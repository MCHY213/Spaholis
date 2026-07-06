// deno-lint-ignore-file no-explicit-any
// Unit tests for finalize-booking. Uses an in-memory fake Supabase client so
// the freshness window, email/amount validation, and idempotent update logic
// can be exercised deterministically without a live database.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleFinalize } from "./index.ts";

const BOOKING_ID = "11111111-2222-3333-4444-555555555555";
const HOUR = 60 * 60 * 1000;

type Booking = {
  id: string;
  status: string;
  total_price: number;
  guest_email: string | null;
  created_at: string;
  payment_id: string | null;
};

type FakeState = {
  booking: Booking | null;
  fetchError?: { message: string };
  updateError?: { message: string };
  // Simulate a race: the row is no longer in `pending_payment` when the
  // filtered UPDATE runs, so `select().maybeSingle()` returns null.
  updateReturnsEmpty?: boolean;
  updates: Array<Record<string, unknown>>;
  audit: Array<Record<string, unknown>>;
};

function makeFake(state: FakeState) {
  return {
    from(table: string) {
      if (table === "audit_logs") {
        return {
          insert: async (row: Record<string, unknown>) => {
            state.audit.push(row);
            return { data: null, error: null };
          },
        };
      }
      // bookings — supports .select().eq().maybeSingle() and
      // .update().eq().eq().select().maybeSingle() plus the fire-and-forget
      // .update().eq().eq() used on the declined/cancelled branch.
      return {
        select: (_cols?: string) => ({
          eq: (_col: string, _val: string) => ({
            maybeSingle: async () => {
              if (state.fetchError) return { data: null, error: state.fetchError };
              return { data: state.booking, error: null };
            },
          }),
        }),
        update: (patch: Record<string, unknown>) => {
          state.updates.push(patch);
          const chain = {
            eq: (_c: string, _v: string) => chain,
            select: (_c?: string) => ({
              maybeSingle: async () => {
                if (state.updateError) return { data: null, error: state.updateError };
                if (state.updateReturnsEmpty) return { data: null, error: null };
                // Apply patch to in-memory row.
                if (state.booking) Object.assign(state.booking, patch);
                return { data: { id: state.booking?.id }, error: null };
              },
            }),
            // Awaiting the chain directly (declined path) resolves to void.
            then: (resolve: (v: unknown) => void) => {
              if (state.booking && (state.booking.status === "pending_payment")) {
                Object.assign(state.booking, patch);
              }
              resolve({ data: null, error: null });
            },
          };
          return chain;
        },
      };
    },
  };
}

function freshBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: BOOKING_ID,
    status: "pending_payment",
    total_price: 20,
    guest_email: "guest@example.com",
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    payment_id: null,
    ...overrides,
  };
}

function newState(booking: Booking | null, extra: Partial<FakeState> = {}): FakeState {
  return { booking, updates: [], audit: [], ...extra };
}

Deno.test("rejects malformed bookingId", async () => {
  const state = newState(freshBooking());
  const { result, statusCode } = await handleFinalize(
    { bookingId: "not-a-uuid", claimedStatus: "approved" },
    makeFake(state),
  );
  assertEquals(statusCode, 400);
  assertEquals(result, { ok: false, reason: "invalid_booking_id" });
  assertEquals(state.audit.at(-1)?.result, "invalid_booking_id");
});

Deno.test("rejects invalid claimedStatus", async () => {
  const state = newState(freshBooking());
  const { result, statusCode } = await handleFinalize(
    { bookingId: BOOKING_ID, claimedStatus: "bogus" as any },
    makeFake(state),
  );
  assertEquals(statusCode, 400);
  assertEquals(result, { ok: false, reason: "invalid_claimed_status" });
});

Deno.test("returns not_found when booking is missing", async () => {
  const state = newState(null);
  const { result, statusCode } = await handleFinalize(
    { bookingId: BOOKING_ID, claimedStatus: "approved" },
    makeFake(state),
  );
  assertEquals(statusCode, 404);
  assertEquals(result, { ok: false, reason: "not_found" });
  assertEquals(state.audit[0].result, "not_found");
});

Deno.test("freshness: rejects bookings older than 3h with expired", async () => {
  const state = newState(freshBooking({
    created_at: new Date(Date.now() - 4 * HOUR).toISOString(),
  }));
  const { result, statusCode } = await handleFinalize(
    {
      bookingId: BOOKING_ID,
      claimedStatus: "approved",
      guestEmail: "guest@example.com",
      expectedAmount: 20,
    },
    makeFake(state),
  );
  assertEquals(statusCode, 410);
  assertEquals(result, { ok: false, reason: "expired" });
  assertEquals(state.audit.at(-1)?.result, "expired");
  assertEquals(state.updates.length, 0);
});

