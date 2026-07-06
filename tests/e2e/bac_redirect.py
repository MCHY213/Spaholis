"""
Playwright E2E: click through the booking UI until the deposit-payment step
and assert `window.location` navigates to the correct BAC CompraClick URL
for the selected service.

Covers both routing branches in `src/lib/bacLinks.ts`:
  - Facials (Organic Facials / Cosmolifting) → $10 link
  - All other paid treatments               → $20 link

External navigations to `checkout.baccredomatic.com` are intercepted so the
browser never actually leaves the app; the intercepted request URL is what
we assert against. Test bookings are cleaned up after each run when a
service-role key is available.

Run:  python3 tests/e2e/bac_redirect.py
"""

import asyncio
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path
from playwright.async_api import async_playwright, Route


HERE = Path(__file__).parent
SCREENSHOTS = HERE / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# .env loader (tiny — avoids adding python-dotenv as a hard dep)
# ---------------------------------------------------------------------------
def load_env():
    env_path = HERE.parent.parent / ".env"
    if not env_path.exists():
        return
    for raw in env_path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip().strip('"').strip("'")
        os.environ.setdefault(k.strip(), v)


load_env()

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

BAC_HOST = "checkout.baccredomatic.com"
BAC_LINK_10_PREFIX = "/YTNjNzIu"  # matches src/lib/bacLinks.ts BAC_LINK_10
BAC_LINK_20_PREFIX = "/Ni42NjEx"  # matches src/lib/bacLinks.ts BAC_LINK_20


# One representative per bookable treatment category (see supabase
# `services` table). Every category active on the booking funnel is covered
# so a routing regression in `src/lib/bacLinks.ts` — either the category or
# the title-based facial matcher — fails at least one case here.
#
# Categories NOT covered: "Manuel Antonio Experiences", "Wellness Programs",
# and "workshop" use inquiry / retreat / class flows, not the standard
# `/book?service=…` deposit path this test drives.
CASES = [
    {
        "label": "Organic Facials (category match) → $10",
        "service_id": "99132c8b-7386-4c8b-8c3b-b0190b78c1f3",  # Essenthya Mini-Facial (45min)
        "expected_prefix": BAC_LINK_10_PREFIX,
        "email": "bac-redirect-facial-cat@e2e.test",
        "days_ahead": 3,
    },
    {
        "label": "Cosmolifting (title match) → $10",
        "service_id": "984e14e1-5c1a-4b62-9c88-6fed16f862b5",  # Japanese Cosmolifting Facial (60min)
        "expected_prefix": BAC_LINK_10_PREFIX,
        "email": "bac-redirect-cosmo@e2e.test",
        "days_ahead": 4,
    },
    {
        "label": "Massage Therapy → $20",
        "service_id": "dbc0f01f-794b-42c0-9a69-1ef6ad6f55eb",  # Holisynergie Massage (45min)
        "expected_prefix": BAC_LINK_20_PREFIX,
        "email": "bac-redirect-massage@e2e.test",
        "days_ahead": 5,
    },
    {
        "label": "Body Treatments → $20",
        "service_id": "0a07d044-ec86-4b21-8ba4-ad613f145b21",  # Aloe Mint Smoothie (60min)
        "expected_prefix": BAC_LINK_20_PREFIX,
        "email": "bac-redirect-body@e2e.test",
        "days_ahead": 6,
    },
    {
        "label": "Holistic Therapy → $20",
        "service_id": "47f0d6d2-5071-4a43-a2a4-fd7f65753965",  # Restorative Cupping Session (30min)
        "expected_prefix": BAC_LINK_20_PREFIX,
        "email": "bac-redirect-holistic@e2e.test",
        "days_ahead": 7,
    },
]


# ---------------------------------------------------------------------------
# Supabase REST helpers (service role)
# ---------------------------------------------------------------------------
def _svc_headers(extra: dict | None = None) -> dict:
    h = {
        "apikey": SERVICE_ROLE_KEY or "",
        "Authorization": f"Bearer {SERVICE_ROLE_KEY or ''}",
        "Content-Type": "application/json",
    }
    if extra:
        h.update(extra)
    return h


