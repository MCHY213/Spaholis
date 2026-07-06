// E2E tests for the create-booking edge function.
//
// Validates that checkout inserts a row into `bookings` without triggering
// Row Level Security errors for BOTH guest (anonymous) and authenticated
// callers. Runs against the deployed function using the anon key + a freshly
// created test user, then cleans up all rows/users it created.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const ANON_KEY =
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const FN_URL = `${SUPABASE_URL}/functions/v1/create-booking`;
const FINALIZE_URL = `${SUPABASE_URL}/functions/v1/finalize-booking`;

// "program" type => no deposit, no room required, cheapest path to
// exercise the full insert into `bookings`.
const TEST_SERVICE_ID = "1d463927-32d0-410c-a563-9004bb52d5d7";

// Room-based treatment ("treatment" type + Holistic Therapy category)
// => requires deposit, so create-booking parks it in `pending_payment`
// and finalize-booking can then flip it to `paid`.
const TREATMENT_SERVICE_ID = "47f0d6d2-5071-4a43-a2a4-fd7f65753965"; // 30 min
const TREATMENT_DURATION_MIN = 30;
const TREATMENT_ROOM_ID = "d27303d9-abc4-4bfd-8a7d-1afca0d4168e"; // Room 2 (no forbidden categories)

const TEST_MARKER = "e2e-checkout-rls-test";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function futureDate(daysAhead = 14): { date: string; time: string } {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  const date = d.toISOString().slice(0, 10);
  return { date, time: "10:00" };
}

// Same-day slot picked at least 30 minutes from now (edge function enforces
// a 15-min lead time for room bookings). Falls through to tomorrow if the
// current UTC time is past the day's usable window.
function sameDaySlot(minLeadMinutes = 30): { date: string; time: string; startIso: string; endIso: string } {
  const now = new Date();
  const start = new Date(now.getTime() + minLeadMinutes * 60_000);
  // Round up to the next :00 or :30.
  const mins = start.getUTCMinutes();
  if (mins > 0 && mins <= 30) start.setUTCMinutes(30, 0, 0);
  else if (mins > 30) {
    start.setUTCHours(start.getUTCHours() + 1, 0, 0, 0);
  } else start.setUTCSeconds(0, 0);

  const date = start.toISOString().slice(0, 10);
  const hh = String(start.getUTCHours()).padStart(2, "0");
  const mm = String(start.getUTCMinutes()).padStart(2, "0");
  return {
    date,
    time: `${hh}:${mm}`,
    startIso: start.toISOString(),
    endIso: new Date(start.getTime() + TREATMENT_DURATION_MIN * 60_000).toISOString(),
  };
}

// Business hours in the edge function are computed in America/Costa_Rica
// (see `businessHours.ts`): Mon–Sat 09:00–19:00, Sun 09:00–17:30. Pick a
// slot at 14:00 CR on a future date so ensureSlotAvailable accepts it.
function futureRoomSlot(daysAhead = 3): { date: string; time: string; startIso: string; endIso: string } {
  const now = new Date();
  const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  // Extract the CR wall-clock date parts and build 14:00 CR from them.
  const shifted = new Date(future.getTime() + (-360) * 60 * 1000); // CR = UTC-6
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();
  // 14:00 CR = 20:00 UTC.
  const start = new Date(Date.UTC(y, m, d, 14 - (-6), 0, 0, 0));
  return {
    date: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    time: "14:00",
    startIso: start.toISOString(),
    endIso: new Date(start.getTime() + TREATMENT_DURATION_MIN * 60_000).toISOString(),
  };
}

