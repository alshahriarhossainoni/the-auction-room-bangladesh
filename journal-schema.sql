-- Run in Supabase SQL Editor. Private to the existing TAR owner account.
create table if not exists public.tar_journal_trades (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 external_id text not null,
 closed_at timestamptz not null,
 opened_at timestamptz,
 symbol text not null,
 side text not null default 'OTHER',
 volume numeric,
 entry_price numeric,
 exit_price numeric,
 profit numeric not null default 0,
 commission numeric not null default 0,
 swap numeric not null default 0,
 net_profit numeric not null default 0,
 setup text,
 notes text,
 source text not null default 'csv',
 created_at timestamptz not null default now(),
 unique(user_id, external_id)
);
create index if not exists tar_journal_user_closed on public.tar_journal_trades(user_id, closed_at desc);
alter table public.tar_journal_trades enable row level security;
-- Replace UUID below with your Supabase Auth user UUID if your admin account changes.
create policy "journal_owner_read" on public.tar_journal_trades for select to authenticated using (auth.uid() = user_id and auth.uid() = '226210a4-8f03-4685-bd80-e1853d626575'::uuid);
create policy "journal_owner_insert" on public.tar_journal_trades for insert to authenticated with check (auth.uid() = user_id and auth.uid() = '226210a4-8f03-4685-bd80-e1853d626575'::uuid);
create policy "journal_owner_update" on public.tar_journal_trades for update to authenticated using (auth.uid() = user_id and auth.uid() = '226210a4-8f03-4685-bd80-e1853d626575'::uuid) with check (auth.uid() = user_id and auth.uid() = '226210a4-8f03-4685-bd80-e1853d626575'::uuid);
create policy "journal_owner_delete" on public.tar_journal_trades for delete to authenticated using (auth.uid() = user_id and auth.uid() = '226210a4-8f03-4685-bd80-e1853d626575'::uuid);
