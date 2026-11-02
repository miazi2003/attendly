const loopbackHosts = new Set(['localhost', '127.0.0.1']);
const localDefault = loopbackHosts.has(window.location.hostname) ? `${window.location.protocol}//${window.location.hostname}:4000` : '';
const configuredBase = window.ATTENDLY_API_BASE_URL || document.querySelector('meta[name="attendly-api-base"]')?.content || localDefault;
const configuredUrl = configuredBase ? new URL(configuredBase, window.location.href) : null;
if (configuredUrl && loopbackHosts.has(configuredUrl.hostname) && loopbackHosts.has(window.location.hostname)) configuredUrl.hostname = window.location.hostname;
const API_BASE_URL = configuredUrl ? configuredUrl.origin.replace(/\/$/, '') : '';
let unauthorizedNotified = false;

export class ApiError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
  } catch {
    throw new ApiError('Unable to reach the server. Check your connection and try again.', 0, 'NETWORK_ERROR');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && body?.error?.code === 'UNAUTHENTICATED' && !unauthorizedNotified) {
      unauthorizedNotified = true;
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    throw new ApiError(body?.error?.message || 'The request could not be completed.', response.status, body?.error?.code);
  }
  unauthorizedNotified = false;
  return body?.data;
}
