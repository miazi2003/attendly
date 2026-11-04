# Attendly Vercel and Netlify Production Readiness Audit

**Audit date:** 4 November 2026 (Asia/Dhaka)  
**Overall status:** **NOT READY FOR DEPLOYMENT**  
**Audit method:** Source and configuration inspection; limited safe static check attempted. No project files other than this report were modified. No server, browser, seed script, database query, or Git operation was run. The local `backend/.env` contents were not read, and this report does not disclose credentials.

## A. Overall Deployment Readiness

**NOT READY FOR DEPLOYMENT.** The current code has multiple deployment-blocking gaps for the specified split-origin architecture:

1. The production frontend API base is empty by default. `client/js/api.js` then sends `/api/...` requests to the Netlify site, where no API is served.
2. The Vercel entry point exports the Express app without connecting MongoDB. Database connection middleware is not installed until after a request reaches `/api`, but the first such request can connect; however this depends on successful environment initialization. The module-level env parser requires production variables to exist even for the health route and cold start.
3. No `vercel.json` or Vercel Node function declaration was found. Root directory selection and function build behavior have not been established. The app is nested under `backend/` and imports ESM; this must be verified with a real Vercel deployment/build before considering it deployable.
4. Admin users cannot reach admin pages: primary navigation has no role-aware visibility, and the course page link is labelled "My Courses" while APIs allow admins to see all courses. More importantly, admin user provisioning is absent from the app; initial accounts require the seed script or separate database setup.
5. Cross-site cookie auth uses `SameSite=None`, but there is no CSRF defense. Authentication security needs remediation or a deployment design that avoids cross-site cookies.
6. A teacher can create an attendance session for a date that is already archived. The create endpoint only rejects future dates; archive checks occur only on update.

Even after configuration is added, runtime checks are required for Vercel function build/start, Atlas connectivity, cross-origin cookies, and the deployed Netlify site.

## B. Frontend Readiness

| Status | Finding | File | Recommended solution |
|---|---|---|---|
| FAIL | API base defaults to empty outside localhost, causing production API calls to go to the Netlify origin. The meta tag is blank and no build-time injection exists. | `client/js/api.js`, `client/index.html` | Set an explicit production API base at deploy time (for example, via a documented Vercel URL injected into `window.ATTENDLY_API_BASE_URL` or a populated meta value). Confirm it is HTTPS and points to the backend origin. |
| PASS | API calls include `credentials: 'include'`, JSON handling, and user-facing network/API errors. | `client/js/api.js` | Retain; verify cookie behavior on deployed domains. |
| PASS | Startup restores authentication through `/api/auth/me`; logout calls the API and clears client state. | `client/js/app.js`, `client/js/auth.js` | Verify against deployed cookie policy. |
| WARNING | No CSRF token or Origin/Referer validation is used for state-changing requests; cookie-based cross-site auth is enabled by production defaults. | `backend/src/app.js`, `backend/src/config/env.js`, `client/js/api.js` | Add a CSRF defense and validate `Origin` for mutation requests, or use same-site hosting/domain architecture with an appropriate cookie policy. |
| PASS | Hash router accepts direct app hashes and rewrites unrecognized routes to dashboard; hash links do not need server-side SPA rewrites. | `client/js/app.js` | Netlify static hosting is compatible with current hash routes. |
| PASS | Template paths and CSS/assets are relative to the published client root; all nine referenced page templates and SVG assets exist. | `client/js/loader.js`, `client/index.html`, `client/pages/`, `client/assets/` | Deploy `client/` as publish root. Verify a production browser load. |
| WARNING | External Google Fonts and unpkg Lucide script are runtime dependencies; CSP/network availability was not checked. | `client/index.html`, `backend/src/app.js` | Verify production CSP and availability; consider local/pinned assets if external dependency uptime is unacceptable. |
| WARNING | Demo records are imported as initial state before API hydration. Current startup does not reveal the app until authenticated data loads, but residual mock data could become visible if future flow changes. | `client/js/data.js`, `client/js/state.js` | Keep API failure in a clear error/loading state and remove mock initialization for production later. |
| WARNING | Responsive behavior was inspected in CSS only; no browser/device validation occurred. | `client/css/style.css` | Validate key screen widths and supported browsers before release. |
| NOT VERIFIED | Browser module loading, page interactions, console errors, visual layout, and direct-route production behavior. | `client/` | Run browser smoke tests against a deployed preview. |

## C. Backend Readiness

