-- Roll & Journey Lab Database Schema
-- Supabase에서 SQL Editor로 실행하세요

-- Labs 테이블 (현상소)
CREATE TABLE IF NOT EXISTS labs (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Orders 테이블 (주문)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id UUID NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  film_type TEXT NOT NULL,
  roll_count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'scanning', 'completed', 'delivered')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Photos 테이블 (스캔 사진)
CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Index 생성
CREATE INDEX IF NOT EXISTS orders_lab_id_idx ON orders(lab_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS photos_order_id_idx ON photos(order_id);

-- RLS (Row Level Security) 활성화
ALTER TABLE labs ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Labs 정책: 본인 현상소만 접근 가능
CREATE POLICY "Users can view their own lab" ON labs
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert their own lab" ON labs
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own lab" ON labs
  FOR UPDATE USING (auth.uid() = id);

-- Orders 정책: 본인 현상소의 주문만 접근 가능
CREATE POLICY "Labs can view their own orders" ON orders
  FOR SELECT USING (auth.uid() = lab_id);

CREATE POLICY "Labs can insert their own orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() = lab_id);

CREATE POLICY "Labs can update their own orders" ON orders
  FOR UPDATE USING (auth.uid() = lab_id);

CREATE POLICY "Labs can delete their own orders" ON orders
  FOR DELETE USING (auth.uid() = lab_id);

-- Photos 정책: 본인 현상소의 주문에 속한 사진만 접근 가능
CREATE POLICY "Labs can view photos of their orders" ON photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders WHERE orders.id = photos.order_id AND orders.lab_id = auth.uid()
    )
  );

CREATE POLICY "Labs can insert photos to their orders" ON photos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders WHERE orders.id = photos.order_id AND orders.lab_id = auth.uid()
    )
  );

CREATE POLICY "Labs can delete photos of their orders" ON photos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM orders WHERE orders.id = photos.order_id AND orders.lab_id = auth.uid()
    )
  );

-- Create a lab row when a new auth user signs up (email confirm has no session yet).
CREATE OR REPLACE FUNCTION public.handle_new_lab_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.labs (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'lab_name', '현상소'),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_lab_user();

-- Used by /api/auth/account-status to tell login whether the email exists.
CREATE OR REPLACE FUNCTION public.auth_email_registered(check_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE lower(email) = lower(check_email)
  );
$$;

REVOKE ALL ON FUNCTION public.auth_email_registered(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_email_registered(text) TO anon, authenticated;
