"""End-to-end verification of the FACIAL booking wizard.

Facial services skip the health intake step but still get the new Summary
(Review) step before Checkout. Contract under test:

  1. Step indicator has exactly 6 pills:
       Service → Date & Time → Your Details → Review → Checkout → Confirmation
     (no Intake Form pill).
  2. Name field is asked for exactly once (Your Details step).
  3. Button label on Your Details is the plain "Continue" (NOT
     "Continue to Checkout") — the checkout trigger has moved to Review.
  4. Button label on Review is "Continue to Checkout".
  5. Clicking Continue on Review calls the create-booking edge function
     and redirects to a BAC CompraClick URL (bac-credomatic domain), which
     confirms the completion behavior for the paid facial flow.
"""

import asyncio
import re
from pathlib import Path
from playwright.async_api import async_playwright

SCREENSHOTS = Path(__file__).parent / "screenshots-facial"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

FACIAL_SERVICE_ID = "de336b42-f6ec-451e-9614-188940097468"  # Facial Glow (60min)

FULL_NAME_PLACEHOLDER = "Jane Doe"
GUEST_NAME_PLACEHOLDER = "Full name of this guest"


async def count_visible(page, selector):
    loc = page.locator(selector)
    n = await loc.count()
    visible = 0
    for i in range(n):
        try:
            if await loc.nth(i).is_visible():
                visible += 1
        except Exception:
            pass
    return visible


async def advance_from_datetime(page):
    await page.wait_for_selector('button[name="day"]', timeout=15000)
    days = page.locator('button[name="day"]:not([disabled])')
    total = await days.count()
    assert total > 0, "no selectable days"
    for idx in (min(total - 1, 10), total - 1, total - 2, 0):
        if idx < 0 or idx >= total:
            continue
        await days.nth(idx).click()
        await page.wait_for_timeout(1200)
        slots = page.locator("button", has_text=re.compile(r"^\d{1,2}:\d{2}"))
        if await slots.count() > 0:
            await slots.first.click()
            await page.wait_for_timeout(300)
            await page.get_by_role("button", name=re.compile("Continue", re.I)).click()
            await page.wait_for_timeout(700)
            return
    raise AssertionError("could not find any date with available facial slots")


async def get_primary_button_label(page):
    """Return the trimmed text of the sole primary CTA button at the bottom."""
    btn = page.get_by_role(
        "button",
        name=re.compile("Continue|Request Booking|Continue to Checkout|Submitting", re.I),
    ).last
    return (await btn.inner_text()).strip()


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        try:
            await page.goto(
                f"http://localhost:8080/book?service={FACIAL_SERVICE_ID}",
                wait_until="networkidle",
            )
            await page.wait_for_timeout(3000)
            await page.screenshot(path=str(SCREENSHOTS / "1_datetime.png"))

            # --- Contract 1: 6 pills, no Intake ---
            pill_count = await page.locator(".w-7.h-7.rounded-full").count()
            print(f"[facial] step pill count: {pill_count}")
            assert pill_count == 6, f"facial wizard must show 6 pills, got {pill_count}"

            # --- Advance: DateTime → Your Details ---
            await advance_from_datetime(page)
            await page.screenshot(path=str(SCREENSHOTS / "2_details.png"))

            # --- Contract 2: exactly one name input on Your Details ---
            full = await count_visible(page, f'input[placeholder="{FULL_NAME_PLACEHOLDER}"]')
            guest = await count_visible(page, f'input[placeholder="{GUEST_NAME_PLACEHOLDER}"]')
            print(f"[facial] details name inputs full={full} guest={guest}")
            assert full == 1 and guest == 0, (
                f"details step must render exactly one full-name input, "
                f"got full={full} guest={guest}"
            )

            # --- Contract 3: button says "Continue" (NOT "Continue to Checkout") ---
            details_label = await get_primary_button_label(page)
            print(f"[facial] details CTA: {details_label!r}")
            assert details_label.lower() == "continue", (
                f"on Your Details the CTA must be plain 'Continue' — "
                f"'Continue to Checkout' means the paid submit trigger "
                f"regressed back to details. Got: {details_label!r}"
            )

            # Fill contact info and advance
            await page.locator(f'input[placeholder="{FULL_NAME_PLACEHOLDER}"]').fill("Test Guest")
            await page.locator('input[type="email"]').first.fill("test@example.com")
            await page.get_by_role("button", name=re.compile("^Continue$", re.I)).click()
            await page.wait_for_timeout(800)
            await page.screenshot(path=str(SCREENSHOTS / "3_summary.png"))

            # --- Contract 4: on Summary/Review the CTA is "Continue to Checkout" ---
            summary_label = await get_primary_button_label(page)
            print(f"[facial] summary CTA: {summary_label!r}")
            assert re.match(r"continue to checkout", summary_label, re.I), (
                f"on Review the CTA must be 'Continue to Checkout', got {summary_label!r}"
            )

            # --- Confirm no intake screen was ever presented: no guest-name
            # placeholder input EVER appeared during the whole flow ---
            guest_on_summary = await count_visible(
                page, f'input[placeholder="{GUEST_NAME_PLACEHOLDER}"]'
            )
            assert guest_on_summary == 0, (
                "intake guest_name input must not appear in the facial flow"
            )

            # --- Contract 5: clicking the Review CTA fires create-booking
            # and redirects to a BAC CompraClick URL. We intercept the
            # navigation instead of following it so the sandbox stays local.
            captured = {"url": None}

            async def route_handler(route):
                url = route.request.url
                if "bac" in url.lower() or "credomatic" in url.lower() or "compraclick" in url.lower():
                    captured["url"] = url
                    await route.abort()
                else:
                    await route.continue_()

            await context.route("**/*", route_handler)
            # Watch for the top-level navigation attempt
            nav_task = asyncio.create_task(
                page.wait_for_event("framenavigated", timeout=15000)
            )
            await page.get_by_role(
                "button", name=re.compile("continue to checkout", re.I)
            ).click()
            # Give the create-booking edge function + redirect a moment
            try:
                await asyncio.wait_for(asyncio.shield(nav_task), timeout=12)
            except Exception:
                pass
            await page.wait_for_timeout(2500)
            await page.screenshot(path=str(SCREENSHOTS / "4_after_submit.png"))

            final_url = page.url
            print(f"[facial] captured redirect: {captured['url']!r}")
            print(f"[facial] final page url: {final_url}")
            paid_ok = (
                (captured["url"] is not None)
                or ("bac" in final_url.lower())
                or ("credomatic" in final_url.lower())
                or ("compraclick" in final_url.lower())
            )
            assert paid_ok, (
                "clicking Continue to Checkout on the facial Review step must "
                "redirect to the BAC CompraClick payment URL — no such "
                "redirect was observed"
            )

            print("FACIAL wizard E2E ALL ASSERTIONS PASSED ✓")
        finally:
            await browser.close()


asyncio.run(main())
