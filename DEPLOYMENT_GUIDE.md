# Attendly Production Deployment Guide: Single Vercel Project (Vercel Services)

**Architecture:** Single Vercel Project using **Vercel Services (Public Beta)**.
- **Frontend Service:** Static Vanilla HTML, CSS, and ES Modules (`client/`).
- **Backend Service:** Node.js Express 5 REST API (`backend/`).
- **Database:** MongoDB Atlas Mongoose connection pool.

---

## 1. Architecture & Unified Domain Routing

A single Vercel Project coordinates both the frontend and backend under a unified domain (e.g., `https://YOUR-APP.vercel.app`):

```
                       Request to: https://YOUR-APP.vercel.app
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
             Path: /api/(.*)                       Path: /(.*)
                    │                                     │
                    ▼                                     ▼
           [ Backend Service ]                   [ Frontend Service ]
         root: "backend"                       root: "client"
         entrypoint: "index.js"                static files & index.html
         Express API Serverless                Vanilla JS Hash Router
```

### Key Security & Operational Advantages
1. **First-Party Cookies:** Because frontend and backend share the identical origin (`https://YOUR-APP.vercel.app`), cookies are strictly first-party. Cross-site third-party cookie restrictions (e.g. Safari ITP, Chrome Privacy Sandbox, Incognito modes) no longer block authentication.
2. **Atomic Deployments:** Frontend static pages and backend API endpoints build, deploy, preview, and roll back together atomically.
3. **Stateless Serverless Execution:** Backend functions run independently on Fluid Compute with lazy MongoDB connection pooling and cryptographic HMAC CSRF protection.

---

## 2. Root Configuration: `vercel.json`

The root [`vercel.json`](file:///c:/Users/sumai/OneDrive/Desktop/Problem%202/vercel.json) orchestrates both services:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "services": {
    "frontend": {
      "root": "client",
      "rewrites": [
        {
          "source": "/(.*)",
          "destination": "/index.html"
        }
      ]
    },
    "backend": {
      "root": "backend",
      "entrypoint": "index.js"
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": {
        "service": "backend"
      }
    },
    {
      "source": "/(.*)",
      "destination": {
        "service": "frontend"
      }
    }
  ]
}
```

- **Top-level routing:** `/api/(.*)` routes to the `backend` service (which receives the `/api/...` path directly). All other routes pass to `frontend`.
- **Frontend service-level SPA rewrite:** Unmatched non-file routes inside `client/` rewrite to `/index.html` without intercepting `/api` calls.

---

## 3. Vercel Project & Dashboard Settings

### Prerequisites & Beta Availability
> [!NOTE]
> **Vercel Services** is currently available in **Public Beta** on all Vercel plans (Hobby, Pro, Enterprise). No special waitlist application is required; defining the `"services"` block in `vercel.json` activates multi-service build and routing automatically.

### Dashboard Settings
1. **Create New Project in Vercel:**
   - Link repository.
   - **Root Directory:** `./` (Leave as repository root — do NOT select `backend` or `client`).
   - **Framework Preset:** `Other` (or auto-detected Services).
   - **Build Command:** Leave empty.
   - **Output Directory:** Leave empty.
   - **Node.js Version:** `20.x` or `22.x`.

---

## 4. Environment Variables Specification

Configure the following environment variables in the Vercel Dashboard under **Project Settings > Environment Variables**:

| Variable Name | Required | Value / Recommendation | Notes |
|---|---|---|---|
| `NODE_ENV` | **Yes** | `production` | Enables production cookie flags and Express optimizations. |
| `MONGODB_URI` | **Yes** | `mongodb+srv://<user>:<password>@cluster.mongodb.net/attendly?retryWrites=true&w=majority` | Atlas connection URI including database name. |
| `JWT_SECRET` | **Yes** | High-entropy string (≥ 32 chars) | Signs JWT tokens and HMAC CSRF tokens. |
| `FRONTEND_ORIGINS` | **Yes** | `https://YOUR-APP.vercel.app` | Exact deployment URL (no trailing slash). |
| `COOKIE_SECURE` | **Yes** | `true` | Requires HTTPS for all cookie delivery. |
| `COOKIE_SAME_SITE` | **Yes** | `lax` | Supported because frontend and API share the exact same domain. |
| `COOKIE_NAME` | No | `attendly_auth` | Auth cookie name (default: `attendly_auth`). |
| `COOKIE_MAX_AGE_MS`| No | `900000` | Session lifetime (default: 15 min). |
| `JWT_EXPIRES_IN` | No | `15m` | Token expiration time. |

> [!CAUTION]
> Seed-related variables (`ADMIN_NAME`, `ADMIN_PASSWORD`, `TEACHER_EMAIL`, etc.) are for the local seed script only. Never upload database passwords or administrator accounts to runtime environment variables.

---

## 5. MongoDB Atlas Setup

1. **Network Access / IP Allowlist:**
   - In MongoDB Atlas, go to **Network Access**.
   - Add `0.0.0.0/0` (Allow access from anywhere) because Vercel serverless function instances execute across dynamic IP address pools.
   - Enforce secure access via TLS and a dedicated database user with strong password.
2. **Connection Pooling:**
   - Handled automatically by `backend/src/config/db.js`.
   - Invocations to `/api/health` bypass the database entirely.
   - Database operations connect lazily and reuse warm connection promises.

---

## 6. Frontend API Configuration

`client/js/api.js` evaluates the API endpoint using this priority order:
1. `window.ATTENDLY_API_BASE_URL` (if set).
2. Explicit non-empty `<meta name="attendly-api-base" content="...">`.
3. If `<meta name="attendly-api-base" content="">` is empty (default in production), it resolves `API_BASE_URL` to `""` (empty string). All requests are issued same-origin:
   - `/api/auth/csrf`
   - `/api/auth/me`
   - `/api/attendance`
4. If running locally without a meta tag (e.g. static dev server), it falls back to `http://localhost:4000`.

---

## 7. Step-by-Step Deployment & Live Verification

### Deployment
1. Set the Vercel environment variables as specified in Section 4.
2. Push your changes to Git (or deploy via Vercel CLI: `vercel --prod`).
3. Note your assigned domain: `https://YOUR-APP.vercel.app`.
4. Ensure `FRONTEND_ORIGINS` in Vercel Environment Variables matches `https://YOUR-APP.vercel.app`.

### Verification Steps
- [ ] **Health Endpoint:** Open `https://YOUR-APP.vercel.app/api/health` -> Verify `{ success: true, message: "OK", data: { status: "up" } }` without database dependency.
- [ ] **Frontend Load:** Open `https://YOUR-APP.vercel.app/` -> Verify page loads, stylesheet applies, and login form renders.
- [ ] **Templates:** Confirm dynamic page templates in `pages/*.html` load properly upon login.
- [ ] **CSRF Bootstrap:** Verify `GET /api/auth/csrf` returns `{ success: true, data: { csrfToken: ... } }` and sets the `attendly_csrf` cookie.
- [ ] **Authentication:** Log in with Admin or Teacher account. Inspect DevTools Cookies:
  - `attendly_auth`: `HttpOnly: true`, `Secure: true`, `SameSite: Lax`.
  - `attendly_csrf`: `HttpOnly: false`, `Secure: true`, `SameSite: Lax`.
- [ ] **Session Restoration:** Refresh the browser -> User remains logged in via `/api/auth/me`.
- [ ] **Mutating Requests:** Take attendance or update courses -> Check DevTools Network tab to confirm `x-csrf-token` header is attached and request succeeds.
- [ ] **Log Out:** Click logout -> Cookies are cleared and user is redirected to the login view.
