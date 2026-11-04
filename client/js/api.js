const loopbackHosts = new Set(['localhost', '127.0.0.1']);
const metaTag = document.querySelector('meta[name="attendly-api-base"]');
const metaBase = metaTag ? metaTag.content.trim() : null;
const windowBase = typeof window !== 'undefined' && window.ATTENDLY_API_BASE_URL ? window.ATTENDLY_API_BASE_URL.trim() : null;

// Determine configured base URL:
// 1. Explicit window.ATTENDLY_API_BASE_URL (if provided)
// 2. Explicit non-empty meta tag content
// 3. Fallback to :4000 ONLY if running on loopback (localhost / 127.0.0.1) AND no meta tag explicitly set
// 4. Otherwise default to '' (empty string) for same-origin requests (e.g. on Vercel)
let rawBase = '';
if (windowBase) {
  rawBase = windowBase;
} else if (metaBase) {
  rawBase = metaBase;
} else if (!metaTag && typeof window !== 'undefined' && loopbackHosts.has(window.location.hostname)) {
  rawBase = `${window.location.protocol}//${window.location.hostname}:4000`;
}

const configuredUrl = rawBase ? new URL(rawBase, window.location.href) : null;
if (configuredUrl && loopbackHosts.has(configuredUrl.hostname) && loopbackHosts.has(window.location.hostname)) {
  configuredUrl.hostname = window.location.hostname;
}
const API_BASE_URL = configuredUrl ? configuredUrl.origin.replace(/\/$/, '') : '';
let unauthorizedNotified = false;
let activeCsrfToken = null;

export class ApiError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

function readCookie(name) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(^|;\\s*)(${name})=([^;]*)`));
  return match ? decodeURIComponent(match[3]) : null;
}

export function setCsrfToken(token) {
  activeCsrfToken = token;
}

export function clearCsrfToken() {
  activeCsrfToken = null;
}

export async function fetchCsrfToken() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/csrf`, {
      method: 'GET',
      credentials: 'include'
    });
    if (response.ok) {
      const body = await response.json().catch(() => null);
      if (body?.data?.csrfToken) {
        activeCsrfToken = body.data.csrfToken;
        return activeCsrfToken;
      }
    }
  } catch {
    // If fetch fails, will fallback to cookie or retry
  }
  return null;
}

export async function getCsrfToken() {
  if (activeCsrfToken) return activeCsrfToken;
  const cookieVal = readCookie('attendly_csrf');
  if (cookieVal) {
    activeCsrfToken = cookieVal;
    return activeCsrfToken;
  }
  return await fetchCsrfToken();
}

export async function api(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  const headers = { 'Content-Type': 'application/json', ...options.headers };

  if (isStateChanging) {
    let token = await getCsrfToken();
    if (token) {
      headers['x-csrf-token'] = token;
    }
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers
    });
  } catch {
    throw new ApiError('Unable to reach the server. Check your connection and try again.', 0, 'NETWORK_ERROR');
  }

  let body = await response.json().catch(() => null);

  // If CSRF token is invalid or missing, attempt one retry after fetching fresh token
  if (!response.ok && response.status === 403 && (body?.error?.code === 'CSRF_INVALID' || body?.error?.code === 'CSRF_MISSING') && isStateChanging) {
    const freshToken = await fetchCsrfToken();
    if (freshToken) {
      headers['x-csrf-token'] = freshToken;
      try {
        response = await fetch(`${API_BASE_URL}${path}`, {
          ...options,
          credentials: 'include',
          headers
        });
        body = await response.json().catch(() => null);
      } catch {
        throw new ApiError('Unable to reach the server. Check your connection and try again.', 0, 'NETWORK_ERROR');
      }
    }
  }

  if (!response.ok) {
    if (response.status === 401 && body?.error?.code === 'UNAUTHENTICATED' && !unauthorizedNotified) {
      unauthorizedNotified = true;
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    throw new ApiError(body?.error?.message || 'The request could not be completed.', response.status, body?.error?.code);
  }
  unauthorizedNotified = false;

  if (body?.data?.csrfToken) {
    activeCsrfToken = body.data.csrfToken;
  }

  return body?.data;
}
