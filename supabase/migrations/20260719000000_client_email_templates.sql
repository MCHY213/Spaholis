-- Client email templates
-- Admin-editable subject/heading/body for the automatic customer emails:
--   * Treatment reservation confirmation
--   * Yoga class booking confirmation
--   * Membership / class pass / drop-in purchase confirmation (per type)
--   * Membership / class pass / drop-in order — schedule link (per type)
--
-- Edge functions (send-booking-notification, send-membership-order-email) read
-- the matching row by template_key, interpolate {{variables}}, and wrap the body
-- in the branded shell. If a row is missing or disabled they fall back to the
-- built-in copy, so email delivery never depends on this table existing.

CREATE TABLE IF NOT EXISTS public.email_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL,
  category     TEXT NOT NULL,          -- treatment | class | offering_purchase | offering_order
  description  TEXT,
  subject      TEXT NOT NULL,
  heading      TEXT NOT NULL,
  body_html    TEXT NOT NULL,
  enabled      BOOLEAN NOT NULL DEFAULT true,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID
);

-- Edge functions reach the table with the service role (bypasses RLS); grant it
-- explicitly since Supabase no longer grants public-schema access by default.
GRANT ALL ON public.email_templates TO service_role;

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Only full admins may read or edit templates (coordinators cannot).
DO $$ BEGIN
  CREATE POLICY "Admins can manage email templates"
    ON public.email_templates FOR ALL
    USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'))
    WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Keep updated_at fresh on every edit.
CREATE OR REPLACE FUNCTION public.touch_email_templates_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_templates_updated_at ON public.email_templates;
CREATE TRIGGER trg_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_email_templates_updated_at();

-- ---------------------------------------------------------------------------
-- Seed the eight default templates. ON CONFLICT DO NOTHING so re-running the
-- migration never overwrites copy the owner has since edited.
-- Available {{variables}} per category are documented in the admin UI.
-- {{details}} and {{button}} expand to HTML blocks the edge function builds
-- from live booking/offering data.
-- ---------------------------------------------------------------------------

