-- km_migration_091_change_password.sql
-- Adds kd_auth_change_password RPC for authenticated users to change their own password.

CREATE OR REPLACE FUNCTION kd_auth_change_password(
    p_current_password text,
    p_new_password text
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id uuid;
    v_user kd_users%ROWTYPE;
BEGIN
    -- Get caller from JWT
    v_user_id := (current_setting('request.jwt.claims', true)::json->>'sub')::uuid;
    IF v_user_id IS NULL THEN
        RETURN json_build_object('error', 'Not authenticated');
    END IF;

    SELECT * INTO v_user FROM kd_users WHERE id = v_user_id;
    IF v_user.id IS NULL THEN
        RETURN json_build_object('error', 'User not found');
    END IF;

    IF v_user.password_hash != crypt(p_current_password, v_user.password_hash) THEN
        RETURN json_build_object('error', 'Current password is incorrect');
    END IF;

    IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
        RETURN json_build_object('error', 'New password must be at least 6 characters');
    END IF;

    UPDATE kd_users
    SET password_hash = crypt(p_new_password, gen_salt('bf', 10)),
        updated_at = now()
    WHERE id = v_user_id;

    RETURN json_build_object('message', 'Password changed successfully');
END;
$$;

GRANT EXECUTE ON FUNCTION kd_auth_change_password(text, text) TO authenticated;
