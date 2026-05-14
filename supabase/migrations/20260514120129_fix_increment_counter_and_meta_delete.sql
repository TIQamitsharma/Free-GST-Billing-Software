/*
  # Fix increment_invoice_counter and meta_store DELETE policy

  1. Problems Fixed
    - `increment_invoice_counter` was referencing a non-existent `invoice_counters`
      table (broken by previous security migration). Rewrites it to use `meta_store`.
    - `meta_store` table was missing a DELETE policy, which silently blocked
      any delete operations.

  2. Changes
    - Recreate `increment_invoice_counter` to read/write `meta_store` table.
      The function atomically increments the counter stored as a JSONB integer
      in `meta_store.meta_value` for the given user and key.
    - Add DELETE policy on `meta_store` so authenticated users can delete
      their own keys.
    - Keep EXECUTE revoked from anon/authenticated/public — the server calls
      this via the service role key when available; the fallback JS path handles
      the no-service-role case.
*/

-- Rewrite increment_invoice_counter to target meta_store (correct table)
CREATE OR REPLACE FUNCTION public.increment_invoice_counter(p_user_id uuid, p_key text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next integer;
BEGIN
  INSERT INTO public.meta_store (user_id, meta_key, meta_value, updated_at)
    VALUES (p_user_id, p_key, to_jsonb(1), now())
    ON CONFLICT (user_id, meta_key) DO UPDATE
      SET meta_value = to_jsonb((meta_store.meta_value::text::integer) + 1),
          updated_at = now()
    RETURNING (meta_value::text)::integer INTO v_next;
  RETURN v_next;
END;
$$;

-- Keep execute revoked from public roles (server calls via service role or JS fallback)
REVOKE EXECUTE ON FUNCTION public.increment_invoice_counter(uuid, text) FROM anon, authenticated, public;

-- Add missing DELETE policy for meta_store
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'meta_store' AND cmd = 'DELETE'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can delete own meta"
        ON meta_store FOR DELETE
        TO authenticated
        USING (auth.uid() = user_id)
    $policy$;
  END IF;
END $$;
