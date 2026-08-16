-- Test için: tüm sözleşme ödemelerini unpaid'e çek.
-- Stripe Checkout oturumları (stripe_session_id) temizlenir; portal token kalır.

update public.contracts
   set payment_status = 'unpaid',
       paid_at = null,
       stripe_session_id = null,
       updated_at = now()
 where payment_status in ('paid', 'waived')
    or paid_at is not null
    or stripe_session_id is not null;
