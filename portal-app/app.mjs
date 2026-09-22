import { randomValue, pkceChallenge, validateConfig, authorizeUrl, logoutUrl, consumePending } from './auth.mjs';

const config = window.SRCO_PORTAL_CONFIG;
const login = document.querySelector('#login');
const logout = document.querySelector('#logout');
const status = document.querySelector('#status');
const dashboard = document.querySelector('#dashboard');
const configured = validateConfig(config, window.location.href);
let accessToken = null; // Never put access/ID/refresh tokens in web storage.

function locked(message) {
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

// STAGING DIAGNOSTIC ONLY: use the genuine ID token from this same sign-in to
// prove that the protected API does not accept an ID token as an access token.
// Send it only to our configured API, never log/store/display token material,
// and never call a failure a pass (network/CORS errors are inconclusive).
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
  } catch {
    locked('Access could not be verified. Sign in again.');
  }
}
initialize();
