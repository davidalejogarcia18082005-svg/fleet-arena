-- Fleet Arena. Ejecutar una sola vez en el SQL Editor de Supabase.
-- Las coordenadas de las flotas nunca se publican en Realtime.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 3 and 24),
  created_at timestamptz not null default now()
);
create table public.games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  mode text not null check (mode in ('timed','untimed')),
  is_public boolean not null default false,
  status text not null default 'waiting' check(status in ('waiting','placing','active','finished','cancelled')),
  player1 uuid not null references public.profiles(id),
  player2 uuid references public.profiles(id),
  ready1 boolean not null default false,
  ready2 boolean not null default false,
  turn uuid references public.profiles(id),
  turn_no integer not null default 0,
  clock1_ms integer not null default 300000 check(clock1_ms >= 0),
  clock2_ms integer not null default 300000 check(clock2_ms >= 0),
  turn_started_at timestamptz,
  winner uuid references public.profiles(id),
  finish_reason text check(finish_reason in ('fleet','timeout','resign')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  check(player1 is distinct from player2),
  check(turn is null or turn=player1 or turn=player2),
  check(winner is null or winner=player1 or winner=player2)
);
create table private.fleets (
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.profiles(id),
  ships jsonb not null,
  primary key(game_id,player_id)
);
create table public.shots (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  shooter uuid not null references public.profiles(id),
  cell integer not null check(cell between 0 and 99),
  result text not null check(result in ('hit','miss','sunk')),
  sunk_ship text,
  turn_no integer not null,
  request_id uuid not null,
  created_at timestamptz not null default now(),
  unique(game_id,shooter,cell),
  unique(game_id,shooter,request_id),
  unique(game_id,turn_no)
);
create table public.messages (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  sender uuid not null references public.profiles(id),
  body text not null check(char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index games_player1_idx on public.games(player1,updated_at desc);
create index games_player2_idx on public.games(player2,updated_at desc);
create index games_lobby_idx on public.games(created_at desc) where status='waiting' and is_public;
create index shots_game_idx on public.shots(game_id,id);
create index messages_game_idx on public.messages(game_id,id);
create index messages_sender_idx on public.messages(sender,created_at desc);

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.shots enable row level security;
alter table public.messages enable row level security;
alter table private.fleets enable row level security;
revoke all on public.profiles,public.games,public.shots,public.messages from public,anon,authenticated;
revoke all on private.fleets from public,anon,authenticated;
grant select on public.profiles,public.games,public.shots,public.messages to authenticated;
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy games_member_read on public.games for select to authenticated
  using (auth.uid()=player1 or auth.uid()=player2);
create policy shots_member_read on public.shots for select to authenticated
  using (exists(select 1 from public.games g where g.id=game_id and (auth.uid()=g.player1 or auth.uid()=g.player2)));
create policy messages_member_read on public.messages for select to authenticated
  using (exists(select 1 from public.games g where g.id=game_id and (auth.uid()=g.player1 or auth.uid()=g.player2)));

create function private.new_profile() returns trigger language plpgsql security definer set search_path='' as $$
declare v_name text;
begin
  v_name := trim(new.raw_user_meta_data->>'username');
  if v_name is null or v_name !~ '^[a-zA-Z0-9_ -]{3,24}$' then
    v_name := 'Capitan-'||left(new.id::text,6);
  end if;
  insert into public.profiles(id,username) values(new.id,v_name);
  return new;
end; $$;
create trigger fleet_new_user after insert on auth.users for each row execute function private.new_profile();
insert into public.profiles(id,username)
  select id,'Capitan-'||left(id::text,6) from auth.users on conflict(id) do nothing;

create function private.require_member(p_id uuid) returns public.games
language plpgsql security definer set search_path='' as $$
declare g public.games; u uuid := auth.uid();
begin
  if u is null then raise exception 'Inicia sesión para continuar.'; end if;
  select * into g from public.games where id=p_id for update;
  if not found or (u is distinct from g.player1 and u is distinct from g.player2) then
    raise exception 'No tienes acceso a esta partida.';
  end if;
  return g;
end; $$;

create function private.expire_clock(p_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare g public.games; v_now timestamptz; v_left bigint;
begin
  select * into g from public.games where id=p_id for update;
  v_now := clock_timestamp();
  if g.status <> 'active' or g.mode <> 'timed' then return false; end if;
  v_left := case when g.turn=g.player1 then g.clock1_ms else g.clock2_ms end
    - floor(extract(epoch from (v_now-g.turn_started_at))*1000)::bigint;
  if v_left > 0 then return false; end if;
  update public.games set status='finished',winner=case when g.turn=g.player1 then g.player2 else g.player1 end,
    finish_reason='timeout',finished_at=v_now,updated_at=v_now,version=version+1,
    clock1_ms=case when g.turn=g.player1 then 0 else clock1_ms end,
    clock2_ms=case when g.turn=g.player2 then 0 else clock2_ms end
    where id=p_id;
  return true;
end; $$;

create function private.snapshot(p_id uuid,p_user uuid) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object(
   'game',to_jsonb(g),'server_now',clock_timestamp(),
   'me',p_user,'player1_name',p1.username,'player2_name',p2.username,
   'own_fleet',coalesce((select ships from private.fleets where game_id=g.id and player_id=p_user),'[]'::jsonb),
   'revealed_fleet',case when g.status='finished' then coalesce((select ships from private.fleets where game_id=g.id and player_id<>p_user),'[]'::jsonb) else '[]'::jsonb end,
   'shots',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.shots s where s.game_id=g.id),'[]'::jsonb),
   'messages',coalesce((select jsonb_agg(to_jsonb(m) order by m.id) from
     (select m.id,m.sender,m.body,m.created_at,p.username from public.messages m join public.profiles p on p.id=m.sender where m.game_id=g.id order by m.id desc limit 100) m),'[]'::jsonb)
 ) from public.games g join public.profiles p1 on p1.id=g.player1 left join public.profiles p2 on p2.id=g.player2 where g.id=p_id;
$$;

create function public.game_snapshot(p_game_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform private.require_member(p_game_id);
  perform private.expire_clock(p_game_id);
  return private.snapshot(p_game_id,auth.uid());
end; $$;

create function public.create_game(p_mode text,p_public boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid; u uuid := auth.uid(); v_code text;
begin
  if u is null then raise exception 'Inicia sesión para crear una sala.'; end if;
  if p_mode not in ('timed','untimed') or p_mode is null then raise exception 'Modo no válido.'; end if;
  -- Serializa la cuota y creación por propietario, incluso entre pestañas.
  perform 1 from public.profiles where id=u for update;
  if (select count(*) from public.games where player1=u and status in ('waiting','placing','active')) >= 10 then
    raise exception 'Tienes 10 salas pendientes. Termina o cancela una antes de crear otra.';
  end if;
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    begin
      insert into public.games(code,mode,is_public,player1) values(v_code,p_mode,coalesce(p_public,false),u) returning id into v_id;
      exit;
    exception when unique_violation then null;
    end;
  end loop;
  return private.snapshot(v_id,u);
end; $$;

create function public.join_game(p_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g public.games; u uuid := auth.uid();
begin
  if u is null then raise exception 'Inicia sesión para unirte.'; end if;
  select * into g from public.games where code=upper(trim(p_code)) for update;
  if not found then raise exception 'No encontramos esa sala. Revisa el código.'; end if;
  if u=g.player1 or u=g.player2 then
    perform private.expire_clock(g.id);
    return private.snapshot(g.id,u);
  end if;
  if g.status<>'waiting' or g.player2 is not null then raise exception 'La sala ya está completa o cerrada.'; end if;
  update public.games set player2=u,status='placing',version=version+1,updated_at=clock_timestamp() where id=g.id;
  return private.snapshot(g.id,u);
end; $$;

create function private.validate_fleet(p_ships jsonb) returns void
language plpgsql set search_path='' as $$
declare s jsonb; v_id text; v_expected integer; v_cells integer[]; v_all integer[] := '{}'; v_ids text[] := '{}'; v_len integer; v_step integer; i integer;
begin
  if jsonb_typeof(p_ships) is distinct from 'array' then raise exception 'La flota debe ser una lista.'; end if;
  if jsonb_array_length(p_ships) <> 5 then raise exception 'Coloca los cinco barcos.'; end if;
  if octet_length(p_ships::text)>5000 then raise exception 'La flota es demasiado grande.'; end if;
  for s in select value from jsonb_array_elements(p_ships) loop
    v_id := s->>'id';
    v_expected := case v_id when 'carrier' then 5 when 'battleship' then 4 when 'cruiser' then 3 when 'submarine' then 3 when 'destroyer' then 2 else null end;
    if v_expected is null or v_id=any(v_ids) then raise exception 'La flota contiene un barco no válido o repetido.'; end if;
    if jsonb_typeof(s->'cells') is distinct from 'array' then raise exception 'Coordenadas no válidas.'; end if;
    if exists(select 1 from jsonb_array_elements(s->'cells') c where jsonb_typeof(c.value)<>'number') then
      raise exception 'Las coordenadas deben ser números enteros.';
    end if;
    select array_agg(value::integer order by value::integer) into v_cells from jsonb_array_elements_text(s->'cells');
    v_len := coalesce(array_length(v_cells,1),0);
    if v_len<>v_expected then raise exception 'El tamaño de un barco es incorrecto.'; end if;
    v_step := v_cells[2]-v_cells[1];
    if v_step not in (1,10) then raise exception 'Los barcos deben ser rectos y consecutivos.'; end if;
    for i in 1..v_len loop
      if v_cells[i] is null or v_cells[i]<0 or v_cells[i]>99 or v_cells[i]=any(v_all) then raise exception 'Los barcos se superponen o salen del tablero.'; end if;
      if i>1 and v_cells[i]-v_cells[i-1]<>v_step then raise exception 'Los barcos deben ocupar casillas consecutivas.'; end if;
      if v_step=1 and v_cells[i]/10<>v_cells[1]/10 then raise exception 'Un barco cruza el borde del tablero.'; end if;
      v_all := array_append(v_all,v_cells[i]);
    end loop;
    v_ids := array_append(v_ids,v_id);
  end loop;
end; $$;

create function public.place_fleet(p_game_id uuid,p_ships jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g public.games; u uuid := auth.uid(); v_now timestamptz;
begin
  g := private.require_member(p_game_id);
  if g.status not in ('waiting','placing') then raise exception 'La preparación ya terminó.'; end if;
  if (u=g.player1 and g.ready1) or (u=g.player2 and g.ready2) then raise exception 'Tu flota ya está confirmada.'; end if;
  perform private.validate_fleet(p_ships);
  insert into private.fleets(game_id,player_id,ships) values(g.id,u,p_ships);
  update public.games set ready1=case when u=player1 then true else ready1 end,
    ready2=case when u=player2 then true else ready2 end,
    version=version+1,updated_at=clock_timestamp() where id=g.id returning * into g;
  if g.player2 is not null and g.ready1 and g.ready2 then
    v_now := clock_timestamp();
    update public.games set status='active',turn=case when random()<0.5 then player1 else player2 end,
      turn_no=1,turn_started_at=v_now,updated_at=v_now,version=version+1 where id=g.id;
  end if;
  return private.snapshot(g.id,u);
end; $$;

create function public.fire_shot(p_game_id uuid,p_cell integer,p_turn_no integer,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g public.games; u uuid := auth.uid(); v_other uuid; v_ship jsonb; v_result text := 'miss'; v_sunk text;
  v_now timestamptz; v_elapsed integer; v_left integer; v_hits integer;
begin
  g := private.require_member(p_game_id);
  -- Un reintento de la misma petición no vuelve a disparar ni cambia el turno.
  if exists(select 1 from public.shots where game_id=g.id and shooter=u and request_id=p_request_id) then
    perform private.expire_clock(g.id); return private.snapshot(g.id,u);
  end if;
  if private.expire_clock(g.id) then return private.snapshot(g.id,u); end if;
  if g.status<>'active' then raise exception 'La partida no está activa.'; end if;
  if u<>g.turn then raise exception 'Es el turno de tu rival.'; end if;
  if p_turn_no is distinct from g.turn_no then raise exception 'El turno cambió. Actualiza la partida.'; end if;
  if p_cell is null or p_cell<0 or p_cell>99 or p_request_id is null then raise exception 'Disparo no válido.'; end if;
  if exists(select 1 from public.shots where game_id=g.id and shooter=u and cell=p_cell) then raise exception 'Ya disparaste a esa casilla.'; end if;
  v_now := clock_timestamp();
  v_other := case when u=g.player1 then g.player2 else g.player1 end;
  select s.value into v_ship from private.fleets f cross join lateral jsonb_array_elements(f.ships) s
    where f.game_id=g.id and f.player_id=v_other and (s.value->'cells') @> to_jsonb(array[p_cell]);
  if v_ship is not null then
    v_result := 'hit';
    if not exists(select 1 from jsonb_array_elements_text(v_ship->'cells') c
      where c.value::integer<>p_cell and not exists(select 1 from public.shots where game_id=g.id and shooter=u and cell=c.value::integer)) then
      v_result := 'sunk'; v_sunk := v_ship->>'id';
    end if;
  end if;
  -- Vuelve a comprobar después de validar, usando el reloj del servidor.
  if private.expire_clock(g.id) then return private.snapshot(g.id,u); end if;
  v_now := clock_timestamp();
  v_elapsed := case when g.mode='timed' then greatest(0,floor(extract(epoch from (v_now-g.turn_started_at))*1000)::integer) else 0 end;
  v_left := greatest(0,(case when u=g.player1 then g.clock1_ms else g.clock2_ms end)-v_elapsed);
  if g.mode='timed' and v_left=0 then
    perform private.expire_clock(g.id);
    return private.snapshot(g.id,u);
  end if;
  insert into public.shots(game_id,shooter,cell,result,sunk_ship,turn_no,request_id,created_at)
    values(g.id,u,p_cell,v_result,v_sunk,g.turn_no,p_request_id,v_now);
  select count(*) into v_hits from public.shots where game_id=g.id and shooter=u and result<>'miss';
  update public.games set
    clock1_ms=case when mode='timed' and u=player1 then v_left else clock1_ms end,
    clock2_ms=case when mode='timed' and u=player2 then v_left else clock2_ms end,
    status=case when v_hits=17 then 'finished' else 'active' end,
    winner=case when v_hits=17 then u else null end,
    finish_reason=case when v_hits=17 then 'fleet' else null end,
    finished_at=case when v_hits=17 then v_now else null end,
    turn=case when v_hits=17 then null else v_other end,
    turn_no=turn_no+1,turn_started_at=v_now,updated_at=v_now,version=version+1 where id=g.id;
  return private.snapshot(g.id,u);
end; $$;

create function public.resign_game(p_game_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g public.games; u uuid := auth.uid(); v_now timestamptz; v_elapsed integer := 0;
begin
  g := private.require_member(p_game_id);
  if private.expire_clock(g.id) or g.status in ('finished','cancelled') then return private.snapshot(g.id,u); end if;
  v_now := clock_timestamp();
  if g.status='active' and g.mode='timed' then
    v_elapsed := greatest(0,floor(extract(epoch from (v_now-g.turn_started_at))*1000)::integer);
    if v_elapsed >= (case when g.turn=g.player1 then g.clock1_ms else g.clock2_ms end) then
      perform private.expire_clock(g.id); return private.snapshot(g.id,u);
    end if;
  end if;
  update public.games set
    clock1_ms=case when g.status='active' and g.mode='timed' and g.turn=player1 then greatest(0,clock1_ms-v_elapsed) else clock1_ms end,
    clock2_ms=case when g.status='active' and g.mode='timed' and g.turn=player2 then greatest(0,clock2_ms-v_elapsed) else clock2_ms end,
    status=case when g.status='active' then 'finished' else 'cancelled' end,
    winner=case when g.status='active' then case when u=g.player1 then g.player2 else g.player1 end else null end,
    finish_reason=case when g.status='active' then 'resign' else null end,
    finished_at=v_now,updated_at=v_now,version=version+1 where id=g.id;
  return private.snapshot(g.id,u);
end; $$;

create function public.send_message(p_game_id uuid,p_body text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g public.games; u uuid := auth.uid();
begin
  g := private.require_member(p_game_id);
  if p_body is null or char_length(trim(p_body)) not between 1 and 300 then raise exception 'El mensaje debe tener entre 1 y 300 caracteres.'; end if;
  if exists(select 1 from public.messages where sender=u and game_id=g.id and created_at>clock_timestamp()-interval '1 second') then
    raise exception 'Espera un segundo antes de enviar otro mensaje.';
  end if;
  insert into public.messages(game_id,sender,body) values(g.id,u,trim(p_body));
  update public.games set version=version+1,updated_at=clock_timestamp() where id=g.id;
  perform private.expire_clock(g.id);
  return private.snapshot(g.id,u);
end; $$;

create function public.list_my_games() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión.'; end if;
  for v_id in select id from public.games where (auth.uid()=player1 or auth.uid()=player2) and status='active' and mode='timed' order by id loop
    perform private.expire_clock(v_id);
  end loop;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.updated_at desc) from (
    select g.*,p1.username player1_name,p2.username player2_name from public.games g
      join public.profiles p1 on p1.id=g.player1 left join public.profiles p2 on p2.id=g.player2
      where auth.uid()=g.player1 or auth.uid()=g.player2 order by g.updated_at desc limit 100
  ) x),'[]'::jsonb);
end; $$;
create function public.list_open_games() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión.'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
    select g.code,g.mode,g.created_at,p.username from public.games g join public.profiles p on p.id=g.player1
      where g.status='waiting' and g.is_public and g.player1<>auth.uid()
      order by g.created_at desc limit 30
  ) x),'[]'::jsonb);
end; $$;

revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.game_snapshot(uuid),public.create_game(text,boolean),public.join_game(text),
  public.place_fleet(uuid,jsonb),public.fire_shot(uuid,integer,integer,uuid),public.resign_game(uuid),
  public.send_message(uuid,text),public.list_my_games(),public.list_open_games() from public,anon;
grant execute on function public.game_snapshot(uuid),public.create_game(text,boolean),public.join_game(text),
  public.place_fleet(uuid,jsonb),public.fire_shot(uuid,integer,integer,uuid),public.resign_game(uuid),
  public.send_message(uuid,text),public.list_my_games(),public.list_open_games() to authenticated;

-- Realtime transmite avisos de cambios; los clientes consultan una instantánea autorizada.
-- Nunca agregar private.fleets a esta publicación.
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.games, public.messages;
  end if;
end $$;
commit;