def fetch_booking_by_email(email: str) -> dict | None:
    """Return the most recent booking row for a guest email, or None."""
    if not (SUPABASE_URL and SERVICE_ROLE_KEY):
        return None
    url = (
        f"{SUPABASE_URL}/rest/v1/bookings"
        f"?guest_email=eq.{urllib.parse.quote(email)}"
        f"&select=id,status,payment_id,total_price,guest_email,created_at"
        f"&order=created_at.desc&limit=1"
    )
    req = urllib.request.Request(url, headers=_svc_headers())
    with urllib.request.urlopen(req, timeout=10) as resp:
        rows = json.loads(resp.read().decode())
    return rows[0] if rows else None


def invoke_finalize(booking_id: str, guest_email: str, expected_amount: float) -> dict:
    """Simulate a successful BAC return by POSTing to finalize-booking."""
    url = f"{SUPABASE_URL}/functions/v1/finalize-booking"
    payload = {
        "bookingId": booking_id,
        "guestEmail": guest_email,
        "expectedAmount": expected_amount,
        "claimedStatus": "approved",
        "params": {
            "reference": f"E2E-{booking_id[:8]}",
            "amount": str(expected_amount),
        },
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        method="POST",
        headers=_svc_headers(),
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())



async def wait_button_enabled(page, pattern: str, timeout: int = 15000):
    """Wait until a button whose text matches `pattern` (case-insensitive) is
    both present AND not disabled."""
    await page.wait_for_function(
        """(pattern) => {
          const rx = new RegExp(pattern, 'i');
          const btns = [...document.querySelectorAll('button')];
          const b = btns.find(el => rx.test(el.textContent || ''));
          return !!b && !b.disabled && b.getAttribute('aria-disabled') !== 'true';
        }""",
        arg=pattern,
        timeout=timeout,
    )


async def click_intake_through(page):
    """If the current service uses the health intake form (treatments,
    excluding facials), fill the two required emergency-contact fields and
    advance. On the intake step the visible placeholders are "Full name"
    and "+506 8888 8888"; on the Your Details step they don't exist yet, so
    presence of "Full name" is a reliable signal we're on intake."""
    ec_name = page.locator('input[placeholder="Full name"]')
    if await ec_name.count() == 0:
        return  # not on intake step

    await ec_name.first.fill("Emergency Contact")
    await page.locator('input[placeholder="+506 8888 8888"]').first.fill(
        "+506 8888 8888"
    )

    await wait_button_enabled(page, r"^(continue|next|siguiente)$")
    await page.get_by_role(
        "button", name=re.compile(r"^(continue|next|siguiente)$", re.I)
    ).first.click()
    await page.wait_for_timeout(500)