| Status | Finding | File | Recommended solution |
|---|---|---|---|
| PASS | Express app mounts auth, student, semester, course, teacher, attendance, and report routes under `/api`; JSON body limit and Helmet are enabled. | `backend/src/app.js` | Keep route setup; verify function behavior on Vercel. |
| WARNING | `backend/index.js` only exports the Express app. MongoDB connection is lazily initiated by `/api` middleware, while `/api/health` does not require a DB. This may be acceptable in a serverless function, but cold start, concurrent connection reuse, timeout, and failure handling are unverified. | `backend/index.js`, `backend/src/app.js`, `backend/src/config/db.js` | Confirm Vercel handler compatibility and Atlas connection reuse under function concurrency; use a supported function entry/build configuration. |
| FAIL | No Vercel-specific configuration exists; root directory and ESM function bundling are not verified. | repository root, `backend/` | Configure Vercel project Root Directory as `backend`, install/build settings and Node runtime as needed, then deploy a preview and verify function logs. |
| PASS | Environment settings are validated at import, including required database URI, JWT secret length, cookie policy, and exact frontend origins. | `backend/src/config/env.js` | Set all required Vercel variables before first deployment. |
| WARNING | Async controllers use `try/catch` and call `next(error)`; Express 5 is listed. Error middleware returns generic messages for server errors. | `backend/src/controllers/`, `backend/src/middleware/error.js` | Keep generic client errors; add operational logging/monitoring without sensitive values. |
| WARNING | Login limiter is an in-memory `Map`, is per instance, has no cleanup of expired keys, and counts successful requests too. Limits can be bypassed across serverless instances. | `backend/src/middleware/loginRateLimit.js` | Use a shared rate-limit store or provider edge protection; count failed login attempts and bound/expire storage. |
| PASS | Auth middleware verifies signed JWT and fetches active user on each request; role authorization is enforced on write routes. | `backend/src/middleware/auth.js`, `backend/src/routes/` | Add tests for every route/role combination. |
| WARNING | No token revocation/session versioning, password change/reset, MFA, or account-management endpoint is present. Admin and teacher accounts must be provisioned externally/by seed. | `backend/src/controllers/auth.controller.js`, `backend/src/routes/`, `backend/scripts/seed.js` | Plan operational account lifecycle and emergency revocation before institutional use. |
| WARNING | Two routes expose the same teacher list (`/api/teachers` and `/api/courses/teachers`), both admin-only. | `backend/src/app.js`, `backend/src/routes/teacher.routes.js`, `backend/src/routes/course.routes.js` | Remove duplicate route in a code-change task or document one canonical endpoint. |
| PASS | Route methods inspected: auth `POST login`, `GET me`, `POST logout`; students `GET list/detail`, `POST`, `PATCH`, `DELETE`; semesters `GET`, `POST`, `PATCH`, `DELETE`; courses `GET list/detail`, `GET teachers`, `POST`, `PATCH`, `DELETE`; teachers `GET`; attendance `GET list/detail`, `POST`, `PATCH`; reports `GET overview/courses/students/trend`. | `backend/src/routes/*.js` | Add an API contract and automated route/permission tests. |
| NOT VERIFIED | Node runtime version and Vercel function timeout/memory behavior. Package requests Node `>=20`; `backend/package-lock.json` is present. | `backend/package.json` | Pin/configure a supported Vercel Node runtime and validate via deployment logs. |

## D. MongoDB Readiness

| Status | Finding | File | Recommended solution |
|---|---|---|---|
| PASS | Mongoose connects using `MONGODB_URI`; a module-level connection promise is reused within a warm process and reset after connection failure. | `backend/src/config/db.js` | Validate Atlas access from Vercel and monitor pool/connect behavior. |
| PASS | Five models register through imports: User, Student, Semester, Course, Attendance. References and populate paths inspected. | `backend/src/models/`, `backend/src/controllers/` | Add database integration tests against a disposable test database. |
| PASS | Required fields, enums, trimmed strings, schedule validation, unique keys, and indexes are defined. | `backend/src/models/*.js` | Ensure Atlas indexes are created; unique constraints require existing data to be clean. |
| PASS | Duplicate prevention exists for email, student roll, semester name/year, course code/semester, attendance course/date, and duplicate enrollment/records validation. | `backend/src/models/*.js`, controllers | Test duplicate-key behavior against MongoDB. |
| PASS | Course enrollment references are checked for existence and active status when added; attendance requires an exact unique roster. | `backend/src/controllers/course.controller.js`, `backend/src/controllers/attendance.controller.js` | Add lifecycle tests for student/course deactivation and roster edits. |
| WARNING | Attendance archive is a dynamically calculated cutoff, not a monthly archival job or persisted archive flag. The API exposes status derived from date. | `backend/src/utils/attendance.js`, `backend/src/controllers/attendance.controller.js` | Treat archive as a retention/editing policy, or implement a documented archival job if physical archival is required. |
| FAIL | Teacher can create a new session for an old archived date; the creation handler checks only future dates and active course membership. | `backend/src/controllers/attendance.controller.js` | Reject archived dates for teachers at creation; only permit explicit administrator corrections under a logged policy. |
| PASS | Attendance dates and archive cutoff use UTC date storage and `Asia/Dhaka` for institutional today/month boundaries. | `backend/src/utils/attendance.js`, `backend/src/models/Attendance.js` | Test boundary dates around Dhaka midnight/month rollover. |
| WARNING | Dashboard weekday derives from browser-local `new Date().getDay()`, not `Asia/Dhaka`, so displayed "today" schedule can differ for users outside the timezone. | `client/js/state.js`, `client/js/dashboard.js` | Derive the dashboard day in `Asia/Dhaka`, consistent with server rules. |
| WARNING | Database queries and in-memory report aggregation are unpaginated and load all matching attendance sessions. | `backend/src/controllers/attendance.controller.js`, `backend/src/controllers/report.controller.js` | Add pagination/date caps and index/query monitoring before growing data. |
| NOT VERIFIED | Atlas database name, network allowlist, credentials, index state, backups, and recovery procedures. | configured outside source; environment values not read | Set database name explicitly in the secure Atlas URI, allow Vercel egress as appropriate, verify backups/restore, and test privately without putting connection strings in this report. |

## E. Security Readiness

| Status | Finding | File | Recommended solution |
|---|---|---|---|
| PASS | Password hashes use bcrypt; password hash is excluded from default selection and user JSON. | `backend/src/models/User.js`, `backend/src/controllers/auth.controller.js` | Keep hashes and secrets out of logs/responses. |
| PASS | JWT secret is required and at least 32 characters; token is short-lived by default and stored in an HttpOnly cookie. | `backend/src/config/env.js`, `backend/src/controllers/auth.controller.js`, `backend/src/utils/cookies.js` | Use a high-entropy secret and rotate with a planned invalidation procedure. |
| PASS | Production cookie defaults require Secure and SameSite=None for separate Netlify/Vercel origins. | `backend/src/config/env.js`, `backend/src/utils/cookies.js` | Set/verify cookie flags on actual HTTPS deployments. |
| WARNING | Cross-site cookie mode is paired with no CSRF token or mutation-origin validation. Strict CORS alone is not a complete CSRF defense in all browser scenarios. | `backend/src/app.js`, `backend/src/config/env.js` | Add CSRF protections and reject unexpected/missing origins on authenticated writes; verify browser behavior. |
| WARNING | CORS permits requests without an Origin header. This is useful for non-browser clients but is not an authentication control. | `backend/src/app.js` | Keep API authentication mandatory; use CSRF/origin validation specifically for browser mutation requests. |
| PASS | Admin-only management operations and teacher course assignment scoping are enforced in server routes/controllers. | `backend/src/routes/*.js`, `backend/src/utils/attendance.js`, controllers | Verify role matrix with tests; review admin visibility in frontend. |
| FAIL | Admin UI navigation is not role-aware: admin-only page controls are hidden, but sidebar still presents teacher-oriented navigation and profile labeling. Admin can access routes if known, but UI provides no clear admin experience and teacher list/account management is unavailable. | `client/index.html`, `client/js/app.js`, `client/pages/`, `client/js/profile.js` | Provide role-appropriate navigation/profile and account administration or documented provisioning. This is functional/security-administration risk, not server authorization bypass. |
| WARNING | Password login limiter is process-local and counts all attempts; production serverless scaling weakens it. | `backend/src/middleware/loginRateLimit.js` | Add shared rate limiting and alerting. |
| PASS | Zod strict input schemas, ObjectId validation, enum constraints, and bounded JSON body size reduce malformed input and injection exposure. No direct Mongo operator passthrough from arbitrary request objects was found in inspected controllers. | `backend/src/controllers/`, `backend/src/utils/validation.js`, `backend/src/app.js` | Maintain allow-listed request schemas and test injection payloads. |
| NOT VERIFIED | Live secret scanning, deployment secret access, HTTPS response headers, CSP behavior, and penetration testing. | N/A | Run secret scanning and deploy-time security checks without printing secret values. |

## F. Vercel Configuration Readiness

**Status: FAIL / NOT VERIFIED.** `backend/index.js` exists and exports the Express app, but no `vercel.json` was found. Backend package root is nested. The source does not establish how Vercel will build this ESM function, and no deployment was attempted.

Required setup based on current structure:

1. Create a Vercel project for the backend and set **Root Directory** to `backend/`.
2. Use the backend package manager (`package-lock.json`, npm) and Node 20 or newer supported by the selected Vercel runtime.
3. Configure Vercel so `index.js` is deployed as the API function. Add the Vercel function configuration needed for this Express app if auto-detection does not recognize it; verify with a preview deployment rather than assuming the filename is sufficient.
4. Add required environment variables listed in section I for Preview and Production. Set `NODE_ENV=production`, exact Netlify origin in `FRONTEND_ORIGINS`, secure cross-site cookie values, Atlas URI, and a strong JWT secret.
5. Verify `/api/health`, authenticated API requests, cold starts, and function logs. Health only reports process state and does not prove MongoDB connectivity.
6. Set Atlas access policy and confirm connection from deployed Vercel functions.

Do not execute either seed script as part of deployment. They are data mutations even though the included scripts are designed to preserve existing records on insert.

## G. Netlify Configuration Readiness

**Status: READY AFTER CONFIGURATION / NOT RUNTIME VERIFIED.** `client/netlify.toml` sets `publish = "."`; when Netlify's Base Directory is `client`, the publish directory resolves to the client content root. There is no frontend build step or package manifest, which matches the static HTML/CSS/ES-module application.

Set Netlify project configuration:

- **Base directory:** `client`
- **Build command:** leave empty (no build required)
- **Publish directory:** `.` (from `client/netlify.toml`)
- **Functions directory:** none required by current frontend
- Add a production API base at deploy time (required; currently absent/blank). Since no build runs, use a configured deploy-time injection mechanism or update the checked-in meta value in a separately authorized code change.
- Use the resulting exact HTTPS site origin in Vercel `FRONTEND_ORIGINS`.

Hash routing and relative page/assets are compatible with static hosting based on inspection. Verify all nested template fetches after deployment.

## H. Functional Workflow Readiness

| Workflow | Status | Evidence and qualification |
|---|---|---|
| Admin login and restoration | WARNING | Shared cookie JWT and `/me` restoration are implemented. Initial admin must be provisioned outside the application; no admin-account CRUD exists. No runtime login was performed. |
| Teacher login and permissions | PASS (code-inspected) | User active check and server-side assignment scoping exist. Runtime and role-matrix tests not run. |
| Student create/edit/deactivate | PASS (code-inspected) | Admin-only API writes; Mongo persistence and duplicate handling. Not runtime tested. |
| Semester management | PASS (code-inspected) | Admin-only CRUD/deactivation and unique name/year. Not runtime tested. |
| Course create/manage/assignment | PASS (code-inspected) | Admin-only; validates semester, active teacher, student references, duplicate roster and course uniqueness. Not runtime tested. |
| Student enrollment | PASS (code-inspected) | Course's student ID array and admin course editor. Not runtime tested. |
| Attendance create/edit | FAIL | Mongo-backed complete-roster validation and unique course/date index; teacher archive-date create loophole remains. |
| Attendance history | PASS (code-inspected) | Filtered Mongo queries and populated related records. Unpaginated; not runtime tested. |
| Dashboard calculations | WARNING | Statistics/report payloads are calculated from MongoDB attendance. "Today" schedule uses browser timezone; UI subtitle says current semester although overview is not semester-filtered unless requested. |
| Reports and analytics | PASS (code-inspected) | Overview/course/student/trend derived from Mongo records with optional semester/course/date filters. No runtime data comparison performed. |
| CSV export | WARNING | Client-generated course summary export from loaded report data; no server-side export or spreadsheet-injection test. |
| Monthly attendance archiving | WARNING | Status is computed by Dhaka-based two-month cutoff; no monthly archive job/storage. Teacher update is blocked for old sessions, but create loophole fails policy. |
| Admin/Teacher access restrictions | WARNING | Server enforces role and course scope; admin has poor/no dedicated UI and account administration is missing. |

No workflow above was exercised against MongoDB or a browser. “PASS” means code path inspected only.

## I. Required Environment Variables

### Vercel backend runtime

Required by `backend/src/config/env.js`:

- `NODE_ENV=production`
- `MONGODB_URI` — Atlas URI including the intended database name and credentials; configure in Vercel only.
- `JWT_SECRET` — high-entropy random value, at least 32 characters.
- `FRONTEND_ORIGINS` — exact origin(s), comma-separated, e.g. `https://your-site.netlify.app`; no path or trailing slash.
- `COOKIE_SECURE=true`
- `COOKIE_SAME_SITE=none` for separate Netlify/Vercel origins

Optional backend variables with defaults in code:

- `PORT` (default `4000`; generally assigned by platform for a server listener; function deployment may not use it)
- `JWT_EXPIRES_IN` (default `15m`)
- `COOKIE_NAME` (default `attendly_auth`)
- `COOKIE_MAX_AGE_MS` (default `900000`)

### Netlify frontend

- No frontend environment variable is currently read directly. A **production API base URL is required** by the application, but the code only reads `window.ATTENDLY_API_BASE_URL` or the `attendly-api-base` meta tag; neither is configured for production. Provide it through a deploy-time injection/build process or a code configuration change before release.

### Seed-only variables — not Vercel runtime requirements

`backend/scripts/seed.js` requires `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_DEPARTMENT`, `TEACHER_NAME`, `TEACHER_EMAIL`, `TEACHER_PASSWORD`, `TEACHER_DEPARTMENT`, `TEACHER_2_NAME`, `TEACHER_2_EMAIL`, `TEACHER_2_PASSWORD`, `TEACHER_3_NAME`, `TEACHER_3_EMAIL`, and `TEACHER_3_PASSWORD`. These are for manually running the seed script in a controlled environment. Do not add passwords to frontend variables or expose them in logs. The audit did not inspect the ignored `.env` file contents.

## J. Deployment Instructions

These steps are configuration guidance from inspected files; actual deploy success is **not verified**.

### Vercel

1. Import the repository and choose `backend` as the project root directory.
2. Confirm Vercel detects the Node/Express function from `index.js`; if it does not, add supported function configuration before relying on deployment.
3. Set Node runtime to a supported Node 20+ version.
4. Add the runtime environment variables in section I for Preview and Production.
5. Set `FRONTEND_ORIGINS` to the exact HTTPS Netlify production origin. For preview deployments, separately add the exact preview origin if login is needed there.
6. Deploy a preview and check `/api/health`, then verify DB-backed endpoints and auth cookie behavior with test accounts/data.
7. Check Vercel logs for function errors and ensure no secrets are logged.

### Netlify

1. Import the same repository as a separate Netlify site.
2. Set Base directory to `client`, leave Build command empty, and set Publish directory to `.` (matches `client/netlify.toml`).
3. Configure the frontend API base to the deployed Vercel origin. The current project does not provide a working production value; release is blocked until supplied.
4. Deploy a preview and confirm all templates, CSS, SVGs, fonts/icons, API calls, direct hash links, and login session restoration work.
5. Update Vercel `FRONTEND_ORIGINS` with the exact final production Netlify origin, then redeploy backend.

## K. Final Checklist

- [ ] Configure production frontend API base to Vercel URL.
- [ ] Establish and verify Vercel root/function build configuration for nested ESM backend.
- [ ] Configure Vercel Node runtime and all runtime environment variables.
- [ ] Configure exact Netlify origin in Vercel CORS allowlist.
- [ ] Add CSRF or mutation-origin protection for cross-site cookie authentication.
- [ ] Fix teacher creation of archived attendance sessions.
- [ ] Provide admin account provisioning and a usable role-aware admin experience.
- [ ] Use a shared login limiter suitable for serverless instances.
- [ ] Confirm Atlas database name, access restrictions, indexes, backups, and restore process.
- [ ] Run syntax/dependency checks in a trusted local Node/npm environment; the attempted `npm run check` was blocked by local NVM security policy before execution.
- [ ] Deploy preview sites and test login, logout, refresh restoration, CRUD, attendance, archive boundaries, reports, CSV, and role restrictions with non-production data.
- [ ] Verify mobile layout, browser console/network errors, production cookies, and security headers.
- [ ] Do not run seed scripts against production without a separately reviewed, deliberate data plan.

## Can this be safely deployed right now?

**No.** First configure the production API URL and Vercel function/root/runtime, add the required production environment variables, implement CSRF/origin protection, and close the archived-date attendance creation loophole. Then validate the deployment with a preview environment and non-production data. The audit did not establish live Atlas connectivity, deployed cookie behavior, or successful Vercel/Netlify builds.

---

**Audit evidence classification:** PASS/FAIL/WARNING are code-inspection findings. Anything requiring execution, external provider state, credentials, browser access, or database access is explicitly marked **NOT VERIFIED**. No application code or deployment configuration was changed during the audit; only this audit report was written.
