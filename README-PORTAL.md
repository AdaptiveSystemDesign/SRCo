# RD-229 — SRCo / PK-OS portal: staging record

**Status (2026-09-22): staging UI and authenticated placeholder API deployed; NOT a private-data service.** The operational observations below come from the project owner's AWS Console, CloudShell and browser screenshots or confirmations, not an independent AWS account audit. PR #2 stays DRAFT and unmerged; no live DNS change or private-data connection is authorized by this record.

## Source and deployed components

- Branch `feature/rd229-portal-ui-prototype`, draft PR #2 targeting `main`. The original root website, `CNAME` and current `srco.adaptivesystemdesign.com` DNS must not change.
- `portal-app/`: publicly retrievable static frontend hosted separately by Amplify app `srco-portal-staging`, at `https://feature-rd229-portal-ui-prototype.d33c5kcljm6hhd.amplifyapp.com/`; configured output directory `portal-app`. Cognito authorization code + PKCE, one-use state, five-minute pending-auth expiry, in-memory access token, no persisted access token. Dashboard remains hidden until `/session` approves.
- `portal-app/config.js` contains *public* Cognito/API/callback identifiers only; populated on the feature branch in commit `79652078a19f692abea59f01d24f554170b3b1bb`. No secret, real token, password, research data or PK-OS file belongs in static hosting or this public repository.
- `template.yaml` is source for deployed SAM stack `srco-rd229-staging` in `us-east-1`: invitation-only Cognito Lite pool requiring TOTP MFA, OAuth code-only public client, JWT-authorized HTTP API, Lambda `/session`, exact Cognito `sub` allowlist. Initially denied everyone until explicitly updated with the authorized subject. The code exposes no document endpoints, databases or PK-OS connectivity.
- `backend/index.js` checks trusted authorizer claims, token use, issuer, client, scope, method and allowlisted subject. Authorized responses contain two `not_connected` placeholders and `privateDataConnected: false`; unauthorised contexts fail closed.

## Evidence classification — verified staging observations

