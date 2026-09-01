-- 0114_search_candidate_pool.sql
-- Havuz araması: kartta görünen Latin isim, DB'deki Kiril ad ile eşleşsin.
-- Yazıldıkça parça/önek (typeahead). SQL Editor > Run (0113'ten sonra).

create or replace function public.turquz_to_latin(p text)
returns text
language plpgsql
immutable
parallel safe
as $$
declare
  s text := lower(coalesce(p, ''));
begin
  -- Çok karakterli önce (JS lib/translit.js ile aynı sıra)
  s := replace(s, 'щ', 'shch');
  s := replace(s, 'ш', 'sh');
  s := replace(s, 'ч', 'ch');
  s := replace(s, 'х', 'kh');
  s := replace(s, 'ц', 'ts');
  s := replace(s, 'ю', 'yu');
  s := replace(s, 'я', 'ya');
  s := replace(s, 'ж', 'zh');
  s := replace(s, 'є', 'ye');
  s := replace(s, 'ї', 'yi');
  s := replace(s, 'ң', 'ng');
  s := replace(s, 'ё', 'e');
  s := replace(s, 'ъ', '');
  s := replace(s, 'ь', '');
  s := replace(s, 'й', 'i');
  s := replace(s, 'ы', 'y');
  s := replace(s, 'э', 'e');
  s := replace(s, 'ә', 'a');
  s := replace(s, 'ғ', 'g');
  s := replace(s, 'қ', 'q');
  s := replace(s, 'ө', 'o');
  s := replace(s, 'ұ', 'u');
  s := replace(s, 'ү', 'u');
  s := replace(s, 'һ', 'h');
  s := replace(s, 'і', 'i');
  s := replace(s, 'ґ', 'g');
  s := translate(s,
    'абвгдежзийклмнопрстуф',
    'abvgdezzijklmnoprstuf');
  return s;
end;
$$;

create or replace function public.turquz_fold_search(p text)
returns text
language plpgsql
immutable
parallel safe
as $$
declare
  s text;
begin
  s := replace(replace(coalesce(p, ''), 'İ', 'i'), 'I', 'i');
  s := lower(public.turquz_to_latin(s));
  s := replace(s, 'ı', 'i');
  s := replace(s, 'ğ', 'g');
  s := replace(s, 'ü', 'u');
  s := replace(s, 'ş', 's');
  s := replace(s, 'ö', 'o');
  s := replace(s, 'ç', 'c');
  s := regexp_replace(s, '[^a-z0-9]+', ' ', 'g');
  s := trim(regexp_replace(s, '\s+', ' ', 'g'));
  return s;
end;
$$;

create or replace function public.search_candidate_pool(p_q text)
returns table (
  user_id uuid,
  title text,
  data jsonb,
  reg_no integer,
  nationality text,
  updated_at timestamptz,
  last_seen_at timestamptz,
  turquz_certified boolean
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  q text := public.turquz_fold_search(p_q);
  toks text[];
begin
  if q is null or length(q) < 1 then
    return;
  end if;
  toks := string_to_array(q, ' ');

  return query
  select
    cp.user_id, cp.title, cp.data, cp.reg_no, cp.nationality,
    cp.updated_at, cp.last_seen_at, cp.turquz_certified
  from public.candidate_pool cp
  where (
    select bool_and(
      public.turquz_fold_search(concat_ws(' ',
        cp.data->>'firstName',
        cp.data->>'lastName',
        cp.data->>'passportFirstName',
        cp.data->>'passportLastName',
        cp.title,
        cp.nationality,
        lpad(coalesce(cp.reg_no, 0)::text, 4, '0')
      )) like '%' || tok || '%'
    )
    from unnest(toks) as tok
    where tok <> ''
  )
  order by cp.last_seen_at desc nulls last
  limit 48;
end;
$$;

grant execute on function public.turquz_to_latin(text) to authenticated;
grant execute on function public.turquz_fold_search(text) to authenticated;
grant execute on function public.search_candidate_pool(text) to authenticated;
revoke all on function public.search_candidate_pool(text) from public, anon;

notify pgrst, 'reload schema';
