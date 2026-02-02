-- Fix orders/order_items admin RLS: use admin_users (profiles.is_admin may not exist)
-- Run this if 067 failed with "column profiles.is_admin does not exist"

DROP POLICY IF EXISTS "Orders: admin can read all" ON orders;
CREATE POLICY "Orders: admin can read all" ON orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Order items: admin can read all" ON order_items;
CREATE POLICY "Order items: admin can read all" ON order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );
