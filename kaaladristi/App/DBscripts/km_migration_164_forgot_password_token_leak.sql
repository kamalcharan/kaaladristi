-- km_migration_164_forgot_password_token_leak.sql
-- Target DB: kaala_dristi_db
--
-- SECURITY FIX — kd_auth_forgot_password leaked the reset token.
--
-- The prior function returned `reset_token` in its JSON response ("REMOVE THIS
-- IN PRODUCTION"). Because no email is ever sent and no reset page consumes the
-- token, the ONLY effect of the endpoint was to hand a valid reset token to any
-- caller who supplies an email — i.e. anyone could reset (take over) any account
-- by calling this RPC and reading the token from the response, then calling
-- kd_auth_reset_password.
--
-- This replacement still generates + stores the token (ready for a future
-- email-delivery flow) but NEVER returns it. Until transactional email exists,
-- password reset is admin-assisted. No behavioural change for legitimate users
-- (the feature was already non-functional end-to-end).

CREATE OR REPLACE FUNCTION public.kd_auth_forgot_password(p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_user_id uuid;
    v_token   text;
BEGIN
    SELECT id INTO v_user_id FROM kd_users WHERE email = lower(trim(p_email));

    -- Always return the same message — never leak whether the email exists.
    IF v_user_id IS NULL THEN
        RETURN json_build_object('message', 'If that email exists, a reset link has been sent');
    END IF;

    v_token := encode(gen_random_bytes(16), 'hex');
    UPDATE kd_users
    SET reset_token     = v_token,
        reset_token_exp = now() + interval '1 hour',
        updated_at      = now()
    WHERE id = v_user_id;

    -- Token intentionally NOT returned (was an account-takeover vector).
    RETURN json_build_object('message', 'If that email exists, a reset link has been sent');
END;
$function$;
