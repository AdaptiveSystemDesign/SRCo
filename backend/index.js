'use strict';

// API Gateway's JWT authorizer validates signature, issuer, audience, expiration,
// and the route's `openid` scope BEFORE Lambda is invoked. These checks are
// independent, fail-closed defense in depth; don't invoke this Lambda publicly.
exports.handler = async function handler(event) {
  const claims = event?.requestContext?.authorizer?.jwt?.claims;
  const subject = process.env.ALLOWED_SUBJECT || '';
  const issuer = process.env.EXPECTED_ISSUER || '';
  const clientId = process.env.EXPECTED_CLIENT_ID || '';
  const scope = typeof claims?.scope === 'string' ? claims.scope.split(/\s+/) : [];
  const authorized = Boolean(
    subject && issuer && clientId &&
    event?.requestContext?.http?.method === 'GET' &&
    claims?.token_use === 'access' &&
    claims?.iss === issuer &&
    claims?.client_id === clientId &&
    claims?.sub === subject &&
    scope.includes('openid')
  );
  return {
    statusCode: authorized ? 200 : 403,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(authorized
      ? { authorized: true, workspaces: [
          { id: 'srco', title: 'SRCo', status: 'not_connected' },
          { id: 'pkos', title: 'PK-OS', status: 'not_connected' }
        ], privateDataConnected: false }
      : { authorized: false, error: 'access_denied' })
  };
};
