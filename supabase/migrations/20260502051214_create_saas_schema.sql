/*
  # SaaS Multi-Tenant Schema for GST Billing Software

  ## Summary
  Transforms the file-based GST billing app into a multi-tenant SaaS platform.
  All existing data entities (bills, clients, products, etc.) are migrated to
  Postgres tables with per-user isolation enforced by Row Level Security.

  ## New Tables
  - `user_profiles` - display name, plan (free/pro), linked to auth.users
  - `subscriptions` - plan tier tracking (free=10 invoices/month, pro=unlimited)
  - `usage_tracking` - monthly invoice count per user for free tier enforcement
  - `business_profiles` - multi-business GSTIN profiles per user
  - `active_profile` - tracks which business profile is currently selected
  - `bills` - all invoice types (tax invoice, proforma, credit note, etc.)
  - `clients` - saved customer records
  - `products` - inventory/product catalog
  - `expenses` - expense entries
  - `purchases` - purchase bills for ITC tracking
  - `recurring_invoices` - recurring invoice templates
  - `receipts` - payment receipt vouchers
  - `terms_templates` - rich-text terms & conditions library
  - `meta_store` - per-user key-value store (invoice counters, settings)
  - `gst_credentials` - encrypted GST portal API credentials (pro only)

  ## Security
  - RLS enabled on ALL tables
  - Every policy checks auth.uid() = user_id
  - gst_credentials further restricted to pro plan users only
*/

-- ============================================================
-- USER PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text DEFAULT '',
  plan text DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- USAGE TRACKING (monthly invoice count)
-- ============================================================
CREATE TABLE IF NOT EXISTS usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year_month text NOT NULL, -- format: '2026-05'
  invoice_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, year_month)
);

ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON usage_tracking FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON usage_tracking FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage"
  ON usage_tracking FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- BUSINESS PROFILES (multi-GSTIN)
-- ============================================================
CREATE TABLE IF NOT EXISTS business_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text DEFAULT '',
  address text DEFAULT '',
  city text DEFAULT '',
  pin text DEFAULT '',
  state text DEFAULT '',
  country text DEFAULT 'India',
  gstin text DEFAULT '',
  pan text DEFAULT '',
  email text DEFAULT '',
  phone text DEFAULT '',
  bank_name text DEFAULT '',
  account_number text DEFAULT '',
  ifsc text DEFAULT '',
  upi_id text DEFAULT '',
  logo text DEFAULT '',
  signature text DEFAULT '',
  google_drive_folder text DEFAULT 'GST Billing Invoices',
  is_active boolean DEFAULT false,
  extra jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own business profiles"
  ON business_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own business profiles"
  ON business_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own business profiles"
  ON business_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own business profiles"
  ON business_profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- BILLS (all invoice types)
-- ============================================================
CREATE TABLE IF NOT EXISTS bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_profile_id uuid REFERENCES business_profiles(id) ON DELETE SET NULL,
  bill_id text NOT NULL, -- the app-level ID like 'INV/2026-27/0001'
  data jsonb NOT NULL DEFAULT '{}',
  invoice_date date,
  invoice_type text DEFAULT 'tax-invoice',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, bill_id)
);

CREATE INDEX IF NOT EXISTS bills_user_id_idx ON bills(user_id);
CREATE INDEX IF NOT EXISTS bills_invoice_date_idx ON bills(invoice_date DESC);

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bills"
  ON bills FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bills"
  ON bills FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bills"
  ON bills FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bills"
  ON bills FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  name text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, client_id)
);

CREATE INDEX IF NOT EXISTS clients_user_id_idx ON clients(user_id);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clients"
  ON clients FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own clients"
  ON clients FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- PRODUCTS / INVENTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  name text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id)
);

CREATE INDEX IF NOT EXISTS products_user_id_idx ON products(user_id);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own products"
  ON products FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own products"
  ON products FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own products"
  ON products FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expense_id text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  expense_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, expense_id)
);

CREATE INDEX IF NOT EXISTS expenses_user_id_idx ON expenses(user_id);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses"
  ON expenses FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- PURCHASES (Purchase Bills for ITC)
