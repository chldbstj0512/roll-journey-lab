-- Run once in the shared Supabase SQL Editor.
-- Lets a logged-in customer read orders/photos that use the same email.

drop policy if exists "Customers can view own orders" on public.orders;
create policy "Customers can view own orders"
  on public.orders for select
  to authenticated
  using (
    customer_email is not null
    and lower(customer_email) = lower((select auth.jwt() ->> 'email'))
  );

drop policy if exists "Customers can view photos of own orders" on public.photos;
create policy "Customers can view photos of own orders"
  on public.photos for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders
      where orders.id = photos.order_id
        and orders.customer_email is not null
        and lower(orders.customer_email) = lower((select auth.jwt() ->> 'email'))
    )
  );

drop policy if exists "Customers can view labs of their orders" on public.labs;
create policy "Customers can view labs of their orders"
  on public.labs for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders
      where orders.lab_id = labs.id
        and orders.customer_email is not null
        and lower(orders.customer_email) = lower((select auth.jwt() ->> 'email'))
    )
  );

grant select on public.orders to authenticated;
grant select on public.photos to authenticated;
grant select on public.labs to authenticated;
