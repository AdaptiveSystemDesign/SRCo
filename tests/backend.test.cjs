'use strict';
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { handler } = require('../backend/index.js');
const good = () => ({ requestContext: { http: { method: 'GET' }, authorizer: { jwt: { claims: {
  iss: 'https://issuer.example', client_id: 'app123', sub: 'owner123', token_use: 'access', scope: 'openid email'
} } } } });
const configure = () => {
  process.env.ALLOWED_SUBJECT = 'owner123';
  process.env.EXPECTED_ISSUER = 'https://issuer.example';
  process.env.EXPECTED_CLIENT_ID = 'app123';
};
afterEach(() => ['ALLOWED_SUBJECT', 'EXPECTED_ISSUER', 'EXPECTED_CLIENT_ID'].forEach(k => delete process.env[k]));
test('missing allowlist denies by default', async () => assert.equal((await handler(good())).statusCode, 403));
test('valid gateway claims plus exact allowlisted owner gives placeholders only', async () => {
  configure(); const r = await handler(good()); assert.equal(r.statusCode, 200);
  assert.equal(JSON.parse(r.body).privateDataConnected, false);
  assert.deepEqual(JSON.parse(r.body).workspaces.map(w => w.status), ['not_connected', 'not_connected']);
  assert.equal(r.headers['cache-control'], 'no-store');
});
test('missing claims denies', async () => { configure(); assert.equal((await handler({})).statusCode, 403); });
test('different subject denies', async () => { configure(); const e = good(); e.requestContext.authorizer.jwt.claims.sub = 'someone-else'; assert.equal((await handler(e)).statusCode, 403); });
test('ID token denies', async () => { configure(); const e = good(); e.requestContext.authorizer.jwt.claims.token_use = 'id'; assert.equal((await handler(e)).statusCode, 403); });
test('wrong issuer denies', async () => { configure(); const e = good(); e.requestContext.authorizer.jwt.claims.iss = 'https://other.example'; assert.equal((await handler(e)).statusCode, 403); });
test('wrong client denies', async () => { configure(); const e = good(); e.requestContext.authorizer.jwt.claims.client_id = 'other'; assert.equal((await handler(e)).statusCode, 403); });
test('missing scope denies', async () => { configure(); const e = good(); e.requestContext.authorizer.jwt.claims.scope = 'email'; assert.equal((await handler(e)).statusCode, 403); });
test('unexpected HTTP method denies', async () => { configure(); const e = good(); e.requestContext.http.method = 'POST'; assert.equal((await handler(e)).statusCode, 403); });
