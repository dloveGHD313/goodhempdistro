alter table public.affiliate_payouts add column if not exists affiliate_user_id uuid references auth.users(id);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'affiliate_payouts' and column_name = 'affiliate_id'
  ) then
    update public.affiliate_payouts ap
    set affiliate_user_id = a.user_id
    from public.affiliates a
    where ap.affiliate_user_id is null and ap.affiliate_id = a.id;
  end if;
end $$;
