// Maps edge-function failure signals (HTTP status + `reason` string) to a
// well-defined user-facing booking error state. Centralizing this here keeps
// the checkout UI consistent whether the failure comes from `create-booking`,
// `finalize-booking`, or `retry-booking-payment`.
//
// Add new reasons to `BOOKING_ERROR_MAP` — do NOT branch on `reason` strings
// in components.

import type { InvokeResult } from "./invokeEdgeFunction";

export type BookingErrorKind =
  | "slot_taken"           // 409 — pick a new time
  | "invalid_slot"         // 400 — chosen slot/room is not valid
  | "invalid_coupon"       // 400 — coupon rejected
  | "invalid_input"        // 400 — bad body / missing fields
  | "service_unavailable"  // 404 — service disabled / removed
  | "not_found"            // 404 — booking id unknown
  | "email_mismatch"       // 403 — return-session email mismatch
  | "expired"              // 410 — pending payment window closed
  | "already_paid"         // 409 — booking already finalized
  | "already_failed"       // 409 — booking already marked failed
  | "wrong_state"          // 409 — booking in a state that blocks the action
  | "amount_mismatch"      // 409 — deposit amount mismatch
  | "auth_required"        // 401 — action needs sign-in
  | "forbidden"            // 403 — generic auth denial
  | "rate_limited"         // 429
  | "network"              // fetch failed / no response
  | "server_error"         // 5xx
  | "unknown";             // everything else

export interface BookingErrorState {
  kind: BookingErrorKind;
  /** Short, user-facing message. Safe to render in a toast or inline banner. */
  message: string;
  /** Suggested next action label, when the UI wants to render a CTA. */
  actionLabel?: string;
  /** Suggested next action id, so callers can decide what handler to run. */
  action?: "pick_new_time" | "retry" | "contact_support" | "sign_in" | "start_over";
  /** HTTP status returned by the edge function (or null for pre-request failures). */
  status: number | null;
  /** Raw reason string, kept for logging/analytics. */
  reason: string | null;
}

interface Mapping {
  kind: BookingErrorKind;
  message: string;
  actionLabel?: string;
  action?: BookingErrorState["action"];
}

// Reason strings emitted by our edge functions. Keep in sync with:
//   supabase/functions/create-booking/index.ts
//   supabase/functions/finalize-booking/index.ts
//   supabase/functions/retry-booking-payment/index.ts
const BOOKING_ERROR_MAP: Record<string, Mapping> = {
  slot_taken: {
    kind: "slot_taken",
    message: "That time was just booked by someone else. Please pick another time.",
    actionLabel: "Pick a new time",
    action: "pick_new_time",
  },
  invalid_slot: {
    kind: "invalid_slot",
    message: "The selected time is no longer available. Please pick another slot.",
    actionLabel: "Pick a new time",
    action: "pick_new_time",
  },
  invalid_coupon: {
    kind: "invalid_coupon",
    message: "The coupon code isn't valid for this booking. Remove it and try again.",
  },
  invalid_body: { kind: "invalid_input", message: "Some booking details are missing or invalid. Please review the form and try again." },
  invalid_json: { kind: "invalid_input", message: "We couldn't submit your booking. Please refresh and try again." },
  invalid_booking_id: { kind: "invalid_input", message: "We couldn't identify this booking. Please start over.", action: "start_over" },
  invalid_claimed_status: { kind: "invalid_input", message: "The payment response was invalid. Please retry your payment.", action: "retry" },
  no_status: { kind: "invalid_input", message: "The payment response was incomplete. Please retry your payment.", action: "retry" },
  email_required: { kind: "invalid_input", message: "Please provide the email used for the booking." },
  service_unavailable: { kind: "service_unavailable", message: "This service isn't available right now. Please choose a different service." },
  not_found: { kind: "not_found", message: "We couldn't find your booking. Please contact us if you were charged.", actionLabel: "Contact support", action: "contact_support" },
  email_mismatch: { kind: "email_mismatch", message: "The email on this booking doesn't match. Please use the same device and email as checkout.", actionLabel: "Contact support", action: "contact_support" },
  expired: { kind: "expired", message: "Your payment window expired. Please start a new booking.", actionLabel: "Start over", action: "start_over" },
  retry_window_expired: { kind: "expired", message: "The retry window for this booking has closed. Please start a new booking.", actionLabel: "Start over", action: "start_over" },
  already_paid: { kind: "already_paid", message: "This booking is already paid — check your email for the confirmation." },
  already_failed: { kind: "already_failed", message: "This booking was already marked as failed. Please start a new one.", action: "start_over" },
  wrong_state: { kind: "wrong_state", message: "This booking can't be updated in its current state. Please contact us.", actionLabel: "Contact support", action: "contact_support" },
  amount_mismatch: { kind: "amount_mismatch", message: "The payment amount didn't match what we expected. Please contact us.", actionLabel: "Contact support", action: "contact_support" },
  fetch_failed: { kind: "server_error", message: "We couldn't reach our booking service. Please try again in a moment.", actionLabel: "Try again", action: "retry" },
  update_failed: { kind: "server_error", message: "We couldn't finalize your booking. Please try again or contact us.", actionLabel: "Try again", action: "retry" },
  create_failed: { kind: "server_error", message: "We couldn't create your booking. Please try again.", actionLabel: "Try again", action: "retry" },
  method_not_allowed: { kind: "invalid_input", message: "That request isn't supported. Please refresh and try again." },
};

