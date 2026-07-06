import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const TEST_SERVICE_ID = "deadbeef-0000-0000-0000-000000000001";
const TEST_BAC_URL =
  "https://checkout.baccredomatic.com/YzY2Nzc1ODMzNDc0ODM0ZThhZDMxLjYxNzgzMDIzMzE2";
const TEST_DEPOSIT = 1;

const TestPayment = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("Test Customer");
  const [email, setEmail] = useState("test@example.com");
  const [phone, setPhone] = useState("+50600000000");
  const [submitting, setSubmitting] = useState(false);

  const start = async () => {
    if (!email) {
      toast.error("Email is required");
      return;
    }
    setSubmitting(true);
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    const timeStr = today.toTimeString().slice(0, 5);

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        service_id: TEST_SERVICE_ID,
        guest_name: name,
        guest_email: email,
        guest_phone: phone,
        booking_date: dateStr,
        booking_time: timeStr,
        status: "test_booking",
        total_price: TEST_DEPOSIT,
        notes: "TEST PAYMENT - internal gateway verification",
      })
      .select("id")
      .single();

    if (error || !data) {
      setSubmitting(false);
      toast.error(error?.message ?? "Failed to create test booking");
      return;
    }

    sessionStorage.setItem(
      "test_payment_context",
      JSON.stringify({
        booking_id: data.id,
        email,
        amount: TEST_DEPOSIT,
        started_at: new Date().toISOString(),
      })
    );
    window.location.href = TEST_BAC_URL;
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="font-heading">Internal Payment Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Hidden test page. Do not share. Uses the $1 BAC CompraClick test
              link and creates a booking flagged as <code>test_booking</code>.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Guest name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div className="rounded-md border p-3 text-sm">
            <div className="flex justify-between">
              <span>Service</span>
              <span className="font-medium">TEST PAYMENT - DO NOT USE</span>
            </div>
            <div className="flex justify-between">
              <span>Deposit</span>
              <span className="font-medium">${TEST_DEPOSIT}.00</span>
            </div>
          </div>

          <Button className="w-full" onClick={start} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Proceed to BAC CompraClick ($1 test)
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => navigate("/")}
          >
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestPayment;
