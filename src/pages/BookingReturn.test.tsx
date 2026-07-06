// End-to-end test for the BAC CompraClick return flow.
//
// Simulates the full customer journey: BAC redirects the browser to
// /booking/return?<params>, BookingReturn reads sessionStorage + URL, calls
// the finalize-booking edge function, and reflects the verified status in
// the UI (badge, headline, and timeline).
//
// The edge function itself has dedicated Deno tests
// (supabase/functions/finalize-booking/index.test.ts) covering freshness,
// email/amount validation, and idempotency. Here we exercise the browser
// side and mock `supabase.functions.invoke("finalize-booking", ...)` with a
// small in-memory implementation that mirrors the real contract, so the
// test is fully deterministic and hermetic.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// Presentation-only chrome — swap for stubs to keep the test focused on
// BookingReturn's own status rendering (and avoid pulling i18n/router
// providers for every navbar link).
vi.mock("@/components/Navbar", () => ({ Navbar: () => <nav data-testid="navbar" /> }));
vi.mock("@/components/Footer", () => ({ Footer: () => <footer data-testid="footer" /> }));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// -----------------------------------------------------------------------
// In-memory booking store + fake finalize-booking implementation.
// Mirrors the response contract of supabase/functions/finalize-booking.
// -----------------------------------------------------------------------
type Booking = {
  id: string;
  status: "pending_payment" | "paid" | "payment_failed" | "cancelled";
  guest_email: string;
  total_price: number;
  created_at: string;
  payment_id: string | null;
};

const store = new Map<string, Booking>();

function fakeFinalize(body: any): { data: any; error: null } | { data: null; error: Error } {
  const { bookingId, guestEmail, expectedAmount, claimedStatus, params } = body ?? {};
  const booking = store.get(bookingId);
  if (!booking) return { data: { ok: false, reason: "not_found" }, error: null };

  if (booking.status === "paid") return { data: { ok: true, status: "already_paid" }, error: null };
  if (booking.status === "payment_failed" || booking.status === "cancelled") {
    return { data: { ok: true, status: "already_failed" }, error: null };
  }
  if (booking.status !== "pending_payment") {
    return { data: { ok: false, reason: "wrong_state" }, error: null };
  }
  const ageMs = Date.now() - new Date(booking.created_at).getTime();
  if (ageMs > 3 * 60 * 60 * 1000) return { data: { ok: false, reason: "expired" }, error: null };
  if (
    guestEmail &&
    guestEmail.trim().toLowerCase() !== booking.guest_email.trim().toLowerCase()
  ) {
    return { data: { ok: false, reason: "email_mismatch" }, error: null };
  }
  const returnedAmount = params?.amount != null ? Number(params.amount) : null;
  if (
    returnedAmount != null &&
    Number.isFinite(returnedAmount) &&
    expectedAmount &&
    Math.abs(returnedAmount - expectedAmount) > 0.01
  ) {
    return { data: { ok: false, reason: "amount_mismatch" }, error: null };
  }
  if (claimedStatus === "approved") {
    booking.status = "paid";
    booking.payment_id = params?.reference || `bac_return_${Date.now()}`;
    return { data: { ok: true, status: "paid" }, error: null };
  }
  if (claimedStatus === "declined" || claimedStatus === "cancelled") {
    booking.status = "payment_failed";
    return { data: { ok: true, status: "failed" }, error: null };
  }
  return { data: { ok: false, reason: "no_status" }, error: null };
}

// vi.mock is hoisted above the file's imports, so the factory must not
// reference module-scoped variables. We stash the invoke spy on
// globalThis so the tests can inspect it after the fact.
vi.mock("@/integrations/supabase/client", async () => {
  const { vi } = await import("vitest");
  const spy = vi.fn(async (fn: string, opts: any) => {
    if (fn === "finalize-booking") {
      // Late-bind so the test can override fakeFinalize if needed.
      return (globalThis as any).__fakeFinalize(opts?.body);
    }
    return { data: null, error: new Error(`unexpected function: ${fn}`) };
  });
  (globalThis as any).__invokeMock = spy;
  return { supabase: { functions: { invoke: spy } } };
});

// Bind the fake implementation and grab the hoisted spy.
(globalThis as any).__fakeFinalize = fakeFinalize;
const invokeMock = (globalThis as any).__invokeMock as ReturnType<typeof vi.fn>;

// Import AFTER mocks so BookingReturn resolves them.
import BookingReturn from "./BookingReturn";

const BOOKING_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function seedPending(overrides: Partial<Booking> & { guestName?: string; serviceTitle?: string } = {}) {
  const booking: Booking = {
    id: BOOKING_ID,
    status: "pending_payment",
    guest_email: "guest@example.com",
    total_price: 20,
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    payment_id: null,
    ...overrides,
  };
  store.set(BOOKING_ID, booking);
  sessionStorage.setItem(
    "holis:pending_booking",
    JSON.stringify({
      bookingId: booking.id,
      guestName: overrides.guestName ?? "Ada Lovelace",
      guestEmail: booking.guest_email,
      amount: booking.total_price,
      serviceTitle: overrides.serviceTitle ?? "Signature Facial",
    }),
  );
  return booking;
}

function renderReturn(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/booking/return" element={<BookingReturn />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  store.clear();
  sessionStorage.clear();
  invokeMock.mockClear();
});

describe("BookingReturn — end-to-end BAC return flow", () => {
  it("approved return flips the booking to paid and shows confirmation UI", async () => {
    const booking = seedPending();

    renderReturn("/booking/return?status=approved&reference=BAC-REF-1&amount=20");

    // Confirmation headline appears after finalize-booking resolves.
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /appointment confirmed/i })).toBeInTheDocument(),
    );

    // Badge reflects paid state.
    expect(screen.getByText(/^Paid$/)).toBeInTheDocument();

    // Timeline reaches its terminal "Booking confirmed" step.
    expect(screen.getByText(/3\. Booking confirmed/i)).toBeInTheDocument();

    // Customer-facing details rendered from sessionStorage.
    expect(screen.getByText(/Ada Lovelace/)).toBeInTheDocument();
    expect(screen.getByText(/Signature Facial/)).toBeInTheDocument();

    // Booking actually transitioned server-side and the reference was stored.
    expect(booking.status).toBe("paid");
    expect(booking.payment_id).toBe("BAC-REF-1");

    // Edge function was invoked exactly once with the correct payload.
    expect(invokeMock).toHaveBeenCalledTimes(1);
    const [fnName, opts] = invokeMock.mock.calls[0];
    expect(fnName).toBe("finalize-booking");
    expect(opts.body).toMatchObject({
      bookingId: BOOKING_ID,
      guestEmail: "guest@example.com",
      expectedAmount: 20,
      claimedStatus: "approved",
      params: { status: "approved", reference: "BAC-REF-1", amount: "20" },
    });

    // Success path clears the pending-booking session.
    await waitFor(() =>
      expect(sessionStorage.getItem("holis:pending_booking")).toBeNull(),
    );
  });

  it("declined return marks payment_failed and shows retry CTA", async () => {
    const booking = seedPending();

    renderReturn("/booking/return?status=declined");

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /payment not completed/i })).toBeInTheDocument(),
    );

    expect(screen.getByText(/^Payment failed$/)).toBeInTheDocument();
    expect(booking.status).toBe("payment_failed");

    // Retry CTA is available and includes the deposit amount.
    expect(screen.getByRole("button", { name: /retry payment \(\$20\)/i })).toBeInTheDocument();

    // Failed path preserves the pending-booking session so retry can reuse it.
    expect(sessionStorage.getItem("holis:pending_booking")).not.toBeNull();
  });

  it("no pending session (bad UUID) surfaces the Unverified state without calling the edge function", async () => {
    // Deliberately do NOT seed sessionStorage.
    renderReturn("/booking/return?status=approved");

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /couldn't verify this confirmation/i })).toBeInTheDocument(),
    );

    expect(screen.getByText(/^Unverified$/)).toBeInTheDocument();
    // Reason code line renders for admin/customer clarity.
    expect(screen.getByText(/Reason code:/i)).toBeInTheDocument();
    expect(screen.getByText(/no_session/)).toBeInTheDocument();

    // Guard rail: BookingReturn must not hit the edge function without a UUID.
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("amount mismatch from finalize-booking renders a human-readable reason", async () => {
    seedPending();

    // BAC echoes a different amount than what the browser session recorded.
    renderReturn("/booking/return?status=approved&reference=REF&amount=5");

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /couldn't verify this confirmation/i })).toBeInTheDocument(),
    );

    expect(screen.getByText(/^Unverified$/)).toBeInTheDocument();
    expect(
      screen.getByText(/amount BAC reported doesn't match the expected deposit/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/amount_mismatch/)).toBeInTheDocument();

    // Booking must remain pending — no state change on validation failure.
    expect(store.get(BOOKING_ID)?.status).toBe("pending_payment");
  });

  it("replay: a second render on an already-paid booking still shows Paid via already_paid", async () => {
    const booking = seedPending({ status: "paid", payment_id: "BAC-REF-OLD" });

    renderReturn("/booking/return?status=approved&reference=BAC-REF-NEW&amount=20");

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /appointment confirmed/i })).toBeInTheDocument(),
    );
    expect(screen.getByText(/^Paid$/)).toBeInTheDocument();

    // Replay must NOT overwrite the original payment_id.
    expect(booking.payment_id).toBe("BAC-REF-OLD");
  });

  it("a11y: status badge exposes aria-live and announces the final status after finalize-booking completes", async () => {
    seedPending();

    renderReturn("/booking/return?status=approved&reference=BAC-REF-A11Y&amount=20");

    // Before finalize-booking resolves, the badge is rendered with the
    // "Verifying" copy and is marked as busy so assistive tech knows the
    // value is provisional.
    const badge = screen.getByRole("status");
    expect(badge).toHaveAttribute("aria-live", "polite");
    expect(badge).toHaveAttribute("aria-atomic", "true");
    expect(badge).toHaveAttribute("aria-busy", "true");
    expect(badge.getAttribute("aria-label") ?? "").toMatch(/booking status:/i);
    expect(badge.textContent ?? "").toMatch(/verifying/i);

    // Once the edge function resolves, the SAME live region is updated in
    // place — this is what triggers the screen-reader announcement. Holding
    // a reference to the original node proves it wasn't unmounted (a
    // remount would break the aria-live announcement).
    const badgeRef = badge;
    await waitFor(() => {
      expect(badgeRef.textContent ?? "").toMatch(/^\s*Paid\s*$/i);
    });

    // aria-busy flips to false once the request is no longer in flight —
    // the value SRs just announced is now the authoritative one.
    expect(badgeRef).toHaveAttribute("aria-busy", "false");
    expect(badgeRef).toHaveAttribute("aria-live", "polite");
    expect(badgeRef).toHaveAttribute("aria-atomic", "true");
    expect(badgeRef.getAttribute("aria-label")).toBe("Booking status: Paid");

    // The confirmation headline landed too, and only ONE live region exists
    // for booking status (extra role="status" nodes would cause SRs to
    // announce twice or ignore updates).
    expect(screen.getByRole("heading", { name: /appointment confirmed/i })).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("a11y: declined return updates the same aria-live region to the failure status", async () => {
    seedPending();

    renderReturn("/booking/return?status=declined");

    const badge = screen.getByRole("status");
    expect(badge).toHaveAttribute("aria-live", "polite");

    await waitFor(() => {
      expect(badge.textContent ?? "").toMatch(/^\s*Payment failed\s*$/i);
    });

    expect(badge).toHaveAttribute("aria-busy", "false");
    expect(badge.getAttribute("aria-label")).toBe("Booking status: Payment failed");
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});

