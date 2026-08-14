-- Schedule module extensions: reschedule, no-show, cancellation reason, source.
-- Deliberately additive against the existing `viewings` table rather than the
-- fuller schema (viewing_outcomes/viewing_history/business_hours/blocked_slots/
-- scheduling_settings) proposed by a third-party reference spec — see
-- BUILD_GUIDE.md Part E for why that fuller scope was reconciled down.

alter type public.viewing_status add value if not exists 'no_show';

-- Guarded rather than a plain CREATE TYPE: if an earlier partial run of this
-- file already created the enum before erroring out on a later statement,
-- a bare CREATE TYPE here would abort the whole script again on re-run.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'viewing_source') then
    create type public.viewing_source as enum ('manual', 'aria');
  end if;
end $$;

alter table public.viewings
  add column if not exists cancellation_reason text,
  add column if not exists original_viewing_id uuid references public.viewings(id),
  add column if not exists source public.viewing_source not null default 'manual';

-- No RLS changes needed: the existing "Agents manage own viewings" FOR ALL
-- USING (auth.uid() = agent_id) policy already covers select/insert/update
-- on these new columns.

notify pgrst, 'reload schema';
