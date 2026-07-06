
-- Add new columns to services table for wellness platform
ALTER TABLE services ADD COLUMN IF NOT EXISTS type text DEFAULT 'treatment';
ALTER TABLE services ADD COLUMN IF NOT EXISTS capacity integer;
ALTER TABLE services ADD COLUMN IF NOT EXISTS sessions integer DEFAULT 1;
ALTER TABLE services ADD COLUMN IF NOT EXISTS level integer;
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS meeting_url text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS certificate boolean DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS max_participants integer;
ALTER TABLE services ADD COLUMN IF NOT EXISTS requires_payment boolean DEFAULT false;

-- Add payment_id to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_id text;

-- Create user_progress table for educational tracking
CREATE TABLE IF NOT EXISTS public.user_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  completed_sessions integer DEFAULT 0,
  completed boolean DEFAULT false,
  certificate_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress" ON user_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON user_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage progress" ON user_progress FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Create gift_cards table
CREATE TABLE IF NOT EXISTS public.gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  initial_value numeric NOT NULL,
  remaining_value numeric NOT NULL,
  purchaser_email text,
  recipient_email text,
  recipient_name text,
  message text,
  payment_id text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can validate gift cards" ON gift_cards FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage gift cards" ON gift_cards FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Create trigger for updated_at on user_progress
CREATE TRIGGER update_user_progress_updated_at BEFORE UPDATE ON user_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
