-- Site membership is independent of the shared Discord role.
-- Additive rollout: enforcement starts OFF. Never infer membership from old bids.
begin;
create table public.auction_membership_settings (
  id boolean primary key default true check (id),
  enforcement_enabled boolean not null default false,
  bidding_paused boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.auction_membership_settings (id) values (true);

create table public.auction_memberships (
  user_id text primary key check (user_id ~ '^[0-9]{17,20}$'),
  guild_type text not null check (guild_type in ('guild1', 'guild2')),
  game_nickname text not null check (length(btrim(game_nickname)) between 1 and 100),
  status text not null default 'active' check (status in ('active', 'suspended')),
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by text not null
);
create index auction_memberships_guild_status on public.auction_memberships (guild_type, status);

create table public.guild_membership_requests (
  id bigint generated always as identity primary key,
  user_id text not null check (user_id ~ '^[0-9]{17,20}$'),
  requester_name text not null,
  guild_type text not null check (guild_type in ('guild1', 'guild2')),
  game_nickname text not null check (length(btrim(game_nickname)) between 1 and 100),
  note text not null default '' check (length(note) <= 1000),
  membership_version integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  review_reason text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index guild_membership_one_pending on public.guild_membership_requests (user_id) where status = 'pending';
create index guild_membership_requests_user_created on public.guild_membership_requests (user_id, created_at desc);
create index guild_membership_requests_pending_created on public.guild_membership_requests (created_at, id) where status = 'pending';

create table public.guild_membership_events (
  id bigint generated always as identity primary key,
  user_id text,
  actor_id text not null,
  action text not null,
  reason text not null default '',
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);
create index guild_membership_events_user_created on public.guild_membership_events (user_id, created_at desc);

alter table public.auction_membership_settings enable row level security;
alter table public.auction_memberships enable row level security;
alter table public.guild_membership_requests enable row level security;
alter table public.guild_membership_events enable row level security;
revoke all on public.auction_membership_settings, public.auction_memberships, public.guild_membership_requests, public.guild_membership_events from public, anon, authenticated, service_role;
grant select, insert, update on public.auction_membership_settings, public.auction_memberships, public.guild_membership_requests to service_role;
grant select, insert on public.guild_membership_events to service_role;
revoke update, delete, truncate on public.guild_membership_events from service_role;
revoke all on sequence public.guild_membership_requests_id_seq, public.guild_membership_events_id_seq from public, anon, authenticated;
grant usage, select on sequence public.guild_membership_requests_id_seq, public.guild_membership_events_id_seq to service_role;

-- All writers use settings -> user lock order. INVOKER: only trusted server calls.
create function public.auction_membership_lock(p_user_id text)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  perform 1 from public.auction_membership_settings where id = true for share;
  if not found then raise exception '길드 권한 설정을 확인할 수 없습니다.' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtextextended('auction-membership:' || p_user_id, 0));
end;
$$;

-- A scan returns counts only; no bid amounts are exposed through membership APIs.
create function public.auction_membership_active_bid_count(p_user_id text, p_guild text)
returns bigint language sql stable security invoker set search_path = public, pg_temp as $$
  select case when p_guild = 'guild1' then
    (select count(*) from public.bid_history b join public.items i on i.id = b.item_id
      where b.bidder_discord_id = p_user_id and (i.end_time is null or i.end_time > now()))
  else
    (select count(*) from public.bid_history_guild2 b join public.items_guild2 i on i.id = b.item_id
      where b.bidder_discord_id = p_user_id and (i.end_time is null or i.end_time > now())) end;
$$;

create function public.auction_membership_command(p_actor text, p_action text, p_data jsonb)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_user text;
  v_member public.auction_memberships%rowtype;
  v_request public.guild_membership_requests%rowtype;
  v_guild text := p_data->>'guildType';
  v_nickname text := btrim(p_data->>'nickname');
  v_reason text := btrim(coalesce(p_data->>'reason', ''));
  v_before jsonb;
  v_after jsonb;
  v_settings public.auction_membership_settings%rowtype;
begin
  if p_actor is null or p_actor !~ '^[0-9]{17,20}$' then
    raise exception 'Discord 계정을 확인해주세요.' using errcode = 'P0001';
  end if;
  if length(v_reason) > 1000 then raise exception '사유는 1,000자 이내로 입력해주세요.' using errcode = 'P0001'; end if;

  if p_action in ('enforce', 'pause', 'resume_bidding') then
    select * into strict v_settings from public.auction_membership_settings where id = true for update;
    if p_action = 'enforce' then
      if v_settings.enforcement_enabled then raise exception '이미 소속 제한이 적용 중입니다.' using errcode = 'P0001'; end if;
      lock table public.items, public.items_guild2 in share mode;
      if exists(select 1 from public.items where end_time is null or end_time > clock_timestamp())
        or exists(select 1 from public.items_guild2 where end_time is null or end_time > clock_timestamp()) then
        raise exception '모든 경매를 마감한 뒤 소속 제한을 활성화해주세요.' using errcode = 'P0001';
      end if;
      if not exists(select 1 from public.auction_memberships where status = 'active') then
        raise exception '길드원을 먼저 등록해주세요.' using errcode = 'P0001';
      end if;
    end if;
    if v_reason = '' then raise exception '설정 변경 사유를 입력해주세요.' using errcode = 'P0001'; end if;
    update public.auction_membership_settings set
      enforcement_enabled = enforcement_enabled or p_action = 'enforce',
      bidding_paused = case when p_action = 'pause' then true when p_action = 'resume_bidding' then false else bidding_paused end,
      updated_by = p_actor, updated_at = now() where id = true returning to_jsonb(auction_membership_settings.*) into v_after;
    insert into public.guild_membership_events(actor_id, action, reason, before_state, after_state)
      values(p_actor, p_action, v_reason, to_jsonb(v_settings), v_after);
    return v_after;
  end if;

  if p_action in ('apply', 'cancel') then v_user := p_actor;
  elsif p_action in ('approve', 'reject') then
    select user_id into v_user from public.guild_membership_requests where id = (p_data->>'requestId')::bigint;
  else v_user := p_data->>'userId'; end if;
  if v_user is null or v_user !~ '^[0-9]{17,20}$' then raise exception 'Discord 사용자 ID가 올바르지 않습니다.' using errcode = 'P0001'; end if;
  perform public.auction_membership_lock(v_user);
  select * into v_member from public.auction_memberships where user_id = v_user;
  v_before := case when found then to_jsonb(v_member) else null end;

  if p_action = 'apply' then
    if v_member.status = 'suspended' then raise exception '이용 정지 상태입니다. 관리자에게 문의해주세요.' using errcode = 'P0001'; end if;
    if exists(select 1 from public.guild_membership_requests where user_id = v_user and status = 'pending') then
      raise exception '이미 승인 대기 중인 신청이 있습니다.' using errcode = 'P0001';
    end if;
    if v_guild is null or v_guild not in ('guild1','guild2') or v_nickname is null or length(v_nickname) not between 1 and 100 then
      raise exception '길드와 게임 닉네임을 확인해주세요.' using errcode = 'P0001';
    end if;
    if v_member.guild_type = v_guild and v_member.game_nickname = v_nickname then
      raise exception '이미 동일한 길드와 닉네임으로 등록되어 있습니다.' using errcode = 'P0001';
    end if;
    insert into public.guild_membership_requests(user_id, requester_name, guild_type, game_nickname, note, membership_version)
      values(v_user, left(coalesce(p_data->>'requesterName',v_user),100), v_guild, v_nickname, v_reason, coalesce(v_member.version,0))
      returning to_jsonb(guild_membership_requests.*) into v_after;
  elsif p_action in ('cancel','approve','reject') then
    select * into v_request from public.guild_membership_requests
      where id = (p_data->>'requestId')::bigint and user_id = v_user for update;
    if not found or v_request.status <> 'pending' then raise exception '이미 처리되었거나 없는 신청입니다. 목록을 새로고침해주세요.' using errcode = 'P0001'; end if;
    if p_action = 'reject' and v_reason = '' then raise exception '반려 사유를 입력해주세요.' using errcode = 'P0001'; end if;
    if p_action = 'approve' then
      if coalesce(v_member.version,0) <> v_request.membership_version then raise exception '신청 이후 소속 정보가 변경되었습니다. 신청을 반려하고 다시 확인해주세요.' using errcode = 'P0001'; end if;
      if v_member.status = 'suspended' then raise exception '이용 정지를 먼저 해제해주세요.' using errcode = 'P0001'; end if;
      v_guild := v_request.guild_type;
      v_nickname := v_request.game_nickname;
    else
      update public.guild_membership_requests set status = case when p_action = 'cancel' then 'cancelled' else 'rejected' end,
        reviewed_by = p_actor, reviewed_at = now(), review_reason = v_reason where id = v_request.id
        returning to_jsonb(guild_membership_requests.*) into v_after;
    end if;
  elsif p_action not in ('assign','suspend','resume') then
    raise exception '지원하지 않는 작업입니다.' using errcode = 'P0001';
  end if;

  if p_action in ('assign','suspend','resume') then
    if v_reason = '' then raise exception '변경 사유를 입력해주세요.' using errcode = 'P0001'; end if;
    if coalesce(v_member.version,0) <> coalesce((p_data->>'version')::integer,-1) then
      raise exception '다른 관리자가 소속 정보를 변경했습니다. 새로고침해주세요.' using errcode = 'P0001';
    end if;
  end if;
  if p_action in ('assign','approve') then
    if v_guild is null or v_guild not in ('guild1','guild2') or v_nickname is null or length(v_nickname) not between 1 and 100 then
      raise exception '길드와 게임 닉네임을 확인해주세요.' using errcode = 'P0001';
    end if;
    -- Even first assignment must not strand active bids in the other guild.
    if (v_member.guild_type is null or v_member.guild_type <> v_guild)
      and public.auction_membership_active_bid_count(v_user, case when v_guild = 'guild1' then 'guild2' else 'guild1' end) > 0 then
      raise exception '다른 길드에 진행 중인 입찰이 있습니다. 정정 신청으로 삭제하거나 마감 후 변경해주세요.' using errcode = 'P0001';
    end if;
    insert into public.auction_memberships(user_id,guild_type,game_nickname,status,version,updated_by)
      values(v_user,v_guild,v_nickname,coalesce(v_member.status,'active'),coalesce(v_member.version,0)+1,p_actor)
      on conflict(user_id) do update set guild_type = excluded.guild_type, game_nickname = excluded.game_nickname,
        version = excluded.version, updated_by = excluded.updated_by, updated_at = now()
      returning to_jsonb(auction_memberships.*) into v_after;
    if p_action = 'approve' then
      update public.guild_membership_requests set status = 'approved',reviewed_by = p_actor,reviewed_at = now(),review_reason = v_reason where id = v_request.id;
    end if;
  elsif p_action in ('suspend','resume') then
    if v_member.user_id is null then raise exception '등록된 길드원이 아닙니다.' using errcode = 'P0001'; end if;
    update public.auction_memberships set status = case when p_action = 'suspend' then 'suspended' else 'active' end,
      version = version+1,updated_by = p_actor,updated_at = now() where user_id = v_user
      returning to_jsonb(auction_memberships.*) into v_after;
  end if;
  insert into public.guild_membership_events(user_id,actor_id,action,reason,before_state,after_state)
    values(v_user,p_actor,p_action,v_reason,v_before,v_after);
  return v_after;
end;
$$;

create function public.auction_membership_guard_bid()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_guild text := case when tg_table_name = 'bid_history' then 'guild1' else 'guild2' end;
  v_settings public.auction_membership_settings%rowtype;
  v_member public.auction_memberships%rowtype;
  v_price numeric; v_quantity integer; v_end timestamptz; v_count integer;
begin
  if tg_op = 'UPDATE' and (new.bidder_discord_id is distinct from old.bidder_discord_id or new.item_id <> old.item_id) then
    raise exception '입찰의 소유자나 경매 품목은 변경할 수 없습니다.' using errcode = 'P0001';
  end if;
  perform public.auction_membership_lock(coalesce(new.bidder_discord_id,'legacy'));
  select * into strict v_settings from public.auction_membership_settings where id = true;
  select * into v_member from public.auction_memberships where user_id = new.bidder_discord_id;
  if tg_op = 'INSERT' and v_settings.bidding_paused then raise exception '신규 입찰이 일시 중지되었습니다.' using errcode = 'P0001'; end if;
  if v_member.status = 'suspended' then raise exception '입찰 이용이 정지된 계정입니다.' using errcode = 'P0001'; end if;
  if v_settings.enforcement_enabled and (v_member.user_id is null or v_member.guild_type <> v_guild or v_member.status <> 'active') then
    raise exception '승인된 소속 길드에만 입찰하거나 입찰을 수정할 수 있습니다. 오입찰은 정정 신청으로 삭제해주세요.' using errcode = 'P0001';
  end if;
  if v_guild = 'guild1' then
    select price,coalesce(quantity,1),end_time into v_price,v_quantity,v_end from public.items where id = new.item_id for share;
  else
    select price,coalesce(quantity,1),end_time into v_price,v_quantity,v_end from public.items_guild2 where id = new.item_id for share;
  end if;
  if not found then raise exception '경매 품목을 찾을 수 없습니다.' using errcode = 'P0001'; end if;
  if tg_op = 'INSERT' and v_end <= clock_timestamp() then raise exception '경매가 이미 마감되었습니다.' using errcode = 'P0001'; end if;
  if new.bid_amount < v_price or new.bid_amount <= 0 or new.bid_amount > 2000000000 or new.bid_amount % 10000 <> 0 then
    raise exception '입찰 금액은 시작가 이상의 10,000bit 단위여야 합니다.' using errcode = 'P0001';
  end if;
  if coalesce(new.bid_quantity,1) < 1 or coalesce(new.bid_quantity,1) > v_quantity or length(btrim(new.bidder_nickname)) not between 1 and 100 then
    raise exception '입찰 수량과 닉네임을 확인해주세요.' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' and v_guild = 'guild2' then
    select count(*) into v_count from public.bid_history_guild2 where item_id = new.item_id and bidder_discord_id = new.bidder_discord_id;
    if v_count >= 3 then raise exception '이 아이템에 대한 입찰 횟수 제한(3회)을 초과했습니다.' using errcode = 'P0001'; end if;
  end if;
  return new;
end;
$$;
create trigger membership_guard_bid before insert or update on public.bid_history for each row execute function public.auction_membership_guard_bid();
create trigger membership_guard_bid before insert or update on public.bid_history_guild2 for each row execute function public.auction_membership_guard_bid();

revoke all on function public.auction_membership_lock(text), public.auction_membership_active_bid_count(text,text), public.auction_membership_command(text,text,jsonb), public.auction_membership_guard_bid() from public, anon, authenticated;
grant execute on function public.auction_membership_lock(text), public.auction_membership_active_bid_count(text,text), public.auction_membership_command(text,text,jsonb), public.auction_membership_guard_bid() to service_role;
commit;
