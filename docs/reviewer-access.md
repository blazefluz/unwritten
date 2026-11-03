# Six-run submission access

The public site keeps saved examples open to everyone. A private reviewer code
unlocks **six accepted video analyses total**, shared across all people using it.
Entering the code does not spend a run. After the sixth acceptance the code is
exhausted; signing out, a new browser, redeploying or restarting cannot replenish
it. Re-review, decision tests and guide-proposal APIs remain local-only and cannot
bypass the cap. No model changes: live analyses still use Meta Muse Spark.

Each accepted request counts even if Meta or the server later fails. Invalid
credentials, invalid form fields and rejected/corrupt/overlong MP4s do not count.
Reviewer uploads are limited to 25 MB, two minutes, and a 28 MB total request.
This bounds runs, not an exact dollar spend. Model SDK retries can occur within a
run. Uploads are sent to Meta under the normal analysis flow; the Meta Files upload
expires after seven days. Temporary hosted run files are removed after the request.

## Deployment settings (private environment variables only)

- Keep `UNWRITTEN_DEMO_ONLY=true` to block every other public server operation.
- Set `JUDGE_LIVE_ENABLED=true` only after testing the gate.
- `JUDGE_ACCESS_CODE`: a randomly generated code at least 24 characters long.
- `DATABASE_URL`: the same-region Render Postgres **internal** connection URL.
- `MODEL_API_KEY`: the existing Meta key, never a `NEXT_PUBLIC_` variable.
- Render supplies `RENDER_EXTERNAL_URL` for same-origin verification.

The code is sent only to `/api/access`, over HTTPS in production. A short-lived,
HttpOnly, Secure, SameSite=Strict signed cookie enables uploads. Code hashes and
usage reservations live in Postgres; the raw code, videos and reference contents
do not. Wrong code entry is separately throttled. Reservations lock the grant row
inside a transaction so concurrent requests cannot exceed six. A request UUID
prevents a retry from running twice. Storage errors fail closed.

Free Render Postgres expires December 2, 2026 for this pilot. If unavailable,
access stays locked; it does not silently create a fresh allowance. Plan a durable
migration if judging or use extends beyond the free database's lifetime. Database
replacement or administrator code rotation is an explicit new grant, not recovery
of the old allowance; never describe it as preserving used runs.

## Verification

`node scripts/test-judge-access.mjs` uses a disposable local Postgres database,
fake credentials and no Meta calls. It checks invalid/tampered/expired sessions,
cross-origin rejection, duplicate requests, 12 concurrent reservations against five
remaining slots, exhaustion, reconnection persistence and disabled-mode rejection.
Requires local Postgres tools and a Node version supporting TypeScript stripping.
The script creates and drops only its uniquely named test database.

Local production-route checks additionally verified anonymous rejection, code
unlock, invalid MP4 rejection before quota reservation, and six remaining runs.
The browser verified code entry, remaining-count display, and disabled non-video
paid tools. An actual live-provider request must be tested separately on Render;
use a setup-only code, then provision the final submission code with all six uses
and disclose that this creates a new grant. Keep the final code in a private
submission note, outside Git and public screenshots.
