# Free Render demo

The Dockerfile packages Next.js and the Python bridge. Deploy the public GitHub
repository as a Docker Web Service, branch `claude/prediction-player`, repository
root, Free ($0) compute, Dockerfile `./Dockerfile`. Render supplies `PORT`.
No secrets or API keys are required for the public demo.

The image defaults to `UNWRITTEN_DEMO_ONLY=true`. By default all POST API operations are
rejected even with a loopback Host header or an accidentally configured Meta key.
The explicit reviewer-access gate can enable only bounded video analysis; see
[the six-run access design](reviewer-access.md).
The status endpoint reports ready=false. Visitors can replay the attributed CC BY
repair video, inspect actual saved Meta output, explore supplied examples, edit
browser drafts and export files. Server analysis, rule checks, freezes and scoring
remain local-only. The public demo is not a multi-user backend.

Keep demo mode enabled on an internet-facing service: the other API guard is
intended for loopback development, not public authentication. The reviewer mode adds separate authentication, upload limits and durable usage
accounting for video analysis only. Other server tools remain local-only.
Keep MODEL_API_KEY server-side and out of the Docker build context, Git and client
bundles. No Meta credential has been sent to Render for this deployment.

Free Render instances sleep after idle periods and have ephemeral filesystems.
Export drafts/results; browser drafts are per device. This deployment does not
promise permanent server storage. See https://render.com/docs/free.

Verification: production build and typecheck, 51 offline Python tests, browser
video playback/event selection/details/example navigation/export, and rejection
of all four POST APIs in demo mode. Docker daemon was unavailable locally; the
actual container build must additionally be verified in Render's build logs.

## First deployment verified

Live URL: https://unwritten-demo.onrender.com
Service: `srv-dbkl0enf3r2c73f6rpd0`; initial deployed commit: `85ac8c8`.
Render's container build succeeded. Public `/api/status` returned HTTP 200 with
`demoOnly=true, ready=false`; all four POST endpoints returned 403. The public
MP4 returned HTTP 200 and played in the browser; selecting e4 sought to 9.5s.
No credentials were supplied to Render and the selected instance is Free ($0).
Public-repository deployments are manual; after pushing changes, use Manual
Deploy → Deploy latest commit in the Render dashboard.