INSERT INTO public.email_templates (template_key, label, category, description, subject, heading, body_html) VALUES
(
  'treatment_confirmation',
  'Treatment reservation confirmation',
  'treatment',
  'Sent to the client when a spa/treatment appointment is confirmed.',
  'Your Holis Wellness reservation is confirmed ({{reservation_id}})',
  'Your Reservation is Confirmed',
  $tpl$<p style="font-size:15px;margin:0 0 16px;">Dear {{guest_name}},</p>
<p style="font-size:14px;line-height:1.6;margin:0 0 18px;">Thank you for booking with Holis Wellness Center. We've confirmed the details of your reservation below. If anything looks incorrect, reply to this email and our team will assist you.</p>
{{details}}
<p style="font-size:13px;line-height:1.6;margin:22px 0 0;color:#555;">We look forward to welcoming you. Please arrive 10 minutes early to settle in.</p>$tpl$
),
(
  'class_confirmation',
  'Yoga class booking confirmation',
  'class',
  'Sent to the client when a yoga class spot is booked (paid, membership or credit).',
  'Your Holis class is booked — {{class_title}} ({{reservation_id}})',
  'Your Class is Booked',
  $tpl$<p style="font-size:15px;margin:0 0 16px;">Dear {{guest_name}},</p>
<p style="font-size:14px;line-height:1.6;margin:0 0 18px;">Thanks for signing up. Your spot in {{class_title}} is confirmed.</p>
{{details}}
<p style="font-size:13px;line-height:1.6;margin:22px 0 12px;color:#555;">Please arrive 10 minutes early. Need to reach us?</p>
{{button}}$tpl$
),
(
  'offering_purchase_membership',
  'Membership — purchase confirmation',
  'offering_purchase',
  'Sent when a customer buys a membership online.',
  'Your Holis membership — {{offering_name}}',
  'Thank you, {{first_name}}!',
  $tpl$<p style="font-size:15px;line-height:1.5;">Your purchase is complete and <strong>{{offering_name}}</strong> is now active in your account.</p>
{{details}}
<p style="font-size:15px;line-height:1.5;">Log in and head to Classes to book — your membership covers every eligible class automatically.</p>
{{button}}$tpl$
),
(
  'offering_purchase_class_pass',
  'Class pass — purchase confirmation',
  'offering_purchase',
  'Sent when a customer buys a class pass online.',
  'Your Holis class pass — {{offering_name}}',
  'Thank you, {{first_name}}!',
  $tpl$<p style="font-size:15px;line-height:1.5;">Your purchase is complete and <strong>{{offering_name}}</strong> is now active in your account.</p>
{{details}}
<p style="font-size:15px;line-height:1.5;">Log in and head to Classes to book — one credit is applied automatically each time you reserve.</p>
{{button}}$tpl$
),
(
  'offering_purchase_drop_in',
  'Drop-in — purchase confirmation',
  'offering_purchase',
  'Sent when a customer buys a single drop-in online.',
  'Your Holis drop-in — {{offering_name}}',
  'Thank you, {{first_name}}!',
  $tpl$<p style="font-size:15px;line-height:1.5;">Your purchase is complete and <strong>{{offering_name}}</strong> is now active in your account.</p>
{{details}}
<p style="font-size:15px;line-height:1.5;">Log in and head to Classes to redeem your drop-in whenever you're ready.</p>
{{button}}$tpl$
),
(
  'offering_order_membership',
  'Membership — ready / schedule link',
  'offering_order',
  'Sent when an admin creates a membership order; carries the no-login scheduling link.',
  'Your Holis membership is ready — {{offering_name}}',
  'Hi {{first_name}}, your membership is ready',
  $tpl$<p style="font-size:15px;line-height:1.5;">Thank you! Your <strong>{{offering_name}}</strong> is active.</p>
{{details}}
<p style="font-size:15px;line-height:1.5;">Click below to book any eligible class — your membership covers it, so your total is <strong>$0</strong>. No login or code needed.</p>
{{button}}
<p style="font-size:13px;color:#666;line-height:1.5;">Or paste this link into your browser:<br><span style="word-break:break-all;">{{schedule_link}}</span></p>$tpl$
),
(
  'offering_order_class_pass',
  'Class pass — ready / schedule link',
  'offering_order',
  'Sent when an admin creates a class-pass order; carries the no-login scheduling link.',
  'Your Holis class pass is ready — {{offering_name}}',
  'Hi {{first_name}}, your class pass is ready',
  $tpl$<p style="font-size:15px;line-height:1.5;">Thank you! Your <strong>{{offering_name}}</strong> is active.</p>
{{details}}
<p style="font-size:15px;line-height:1.5;">Click below to book any eligible class — a credit is applied automatically, so your total is <strong>$0</strong>. No login or code needed.</p>
{{button}}
<p style="font-size:13px;color:#666;line-height:1.5;">Or paste this link into your browser:<br><span style="word-break:break-all;">{{schedule_link}}</span></p>$tpl$
),
(
  'offering_order_drop_in',
  'Drop-in — ready / schedule link',
  'offering_order',
  'Sent when an admin creates a drop-in order; carries the no-login scheduling link.',
  'Your Holis drop-in is ready — {{offering_name}}',
  'Hi {{first_name}}, your drop-in is ready',
  $tpl$<p style="font-size:15px;line-height:1.5;">Thank you! Your <strong>{{offering_name}}</strong> is active.</p>
{{details}}
<p style="font-size:15px;line-height:1.5;">Click below to book your class — your drop-in covers it, so your total is <strong>$0</strong>. No login or code needed.</p>
{{button}}
<p style="font-size:13px;color:#666;line-height:1.5;">Or paste this link into your browser:<br><span style="word-break:break-all;">{{schedule_link}}</span></p>$tpl$
)
ON CONFLICT (template_key) DO NOTHING;