Deno.test("freshness: accepts bookings within the 3h window", async () => {
  const state = newState(freshBooking({
    created_at: new Date(Date.now() - 2 * HOUR).toISOString(),
  }));
  const { result, statusCode } = await handleFinalize(
    {
      bookingId: BOOKING_ID,
      claimedStatus: "approved",
      guestEmail: "guest@example.com",
      expectedAmount: 20,
    },
    makeFake(state),
  );
  assertEquals(statusCode, 200);
  assertEquals(result, { ok: true, status: "paid" });
});

Deno.test("email mismatch is rejected (case/whitespace insensitive check)", async () => {
  const state = newState(freshBooking({ guest_email: "Guest@Example.com" }));
  const { result, statusCode } = await handleFinalize(
    { bookingId: BOOKING_ID, claimedStatus: "approved", guestEmail: "someone-else@example.com" },
    makeFake(state),
  );
  assertEquals(statusCode, 403);
  assertEquals(result, { ok: false, reason: "email_mismatch" });
  assertEquals(state.updates.length, 0);
});

Deno.test("email matching is case- and whitespace-insensitive", async () => {
  const state = newState(freshBooking({ guest_email: "Guest@Example.com" }));
  const { result } = await handleFinalize(
    { bookingId: BOOKING_ID, claimedStatus: "approved", guestEmail: "  guest@example.com  " },
    makeFake(state),
  );
  assertEquals(result, { ok: true, status: "paid" });
});

Deno.test("amount mismatch is rejected when BAC returns a different amount", async () => {
  const state = newState(freshBooking());
  const { result, statusCode } = await handleFinalize(
    {
      bookingId: BOOKING_ID,
      claimedStatus: "approved",
      guestEmail: "guest@example.com",
      expectedAmount: 20,
      params: { amount: "10" },
    },
    makeFake(state),
  );
  assertEquals(statusCode, 409);
  assertEquals(result, { ok: false, reason: "amount_mismatch" });
});

Deno.test("amount within 0.01 tolerance passes", async () => {
  const state = newState(freshBooking());
  const { result } = await handleFinalize(
    {
      bookingId: BOOKING_ID,
      claimedStatus: "approved",
      guestEmail: "guest@example.com",
      expectedAmount: 20,
      params: { AMOUNT: "20.005" },
    },
    makeFake(state),
  );
  assertEquals(result, { ok: true, status: "paid" });
});

Deno.test("idempotency: booking already paid returns already_paid without update", async () => {
  const state = newState(freshBooking({ status: "paid", payment_id: "existing" }));
  const { result, statusCode } = await handleFinalize(
    { bookingId: BOOKING_ID, claimedStatus: "approved", guestEmail: "guest@example.com" },
    makeFake(state),
  );
  assertEquals(statusCode, 200);
  assertEquals(result, { ok: true, status: "already_paid" });
  assertEquals(state.updates.length, 0);
  assertEquals(state.booking?.payment_id, "existing");
});

Deno.test("idempotency: payment_failed booking returns already_failed", async () => {
  const state = newState(freshBooking({ status: "payment_failed" }));
  const { result } = await handleFinalize(
    { bookingId: BOOKING_ID, claimedStatus: "approved", guestEmail: "guest@example.com" },
    makeFake(state),
  );
  assertEquals(result, { ok: true, status: "already_failed" });
  assertEquals(state.updates.length, 0);
});

Deno.test("idempotency: race where UPDATE affects 0 rows returns already_paid", async () => {
  const state = newState(freshBooking(), { updateReturnsEmpty: true });
  const { result, statusCode } = await handleFinalize(
    {
      bookingId: BOOKING_ID,
      claimedStatus: "approved",
      guestEmail: "guest@example.com",
      expectedAmount: 20,
      params: { reference: "REF-123" },
    },
    makeFake(state),
  );
  assertEquals(statusCode, 200);
  assertEquals(result, { ok: true, status: "already_paid" });
  const raceLog = state.audit.at(-1);
  assertEquals(raceLog?.result, "already_paid");
  assertEquals((raceLog?.details as any).race, true);
});

Deno.test("approved: writes BAC reference as payment_id", async () => {
  const state = newState(freshBooking());
  await handleFinalize(
    {
      bookingId: BOOKING_ID,
      claimedStatus: "approved",
      guestEmail: "guest@example.com",
      expectedAmount: 20,
      params: { reference: "BAC-REF-789" },
    },
    makeFake(state),
  );
  assertEquals(state.updates[0], { status: "paid", payment_id: "BAC-REF-789" });
  assertEquals(state.booking?.status, "paid");
});