-- ============================================================
CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_id text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  purchase_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, purchase_id)
);

CREATE INDEX IF NOT EXISTS purchases_user_id_idx ON purchases(user_id);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own purchases"
  ON purchases FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own purchases"
  ON purchases FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own purchases"
  ON purchases FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own purchases"
  ON purchases FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- RECURRING INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS recurring_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recurring_id text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, recurring_id)
);

CREATE INDEX IF NOT EXISTS recurring_user_id_idx ON recurring_invoices(user_id);

ALTER TABLE recurring_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recurring invoices"
  ON recurring_invoices FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recurring invoices"
  ON recurring_invoices FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recurring invoices"
  ON recurring_invoices FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recurring invoices"
  ON recurring_invoices FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- RECEIPTS / PAYMENT VOUCHERS
-- ============================================================
CREATE TABLE IF NOT EXISTS receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receipt_id text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  receipt_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, receipt_id)
);

CREATE INDEX IF NOT EXISTS receipts_user_id_idx ON receipts(user_id);

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own receipts"
  ON receipts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own receipts"
  ON receipts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own receipts"
  ON receipts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own receipts"
  ON receipts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- TERMS TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS terms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  name text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, template_id)
);

CREATE INDEX IF NOT EXISTS terms_templates_user_id_idx ON terms_templates(user_id);

ALTER TABLE terms_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own terms templates"
  ON terms_templates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own terms templates"
  ON terms_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own terms templates"
  ON terms_templates FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own terms templates"
  ON terms_templates FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- META STORE (invoice counters, settings, preferences)
-- ============================================================
CREATE TABLE IF NOT EXISTS meta_store (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meta_key text NOT NULL,
  meta_value jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, meta_key)
);

CREATE INDEX IF NOT EXISTS meta_store_user_id_idx ON meta_store(user_id);

ALTER TABLE meta_store ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meta"
  ON meta_store FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meta"
  ON meta_store FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meta"
  ON meta_store FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- GST CREDENTIALS (Official GST Portal API - Pro plan only)
-- ============================================================
CREATE TABLE IF NOT EXISTS gst_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gstin text NOT NULL DEFAULT '',
  username text NOT NULL DEFAULT '',
  password_encrypted text NOT NULL DEFAULT '',
  app_key text NOT NULL DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE gst_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own GST credentials"
  ON gst_credentials FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.plan = 'pro'
    )
  );

CREATE POLICY "Users can insert own GST credentials"
  ON gst_credentials FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.plan = 'pro'
    )
  );

CREATE POLICY "Users can update own GST credentials"
  ON gst_credentials FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.plan = 'pro'
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.plan = 'pro'
    )
  );

CREATE POLICY "Users can delete own GST credentials"
  ON gst_credentials FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.plan = 'pro'
    )
  );

-- ============================================================
-- FUNCTION: Atomic invoice counter increment
-- ============================================================
CREATE OR REPLACE FUNCTION increment_invoice_counter(p_user_id uuid, p_key text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current integer;
  v_next integer;
BEGIN
  SELECT (meta_value::text)::integer INTO v_current
  FROM meta_store
  WHERE user_id = p_user_id AND meta_key = p_key;

  IF v_current IS NULL THEN
    v_next := 1;
    INSERT INTO meta_store (user_id, meta_key, meta_value, updated_at)
    VALUES (p_user_id, p_key, to_jsonb(v_next), now())
    ON CONFLICT (user_id, meta_key) DO UPDATE
      SET meta_value = to_jsonb(EXCLUDED.meta_value::text::integer),
          updated_at = now();
  ELSE
    v_next := v_current + 1;
    UPDATE meta_store
    SET meta_value = to_jsonb(v_next), updated_at = now()
    WHERE user_id = p_user_id AND meta_key = p_key;
  END IF;

  RETURN v_next;
END;
$$;

-- ============================================================
-- FUNCTION: Auto-create user profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_profiles (id, display_name, plan)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', ''), 'free')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
