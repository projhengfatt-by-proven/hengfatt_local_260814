-- Light lead reassignment: an agent can invite a named colleague to take over
-- a lead they own; the colleague accepts/declines. No public pool, no
-- transfer/co_own/temporary modes, no expiry, no notifications pipeline —
-- deliberately scoped per BUILD_GUIDE.md §14/§15 ("light version only, for now").

create type public.lead_share_status as enum ('pending', 'accepted', 'declined', 'revoked');

create table public.lead_shares (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  from_agent_id uuid not null references public.agent_profiles(id),
  to_agent_id uuid not null references public.agent_profiles(id),
  status public.lead_share_status not null default 'pending',
  message text,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint chk_lead_share_not_self check (from_agent_id <> to_agent_id)
);
create index idx_lead_shares_lead on public.lead_shares (lead_id);
create index idx_lead_shares_recipient on public.lead_shares (to_agent_id, status);

alter table public.lead_shares enable row level security;

create policy "Agents see own lead shares" on public.lead_shares for select
using (from_agent_id = auth.uid() or to_agent_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "Agents create shares for own leads" on public.lead_shares for insert
with check (
  from_agent_id = auth.uid()
  and exists (select 1 from public.leads l where l.id = lead_shares.lead_id and l.agent_id = auth.uid())
);

-- Sender can revoke while pending; recipient can decline. Accept goes through the RPC below
-- (not a plain client update), since it must also transfer leads.agent_id atomically.
--
-- WITH CHECK is deliberately its own, narrower expression, not left to default
-- to the USING clause: Postgres applies the USING expression to the *new* row
-- too when WITH CHECK is omitted, and since USING requires status = 'pending',
-- that would reject the very update that moves status away from 'pending' —
-- decline/revoke would always fail RLS. WITH CHECK here instead only permits
-- each actor to move the row to the one terminal status they're allowed to set
-- directly; 'accepted' is intentionally not reachable through this policy at
-- all — only accept_lead_share() below can set it, since that RPC also has to
-- transfer leads.agent_id in the same transaction.
create policy "Agents respond to own lead shares" on public.lead_shares for update
using (
  (from_agent_id = auth.uid() and status = 'pending')
  or (to_agent_id = auth.uid() and status = 'pending')
  or public.has_role(auth.uid(), 'admin')
)
with check (
  (from_agent_id = auth.uid() and status = 'revoked')
  or (to_agent_id = auth.uid() and status = 'declined')
  or public.has_role(auth.uid(), 'admin')
);

-- Closes an existing RLS gap: today `leads` has no policy at all letting a
-- non-owning agent read a lead row. This lets the addressee of a pending
-- reassignment see the lead itself (name/phone/etc.) before deciding to
-- accept/decline, without granting them broader access to leads that aren't
-- addressed to them.
create policy "Pending reassignment recipients can view lead" on public.leads for select
using (
  exists (
    select 1 from public.lead_shares ls
    where ls.lead_id = leads.id
    and ls.to_agent_id = auth.uid()
    and ls.status = 'pending'
  )
);

create or replace function public.accept_lead_share(p_share_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share public.lead_shares%rowtype;
begin
  select * into v_share from public.lead_shares
    where id = p_share_id and to_agent_id = auth.uid() and status = 'pending'
    for update;
  if not found then
    raise exception 'Share not found or not actionable';
  end if;
  update public.lead_shares set status = 'accepted', responded_at = now() where id = p_share_id;
  update public.leads set agent_id = v_share.to_agent_id, updated_at = now() where id = v_share.lead_id;
end;
$$;
grant execute on function public.accept_lead_share(uuid) to authenticated;