Deno.test("declined: transitions to payment_failed", async () => {
  const state = newState(freshBooking());
  const { result } = await handleFinalize(
    { bookingId: BOOKING_ID, claimedStatus: "declined", guestEmail: "guest@example.com" },
    makeFake(state),
  );
  assertEquals(result, { ok: true, status: "failed" });
  assertEquals(state.updates[0], { status: "payment_failed" });
  assertEquals(state.audit.at(-1)?.result, "payment_failed");
});

Deno.test("unknown claimedStatus makes no transition and logs no_status", async () => {
  const state = newState(freshBooking());
  const { result, statusCode } = await handleFinalize(
    { bookingId: BOOKING_ID, claimedStatus: "unknown", guestEmail: "guest@example.com" },
    makeFake(state),
  );
  assertEquals(statusCode, 400);
  assertEquals(result, { ok: false, reason: "no_status" });
  assertEquals(state.updates.length, 0);
  assertEquals(state.audit.at(-1)?.result, "no_status");
});

Deno.test("wrong_state returns 409 for unknown status values", async () => {
  const state = newState(freshBooking({ status: "in_progress" }));
  const { result, statusCode } = await handleFinalize(
    { bookingId: BOOKING_ID, claimedStatus: "approved", guestEmail: "guest@example.com" },
    makeFake(state),
  );
  assertEquals(statusCode, 409);
  assertEquals(result, { ok: false, reason: "wrong_state" });
});

Deno.test("fetch_failed bubbles up as 500", async () => {
  const state = newState(null, { fetchError: { message: "db down" } });
  const { result, statusCode } = await handleFinalize(
    { bookingId: BOOKING_ID, claimedStatus: "approved" },
    makeFake(state),
  );
  assertEquals(statusCode, 500);
  assertEquals(result, { ok: false, reason: "fetch_failed" });
});

// ---------------------------------------------------------------------------
// Concurrency / replay protection
// ---------------------------------------------------------------------------
// This fake enforces the same invariant Postgres does for the finalize-booking
// UPDATE: `.eq("status", "pending_payment")` only matches if the row is still
// pending. The first caller to reach the atomic update wins; every subsequent
// caller sees 0 rows updated and falls back to the "already_paid" reply.
function makeRacingFake(state: FakeState) {
  const yieldTick = () => new Promise((r) => setTimeout(r, Math.floor(Math.random() * 3)));
  return {
    from(table: string) {
      if (table === "audit_logs") {
        return {
          insert: async (row: Record<string, unknown>) => {
            state.audit.push(row);
            return { data: null, error: null };
          },
        };
      }
      return {
        select: (_cols?: string) => {
          const filters: Array<[string, unknown]> = [];
          const chain = {
            eq: (col: string, val: unknown) => {
              filters.push([col, val]);
              return chain;
            },
            maybeSingle: async () => {
              await yieldTick();
              if (!state.booking) return { data: null, error: null };
              const matches = filters.every(([c, v]) => (state.booking as any)[c] === v);
              return { data: matches ? { ...state.booking } : null, error: null };
            },
          };
          return chain;
        },
        update: (patch: Record<string, unknown>) => {
          const filters: Array<[string, unknown]> = [];
          const chain: any = {
            eq: (col: string, val: unknown) => {
              filters.push([col, val]);
              return chain;
            },
            select: (_c?: string) => ({
              maybeSingle: async () => {
                await yieldTick();
                // Atomic check-and-set — mirrors Postgres UPDATE ... WHERE.
                if (!state.booking) return { data: null, error: null };
                const matches = filters.every(([c, v]) => (state.booking as any)[c] === v);
                if (!matches) return { data: null, error: null };
                Object.assign(state.booking, patch);
                state.updates.push({ ...patch });
                return { data: { id: state.booking.id }, error: null };
              },
            }),
          };
          return chain;
        },
      };
    },
  };
}

Deno.test("replay: 10 concurrent approvals only flip the booking once", async () => {
  const state = newState(freshBooking());
  const fake = makeRacingFake(state);

  const calls = Array.from({ length: 10 }, (_, i) =>
    handleFinalize(
      {
        bookingId: BOOKING_ID,
        claimedStatus: "approved",
        guestEmail: "guest@example.com",
        expectedAmount: 20,
        // Every replay carries the same BAC reference — the whole point is
        // that the browser (or a refresh) can hit /booking/return repeatedly.
        params: { reference: "BAC-REF-REPLAY", amount: "20" },
      },
      fake,
    ).then((r) => r.result),
  );

  const results = await Promise.all(calls);

  const paid = results.filter((r) => r.ok && r.status === "paid");
  const alreadyPaid = results.filter((r) => r.ok && r.status === "already_paid");
  const failures = results.filter((r) => !r.ok);

  // Exactly one caller wins the transition; the rest are idempotent no-ops.
  assertEquals(paid.length, 1, `expected 1 winner, got ${paid.length}`);
  assertEquals(alreadyPaid.length, 9, `expected 9 replays, got ${alreadyPaid.length}`);
  assertEquals(failures.length, 0);

  // The DB row must reflect the winner's payment_id — and only one UPDATE
  // (the winning one) was ever actually applied to the row.
  assertEquals(state.booking?.status, "paid");
  assertEquals(state.booking?.payment_id, "BAC-REF-REPLAY");
  assertEquals(state.updates.length, 1);

  // Audit trail: exactly one "paid" entry. The nine replays land either as
  // an early idempotent already_paid (their pre-fetch saw status='paid') or
  // as a race already_paid (their UPDATE affected 0 rows) — both are
  // correct no-op paths.
  const paidLogs = state.audit.filter((a) => a.result === "paid");
  const alreadyPaidLogs = state.audit.filter((a) => a.result === "already_paid");
  assertEquals(paidLogs.length, 1);
  assertEquals(alreadyPaidLogs.length, 9);
});

