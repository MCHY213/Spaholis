import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

type Ctx = {
  booking_id: string;
  email: string;
  amount: number;
  started_at: string;
};

const TestPaymentReturn = () => {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [status, setStatus] = useState<"loading" | "found" | "missing">("loading");
  const [dbStatus, setDbStatus] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("test_payment_context");
    if (!raw) {
      setStatus("missing");
      return;
    }
    const parsed = JSON.parse(raw) as Ctx;
    setCtx(parsed);
    (async () => {
      const { data } = await supabase
        .from("bookings")
        .select("status")
        .eq("id", parsed.booking_id)
        .maybeSingle();
      setDbStatus(data?.status ?? null);
      setStatus("found");
    })();
  }, []);

  const params = new URLSearchParams(window.location.search);
  const paramList = Array.from(params.entries());

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            {status === "loading" && <Loader2 className="h-5 w-5 animate-spin" />}
            {status === "found" && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            {status === "missing" && <AlertTriangle className="h-5 w-5 text-amber-600" />}
            Test Payment Return
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {status === "missing" && (
            <p className="text-muted-foreground">
              No active test session found in this browser. Open the test page
              first and complete the redirect from the same tab.
            </p>
          )}

          {ctx && (
            <>
              <div className="rounded-md border p-3 space-y-1">
                <div className="flex justify-between">
                  <span>Booking ID</span>
                  <span className="font-mono text-xs">{ctx.booking_id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Guest email</span>
                  <span>{ctx.email}</span>
                </div>
                <div className="flex justify-between">
                  <span>Deposit sent</span>
                  <span>${ctx.amount}.00</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Booking status</span>
                  <Badge variant="secondary">{dbStatus ?? "unknown"}</Badge>
                </div>
              </div>

              <div>
                <div className="font-medium mb-1">BAC return parameters</div>
                {paramList.length === 0 ? (
                  <p className="text-muted-foreground">
                    No query parameters were included in the return URL.
                  </p>
                ) : (
                  <ul className="text-xs font-mono border rounded-md p-2 space-y-1 bg-muted/40">
                    {paramList.map(([k, v]) => (
                      <li key={k}>
                        <span className="text-muted-foreground">{k}:</span> {v}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <p className="text-muted-foreground">
                This is a diagnostic screen for the payment gateway test only.
                The booking remains flagged <code>test_booking</code>.
              </p>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" asChild>
              <Link to="/test-payment">Run another test</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/">Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestPaymentReturn;
