# BAC CompraClick redirect E2E test

Playwright test that clicks through the real booking UI on `http://localhost:8080`
until the payment step and asserts `window.location` navigates to the correct
BAC CompraClick deposit URL for the selected service:

- Facials (Organic Facials / Cosmolifting) → `$10` link
- All other treatments → `$20` link

The test intercepts the outbound navigation to `checkout.baccredomatic.com`
so the browser doesn't actually leave the app; only the target URL is
asserted. Test bookings are cleaned up automatically via the service role
after each run.

## Requirements

- Dev server running at `http://localhost:8080` (`bun run dev`).
- Python 3 with `playwright` installed (`pip install playwright` +
  `playwright install chromium`). In the Lovable sandbox these are already
  available.
- `.env` at the repo root with `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (service
  role is only needed for post-run cleanup and is optional — the test still
  passes without it, only skipping the cleanup step).

## Run

```bash
python3 tests/e2e/bac_redirect.py
```

Screenshots for each step are written to `tests/e2e/screenshots/`.
