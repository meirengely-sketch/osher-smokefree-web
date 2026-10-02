# Public link runbook

The public static app is served from the `docs/` folder of the GitHub repository `meirengely-sketch/osher-smokefree-web` by GitHub Pages. It is independent of the production VPS process and survives server restarts. GitHub Pages enforces HTTPS.

Run `python3 check_live.py` to confirm that the public page, JavaScript, stylesheet, research, manifest, and content data return HTTP 200. This checks the link that a visitor opens rather than a local process.

The published static version has the timer, onboarding, evidence milestones, and research document. Background Web Push is explicitly disabled because GitHub Pages has no persistent Node scheduler or subscriber store. The full Node implementation is in the parent workspace. To add background notifications, deploy that implementation behind a durable HTTPS service and verify delivery on an actual phone before enabling the button on the public site.

To update GitHub Pages, change files in `docs/`, publish them to the repository's `main` branch under `docs/`, and rerun the live check. Do not publish server-side `data/` or VAPID private keys.
