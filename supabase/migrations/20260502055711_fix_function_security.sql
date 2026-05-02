/*
  # Fix Function Security Issues

  1. Problem
    - `handle_new_user` and `increment_invoice_counter` have mutable search_path,
      allowing search_path hijacking attacks.
    - Both SECURITY DEFINER functions are executable by `anon` and `authenticated`
      roles via the REST API, which is unintentional.

  2. Changes
    - Recreate both functions with `SET search_path = public, pg_temp` to fix
      the mutable search_path vulnerability.
    - Revoke EXECUTE on both functions from `anon` and `authenticated` roles.
    - `handle_new_user` is an internal trigger function — no role needs direct
      execute access; the trigger runs it as the owner.
    - `increment_invoice_counter` is called server-side only; revoke public access.
*/

-- Fix handle_new_user: lock down search_path and revoke public execute
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, plan)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'free'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

-- Fix increment_invoice_counter: lock down search_path and revoke public execute
CREATE OR REPLACE FUNCTION public.increment_invoice_counter(p_user_id uuid, p_key text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next integer;
BEGIN
  INSERT INTO public.invoice_counters (user_id, key, last_value)
    VALUES (p_user_id, p_key, 1)
    ON CONFLICT (user_id, key) DO UPDATE
      SET last_value = invoice_counters.last_value + 1
    RETURNING last_value INTO v_next;
  RETURN v_next;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_invoice_counter(uuid, text) FROM anon, authenticated, public;
