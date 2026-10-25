BEGIN;

DO $$
DECLARE
  v_identity_generation text;
  v_column_default text;
  v_seq_name text;
  v_max_user_id bigint;
BEGIN
  SELECT
    c.identity_generation,
    c.column_default
  INTO
    v_identity_generation,
    v_column_default
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'users'
    AND c.column_name = 'user_id';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Column public.users.user_id was not found';
  END IF;

  SELECT pg_get_serial_sequence('public.users', 'user_id')
  INTO v_seq_name;

  IF v_identity_generation IS NULL
     AND (v_column_default IS NULL OR v_column_default NOT ILIKE 'nextval(%') THEN
    IF v_seq_name IS NULL THEN
      IF to_regclass('public.users_user_id_seq') IS NULL THEN
        EXECUTE 'CREATE SEQUENCE public.users_user_id_seq AS bigint';
      END IF;

      EXECUTE 'ALTER SEQUENCE public.users_user_id_seq OWNED BY public.users.user_id';
      EXECUTE 'ALTER TABLE public.users ALTER COLUMN user_id SET DEFAULT nextval(''public.users_user_id_seq''::regclass)';
      v_seq_name := 'public.users_user_id_seq';
    END IF;

    RAISE NOTICE 'Enabled auto-generation for public.users.user_id using sequence %', v_seq_name;
  ELSIF v_seq_name IS NULL THEN
    RAISE NOTICE 'public.users.user_id already auto-generated without a serial sequence; skipping sequence sync';
    RETURN;
  ELSE
    RAISE NOTICE 'public.users.user_id already auto-generated; only syncing sequence value';
  END IF;

  EXECUTE 'SELECT COALESCE(MAX(user_id), 0) FROM public.users'
  INTO v_max_user_id;

  IF v_max_user_id = 0 THEN
    EXECUTE format('SELECT setval(%L::regclass, 1, false)', v_seq_name);
  ELSE
    EXECUTE format('SELECT setval(%L::regclass, %s, true)', v_seq_name, v_max_user_id);
  END IF;
END
$$;

COMMIT;
