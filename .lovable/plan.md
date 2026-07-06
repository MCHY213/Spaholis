# Booking wizard refactor — shorter, no duplicate fields

## Goal
For standard paid treatments, change the step order from
`Service → Date/Time → Intake → Your Details → Checkout → Confirmation`
to
`Service → Date/Time → Your Details → Intake → Summary → Checkout → Confirmation`
and remove the duplicate name field on the intake form.

Non-standard flows (classes, retreats, programs, experiences, facials, spa packages, consultation) keep their existing step lists — this refactor only touches the shared wizard in `src/pages/Booking.tsx`.

## Changes

### 1. Step order (`getStepKeys` in `src/pages/Booking.tsx`)
- Standard treatment: `[S, DT, YD, IF, SUMMARY, CHK, CONF]`
- Facial (no intake): `[S, DT, YD, SUMMARY, CHK, CONF]`
- Add new key `booking.steps.summary` to i18n EN + ES.
- Everything else (class, retreat, program, experience) is unchanged.

### 2. Remove duplicate name on intake form
- `intakeForm.guest_name` and `intakeForm2.guest_name` are the current duplicates of `formData.name`.
- Solo bookings: drop the `guest_name` field from the intake UI entirely; when we submit, set `intakeForm.guest_name = formData.name` in `createBooking`.
- Couples bookings: keep only one field labeled "Partner's name" for person 2. Person 1's name comes from `formData.name`. Update the `canProceed` intake check accordingly (only require `intakeForm2.guest_name` when couples).
- Emergency contact name/phone stay — they're different data.

### 3. New Summary step
- Read-only recap card showing: service (title, duration, price), date/time (via `formatSpaDateLong` / `formatSpaTime`), contact (name/email/phone), and a collapsed "Health & preferences" section listing any non-empty intake answers.
- "Edit" links jump back to the relevant step via `setStep(...)`.
- Coupon input moves here (currently on details step) so payment total is confirmed before checkout.
- No new validation — just a "Continue to payment" button that advances to `CHK`.

### 4. State reuse
- `formData` (name/email/phone/address/notes) already persists across steps — no change needed; we just render it read-only on the intake and summary steps.
- Prefill `formData` from `user.email` / profile when signed in (already partially done — verify and extend to `full_name` / `phone` from `profiles`).

### 5. Preserve
- All Zod-less regex validators (`NAME_RE`, `EMAIL_RE`, `PHONE_RE`) and their call sites.
- BAC CompraClick payment branch, `create-booking` edge function payload shape, `intake_form` JSON structure (still includes `guest_name` — populated from `formData.name` for solo, from both fields for couples).
- Supabase insert path and RLS (no schema change).
- Card-authorization archive code path (inert, kept as-is).

### 6. Tests
- Extend `src/test/` with a wizard-order test asserting `getStepKeys` returns the new order for a standard treatment and the trimmed order for a facial.
- Add a test that `createBooking`'s `intake_form` payload sets `guest_name` from `formData.name` for solo bookings.

## Out of scope
- Class booking (`ClassBooking.tsx`), experience booking, custom retreat, consultation form — those already have shorter flows and no duplicate name issue.
- Visual redesign beyond the new Summary card and removing one input.

## Technical notes
- Files touched: `src/pages/Booking.tsx`, `src/i18n/locales/en.json`, `src/i18n/locales/es.json` (or wherever `booking.steps.*` lives — will confirm on implementation), plus one new vitest file.
- Step indices are already resolved via `steps.indexOf(...)`, so reordering the array in `getStepKeys` automatically shifts `intakeStepIdx`, `detailsStepIdx`, `checkoutStepIdx`. No hard-coded indices need updating.