**Observed September 22 (owner screenshots/confirmations):**
- Original Node 22 helper/backend tests were 17/17 passing. CloudShell chained `npm test`, `sam validate --lint` and `sam build`, and displayed `Build Succeeded` before the initial stack deployment. These do not independently verify later source changes.
- CloudFormation stack creation and subsequent allowed-subject deployment reported success. The allowlist changeset modified `PortalApi` and `PortalSession` with no additions, deletions or replacements.
- Invited user changed the temporary password and set up TOTP. Cognito readbacks: enabled, confirmed, `SOFTWARE_TOKEN` factor registered, pool MFA `ON`, authenticator enabled, admin-only creation `true`. Do not copy the person's email or `sub` into this public record.
- Authenticated browser sign-in displayed placeholders; anonymous `GET /session` returned `Unauthorized`; malformed bearer token returned HTTP 401; sign-out and refresh hid the dashboard. Browser sign-out does NOT establish immediate revocation of issued JWTs.
- **Live genuine ID-token challenge: PASS, HTTP 403** (owner screenshot of the staging diagnostic after commit `9027583` deployed). The ID token was sent solely to configured `/session`; no token value was recorded. This proves end-to-end refusal, but not which layer (gateway or Lambda) rejected it. The diagnostic in `portal-app/app.mjs` is staging-only and must be removed before private-data release.
- Original Amplify console header configuration was redeployed and `curl -sSI` returned HTTP 200 plus HSTS `max-age=86400`, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`. HTML contains a meta CSP; an HTTP CSP header remains unreviewed.
- The single identified Lambda log group initially had `retentionInDays: null`. Owner applied 30-day retention and reported exact readback `30`. This is a verified MANUAL AWS setting, not a CloudFormation-managed resource.

**Source changes after those runtime observations (not yet revalidated in AWS):**
- Root `customHttp.yml` now captures exactly the four verified headers on the isolated feature branch. AWS Amplify gives root `customHttp.yml` precedence over console-defined headers. A new Amplify build must deploy this commit and the actual HTTP responses must be rechecked; committing this file does not itself prove current deployment or header precedence.
- `scripts/check-staging-log-retention.sh` is a proposed reproducibility guard. It resolves the current Lambda physical ID from the existing staging CloudFormation stack, requires an exact existing log group, and checks retention **read-only by default**. `--apply` is an explicit 30-day reconciliation action, not run automatically. The script has not been executed or proven against live AWS.
- No new log group resource was added to `template.yaml`: the group already exists and a blind `AWS::Logs::LogGroup` declaration would risk an already-exists conflict. Managed adoption/import requires separate design and reviewed CloudFormation import, not a guessed redeploy.

## Reproducible staging hardening: operator procedure

1. Inspect the feature branch and confirm the targeted Amplify app is `srco-portal-staging`, output `portal-app`, not the public root website. A feature-branch commit may trigger an automatic staging build. Confirm that build reports **Deployed** before declaring source-header deployment complete.
2. Verify actual HTTP headers after the build; do not assume the YAML took effect:

   ```bash
   curl -sSI https://feature-rd229-portal-ui-prototype.d33c5kcljm6hhd.amplifyapp.com/ | grep -Ei '^(HTTP/|strict-transport-security:|x-content-type-options:|x-frame-options:|referrer-policy:)'
   ```

   Require HTTP 200 and the four exact values listed above. If missing or changed, stop and investigate the Amplify build, console/root precedence and monorepo configuration. Do not modify DNS.
3. In a checked-out feature-branch working directory using the intended authenticated AWS session, inspect the existing log group **without changing AWS**:

   ```bash
   bash scripts/check-staging-log-retention.sh
   ```

   Expected `PASS` and 30 days. If it reports DRIFT, investigate why (including stack identity). Only with owner approval and verified target, run `bash scripts/check-staging-log-retention.sh --apply`, which changes retention only on the *existing* named group and reads it back. Do not create, replace or import a log group automatically.
4. Before any separately authorized SAM redeployment, rerun `npm test`, `sam validate --lint`, and `sam build`; inspect the exact changeset and preserve all current staging parameters, particularly the protected allowed-subject value. `AllowedSubject` defaults to empty and would deny all if accidentally dropped. Do not publish that value to public repository material. New resources, private services, DNS, or PR merge need separate authorization.

This procedure is **not** an automatically enforced IaC guarantee. A verified post-commit Amplify deployment and execution of the new read-only retention check are still outstanding.

## Remaining security release gates

- A genuine other-user access token must be denied; a genuinely expired access token must be denied. Unit tests simulate subject mismatch and JWT authorizer is configured to check expiry, but neither live case is established. Additional test users, real-token handling or automation require an approved safe plan, and secrets must never be pasted into chat or GitHub.
- Browser callback-state mismatch is covered by helper tests but not separately shown live. Reassess JWT revocation/sign-out requirements, HTTP CSP compatibility and final permissions, then remove the staging-only ID-token diagnostic before any private-data release.
- Preserve verified headers and retention on future changes using the procedure above; log-group CloudFormation import/adoption remains unresolved.

## Cost checkpoint and authority boundary

Owner September 22 billing screenshots showed September's **pending estimated grand total $0.00**, Credits *total amount remaining* `$1,140.00`, *total used* `$0.00`, **estimated** remaining `$1,139.99` and **estimated** used `$0.01`. Visible expanded Bedrock, CloudWatch and Data Transfer entries showed `$0.00`; the single cent has **not** been attributed to a particular service. Bills and credits can update later; no final service-by-service costs, taxes or out-of-pocket guarantee has been established. Existing $0.50 and $10 account-wide AWS budgets send alerts, not spending caps. No automatic AWS billing access or scheduled check was successfully established.

The independently migrated public `adaptivesystemdesign.com` and `www` are not staging targets. Preserve existing `srco` DNS, public root site and mail records, keep PR #2 draft/unmerged, and leave all private SRCo data and PK-OS runtime disconnected. No production domain cutover, repo privacy change, private endpoints, or runtime remote access is authorized by this staging milestone.
