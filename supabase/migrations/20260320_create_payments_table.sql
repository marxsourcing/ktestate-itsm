-- 결제 상태 ENUM
CREATE TYPE payment_status AS ENUM (
  'pending',
  'ready',
  'done',
  'canceled',
  'partial_canceled',
  'aborted',
  'expired'
);

-- 결제 테이블
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id TEXT NOT NULL UNIQUE,
  payment_key TEXT UNIQUE,
  order_name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  method TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  receipt_url TEXT,
  metadata JSONB DEFAULT '{}',
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);

-- RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payments"
  ON payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can do anything"
  ON payments FOR ALL
  USING (auth.role() = 'service_role');

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_updated_at();
