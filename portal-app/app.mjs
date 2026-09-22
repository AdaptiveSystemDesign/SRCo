import { randomValue, pkceChallenge, validateConfig, authorizeUrl, logoutUrl, consumePending } from './auth.mjs';

const config = window.SRCO_PORTAL_CONFIG;
const login = document.querySelector('#login');
const logout = document.querySelector('#logout');
const status = document.querySelector('#status');
const dashboard = document.querySelector('#dashboard');
const configured = validateConfig(config, window.location.href);
let accessToken = null; // Never put access/ID/refresh tokens in web storage.
let expiryTimer = null;
let accessTokenExpiresAt = null;

function locked(message) {
  if (expiryTimer !== null) window.clearTimeout(expiryTimer);
  expiryTimer = null;
  accessTokenExpiresAt = null;
  accessToken = null;
  dashboard.hidden = true;
  logout.hidden = true;
  login.hidden = !configured;
  status.textContent = message;
}
async function loadSession(token) {
  const response = await fetch(new URL('/session', config.apiUrl), {
    method: 'GET', headers: { Authorization: `Bearer ${token}` },
    credentials: 'omit', cache: 'no-store'
  });
  if (!response.ok) throw new Error('Access denied by the private API.');
  const result = await response.json();
  if (result?.authorized !== true || result?.privateDataConnected !== false ||
      !Array.isArray(result.workspaces) || result.workspaces.length !== 2) {
    throw new Error('Unexpected response from the private API.');
  }
  accessToken = token;
  dashboard.hidden = false;
  login.hidden = true;
  logout.hidden = false;
  status.textContent = 'Signed in. Both workspaces are placeholders; no private data is connected.';
}

// STAGING DIAGNOSTIC ONLY: send the genuine ID token only to our own API;
// never log, store or display token material. Network errors are inconclusive.
async function checkIdTokenRejection(idToken) {
  if (typeof idToken !== 'string' || !idToken) {
    status.textContent += ' ID-token rejection test: NOT RUN (no ID token returned).';
    return;
  }
  let code;
  try {
    const response = await fetch(new URL('/session', config.apiUrl), {
      method: 'GET', headers: { Authorization: `Bearer ${idToken}` },
      credentials: 'omit', cache: 'no-store'
    });
    code = response.status;
  } catch {
    status.textContent += ' ID-token rejection test: INCONCLUSIVE (network or CORS error).';
    return;
  }
  if (code === 401 || code === 403) {
    status.textContent += ` ID-token rejection test: PASS (HTTP ${code}).`;
  } else if (code === 200) {
    locked('SECURITY CHECK FAILED: API accepted an ID token. Do not use this staging portal.');
  } else {
    status.textContent += ` ID-token rejection test: INCONCLUSIVE (HTTP ${code}).`;
  }
}

// STAGING DIAGNOSTIC ONLY: wait until a previously authorized genuine access
// token is expired, then send it to our own /session route. Token remains in
// this tab's memory, not storage, logs, screenshots or chat. JWT exp only
// schedules the probe; it is not used as proof of authorization.
function scheduleExpiredTokenProbe(token) {
  let expiresAt;
  try {
    const encoded = token.split('.')[1];
    const claims = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')));
    expiresAt = claims.exp * 1000;
    if (!Number.isSafeInteger(claims.exp) || !Number.isSafeInteger(expiresAt) ||
        expiresAt <= Date.now() || expiresAt > Date.now() + 2 * 60 * 60 * 1000) {
      throw new Error('Invalid expiration');
    }
  } catch {
    status.textContent += ' Expired-token rejection test: NOT RUN (expiration unavailable).';
    return;
  }

  accessTokenExpiresAt = expiresAt;
  const probeAt = expiresAt + 60 * 1000; // Account for clock skew/boundary effects.
  status.textContent += ` Expired-token rejection test: PENDING (keep this tab open until ${new Date(probeAt).toLocaleTimeString()}).`;
  async function runProbe() {
    expiryTimer = null;
    if (!accessToken || accessTokenExpiresAt !== expiresAt) return;
    if (Date.now() < probeAt) {
      // If the browser clock moved backwards, reschedule instead of trying
      // a potentially still-valid token and misreporting the test.
      expiryTimer = window.setTimeout(runProbe, probeAt - Date.now());
      return;
    }
    let code;
    try {
      const response = await fetch(new URL('/session', config.apiUrl), {
        method: 'GET', headers: { Authorization: `Bearer ${accessToken}` },
        credentials: 'omit', cache: 'no-store'
      });
      code = response.status;
    } catch {
      locked('Session expired. Expired-token rejection test: INCONCLUSIVE (network or CORS error).');
      return;
    }
    if (accessTokenExpiresAt !== expiresAt) return; // Signed out while requesting.
    if (code === 401 || code === 403) {
      locked(`Session expired. Expired-token rejection test: PASS (HTTP ${code}). Sign in again to continue.`);
    } else if (code === 200) {
      locked('SECURITY CHECK FAILED: API accepted an expired access token. Do not use this staging portal.');
    } else {
      locked(`Session expired. Expired-token rejection test: INCONCLUSIVE (HTTP ${code}).`);
    }
  }
  expiryTimer = window.setTimeout(runProbe, Math.max(0, probeAt - Date.now()));
}

login.addEventListener('click', async () => {
  if (!configured) return;
  login.disabled = true;
  try {
    const verifier = randomValue();
    const state = randomValue();
    const challenge = await pkceChallenge(verifier);
    sessionStorage.setItem('srco-portal-oauth', JSON.stringify({
      verifier, state, redirectUri: config.redirectUri, createdAt: Date.now()
    }));
    window.location.assign(authorizeUrl(config, challenge, state));
  } catch {
    locked('Could not start sign-in. Try again.');
    login.disabled = false;
  }
});
logout.addEventListener('click', () => {
  locked('Signed out of this page.');
  sessionStorage.removeItem('srco-portal-oauth');
  if (configured) window.location.assign(logoutUrl(config));
});

async function initialize() {
  if (!configured) {
    locked('Portal is not configured. Access remains disabled.');
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');
  if (!code && !error) {
    locked('Sign in to request access.');
    return;
  }
  // Remove the short-lived authorization code from browser history immediately.
  window.history.replaceState(null, '', window.location.pathname);
  if (error || !code) {
    sessionStorage.removeItem('srco-portal-oauth');
    locked('Sign-in was not completed.');
    return;
  }
  const verifier = consumePending(sessionStorage, state, config.redirectUri);
  if (!verifier) {
    locked('Sign-in validation failed. Please start again.');
    return;
  }
  status.textContent = 'Checking your access…';
  try {
    const reply = await fetch(new URL('/oauth2/token', config.domain), {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      credentials: 'omit', cache: 'no-store',
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: config.clientId,
        code, code_verifier: verifier, redirect_uri: config.redirectUri })
    });
    if (!reply.ok) throw new Error('Token exchange failed.');
    const tokens = await reply.json();
    if (tokens.token_type?.toLowerCase() !== 'bearer' ||
        typeof tokens.access_token !== 'string' || !tokens.access_token) {
      throw new Error('Invalid token response.');
    }
    await loadSession(tokens.access_token);
    await checkIdTokenRejection(tokens.id_token);
    if (accessToken) scheduleExpiredTokenProbe(accessToken);
  } catch {
    locked('Access could not be verified. Sign in again.');
  }
}
initialize();
