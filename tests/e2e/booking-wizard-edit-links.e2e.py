"""E2E: Summary step Edit links jump to the correct wizard step and
previously entered values are still intact.

Flow:
  1. Load /book?service=<solo massage>
  2. Walk: DateTime → Details → Intake → Summary
  3. Verify Summary shows the values we entered
  4. For each Edit link on Summary, click it, verify the correct step
     becomes active AND the prior values are preserved, then advance
     back to Summary via Continue.

"Correct step" is determined by reading which step-indicator pill has
the active class (`bg-foreground`), which is the same signal the header
number uses. Value preservation is checked from real DOM state
(input.value, selected calendar day aria-pressed, selected slot button
data-state, filled intake fields).
"""

import asyncio
import re
from pathlib import Path
from playwright.async_api import async_playwright

SCREENSHOTS = Path(__file__).parent / "screenshots-edit"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

SOLO_SERVICE_ID = "dbc0f01f-794b-42c0-9a69-1ef6ad6f55eb"  # Holisynergie Massage 45min

FULL_NAME_PLACEHOLDER = "Jane Doe"
GUEST_NAME = "Test Guest"
GUEST_EMAIL = "test@example.com"
EMERGENCY_NAME = "Emergency Person"
EMERGENCY_PHONE = "+506 8888 8888"

# For the standard treatment wizard the ordered indices are:
#   0 Service, 1 Date/Time, 2 Your Details, 3 Intake, 4 Review, 5 Checkout, 6 Confirmation
IDX_SERVICE = 0
IDX_DATETIME = 1
IDX_DETAILS = 2
IDX_INTAKE = 3
IDX_SUMMARY = 4


async def active_step_index(page):
    """Return the index of the pill currently rendered as the active step."""
    pills = page.locator(".w-7.h-7.rounded-full")
    total = await pills.count()
    for i in range(total):
        klass = await pills.nth(i).get_attribute("class") or ""
        # Active pill: `bg-foreground text-background`
        # Completed pill: `bg-spa-sage text-spa-cream`
        # Future pill:    `bg-muted text-muted-foreground`
        if "bg-foreground" in klass and "text-background" in klass:
            return i
    return -1


async def pick_date_and_slot(page):
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
            return
    raise AssertionError("no dates had available slots")


async def continue_button(page):
    return page.get_by_role(
        "button",
        name=re.compile(
            r"^(continue|continue to checkout|request booking)$", re.I
        ),
    ).last


async def click_continue(page):
    await (await continue_button(page)).click()
    await page.wait_for_timeout(700)


async def fill_details(page):
    await page.locator(f'input[placeholder="{FULL_NAME_PLACEHOLDER}"]').fill(GUEST_NAME)
    await page.locator('input[type="email"]').first.fill(GUEST_EMAIL)


async def fill_intake(page):
    # Emergency contact is the only required field on solo intake
    tel = page.locator('input[inputmode="tel"]').last
    name = page.locator('input[autocomplete="name"]').last
    await name.fill(EMERGENCY_NAME)
    await tel.fill(EMERGENCY_PHONE)


async def walk_to_summary(page):
    await page.goto(
        f"http://localhost:8080/book?service={SOLO_SERVICE_ID}",
        wait_until="networkidle",
    )
    await page.wait_for_timeout(3000)
    # DateTime → Details
    await pick_date_and_slot(page)
    await click_continue(page)
    # Details → Intake
    await fill_details(page)
    await click_continue(page)
    # Intake → Summary
    await fill_intake(page)
    await click_continue(page)
    # Confirm we're on Summary
    assert await active_step_index(page) == IDX_SUMMARY, (
        f"expected to land on Summary (index {IDX_SUMMARY}) after intake, "
        f"got {await active_step_index(page)}"
    )


async def summary_edit_buttons(page):
    """Return the ordered list of Edit buttons on the Summary step."""
    return page.get_by_role("button", name=re.compile(r"^edit$", re.I))


async def get_summary_text(page):
    """Return the concatenated visible summary card text so we can assert
    that previously entered values are shown before we click Edit."""
    return await page.locator("main, body").first.inner_text()


