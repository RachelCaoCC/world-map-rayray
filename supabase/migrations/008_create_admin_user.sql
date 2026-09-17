-- 008_create_admin_user.sql
-- Create initial admin user and set role

-- First, create the user via Supabase Dashboard → Authentication → Users
-- Then run this migration to set the admin role

-- Function to set user as admin
CREATE OR REPLACE FUNCTION set_admin_role(user_email TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
  WHERE email = user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = user_id
    AND (
      raw_app_meta_data->>'role' = 'admin'
      OR raw_user_meta_data->>'role' = 'admin'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
