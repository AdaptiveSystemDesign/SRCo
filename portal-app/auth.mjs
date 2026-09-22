// Public, dependency-free OAuth authorization-code + PKCE helpers.
export function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
export function randomValue() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}
export async function pkceChallenge(verifier) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(hash));
}
export function validateConfig(config, here) {
  if (!config || !['domain', 'clientId', 'apiUrl', 'redirectUri'].every(
    key => typeof config[key] === 'string' && config[key].length > 0
  )) return false;
  try {
    const domain = new URL(config.domain);
    const api = new URL(config.apiUrl);
    const redirect = new URL(config.redirectUri);
    return domain.protocol === 'https:' && api.protocol === 'https:' &&
      redirect.protocol === 'https:' &&
      !domain.username && !domain.password && domain.pathname === '/' &&
      !domain.search && !domain.hash &&
      !api.username && !api.password && !api.search && !api.hash &&
      !redirect.username && !redirect.password && !redirect.search && !redirect.hash &&
      redirect.href === new URL(here).origin + new URL(here).pathname &&
      /^[a-z0-9]+$/i.test(config.clientId);
  } catch { return false; }
}
export function authorizeUrl(config, challenge, state) {
  const url = new URL('/oauth2/authorize', config.domain);
  url.search = new URLSearchParams({
    response_type: 'code', client_id: config.clientId,
    redirect_uri: config.redirectUri, scope: 'openid email',
    state, code_challenge: challenge, code_challenge_method: 'S256'
  }).toString();
  return url.href;
}
export function logoutUrl(config) {
  const url = new URL('/logout', config.domain);
  url.search = new URLSearchParams({ client_id: config.clientId, logout_uri: config.redirectUri }).toString();
  return url.href;
}
export function consumePending(store, returnedState, redirectUri, now = Date.now()) {
  const raw = store.getItem('srco-portal-oauth');
  store.removeItem('srco-portal-oauth');
  if (!raw || !returnedState) return null;
  try {
    const pending = JSON.parse(raw);
    if (typeof pending.state !== 'string' || pending.state !== returnedState ||
        typeof pending.verifier !== 'string' || !/^[\w-]{43,128}$/.test(pending.verifier) ||
        pending.redirectUri !== redirectUri ||
        !Number.isFinite(pending.createdAt) || now - pending.createdAt < 0 ||
        now - pending.createdAt > 5 * 60 * 1000) return null;
    return pending.verifier;
  } catch { return null; }
}
