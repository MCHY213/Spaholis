// deno-lint-ignore-file no-explicit-any
// Edge function: paypal-config
// Returns the PUBLIC PayPal client id + currency so the browser can load the
// PayPal JS SDK. The secret never leaves the server.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID") ?? "";
  const configured = !!clientId && !!Deno.env.get("PAYPAL_SECRET");
  return new Response(
    JSON.stringify({ clientId, currency: "USD", configured }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