async def run_case(pw, case) -> str:
    """Drive one full booking → returns the captured BAC URL."""
    browser = await pw.chromium.launch(headless=True)
    ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
    captured = {"url": None}

    async def block_bac(route: Route):
        captured["url"] = route.request.url
        await route.fulfill(
            status=200,
            content_type="text/html",
            body="<html><body>intercepted</body></html>",
        )

    await ctx.route(f"https://{BAC_HOST}/**", block_bac)
    page = await ctx.new_page()
    page.on("console", lambda m: print(f"    [browser:{m.type}] {m.text}"))
    page.on("pageerror", lambda e: print(f"    [pageerror] {e}"))
    page.on("requestfailed", lambda r: print(f"    [reqfail] {r.url} — {r.failure}"))

    try:
        await page.goto(
            f"http://localhost:8080/book?service={case['service_id']}",
            wait_until="networkidle",
        )
        prefix = case["expected_prefix"].strip("/")[:6]
        await page.screenshot(path=str(SCREENSHOTS / f"{prefix}_1_datetime.png"))

        # 1. Pick a date 3 days out.
        target = date.today() + timedelta(days=case.get("days_ahead", 3))
        # get_by_role("gridcell") may match disabled prev-month cells that
        # accidentally share the day number — filter to enabled buttons only.
        day_cell = page.locator(
            f'button[role="gridcell"][name="day"]:not([disabled])'
        ).filter(has_text=re.compile(rf"^{target.day}$"))
        await day_cell.first.click()
        await page.wait_for_timeout(400)

        # 2. Pick the first available time slot.
        slot = page.get_by_role("button", name=re.compile(r"^\d{1,2}:\d{2}\s+(AM|PM)$"))
        await slot.first.wait_for(state="visible", timeout=15000)
        await slot.first.click()
        await page.screenshot(path=str(SCREENSHOTS / f"{prefix}_2_slot.png"))

        # 3. Continue → next step (intake for treatments, details for facials).
        await wait_button_enabled(page, r"^(continue|next|siguiente)$")
        await page.get_by_role(
            "button", name=re.compile(r"^(continue|next|siguiente)$", re.I)
        ).first.click()
        await page.wait_for_timeout(500)

        # 4. Optional intake step (treatments only).
        await click_intake_through(page)
        await page.screenshot(path=str(SCREENSHOTS / f"{prefix}_3_details.png"))

        # 5. Your details — fill and submit. The submit button on this step is
        # "Continue to Checkout" (EN) / "Continuar al pago" (ES). Wait for the
        # form to become valid, then click the SUBMIT button (the last one on
        # the page — "Back" comes before it).
        await page.get_by_placeholder("Jane Doe").fill("BAC Redirect Test")
        await page.get_by_placeholder("jane@example.com").fill(case["email"])
        await page.get_by_placeholder("+506 8888 8888").last.fill("+506 8888 8888")

        pay_btn = page.get_by_role(
            "button",
            name=re.compile(
                r"continue to checkout|continuar al pago|pay deposit|pagar", re.I
            ),
        )
        await pay_btn.first.wait_for(state="visible", timeout=15000)
        # Poll until enabled (canProceed reacts to state updates).
        for _ in range(40):
            if await pay_btn.first.is_enabled():
                break
            await page.wait_for_timeout(250)
        await pay_btn.first.click()

        # 6. Wait for the intercepted navigation to BAC.
        for _ in range(80):
            if captured["url"]:
                break
            await page.wait_for_timeout(250)

        await page.screenshot(path=str(SCREENSHOTS / f"{prefix}_4_after_pay.png"))
        return captured["url"] or ""
    finally:
        await browser.close()


