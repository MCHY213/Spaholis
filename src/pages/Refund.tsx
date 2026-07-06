import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";

export default function Refund() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="Refund Policy | Holis Wellness Center"
        description="Refund and cancellation policy for treatments, classes, retreats, and gift cards at Holis Wellness Center."
        canonical="/refund"
      />
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="font-heading text-4xl md:text-5xl text-foreground mb-8">
          Refund Policy
        </h1>
        <div className="space-y-6 font-body text-foreground/90 leading-relaxed">
          <p>Last updated: May 2026.</p>

          <h2 className="font-heading text-2xl mt-8">Treatments &amp; Private Sessions</h2>
          <p>
            Full refund if cancelled at least 24 hours before the scheduled
            appointment. Within 24 hours, sessions are non-refundable but may be
            rescheduled once at our discretion.
          </p>

          <h2 className="font-heading text-2xl mt-8">Classes &amp; Passes</h2>
          <p>
            Single class bookings may be cancelled up to 4 hours before the
            class. Class passes and memberships are non-refundable once
            activated but remain valid for their original duration.
          </p>

          <h2 className="font-heading text-2xl mt-8">Retreats &amp; Packages</h2>
          <p>
            Deposits are non-refundable. The remaining balance is refundable up
            to 30 days before the retreat start date. Cancellations within 30
            days are non-refundable but transferable to another guest.
          </p>

          <h2 className="font-heading text-2xl mt-8">Gift Cards</h2>
          <p>
            Gift cards are non-refundable and valid for 12 months from the
            purchase date.
          </p>

          <h2 className="font-heading text-2xl mt-8">How to Request a Refund</h2>
          <p>
            Email{" "}
            <a className="underline" href="mailto:spaholisma@gmail.com">
              spaholisma@gmail.com
            </a>{" "}
            with your booking reference. Approved refunds are issued to the
            original payment method within 5–10 business days.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