const STATUS_FALLBACK: Array<{ test: (s: number) => boolean; mapping: Mapping }> = [
  { test: (s) => s === 401, mapping: { kind: "auth_required", message: "Please sign in to continue.", actionLabel: "Sign in", action: "sign_in" } },
  { test: (s) => s === 403, mapping: { kind: "forbidden", message: "You don't have permission to complete this booking.", actionLabel: "Contact support", action: "contact_support" } },
  { test: (s) => s === 404, mapping: { kind: "not_found", message: "We couldn't find that booking.", actionLabel: "Contact support", action: "contact_support" } },
  { test: (s) => s === 409, mapping: { kind: "wrong_state", message: "That action conflicts with the booking's current state.", actionLabel: "Contact support", action: "contact_support" } },
  { test: (s) => s === 410, mapping: { kind: "expired", message: "This booking has expired. Please start a new one.", actionLabel: "Start over", action: "start_over" } },
  { test: (s) => s === 429, mapping: { kind: "rate_limited", message: "Too many attempts. Please wait a moment and try again.", actionLabel: "Try again", action: "retry" } },
  { test: (s) => s >= 500, mapping: { kind: "server_error", message: "Our booking service is having trouble. Please try again shortly.", actionLabel: "Try again", action: "retry" } },
  { test: (s) => s >= 400, mapping: { kind: "invalid_input", message: "The booking couldn't be submitted. Please review your details and try again." } },
];

/** Convert an `InvokeResult` from a checkout edge function into a UI-ready state. */
export function toBookingErrorState(result: InvokeResult): BookingErrorState {
  const reason = (result.data as any)?.reason ?? null;
  const providedMessage = typeof (result.data as any)?.message === "string" ? (result.data as any).message : null;

  if (reason && BOOKING_ERROR_MAP[reason]) {
    const m = BOOKING_ERROR_MAP[reason];
    return {
      kind: m.kind,
      // Prefer server-provided message when it exists AND is human-readable
      // (the server sometimes echoes the exact SLOT_TAKEN copy).
      message: providedMessage || m.message,
      actionLabel: m.actionLabel,
      action: m.action,
      status: result.status,
      reason,
    };
  }

  if (result.status != null) {
    for (const { test, mapping } of STATUS_FALLBACK) {
      if (test(result.status)) {
        return {
          kind: mapping.kind,
          message: providedMessage || mapping.message,
          actionLabel: mapping.actionLabel,
          action: mapping.action,
          status: result.status,
          reason,
        };
      }
    }
  }

  // No status and no known reason — treat as network / unknown.
  return {
    kind: result.status == null ? "network" : "unknown",
    message:
      providedMessage ||
      (result.status == null
        ? "We couldn't reach the booking service. Check your connection and try again."
        : "Something went wrong. Please try again."),
    actionLabel: "Try again",
    action: "retry",
    status: result.status,
    reason,
  };
}