async function callCreateBooking(token: string, body: Record<string, unknown>) {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function callFinalize(body: Record<string, unknown>) {
  const res = await fetch(FINALIZE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}


async function cleanupByEmail(email: string) {
  await admin.from("bookings").delete().eq("guest_email", email);
}

Deno.test("checkout as guest creates booking without RLS error", async () => {
  const { date, time } = futureDate(14);
  const email = `guest+${crypto.randomUUID()}@${TEST_MARKER}.test`;

  const { status, json } = await callCreateBooking(ANON_KEY, {
    service_id: TEST_SERVICE_ID,
    booking_date: date,
    booking_time: time,
    guest_name: "Guest Tester",
    guest_email: email,
    guest_phone: "+50600000000",
    notes: TEST_MARKER,
  });

  try {
    assertEquals(status, 200, `Guest checkout failed: ${JSON.stringify(json)}`);
    assertEquals(json.ok, true);
    assert(typeof json.bookingId === "string" && json.bookingId.length > 0);

    // Verify the row actually landed in bookings and no RLS blocked it.
    const { data, error } = await admin
      .from("bookings")
      .select("id, user_id, guest_email, status")
      .eq("id", json.bookingId)
      .maybeSingle();

    assertEquals(error, null);
    assert(data, "booking row not persisted");
    assertEquals(data!.guest_email, email);
    assertEquals(data!.user_id, null, "guest booking must have null user_id");
  } finally {
    await cleanupByEmail(email);
  }
});

Deno.test("checkout as authenticated user creates booking without RLS error", async () => {
  const email = `auth+${crypto.randomUUID()}@${TEST_MARKER}.test`;
  const password = `Test-${crypto.randomUUID()}`;

  // Create + auto-confirm a throwaway user via the service role.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assertEquals(createErr, null, `createUser failed: ${createErr?.message}`);
  const userId = created.user!.id;

  try {
    // Sign in as anon to get a real JWT for that user.
    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signIn, error: signInErr } =
      await anonClient.auth.signInWithPassword({ email, password });
    assertEquals(signInErr, null, `signIn failed: ${signInErr?.message}`);
    const accessToken = signIn.session!.access_token;

    const { date, time } = futureDate(15);
    const { status, json } = await callCreateBooking(accessToken, {
      service_id: TEST_SERVICE_ID,
      booking_date: date,
      booking_time: time,
      guest_name: "Auth Tester",
      guest_email: email,
      guest_phone: "+50600000000",
      notes: TEST_MARKER,
    });

    assertEquals(
      status,
      200,
      `Authenticated checkout failed: ${JSON.stringify(json)}`,
    );
    assertEquals(json.ok, true);
    assert(typeof json.bookingId === "string" && json.bookingId.length > 0);

    // Verify user_id was persisted (proves the JWT was decoded, not treated as guest).
    const { data, error } = await admin
      .from("bookings")
      .select("id, user_id, guest_email")
      .eq("id", json.bookingId)
      .maybeSingle();

    assertEquals(error, null);
    assert(data, "authenticated booking row not persisted");
    assertEquals(data!.user_id, userId);
    assertEquals(data!.guest_email, email);

    // The authenticated user must be able to read their own booking under RLS.
    const { data: viaRls, error: rlsErr } = await anonClient
      .from("bookings")
      .select("id")
      .eq("id", json.bookingId)
      .maybeSingle();
    assertEquals(rlsErr, null, `RLS SELECT failed: ${rlsErr?.message}`);
    assert(viaRls, "authenticated user could not SELECT their own booking");

    await anonClient.auth.signOut();
  } finally {
    await cleanupByEmail(email);
    await admin.auth.admin.deleteUser(userId);
  }
});

// ---------------------------------------------------------------------------
// Same-day booking tests
// ---------------------------------------------------------------------------

Deno.test("same-day guest checkout succeeds when a future slot remains today", async () => {
  const { date, time } = sameDaySlot(30);
  const email = `same-day-guest+${crypto.randomUUID()}@${TEST_MARKER}.test`;

  const { status, json } = await callCreateBooking(ANON_KEY, {
    service_id: TEST_SERVICE_ID, // program → no room, no deposit, no business-hour check
    booking_date: date,
    booking_time: time,
    guest_name: "Same-Day Guest",
    guest_email: email,
    notes: TEST_MARKER,
  });

  try {
    assertEquals(status, 200, `Same-day guest checkout failed: ${JSON.stringify(json)}`);
    assertEquals(json.ok, true);

    const { data, error } = await admin
      .from("bookings")
      .select("id, booking_date, user_id")
      .eq("id", json.bookingId)
      .maybeSingle();

    assertEquals(error, null);
    assert(data, "same-day guest booking not persisted");
    assertEquals(data!.booking_date, date, "booking_date must equal today");
    assertEquals(data!.user_id, null);
  } finally {
    await cleanupByEmail(email);
  }
});

Deno.test("same-day authenticated checkout succeeds when a future slot remains today", async () => {
  const email = `same-day-auth+${crypto.randomUUID()}@${TEST_MARKER}.test`;
  const password = `Test-${crypto.randomUUID()}`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  assertEquals(createErr, null);
  const userId = created.user!.id;

  try {
    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signIn, error: signInErr } =
      await anonClient.auth.signInWithPassword({ email, password });
    assertEquals(signInErr, null);
    const accessToken = signIn.session!.access_token;

    const { date, time } = sameDaySlot(45);
    const { status, json } = await callCreateBooking(accessToken, {
      service_id: TEST_SERVICE_ID,
      booking_date: date,
      booking_time: time,
      guest_name: "Same-Day Auth",
      guest_email: email,
      notes: TEST_MARKER,
    });

    assertEquals(status, 200, `Same-day auth checkout failed: ${JSON.stringify(json)}`);
    assertEquals(json.ok, true);

    const { data, error } = await admin
      .from("bookings")
      .select("id, booking_date, user_id")
      .eq("id", json.bookingId)
      .maybeSingle();

    assertEquals(error, null);
    assert(data, "same-day auth booking not persisted");
    assertEquals(data!.booking_date, date);
    assertEquals(data!.user_id, userId);

    await anonClient.auth.signOut();
  } finally {
    await cleanupByEmail(email);
    await admin.auth.admin.deleteUser(userId);
  }
});

