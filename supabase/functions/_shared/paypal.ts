// Shared PayPal REST helpers used by paypal-create-order and paypal-capture-order.
// Server-side only — do NOT import from client code.

const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";
const LIVE_BASE = "https://api-m.paypal.com";

export function paypalBaseUrl(): string {
  const env = (Deno.env.get("PAYPAL_ENVIRONMENT") || "sandbox").toLowerCase();
  return env === "live" || env === "production" ? LIVE_BASE : SANDBOX_BASE;
}

export function paypalEnvironment(): "sandbox" | "live" {
  const env = (Deno.env.get("PAYPAL_ENVIRONMENT") || "sandbox").toLowerCase();
  return env === "live" || env === "production" ? "live" : "sandbox";
}

/**
 * Fetch an OAuth2 access token from PayPal using the client credentials flow.
 * Throws on missing credentials or non-2xx responses so the caller can surface
 * a clear error to the client.
 */
export async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const secret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  if (!clientId || !secret) {
    throw new Error(
      "PayPal is not configured: missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET.",
    );
  }

  const basic = btoa(`${clientId}:${secret}`);
  const res = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`PayPal auth failed (${res.status}): ${text}`);
  }
  let parsed: { access_token?: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`PayPal auth returned non-JSON: ${text}`);
  }
  if (!parsed.access_token) {
    throw new Error(`PayPal auth response missing access_token: ${text}`);
  }
  return parsed.access_token;
}

export async function paypalFetch(
  path: string,
  init: RequestInit & { accessToken: string },
): Promise<{ status: number; body: any; raw: string }> {
  const { accessToken, headers, ...rest } = init;
  const res = await fetch(`${paypalBaseUrl()}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(headers || {}),
    },
  });
  const raw = await res.text();
  let body: any = null;
  if (raw) {
    try { body = JSON.parse(raw); } catch { body = raw; }
  }
  return { status: res.status, body, raw };
}