Deno.test("replay: concurrent approve + decline — decline loses after approve wins", async () => {
  const state = newState(freshBooking());
  const fake = makeRacingFake(state);

  const [a, b, c] = await Promise.all([
    handleFinalize(
      {
        bookingId: BOOKING_ID,
        claimedStatus: "approved",
        guestEmail: "guest@example.com",
        expectedAmount: 20,
        params: { reference: "REF-A", amount: "20" },
      },
      fake,
    ),
    handleFinalize(
      {
        bookingId: BOOKING_ID,
        claimedStatus: "declined",
        guestEmail: "guest@example.com",
        expectedAmount: 20,
      },
      fake,
    ),
    handleFinalize(
      {
        bookingId: BOOKING_ID,
        claimedStatus: "approved",
        guestEmail: "guest@example.com",
        expectedAmount: 20,
        params: { reference: "REF-C", amount: "20" },
      },
      fake,
    ),
  ]);

  // Whichever of the three ran first is the only one that mutated the row;
  // the terminal status is either "paid" or "payment_failed" and never
  // flips back and forth. Exactly one call did the write.
  assertEquals(state.updates.length, 1);
  const terminal = state.booking?.status;
  const isTerminal = terminal === "paid" || terminal === "payment_failed";
  assertEquals(isTerminal, true, `unexpected terminal status: ${terminal}`);

  // No caller returned an error — the two losers get idempotent replies.
  for (const r of [a.result, b.result, c.result]) {
    assertEquals(r.ok, true);
  }
});

// ---------------------------------------------------------------------------
// Audit-log field consistency
// ---------------------------------------------------------------------------
// Every branch of handleFinalize must emit a bac_return_verification row that
// carries the same core fields (attempt_id, email, amount, transition) so
// admins can filter/inspect any outcome without special-casing shapes.

const REQUIRED_AUDIT_FIELDS = ["attempt_id", "email", "amount", "transition", "claimed_status", "bac_params"];

function assertAuditShape(row: Record<string, unknown> | undefined, expected: {
  result: string;
  from: string | null;
  to: string | null;
  provided?: string | null;
  bookingEmail?: string | null;
  expected?: number | null;
  returned?: number | null;
  target?: string | null;
}) {
  if (!row) throw new Error("expected an audit row, got none");
  assertEquals(row.action, "bac_return_verification");
  assertEquals(row.target_type, "booking");
  if (expected.target !== undefined) assertEquals(row.target_id, expected.target);
  assertEquals(row.result, expected.result);
  const details = row.details as Record<string, any>;
  for (const f of REQUIRED_AUDIT_FIELDS) {
    if (!(f in details)) throw new Error(`audit ${expected.result} missing field '${f}'`);
  }
  // attempt_id must be a non-empty string.
  assertEquals(typeof details.attempt_id, "string");
  assertEquals((details.attempt_id as string).length > 0, true);
  // transition must always be an object with from/to keys.
  assertEquals(details.transition.from, expected.from);
  assertEquals(details.transition.to, expected.to);
  // email pair.
  assertEquals(details.email.provided, expected.provided ?? null);
  assertEquals(details.email.booking, expected.bookingEmail ?? null);
  // amount pair.
  assertEquals(details.amount.expected, expected.expected ?? null);
  assertEquals(details.amount.returned, expected.returned ?? null);
}

Deno.test("audit shape: invalid_booking_id logs required fields with null booking context", async () => {
  const state = newState(freshBooking());
  await handleFinalize(
    { bookingId: "not-a-uuid", claimedStatus: "approved", guestEmail: "g@e.com", expectedAmount: 20 },
    makeFake(state),
  );
  assertEquals(state.audit.length, 1);
  assertAuditShape(state.audit[0], {
    result: "invalid_booking_id", from: null, to: null,
    provided: "g@e.com", expected: 20, target: null,
  });
});

