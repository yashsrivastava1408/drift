-- Expense Tracker schema. Paste this whole file into the Supabase SQL Editor and run it once.
-- Every table has Row Level Security: a signed-in user can only ever see and change their own rows.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables

create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  color      text not null default '#6366f1' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.category_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  keyword     text not null check (char_length(keyword) between 2 and 60),
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, keyword)
);

create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  occurred_on date not null,
  amount      numeric(12,2) not null check (amount > 0 and amount < 100000000),
  type        text not null check (type in ('debit', 'credit')),
  description text not null check (char_length(description) between 1 and 200),
  category_id uuid references public.categories(id) on delete set null,
  source      text not null default 'manual' check (source in ('manual', 'csv', 'pdf')),
  note        text check (note is null or char_length(note) <= 300),
  fingerprint text,
  created_at  timestamptz not null default now()
);

-- Re-importing the same statement will not create duplicates.
create unique index if not exists transactions_user_fingerprint_key
  on public.transactions (user_id, fingerprint);
create index if not exists transactions_user_date_idx
  on public.transactions (user_id, occurred_on desc);

-- ---------------------------------------------------------------- row level security

alter table public.categories      enable row level security;
alter table public.category_rules  enable row level security;
alter table public.transactions    enable row level security;

drop policy if exists "own categories" on public.categories;
create policy "own categories" on public.categories
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- A rule or transaction may only point at a category that belongs to the same user.
drop policy if exists "own rules" on public.category_rules;
create policy "own rules" on public.category_rules
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.categories c where c.id = category_id and c.user_id = auth.uid())
  );

drop policy if exists "own transactions" on public.transactions;
create policy "own transactions" on public.transactions
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      category_id is null
      or exists (select 1 from public.categories c where c.id = category_id and c.user_id = auth.uid())
    )
  );

-- Nothing is readable without signing in.
revoke all on public.categories, public.category_rules, public.transactions from anon;

-- ---------------------------------------------------------------- default categories and rules

create or replace function public.seed_user_defaults(uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.categories where user_id = uid) then
    return;
  end if;

  insert into public.categories (user_id, name, color) values
    (uid, 'Food & Dining',       '#f97316'),
    (uid, 'Groceries',           '#22c55e'),
    (uid, 'Transport',           '#3b82f6'),
    (uid, 'Shopping',            '#ec4899'),
    (uid, 'Bills & Utilities',   '#eab308'),
    (uid, 'Entertainment',       '#a855f7'),
    (uid, 'Health',              '#ef4444'),
    (uid, 'Travel',              '#06b6d4'),
    (uid, 'Education',           '#14b8a6'),
    (uid, 'Rent',                '#8b5cf6'),
    (uid, 'Transfers',           '#64748b'),
    (uid, 'Income',              '#10b981'),
    (uid, 'Other',               '#94a3b8');

  insert into public.category_rules (user_id, keyword, category_id)
  select uid, r.keyword, c.id
  from (values
    ('swiggy','Food & Dining'), ('zomato','Food & Dining'), ('dominos','Food & Dining'),
    ('mcdonald','Food & Dining'), ('kfc','Food & Dining'), ('starbucks','Food & Dining'),
    ('cafe','Food & Dining'), ('restaurant','Food & Dining'),
    ('blinkit','Groceries'), ('zepto','Groceries'), ('bigbasket','Groceries'),
    ('instamart','Groceries'), ('dmart','Groceries'), ('grocery','Groceries'),
    ('uber','Transport'), ('ola','Transport'), ('rapido','Transport'),
    ('metro','Transport'), ('petrol','Transport'), ('fuel','Transport'), ('fastag','Transport'),
    ('irctc','Travel'), ('redbus','Travel'), ('makemytrip','Travel'),
    ('goibibo','Travel'), ('indigo','Travel'), ('airlines','Travel'),
    ('amazon','Shopping'), ('flipkart','Shopping'), ('myntra','Shopping'),
    ('ajio','Shopping'), ('meesho','Shopping'), ('nykaa','Shopping'),
    ('jio','Bills & Utilities'), ('airtel','Bills & Utilities'), ('bsnl','Bills & Utilities'),
    ('electricity','Bills & Utilities'), ('broadband','Bills & Utilities'),
    ('recharge','Bills & Utilities'), ('insurance','Bills & Utilities'),
    ('netflix','Entertainment'), ('spotify','Entertainment'), ('hotstar','Entertainment'),
    ('bookmyshow','Entertainment'), ('primevideo','Entertainment'), ('youtube','Entertainment'),
    ('pharmeasy','Health'), ('apollo','Health'), ('1mg','Health'),
    ('pharmacy','Health'), ('hospital','Health'), ('clinic','Health'),
    ('udemy','Education'), ('coursera','Education'), ('college','Education'),
    ('school','Education'), ('tuition','Education'),
    ('rent','Rent'), ('salary','Income'), ('refund','Income'), ('cashback','Income')
  ) as r(keyword, category_name)
  join public.categories c on c.user_id = uid and c.name = r.category_name
  on conflict do nothing;
end;
$$;

revoke all on function public.seed_user_defaults(uuid) from public, anon, authenticated;

-- Called automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_user_defaults(new.id);
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lets the app fill in defaults for an account that existed before this script was run.
create or replace function public.ensure_my_defaults()
returns void
language sql
security definer
set search_path = public
as $$
  select public.seed_user_defaults(auth.uid()) where auth.uid() is not null;
$$;

revoke all on function public.ensure_my_defaults() from public, anon;
grant execute on function public.ensure_my_defaults() to authenticated;
