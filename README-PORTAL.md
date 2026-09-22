# RD-229 — SRCo / PK-OS portal: staging evidence

**September 22, 2026: authenticated staging demonstration deployed, NOT approved for private data or DNS cutover.** Evidence from owner AWS Console, CloudShell and browser screenshots, not independent direct AWS access. [PR #2](https://github.com/AdaptiveSystemDesign/SRCo/pull/2) remains DRAFT and unmerged.

## Components and authority

- `portal-app/` static public-safe frontend on separate Amplify app `srco-portal-staging`, `https://feature-rd229-portal-ui-prototype.d33c5kcljm6hhd.amplifyapp.com/`, build output `portal-app`. `config.js` contains public client, API and callback identifiers only. Browser uses OAuth authorization-code/PKCE and one-use state; access tokens are held only in memory, not local or session storage.
- `template.yaml`: deployed SAM stack `srco-rd229-staging`, `us-east-1`, invitation-only Cognito Lite with required TOTP MFA, public code-only browser client, JWT-authorized API Gateway HTTP API, Lambda `/session` and exact Cognito subject allowlist. `backend/index.js` checks token use, issuer, client, scope, subject and method. Only two `not_connected` placeholders and `privateDataConnected: false` are returned.
- No private files, document endpoint, databases, PK-OS local runtime, or credentials are connected to static hosting. Keep the root/`www` public website, live `srco` DNS, Proton Mail records and repository visibility unchanged.

## Verified evidence — September 22

- Earlier 17/17 Node helper/backend tests and successful `sam validate --lint`/`sam build` were observed before later diagnostic/reproducibility changes; **not** a current full regression test.
- CloudFormation stack creation and subject-allowlist update reported successful. Invited user completed permanent-password and authenticator setup. Cognito readbacks: enabled/confirmed, registered software-token factor, MFA `ON`, authenticator enabled, invitation-only `true`.
- Authorized browser sign-in displayed placeholders; anonymous `/session` returned `Unauthorized`; invalid bearer token returned HTTP 401. Sign-out and refresh hid dashboard (not proof of immediate server-side JWT revocation).
- Genuine Cognito ID token was rejected by the live `/session` API: staging browser `ID-token rejection test: PASS (HTTP 403)` after commit `9027583`. The result proves refusal, not which layer refused it. No token value was shared.
- Amplify `list-jobs` showed commit `5f13df6d657c35b388cb9d44fc450d2848efefe1` as `SUCCEED`. Live `curl -fsSI` returned HTTP 200 with `strict-transport-security: max-age=86400`, `x-content-type-options: nosniff`, `x-frame-options: DENY`, `referrer-policy: no-referrer`. Root `customHttp.yml` stores matching settings, though header presence alone cannot isolate console versus repository precedence.
- Owner ran pinned `scripts/check-staging-log-retention.sh` read-only; output `PASS: existing staging log group has 30-day retention` for the actual staging Lambda. The live 30-day retention was previously set manually and is **not** CloudFormation-owned. Optional `--apply` has not been run; do not blindly create or import a duplicate log group.

## Expired-token live check — source added, NOT YET VERIFIED

Commit `1b323a2819ef20ddd9342dd93ea7c08872792028` adds a temporary staging-only probe to `portal-app/app.mjs`. On a successful interactive login, it reads the genuine authorized access token's `exp` solely to schedule a single API request at expiry plus 60 seconds, sends that token only to the configured `/session` API, and displays only an HTTP status classification. Tokens remain in the browser tab's memory, never printed or stored. Sign-out cancels the timer and clears the token. Browser tab must remain open roughly one hour; background execution is not guaranteed. An HTTP 401/403 is a live denial; HTTP 200 is an unsafe result; network/CORS/other response is inconclusive. **Do not claim this probe has deployed, run or passed until its commit is shown deployed and a browser result is observed.** Do not share access or ID tokens, passwords, MFA codes or token-bearing URLs in chat or public repo. Remove both temporary diagnostic probes before private-data release.

## Other live authorization gate

A separate *different, genuinely valid, non-allowlisted user's* access-token test is still unperformed. Existing mock tests cover subject rejection, but no second test identity has been authorized. Do NOT temporarily remove or change the owner's allowlist (risk of lockout), create users/resources or export bearer tokens without a separately reviewed plan and explicit approval. In a future safe test, a dedicated second invited user must authenticate with MFA, call only `/session`, and receive denial; preserve one-subject allowlist and never expose secrets.

## Remaining production/release questions

Browser callback-state mismatch end-to-end, session/revocation policy, CSP response-header compatibility, full regression after new commits, future protected endpoint/data-isolation review, log-group infrastructure ownership, and final per-service cost eligibility. Do not merge PR, switch `srco` DNS, connect SRCo private files or expose PK-OS until an explicitly approved release process.

## Billing checkpoint, not an invoice

September 22 pending estimated bill `$0.00`; Credits total `$1,140.00`, estimated used `$0.01`, estimated remaining `$1,139.99`, finalized used `$0.00` as displayed at observation. Visible service rows Bedrock, CloudWatch and Data Transfer reported `$0.00`. The one-cent estimate cannot yet be attributed to a service; AWS bill/credit reports can lag. Final line items, covered services, taxes and cash liability are unresolved. Existing account-wide `$0.50` and `$10` budgets are alerts, not caps. No automatic AWS billing connector or follow-up was established.