def cleanup_bookings(emails):
    """Best-effort cleanup via the REST API using the service role."""
    if not SUPABASE_URL or not SERVICE_ROLE_KEY:
        print("[cleanup] skipped (SUPABASE_SERVICE_ROLE_KEY not set)")
        return
    for email in emails:
        url = (
            f"{SUPABASE_URL}/rest/v1/bookings?guest_email=eq."
            f"{urllib.parse.quote(email)}"
        )
        req = urllib.request.Request(
            url,
            method="DELETE",
            headers={
                "apikey": SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                print(f"[cleanup] {email}: {resp.status}")
        except Exception as e:
            print(f"[cleanup] {email}: {e}")


# Every booking status that indicates the row participated in — or is
# still tied up in — the payment lifecycle. If any of these survive
# cleanup for a test guest email, the next run will see a lingering slot
# hold or double-count an already-paid test booking.
PAYMENT_STATUSES = (
    "pending",
    "pending_payment",
    "paid",
    "payment_failed",
    "cancelled",
    "refunded",
)


def verify_no_pending_bookings(emails) -> dict:
    """Return {email: [rows]} for any bookings still present after cleanup
    whose status is payment-related. An empty dict means the DB is clean.
    Used as a post-run guard so a stuck row in ANY payment state can't
    silently survive between test runs."""
    if not (SUPABASE_URL and SERVICE_ROLE_KEY):
        print("[verify] skipped (service role not set)")
        return {}
    status_filter = ",".join(PAYMENT_STATUSES)
    leaks: dict = {}
    for email in emails:
        url = (
            f"{SUPABASE_URL}/rest/v1/bookings"
            f"?guest_email=eq.{urllib.parse.quote(email)}"
            f"&status=in.({status_filter})"
            f"&select=id,status,payment_id,created_at"
        )
        req = urllib.request.Request(url, headers=_svc_headers())
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                rows = json.loads(resp.read().decode())
        except Exception as e:
            print(f"[verify] {email}: {e}")
            continue
        if rows:
            leaks[email] = rows
    if not leaks:
        print(
            f"[verify] no leftover bookings in {list(PAYMENT_STATUSES)} "
            f"for {len(emails)} test emails ✓"
        )
    return leaks





# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def expected_amount_for(case: dict) -> float:
    return 10.0 if case["expected_prefix"] == BAC_LINK_10_PREFIX else 20.0


async def assert_pending_then_paid(case: dict) -> None:
    """After the redirect, verify the booking is `pending_payment`, then
    simulate a successful BAC return via finalize-booking and verify the
    row flips to `paid` with a payment_id set."""
    if not (SUPABASE_URL and SERVICE_ROLE_KEY):
        print("    [db-assert] skipped (service role not set)")
        return

    # 1. Poll for the booking row created by create-booking.
    booking = None
    for _ in range(20):
        booking = fetch_booking_by_email(case["email"])
        if booking:
            break
        import time
        time.sleep(0.25)
    assert booking, f"booking row not found for {case['email']}"

    assert booking["status"] == "pending_payment", (
        f"expected status=pending_payment before finalize, got {booking['status']!r}"
    )
    assert not booking.get("payment_id"), (
        f"payment_id must be empty before finalize, got {booking.get('payment_id')!r}"
    )
    print(f"    [db-assert] pre-redirect: id={booking['id']} status=pending_payment ✓")

    # 2. Simulate BAC's approved-return callback.
    expected = expected_amount_for(case)
    result = invoke_finalize(booking["id"], case["email"], expected)
    assert result.get("ok") and result.get("status") in ("paid", "already_paid"), (
        f"finalize-booking rejected the return: {result!r}"
    )
    print(f"    [db-assert] finalize-booking → {result}")

    # 3. Re-fetch and verify the atomic transition.
    after = fetch_booking_by_email(case["email"])
    assert after, "booking disappeared after finalize"
    assert after["status"] == "paid", (
        f"expected status=paid after finalize, got {after['status']!r}"
    )
    assert after.get("payment_id"), (
        "payment_id must be set after finalize"
    )
    print(
        f"    [db-assert] post-finalize: status=paid payment_id={after['payment_id']} ✓"
    )


async def main():
    # Clean any leftover rows from previous runs before starting, so a stale
    # booking at the same slot can't cause a spurious 409/slot_taken.
    cleanup_bookings([c["email"] for c in CASES])

    failures = []
    async with async_playwright() as pw:
        for case in CASES:
            print(f"\n=== {case['label']} ===")
            try:
                url = await run_case(pw, case)
                print(f"captured: {url}")
                assert url, "no BAC navigation captured"
                assert BAC_HOST in url, f"wrong host: {url}"
                assert case["expected_prefix"] in url, (
                    f"expected {case['expected_prefix']} in {url}"
                )
                await assert_pending_then_paid(case)
                print(f"PASS ({case['label']})")
            except AssertionError as e:
                print(f"FAIL ({case['label']}): {e}")
                failures.append(case["label"])
            except Exception as e:
                print(f"ERROR ({case['label']}): {e}")
                failures.append(case["label"])

    # Cleanup regardless of pass/fail, then verify nothing lingers —
    # a leftover `pending_payment` row would poison the next run's slot
    # availability and mask real regressions in create-booking cleanup.
    cleanup_bookings([c["email"] for c in CASES])
    leaks = verify_no_pending_bookings([c["email"] for c in CASES])
    if leaks:
        for email, rows in leaks.items():
            for r in rows:
                print(f"[leak] {email}: id={r['id']} status={r['status']}")
        failures.append(f"leftover bookings for {list(leaks)}")

    if failures:
        print(f"\n{len(failures)} failing case(s): {failures}")
        sys.exit(1)
    print("\nAll BAC redirect cases passed; no leftover pending_payment rows.")


if __name__ == "__main__":
    asyncio.run(main())