Deno.test("audit shape: invalid_claimed_status logs required fields", async () => {
  const state = newState(freshBooking());
  await handleFinalize(
    { bookingId: BOOKING_ID, claimedStatus: "bogus" as any, guestEmail: "g@e.com", expectedAmount: 20 },
    makeFake(state),
  );
  assertAuditShape(state.audit.at(-1), {
    result: "invalid_claimed_status", from: null, to: null,
    provided: "g@e.com", expected: 20, target: BOOKING_ID,
  });
  const d = state.audit.at(-1)!.details as any;
  assertEquals(d.claimed_status, "bogus");
});

Deno.test("audit shape: not_found includes attempt_id and empty transition", async () => {
  const state = newState(null);
  await handleFinalize(
    { bookingId: BOOKING_ID, claimedStatus: "approved", guestEmail: "g@e.com", expectedAmount: 20 },
    makeFake(state),
  );
  assertAuditShape(state.audit.at(-1), {
    result: "not_found", from: null, to: null,
    provided: "g@e.com", expected: 20, target: BOOKING_ID,
  });
});

Deno.test("audit shape: fetch_failed records error and null transition", async () => {
  const state = newState(null, { fetchError: { message: "db down" } });
  await handleFinalize(
    { bookingId: BOOKING_ID, claimedStatus: "approved", guestEmail: "g@e.com", expectedAmount: 20 },
    makeFake(state),
  );
  const row = state.audit.at(-1)!;
  assertAuditShape(row, {
    result: "fetch_failed", from: null, to: null,
    provided: "g@e.com", expected: 20, target: BOOKING_ID,
  });
  assertEquals((row.details as any).error, "db down");
});

Deno.test("audit shape: already_paid records transition paid→paid with booking email", async () => {
  const state = newState(freshBooking({ status: "paid", payment_id: "existing" }));
  await handleFinalize(
    { bookingId: BOOKING_ID, claimedStatus: "approved", guestEmail: "guest@example.com", expectedAmount: 20 },
    makeFake(state),
  );
  assertAuditShape(state.audit.at(-1), {
    result: "already_paid", from: "paid", to: "paid",
    provided: "guest@example.com", bookingEmail: "guest@example.com",
    expected: 20, target: BOOKING_ID,
  });
});

Deno.test("audit shape: already_failed logs current status in transition", async () => {
  const state = newState(freshBooking({ status: "payment_failed" }));
  await handleFinalize(
    { bookingId: BOOKING_ID, claimedStatus: "approved", guestEmail: "guest@example.com", expectedAmount: 20 },
    makeFake(state),
  );
  assertAuditShape(state.audit.at(-1), {
    result: "already_failed", from: "payment_failed", to: "payment_failed",
    provided: "guest@example.com", bookingEmail: "guest@example.com",
    expected: 20, target: BOOKING_ID,
  });
});

Deno.test("audit shape: wrong_state (unexpected/invalid booking state) logs from with null to", async () => {
  const state = newState(freshBooking({ status: "in_progress" }));
  await handleFinalize(
    { bookingId: BOOKING_ID, claimedStatus: "approved", guestEmail: "guest@example.com", expectedAmount: 20 },
    makeFake(state),
  );
  const row = state.audit.at(-1)!;
  assertAuditShape(row, {
    result: "wrong_state", from: "in_progress", to: null,
    provided: "guest@example.com", bookingEmail: "guest@example.com",
    expected: 20, target: BOOKING_ID,
  });
  assertEquals((row.details as any).current_status, "in_progress");
});

Deno.test("audit shape: expired records booking email and null to", async () => {
  const state = newState(freshBooking({
    created_at: new Date(Date.now() - 4 * HOUR).toISOString(),
  }));
  await handleFinalize(
    { bookingId: BOOKING_ID, claimedStatus: "approved", guestEmail: "guest@example.com", expectedAmount: 20 },
    makeFake(state),
  );
  assertAuditShape(state.audit.at(-1), {
    result: "expired", from: "pending_payment", to: null,
    provided: "guest@example.com", bookingEmail: "guest@example.com",
    expected: 20, target: BOOKING_ID,
  });
});

Deno.test("audit shape: email_mismatch logs both provided and booking emails", async () => {
  const state = newState(freshBooking({ guest_email: "Guest@Example.com" }));
  await handleFinalize(
    { bookingId: BOOKING_ID, claimedStatus: "approved", guestEmail: "someone-else@example.com", expectedAmount: 20 },
    makeFake(state),
  );
  assertAuditShape(state.audit.at(-1), {
    result: "email_mismatch", from: "pending_payment", to: null,
    provided: "someone-else@example.com", bookingEmail: "Guest@Example.com",
    expected: 20, target: BOOKING_ID,
  });
});