async def verify_edit(page, edit_index, expected_step_idx, verify_value):
    """Click a specific Edit link and verify step + value preservation."""
    buttons = await summary_edit_buttons(page)
    n = await buttons.count()
    assert edit_index < n, (
        f"only {n} Edit buttons on Summary, need index {edit_index}"
    )
    await buttons.nth(edit_index).click()
    await page.wait_for_timeout(600)
    active = await active_step_index(page)
    assert active == expected_step_idx, (
        f"Edit #{edit_index} should jump to step {expected_step_idx}, "
        f"got {active}"
    )
    await verify_value(page)
    # Return to Summary by pressing Continue until we're back.
    for _ in range(6):
        if await active_step_index(page) == IDX_SUMMARY:
            break
        await click_continue(page)
    assert await active_step_index(page) == IDX_SUMMARY, (
        "failed to return to Summary after edit"
    )


async def verify_datetime_preserved(page):
    # A day is still highlighted (aria-pressed=true) and a slot is still
    # highlighted (button with time label carries the selected-state class
    # `border-foreground`).
    picked_day = page.locator('button[name="day"][aria-selected="true"]')
    assert await picked_day.count() >= 1, "previously selected day not preserved"
    # slot: any button whose text matches HH:MM and whose class contains
    # `border-foreground` (selected style used across the wizard)
    slot_selected = page.locator(
        "button",
        has_text=re.compile(r"^\d{1,2}:\d{2}"),
    )
    n = await slot_selected.count()
    found = False
    for i in range(n):
        cls = await slot_selected.nth(i).get_attribute("class") or ""
        if "border-foreground" in cls or "bg-foreground" in cls:
            found = True
            break
    assert found, "previously selected time slot not preserved"


async def verify_details_preserved(page):
    name_val = await page.locator(f'input[placeholder="{FULL_NAME_PLACEHOLDER}"]').input_value()
    email_val = await page.locator('input[type="email"]').first.input_value()
    assert name_val == GUEST_NAME, f"name lost: got {name_val!r}"
    assert email_val == GUEST_EMAIL, f"email lost: got {email_val!r}"


async def verify_intake_preserved(page):
    # Emergency contact name/phone were the only fields we filled
    name_val = await page.locator('input[autocomplete="name"]').last.input_value()
    tel_val = await page.locator('input[inputmode="tel"]').last.input_value()
    assert name_val == EMERGENCY_NAME, f"intake name lost: got {name_val!r}"
    assert tel_val == EMERGENCY_PHONE, f"intake phone lost: got {tel_val!r}"


async def verify_service_step(page):
    # Service was preselected via URL → the picker is service-locked and
    # the step 0 area intentionally renders no service list. All we can
    # verify is that we landed on step 0 (already asserted by caller) and
    # that the summary sidebar still shows the selected service title,
    # meaning selection state was not wiped.
    body = await page.locator("body").inner_text()
    assert "Holisynergie" in body, "selected service was cleared on edit"


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        try:
            await walk_to_summary(page)
            await page.screenshot(path=str(SCREENSHOTS / "0_summary.png"))

            # Summary must show all four rows before we start editing
            summary_txt = await get_summary_text(page)
            for needle in (GUEST_NAME, GUEST_EMAIL, "Holisynergie"):
                assert needle in summary_txt, f"summary missing {needle!r}"

            edits = await summary_edit_buttons(page)
            edit_count = await edits.count()
            print(f"Summary Edit buttons rendered: {edit_count}")
            assert edit_count == 4, (
                f"expected 4 Edit links (Service, DateTime, Contact, Intake), "
                f"got {edit_count}"
            )

            # Order on the Summary card matches the render order:
            #   0 = Service, 1 = Date & Time, 2 = Contact, 3 = Intake
            print("--- edit #3 Intake ---")
            await verify_edit(page, 3, IDX_INTAKE, verify_intake_preserved)
            await page.screenshot(path=str(SCREENSHOTS / "1_after_intake_edit.png"))

            print("--- edit #2 Contact ---")
            await verify_edit(page, 2, IDX_DETAILS, verify_details_preserved)
            await page.screenshot(path=str(SCREENSHOTS / "2_after_contact_edit.png"))

            print("--- edit #1 Date & Time ---")
            await verify_edit(page, 1, IDX_DATETIME, verify_datetime_preserved)
            await page.screenshot(path=str(SCREENSHOTS / "3_after_datetime_edit.png"))

            print("--- edit #0 Service ---")
            await verify_edit(page, 0, IDX_SERVICE, verify_service_step)
            await page.screenshot(path=str(SCREENSHOTS / "4_after_service_edit.png"))

            print("ALL SUMMARY EDIT E2E ASSERTIONS PASSED ✓")
        finally:
            await browser.close()


asyncio.run(main())