// ---------------------------------------------------------------------------
// Full paid-booking flow (create-booking → finalize-booking → status='paid')
// ---------------------------------------------------------------------------

async function runPaidFlow(opts: { accessToken: string; email: string; expectedUserId: string | null }) {
  const { date, time, startIso, endIso } = futureRoomSlot(3);
  const { status, json } = await callCreateBooking(opts.accessToken, {
    service_id: TREATMENT_SERVICE_ID,
    booking_date: date,
    booking_time: time,
    guest_name: "Paid Flow Tester",
    guest_email: opts.email,
    notes: TEST_MARKER,
    room_id: TREATMENT_ROOM_ID,
    start_time: startIso,
    end_time: endIso,
  });
  assertEquals(status, 200, `create-booking failed: ${JSON.stringify(json)}`);
  assertEquals(json.ok, true);
  assertEquals(json.status, "pending_payment", "deposit service must park in pending_payment");
  const bookingId = json.bookingId as string;

  // Sanity-check the row exists and belongs to the right identity.
  const { data: pre } = await admin
    .from("bookings")
    .select("id, status, user_id, total_price")
    .eq("id", bookingId)
    .maybeSingle();
  assert(pre, "booking not persisted before finalize");
  assertEquals(pre!.status, "pending_payment");
  assertEquals(pre!.user_id, opts.expectedUserId);

  // Simulate the BAC return: browser posts the bookingId + claimedStatus.
  const fin = await callFinalize({
    bookingId,
    guestEmail: opts.email,
    expectedAmount: Number(pre!.total_price),
    claimedStatus: "approved",
    params: { reference: `test_ref_${bookingId.slice(0, 8)}` },
  });
  assertEquals(fin.status, 200, `finalize-booking failed: ${JSON.stringify(fin.json)}`);
  assertEquals(fin.json.ok, true);
  assertEquals(fin.json.status, "paid", "finalize-booking must flip status to paid");

  const { data: post, error: postErr } = await admin
    .from("bookings")
    .select("id, status, payment_id, user_id")
    .eq("id", bookingId)
    .maybeSingle();
  assertEquals(postErr, null);
  assert(post, "booking missing after finalize");
  assertEquals(post!.status, "paid", "final booking status must be 'paid'");
  assert(post!.payment_id, "paid booking must have a payment_id");
  return bookingId;
}

Deno.test("guest can complete a paid booking end-to-end", async () => {
  const email = `paid-guest+${crypto.randomUUID()}@${TEST_MARKER}.test`;
  try {
    await runPaidFlow({ accessToken: ANON_KEY, email, expectedUserId: null });
  } finally {
    await cleanupByEmail(email);
  }
});

Deno.test("authenticated user can complete a paid booking end-to-end", async () => {
  const email = `paid-auth+${crypto.randomUUID()}@${TEST_MARKER}.test`;
  const password = `Test-${crypto.randomUUID()}`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  assertEquals(createErr, null);
  const userId = created.user!.id;

  try {
    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signIn, error: signInErr } =
      await anonClient.auth.signInWithPassword({ email, password });
    assertEquals(signInErr, null);
    const accessToken = signIn.session!.access_token;

    await runPaidFlow({ accessToken, email, expectedUserId: userId });

    await anonClient.auth.signOut();
  } finally {
    await cleanupByEmail(email);
    await admin.auth.admin.deleteUser(userId);
  }
});