Deno.test("audit shape: amount_mismatch logs expected and returned amounts", async () => {
  const state = newState(freshBooking());
  await handleFinalize(
    {
      bookingId: BOOKING_ID, claimedStatus: "approved",
      guestEmail: "guest@example.com", expectedAmount: 20,
      params: { amount: "10" },
    },
    makeFake(state),
  );
  assertAuditShape(state.audit.at(-1), {
    result: "amount_mismatch", from: "pending_payment", to: null,
    provided: "guest@example.com", bookingEmail: "guest@example.com",
    expected: 20, returned: 10, target: BOOKING_ID,
  });
});

Deno.test("audit shape: paid records transition pending_payment→paid and payment_id", async () => {
  const state = newState(freshBooking());
  await handleFinalize(
    {
      bookingId: BOOKING_ID, claimedStatus: "approved",
      guestEmail: "guest@example.com", expectedAmount: 20,
      params: { reference: "BAC-REF-789", amount: "20" },
    },
    makeFake(state),
  );
  const row = state.audit.at(-1)!;
  assertAuditShape(row, {
    result: "paid", from: "pending_payment", to: "paid",
    provided: "guest@example.com", bookingEmail: "guest@example.com",
    expected: 20, returned: 20, target: BOOKING_ID,
  });
  assertEquals((row.details as any).payment_id, "BAC-REF-789");
});

Deno.test("audit shape: race already_paid marks race=true and transition pending_payment→paid", async () => {
  const state = newState(freshBooking(), { updateReturnsEmpty: true });
  await handleFinalize(
    {
      bookingId: BOOKING_ID, claimedStatus: "approved",
      guestEmail: "guest@example.com", expectedAmount: 20,
      params: { reference: "REF", amount: "20" },
    },
    makeFake(state),
  );
  const row = state.audit.at(-1)!;
  assertAuditShape(row, {
    result: "already_paid", from: "pending_payment", to: "paid",
    provided: "guest@example.com", bookingEmail: "guest@example.com",
    expected: 20, returned: 20, target: BOOKING_ID,
  });
  assertEquals((row.details as any).race, true);
});

Deno.test("audit shape: payment_failed on declined records transition pending_payment→payment_failed", async () => {
  const state = newState(freshBooking());
  await handleFinalize(
    { bookingId: BOOKING_ID, claimedStatus: "declined", guestEmail: "guest@example.com", expectedAmount: 20 },
    makeFake(state),
  );
  const row = state.audit.at(-1)!;
  assertAuditShape(row, {
    result: "payment_failed", from: "pending_payment", to: "payment_failed",
    provided: "guest@example.com", bookingEmail: "guest@example.com",
    expected: 20, target: BOOKING_ID,
  });
  assertEquals((row.details as any).reason, "declined");
});

Deno.test("audit shape: no_status (unknown claimedStatus) logs from with null to", async () => {
  const state = newState(freshBooking());
  await handleFinalize(
    { bookingId: BOOKING_ID, claimedStatus: "unknown", guestEmail: "guest@example.com", expectedAmount: 20 },
    makeFake(state),
  );
  assertAuditShape(state.audit.at(-1), {
    result: "no_status", from: "pending_payment", to: null,
    provided: "guest@example.com", bookingEmail: "guest@example.com",
    expected: 20, target: BOOKING_ID,
  });
});

Deno.test("audit shape: attempt_id is stable within a call and unique across calls", async () => {
  const state = newState(freshBooking({ status: "paid" }));
  await handleFinalize(
    { bookingId: BOOKING_ID, claimedStatus: "approved", guestEmail: "guest@example.com" },
    makeFake(state),
  );
  const state2 = newState(freshBooking({ status: "paid" }));
  await handleFinalize(
    { bookingId: BOOKING_ID, claimedStatus: "approved", guestEmail: "guest@example.com" },
    makeFake(state2),
  );
  const id1 = (state.audit[0].details as any).attempt_id;
  const id2 = (state2.audit[0].details as any).attempt_id;
  assertEquals(typeof id1, "string");
  assertEquals(typeof id2, "string");
  assertEquals(id1 === id2, false, "attempt_id should differ across invocations");
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------
// Randomly generate BAC return payloads (email, amount, claimedStatus, params,
// booking age, booking initial status) and assert three invariants must hold
// for every generated input:
//   1. Idempotency — invoking handleFinalize a second time with the same
//      payload never mutates the row again and returns an idempotent reply.
//   2. Audit shape consistency — every call produces >=1 audit row and every
//      row carries attempt_id, email, amount, transition, and bac_params.
//   3. No unexpected state transitions — the booking row only ever moves
//      pending_payment -> {paid, payment_failed}. Terminal states never
//      change. `transition.to` in audit rows always matches the actual row.
//
// We use a deterministic seeded PRNG so failures are reproducible from the
// printed seed. Bump ITERATIONS if you want more coverage locally.

const ITERATIONS = 120;
const REQUIRED_DETAIL_FIELDS = ["attempt_id", "email", "amount", "transition", "bac_params", "claimed_status"];
const TERMINAL_STATES = new Set(["paid", "payment_failed"]);
const ALLOWED_TRANSITIONS: Record<string, Set<string>> = {
  pending_payment: new Set(["pending_payment", "paid", "payment_failed"]),
  paid: new Set(["paid"]),
  payment_failed: new Set(["payment_failed"]),
  cancelled: new Set(["cancelled"]),
  in_progress: new Set(["in_progress"]),
};

// Mulberry32 — small, deterministic, seedable PRNG.
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickFrom<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

const STATUS_POOL = ["pending_payment", "paid", "payment_failed", "cancelled", "in_progress"] as const;
const CLAIMED_POOL = ["approved", "declined", "cancelled", "unknown"] as const;
const EMAIL_POOL = ["guest@example.com", "GUEST@example.com", "  guest@example.com  ", "someone-else@example.com", ""] as const;
const AMOUNT_KEY_POOL = ["amount", "AMOUNT", "total", "TOTAL"] as const;
const REF_KEY_POOL = ["reference", "order", "orderNumber", "invoice"] as const;

type Payload = {
  bookingId: string;
  claimedStatus: any;
  guestEmail?: string;
  expectedAmount?: number;
  params?: Record<string, string>;
};

function genBooking(rng: () => number): Booking {
  const ageHours = rng() * 6; // 0..6h -> spans fresh and expired
  return {
    id: BOOKING_ID,
    status: pickFrom(rng, STATUS_POOL),
    total_price: 20,
    guest_email: "guest@example.com",
    created_at: new Date(Date.now() - ageHours * HOUR).toISOString(),
    payment_id: null,
  };
}

function genPayload(rng: () => number): Payload {
  const p: Payload = {
    bookingId: BOOKING_ID,
    claimedStatus: pickFrom(rng, CLAIMED_POOL),
  };
  if (rng() < 0.9) p.guestEmail = pickFrom(rng, EMAIL_POOL) || undefined;
  if (rng() < 0.9) p.expectedAmount = 20;
  if (rng() < 0.85) {
    const params: Record<string, string> = {};
    if (rng() < 0.9) params[pickFrom(rng, AMOUNT_KEY_POOL)] = pickFrom(rng, ["20", "20.005", "10", "abc", "20.5"]);
    if (rng() < 0.6) params[pickFrom(rng, REF_KEY_POOL)] = `REF-${Math.floor(rng() * 1e6)}`;
    p.params = params;
  }
  return p;
}

function validateAudit(rows: Array<Record<string, unknown>>, seed: number, tag: string) {
  if (rows.length === 0) throw new Error(`[seed=${seed} ${tag}] expected >=1 audit row`);
  for (const row of rows) {
    if (row.action !== "bac_return_verification") {
      throw new Error(`[seed=${seed} ${tag}] audit action=${row.action}`);
    }
    if (row.target_type !== "booking") {
      throw new Error(`[seed=${seed} ${tag}] audit target_type=${row.target_type}`);
    }
    const details = row.details as Record<string, any> | undefined;
    if (!details) throw new Error(`[seed=${seed} ${tag}] audit details missing`);
    for (const f of REQUIRED_DETAIL_FIELDS) {
      if (!(f in details)) throw new Error(`[seed=${seed} ${tag}] audit ${row.result} missing '${f}'`);
    }
    if (typeof details.attempt_id !== "string" || details.attempt_id.length === 0) {
      throw new Error(`[seed=${seed} ${tag}] audit ${row.result} bad attempt_id`);
    }
    if (typeof details.email !== "object" || details.email == null) {
      throw new Error(`[seed=${seed} ${tag}] audit email not object`);
    }
    if (!("provided" in details.email) || !("booking" in details.email)) {
      throw new Error(`[seed=${seed} ${tag}] audit email keys`);
    }
    if (typeof details.amount !== "object" || details.amount == null) {
      throw new Error(`[seed=${seed} ${tag}] audit amount not object`);
    }
    if (!("expected" in details.amount) || !("returned" in details.amount)) {
      throw new Error(`[seed=${seed} ${tag}] audit amount keys`);
    }
    if (typeof details.transition !== "object" || details.transition == null) {
      throw new Error(`[seed=${seed} ${tag}] audit transition not object`);
    }
    if (!("from" in details.transition) || !("to" in details.transition)) {
      throw new Error(`[seed=${seed} ${tag}] audit transition keys`);
    }
    // Transition sanity: `from` must be one of our known states or null; `to`
    // must belong to the allowed transitions for `from` when both are set.
    const from = details.transition.from as string | null;
    const to = details.transition.to as string | null;
    if (from != null && to != null) {
      const allowed = ALLOWED_TRANSITIONS[from];
      if (!allowed || !allowed.has(to)) {
        throw new Error(`[seed=${seed} ${tag}] illegal transition ${from}->${to} (result=${row.result})`);
      }
    }
  }
}

Deno.test("property: random payloads uphold idempotency + audit shape + legal transitions", async () => {
  const baseSeed = Number(Deno.env.get("FINALIZE_SEED") ?? Date.now() & 0xffffffff);

  for (let i = 0; i < ITERATIONS; i++) {
    const seed = (baseSeed + i) >>> 0;
    const rng = makeRng(seed);

    const initialBooking = genBooking(rng);
    const initialStatus = initialBooking.status;
    const initialPaymentId = initialBooking.payment_id;
    const payload = genPayload(rng);

    const state = newState({ ...initialBooking });

    // --- First call ---
    let r1;
    try {
      r1 = await handleFinalize(payload, makeFake(state));
    } catch (e) {
      throw new Error(`[seed=${seed}] first call threw: ${(e as Error).message}`);
    }

    // Invariant: legal transition on the booking row itself.
    const afterFirstStatus = state.booking!.status;
    const allowedFromInitial = ALLOWED_TRANSITIONS[initialStatus];
    if (!allowedFromInitial || !allowedFromInitial.has(afterFirstStatus)) {
      throw new Error(`[seed=${seed}] illegal row transition ${initialStatus}->${afterFirstStatus} (payload=${JSON.stringify(payload)})`);
    }
    // Invariant: terminal states never change.
    if (TERMINAL_STATES.has(initialStatus) && afterFirstStatus !== initialStatus) {
      throw new Error(`[seed=${seed}] terminal ${initialStatus} mutated to ${afterFirstStatus}`);
    }
    if (initialStatus === "cancelled" && afterFirstStatus !== "cancelled") {
      throw new Error(`[seed=${seed}] cancelled row mutated to ${afterFirstStatus}`);
    }
    if (initialStatus === "paid" && state.booking!.payment_id !== initialPaymentId) {
      throw new Error(`[seed=${seed}] paid row payment_id overwritten`);
    }

    // Invariant: audit rows exist and are well-shaped.
    validateAudit(state.audit, seed, "first");

    // Invariant: at least one audit row's transition.to matches the actual
    // post-call row status (or is null for pure rejections that never touched
    // the row).
    const lastAudit = state.audit.at(-1)!;
    const lastTo = (lastAudit.details as any).transition.to as string | null;
    const rowUnchanged = afterFirstStatus === initialStatus;
    if (lastTo != null && lastTo !== afterFirstStatus && !(rowUnchanged && lastTo === initialStatus)) {
      throw new Error(`[seed=${seed}] audit transition.to=${lastTo} != row status=${afterFirstStatus}`);
    }

    // --- Second call: idempotency ---
    const updatesBefore = state.updates.length;
    const statusBefore = state.booking!.status;
    const paymentIdBefore = state.booking!.payment_id;

    let r2;
    try {
      r2 = await handleFinalize(payload, makeFake(state));
    } catch (e) {
      throw new Error(`[seed=${seed}] second call threw: ${(e as Error).message}`);
    }

    // Idempotency: row must not have moved after the second call.
    if (state.booking!.status !== statusBefore) {
      throw new Error(`[seed=${seed}] second call changed status ${statusBefore}->${state.booking!.status}`);
    }
    if (state.booking!.payment_id !== paymentIdBefore) {
      throw new Error(`[seed=${seed}] second call changed payment_id ${paymentIdBefore}->${state.booking!.payment_id}`);
    }
    // Idempotency: if the row already reached a terminal state on the first
    // call, the second call must not issue another mutating UPDATE against
    // pending_payment. (The declined branch always issues a filtered UPDATE
    // which is a no-op on a non-pending row — that's still safe, so we only
    // enforce this for the approved path.)
    if (payload.claimedStatus === "approved" && TERMINAL_STATES.has(statusBefore)) {
      if (state.updates.length !== updatesBefore) {
        throw new Error(`[seed=${seed}] approved replay issued extra update on terminal row`);
      }
    }

    // Idempotency: replies must be structurally consistent — both errors or
    // both successes. A successful first call must never be followed by an
    // error second call for the identical payload.
    if (r1.result.ok && !r2.result.ok) {
      throw new Error(`[seed=${seed}] first ok but replay failed with ${(r2.result as any).reason}`);
    }

    validateAudit(state.audit, seed, "second");
  }
});

