-- ═══════════════════════════════════════════════════════════════════════════
-- 0006 · L'asta: motore, offerte, timer, aggiudicazioni
--
-- Fetta 4a della roadmap. È il pezzo dove il principio del progetto conta più
-- che altrove: **il client propone, il server decide**. Nessun importo, nessun
-- credito e nessun secondo viene calcolato sul telefono.
--
-- IL TEMPO. Il countdown non è un contatore: sul lotto è salvato l'istante
-- dell'ultimo rilancio, `last_bid_at`, e tutto il resto si ricava da lì.
--
--     attesa     finché  adesso <  last_bid_at + inattività
--     countdown  quando  adesso >= last_bid_at + inattività
--     scaduto    quando  adesso >= last_bid_at + inattività + countdown
--
-- Così ogni dispositivo calcola lo stesso numero, chi ricarica la pagina
-- riprende da dove era, e nessun orologio sfasato può falsare un'assegnazione.
-- Vedi ADR-0005.
-- ═══════════════════════════════════════════════════════════════════════════

create type public.metodo_asta     as enum ('chiamata', 'alfabetico', 'random');
create type public.variante_asta   as enum ('totale', 'per_ruolo', 'ibrida');
create type public.conduzione_asta as enum ('app', 'live');
create type public.tipo_chiamata   as enum ('libera', 'con_passo');
create type public.stato_asta      as enum ('draft', 'open', 'paused', 'closed');
create type public.stato_lotto     as enum ('open', 'awarded', 'passed', 'cancelled');
create type public.fonte_acquisto  as enum ('auction', 'quick_assign', 'trade');

-- ─── L'asta ─────────────────────────────────────────────────────────────────

create table public.auctions (
  id                 uuid primary key default gen_random_uuid(),
  league_id          uuid not null unique references public.leagues (id) on delete cascade,

  status             public.stato_asta      not null default 'draft',
  method             public.metodo_asta     not null default 'chiamata',
  variant            public.variante_asta   not null default 'totale',
  conduction         public.conduzione_asta not null default 'app',
  bid_type           public.tipo_chiamata   not null default 'libera',

  inactivity_seconds int not null default 8 check (inactivity_seconds between 3 and 120),
  countdown_seconds  int not null default 5 check (countdown_seconds  between 3 and 60),

  -- Le squadre nell'ordine di chiamata, deciso o sorteggiato all'apertura.
  nomination_order   uuid[] not null default '{}',
  current_turn_index int not null default 0,
  current_role_phase public.ruolo_calciatore,

  opened_at          timestamptz,
  closed_at          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ─── I lotti ────────────────────────────────────────────────────────────────

create table public.auction_lots (
  id                     uuid primary key default gen_random_uuid(),
  auction_id             uuid not null references public.auctions (id) on delete cascade,
  player_id              int  not null references public.players (id)  on delete restrict,

  status                 public.stato_lotto not null default 'open',
  nominated_by_team_id   uuid references public.teams (id) on delete set null,
  current_bid            int  not null check (current_bid >= 0),
  current_bidder_team_id uuid references public.teams (id) on delete set null,

  -- La base di calcolo del countdown. Ogni rilancio la riporta ad adesso.
  last_bid_at            timestamptz not null default now(),

  awarded_team_id        uuid references public.teams (id) on delete set null,
  final_price            int,
  created_at             timestamptz not null default now(),
  closed_at              timestamptz
);

create index lotti_asta_idx on public.auction_lots (auction_id, status);
-- Un solo lotto aperto per volta in una stessa asta: è la regola del gioco,
-- e scritta qui non può essere aggirata da nessuna corsa fra due richieste.
create unique index lotti_uno_aperto_per_asta
  on public.auction_lots (auction_id) where status = 'open';

-- ─── Offerte e passi ────────────────────────────────────────────────────────

create table public.bids (
  id         bigserial primary key,
  lot_id     uuid not null references public.auction_lots (id) on delete cascade,
  team_id    uuid not null references public.teams (id)        on delete cascade,
  amount     int  not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index offerte_lotto_idx on public.bids (lot_id, id desc);

create table public.lot_passes (
  lot_id     uuid not null references public.auction_lots (id) on delete cascade,
  team_id    uuid not null references public.teams (id)        on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lot_id, team_id)
);

-- ─── Le rose ────────────────────────────────────────────────────────────────

create table public.roster_players (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid not null references public.leagues (id) on delete cascade,
  team_id     uuid not null references public.teams (id)   on delete cascade,
  player_id   int  not null references public.players (id) on delete restrict,
  price       int  not null check (price >= 0),
  source      public.fonte_acquisto not null default 'auction',
  acquired_at timestamptz not null default now(),
  -- Lo stesso calciatore non può stare in due rose della stessa lega.
  unique (league_id, player_id)
);

create index rose_squadra_idx on public.roster_players (team_id);

-- ─── Registro eventi, a sola aggiunta ───────────────────────────────────────

create table public.auction_events (
  seq           bigserial primary key,
  auction_id    uuid not null references public.auctions (id) on delete cascade,
  type          text not null,
  payload       jsonb not null default '{}',
  actor_user_id uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index eventi_asta_idx on public.auction_events (auction_id, seq);

-- Il registro non si modifica e non si cancella: è la memoria della serata.
create or replace function public.registro_immutabile()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Il registro dell''asta è a sola aggiunta.' using errcode = '42501';
end;
$$;

create trigger eventi_niente_modifiche
  before update or delete on public.auction_events
  for each row execute function public.registro_immutabile();

-- ═══════════════════════════════════════════════════════════════════════════
-- Regole di accesso
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.auctions       enable row level security;
alter table public.auction_lots   enable row level security;
alter table public.bids           enable row level security;
alter table public.lot_passes     enable row level security;
alter table public.roster_players enable row level security;
alter table public.auction_events enable row level security;

create policy "asta: la vedono i partecipanti"
  on public.auctions for select to authenticated
  using (public.e_membro_lega(league_id));

create or replace function public.lega_dell_asta(p_asta uuid)
returns uuid language sql security definer stable set search_path = '' as $$
  select league_id from public.auctions where id = p_asta;
$$;

create policy "lotti: li vedono i partecipanti"
  on public.auction_lots for select to authenticated
  using (public.e_membro_lega(public.lega_dell_asta(auction_id)));

create policy "offerte: le vedono i partecipanti"
  on public.bids for select to authenticated
  using (exists (select 1 from public.auction_lots l
                 where l.id = lot_id
                   and public.e_membro_lega(public.lega_dell_asta(l.auction_id))));

create policy "passi: li vedono i partecipanti"
  on public.lot_passes for select to authenticated
  using (exists (select 1 from public.auction_lots l
                 where l.id = lot_id
                   and public.e_membro_lega(public.lega_dell_asta(l.auction_id))));

create policy "rose: le vedono i partecipanti"
  on public.roster_players for select to authenticated
  using (public.e_membro_lega(league_id));

create policy "registro: lo vedono i partecipanti"
  on public.auction_events for select to authenticated
  using (public.e_membro_lega(public.lega_dell_asta(auction_id)));

-- NESSUNA policy di scrittura su nessuna di queste tabelle. Offerte,
-- aggiudicazioni e crediti passano soltanto dalle funzioni qui sotto, che
-- controllano ogni regola prima di scrivere.

-- ═══════════════════════════════════════════════════════════════════════════
-- Il conto che regge tutta l'asta: quanto può ancora offrire una squadra
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * Se una squadra ha 40 crediti e le mancano 6 giocatori, NON può offrirne 40:
 * resterebbe con 5 slot vuoti e zero crediti. Deve tenere da parte l'offerta
 * minima per ognuno degli slot restanti.
 *
 *   massimo = crediti - (slot_rimanenti - 1) * offerta_minima
 *
 * È la regola più facile da sbagliare e la più visibile quando è sbagliata.
 * Vedi docs/02-dominio-fantacalcio.md e .claude/skills/regole-asta/SKILL.md
 */
create or replace view public.team_budget
with (security_invoker = true) as
select
  t.id                       as team_id,
  t.league_id,
  t.user_id,
  t.name,
  t.credits_remaining,
  count(r.id) filter (where p.role = 'P')::int as presi_p,
  count(r.id) filter (where p.role = 'D')::int as presi_d,
  count(r.id) filter (where p.role = 'C')::int as presi_c,
  count(r.id) filter (where p.role = 'A')::int as presi_a,
  count(r.id)::int                              as presi_totali,
  (l.slots_p + l.slots_d + l.slots_c + l.slots_a - count(r.id))::int as slot_rimanenti,
  greatest(
    0,
    t.credits_remaining
      - greatest(0, (l.slots_p + l.slots_d + l.slots_c + l.slots_a - count(r.id)) - 1) * l.min_bid
  )::int as massimo_offribile
from public.teams t
join public.leagues l on l.id = t.league_id
left join public.roster_players r on r.team_id = t.id
left join public.players p on p.id = r.player_id
group by t.id, t.league_id, t.user_id, t.name, t.credits_remaining,
         l.slots_p, l.slots_d, l.slots_c, l.slots_a, l.min_bid;

comment on view public.team_budget is
  'Crediti, slot occupati e massimo offribile di ogni squadra. Il numero che lo schermo condiviso mostra accanto a ogni nome.';

-- Quanti slot restano a una squadra per un ruolo preciso.
create or replace function public.slot_liberi_ruolo(p_squadra uuid, p_ruolo public.ruolo_calciatore)
returns int language sql security definer stable set search_path = '' as $$
  select (
    case p_ruolo
      when 'P' then l.slots_p when 'D' then l.slots_d
      when 'C' then l.slots_c else l.slots_a
    end
    - (select count(*) from public.roster_players r
       join public.players p on p.id = r.player_id
       where r.team_id = t.id and p.role = p_ruolo)
  )::int
  from public.teams t join public.leagues l on l.id = t.league_id
  where t.id = p_squadra;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Preparazione dell'asta
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.assicura_asta(p_lega uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_asta uuid;
begin
  if not public.e_membro_lega(p_lega) then
    raise exception 'Non fai parte di questa lega.' using errcode = '42501';
  end if;
  select id into v_asta from public.auctions where league_id = p_lega;
  if v_asta is not null then return v_asta; end if;
  if not public.e_admin_lega(p_lega) then
    raise exception 'L''asta la prepara l''amministratore della lega.' using errcode = '42501';
  end if;
  insert into public.auctions (league_id) values (p_lega) returning id into v_asta;
  return v_asta;
end;
$$;

create type public.esito_asta as enum (
  'ok', 'non_autorizzato', 'asta_non_aperta', 'non_e_il_tuo_turno',
  'gia_acquistato', 'ruolo_pieno', 'reparto_chiuso', 'offerta_troppo_bassa',
  'oltre_il_massimo', 'lotto_chiuso', 'hai_passato', 'nessun_lotto_aperto',
  'non_ancora_scaduto', 'rosa_completa', 'metodo_non_disponibile'
);

create or replace function public.configura_asta(
  p_lega               uuid,
  p_metodo             public.metodo_asta,
  p_variante           public.variante_asta,
  p_conduzione         public.conduzione_asta,
  p_tipo_chiamata      public.tipo_chiamata,
  p_secondi_inattivita int,
  p_secondi_countdown  int
)
returns table (esito public.esito_asta, messaggio text)
language plpgsql security definer set search_path = '' as $$
declare v_asta uuid;
begin
  if not public.e_admin_lega(p_lega) then
    return query select 'non_autorizzato'::public.esito_asta,
      'Solo l''amministratore della lega può cambiare le impostazioni.'; return;
  end if;

  -- Onestà: le altre varianti sono progettate ma non costruite. Meglio dirlo
  -- qui che lasciare l'amministratore ad aprire un'asta che non funziona.
  if p_metodo <> 'chiamata' or p_variante <> 'totale' or p_conduzione <> 'app'
     or p_tipo_chiamata <> 'libera' then
    return query select 'metodo_non_disponibile'::public.esito_asta,
      'Per ora è disponibile solo la chiamata libera totale, condotta dall''app. Le altre varianti arrivano più avanti.';
    return;
  end if;

  v_asta := public.assicura_asta(p_lega);

  update public.auctions set
    method = p_metodo, variant = p_variante, conduction = p_conduzione,
    bid_type = p_tipo_chiamata,
    inactivity_seconds = p_secondi_inattivita,
    countdown_seconds = p_secondi_countdown,
    updated_at = now()
  where id = v_asta and status = 'draft';

  if not found then
    return query select 'asta_non_aperta'::public.esito_asta,
      'Le impostazioni si cambiano solo prima di aprire l''asta.'; return;
  end if;

  return query select 'ok'::public.esito_asta, 'Impostazioni salvate.';
end;
$$;

/**
 * Apre l'asta. L'ordine di chiamata si fissa qui e non cambia più:
 * cambiarlo a metà falserebbe la gara.
 */
create or replace function public.apri_asta(p_lega uuid, p_sorteggia boolean default true)
returns table (esito public.esito_asta, messaggio text)
language plpgsql security definer set search_path = '' as $$
declare
  v_asta   uuid;
  v_ordine uuid[];
begin
  if not public.e_admin_lega(p_lega) then
    return query select 'non_autorizzato'::public.esito_asta,
      'Solo l''amministratore della lega può aprire l''asta.'; return;
  end if;

  v_asta := public.assicura_asta(p_lega);

  if p_sorteggia then
    select array_agg(id order by random()) into v_ordine
    from public.teams where league_id = p_lega;
  else
    select array_agg(id order by created_at) into v_ordine
    from public.teams where league_id = p_lega;
  end if;

  if coalesce(array_length(v_ordine, 1), 0) < 2 then
    return query select 'asta_non_aperta'::public.esito_asta,
      'Servono almeno due squadre per fare un''asta.'; return;
  end if;

  update public.auctions
  set status = 'open', nomination_order = v_ordine, current_turn_index = 0,
      opened_at = now(), updated_at = now()
  where id = v_asta and status = 'draft';

  if not found then
    return query select 'asta_non_aperta'::public.esito_asta,
      'Questa asta è già stata aperta.'; return;
  end if;

  update public.leagues set status = 'auction' where id = p_lega;

  insert into public.auction_events (auction_id, type, payload, actor_user_id)
  values (v_asta, 'apertura',
          jsonb_build_object('ordine', to_jsonb(v_ordine), 'sorteggiato', p_sorteggia),
          (select auth.uid()));

  return query select 'ok'::public.esito_asta, 'Asta aperta. Si comincia.';
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Avanzamento del turno
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * Passa al prossimo che può ancora chiamare, saltando chi ha la rosa piena o
 * non ha più crediti nemmeno per l'offerta minima. Se non può più nessuno,
 * l'asta si chiude da sola.
 */
create or replace function public.avanza_turno(p_asta uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_asta     public.auctions%rowtype;
  v_quante   int;
  v_indice   int;
  v_squadra  uuid;
  v_min      int;
  i          int;
begin
  select * into v_asta from public.auctions where id = p_asta;
  v_quante := coalesce(array_length(v_asta.nomination_order, 1), 0);
  if v_quante = 0 then return; end if;

  select min_bid into v_min from public.leagues where id = v_asta.league_id;

  for i in 1..v_quante loop
    v_indice  := (v_asta.current_turn_index + i) % v_quante;
    v_squadra := v_asta.nomination_order[v_indice + 1];

    if exists (
      select 1 from public.team_budget b
      where b.team_id = v_squadra and b.slot_rimanenti > 0 and b.massimo_offribile >= v_min
    ) then
      update public.auctions set current_turn_index = v_indice, updated_at = now()
      where id = p_asta;
      return;
    end if;
  end loop;

  -- Nessuno può più chiamare: la serata è finita.
  update public.auctions set status = 'closed', closed_at = now(), updated_at = now()
  where id = p_asta;
  update public.leagues set status = 'done' where id = v_asta.league_id;
  insert into public.auction_events (auction_id, type) values (p_asta, 'chiusura');
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Chiamata
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.chiama_calciatore(
  p_lega      uuid,
  p_player_id int,
  p_importo   int
)
returns table (esito public.esito_asta, messaggio text, lotto uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_asta     public.auctions%rowtype;
  v_squadra  uuid;
  v_budget   public.team_budget%rowtype;
  v_ruolo    public.ruolo_calciatore;
  v_min      int;
  v_lotto    uuid;
begin
  select * into v_asta from public.auctions where league_id = p_lega for update;
  if not found or v_asta.status <> 'open' then
    return query select 'asta_non_aperta'::public.esito_asta, 'L''asta non è aperta.', null::uuid; return;
  end if;

  select id into v_squadra from public.teams
  where league_id = p_lega and user_id = (select auth.uid());
  if v_squadra is null then
    return query select 'non_autorizzato'::public.esito_asta, 'Non hai una squadra in questa lega.', null::uuid; return;
  end if;

  if v_asta.nomination_order[v_asta.current_turn_index + 1] is distinct from v_squadra then
    return query select 'non_e_il_tuo_turno'::public.esito_asta, 'Non tocca a te chiamare.', null::uuid; return;
  end if;

  if exists (select 1 from public.auction_lots where auction_id = v_asta.id and status = 'open') then
    return query select 'lotto_chiuso'::public.esito_asta,
      'C''è già un calciatore all''asta.', null::uuid; return;
  end if;

  if exists (select 1 from public.roster_players where league_id = p_lega and player_id = p_player_id) then
    return query select 'gia_acquistato'::public.esito_asta,
      'Questo calciatore è già stato comprato.', null::uuid; return;
  end if;

  select role into v_ruolo from public.players where id = p_player_id;
  if v_ruolo is null then
    return query select 'gia_acquistato'::public.esito_asta,
      'Questo calciatore non è nel listone.', null::uuid; return;
  end if;

  if public.slot_liberi_ruolo(v_squadra, v_ruolo) <= 0 then
    return query select 'ruolo_pieno'::public.esito_asta,
      'Hai già completato questo reparto.', null::uuid; return;
  end if;

  select min_bid into v_min from public.leagues where id = p_lega;
  select * into v_budget from public.team_budget where team_id = v_squadra;

  if p_importo < v_min then
    return query select 'offerta_troppo_bassa'::public.esito_asta,
      format('L''offerta minima è %s.', v_min), null::uuid; return;
  end if;

  if p_importo > v_budget.massimo_offribile then
    return query select 'oltre_il_massimo'::public.esito_asta,
      format('Puoi arrivare al massimo a %s: devi tenere %s crediti per gli slot che ti restano.',
             v_budget.massimo_offribile, v_budget.credits_remaining - v_budget.massimo_offribile),
      null::uuid; return;
  end if;

  insert into public.auction_lots (auction_id, player_id, nominated_by_team_id,
                                   current_bid, current_bidder_team_id, last_bid_at)
  values (v_asta.id, p_player_id, v_squadra, p_importo, v_squadra, now())
  returning id into v_lotto;

  insert into public.bids (lot_id, team_id, amount) values (v_lotto, v_squadra, p_importo);

  insert into public.auction_events (auction_id, type, payload, actor_user_id)
  values (v_asta.id, 'chiamata',
          jsonb_build_object('lotto', v_lotto, 'calciatore', p_player_id,
                             'squadra', v_squadra, 'importo', p_importo),
          (select auth.uid()));

  return query select 'ok'::public.esito_asta, 'Chiamato.', v_lotto;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rilancio
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.rilancia(p_lotto uuid, p_importo int)
returns table (esito public.esito_asta, messaggio text, offerta int)
language plpgsql security definer set search_path = '' as $$
declare
  v_lotto   public.auction_lots%rowtype;
  v_asta    public.auctions%rowtype;
  v_squadra uuid;
  v_budget  public.team_budget%rowtype;
  v_ruolo   public.ruolo_calciatore;
begin
  -- Il blocco sulla riga serializza i rilanci simultanei: la seconda richiesta
  -- aspetta e trova il lotto già aggiornato. È il caso normale, non l'eccezione.
  select * into v_lotto from public.auction_lots where id = p_lotto for update;
  if not found then
    return query select 'lotto_chiuso'::public.esito_asta, 'Questo lotto non esiste.', 0; return;
  end if;

  select * into v_asta from public.auctions where id = v_lotto.auction_id;

  if v_lotto.status <> 'open' then
    return query select 'lotto_chiuso'::public.esito_asta,
      'Il calciatore è stato appena assegnato.', v_lotto.current_bid; return;
  end if;
  if v_asta.status <> 'open' then
    return query select 'asta_non_aperta'::public.esito_asta,
      'L''asta è in pausa.', v_lotto.current_bid; return;
  end if;

  -- Il tempo è già scaduto: si rifiuta invece di far entrare un'offerta
  -- arrivata dopo la campanella.
  if now() >= v_lotto.last_bid_at
      + make_interval(secs => v_asta.inactivity_seconds + v_asta.countdown_seconds) then
    return query select 'lotto_chiuso'::public.esito_asta,
      'Tempo scaduto: il calciatore sta per essere assegnato.', v_lotto.current_bid; return;
  end if;

  select id into v_squadra from public.teams
  where league_id = v_asta.league_id and user_id = (select auth.uid());
  if v_squadra is null then
    return query select 'non_autorizzato'::public.esito_asta,
      'Non hai una squadra in questa lega.', v_lotto.current_bid; return;
  end if;

  if v_asta.bid_type = 'con_passo'
     and exists (select 1 from public.lot_passes where lot_id = p_lotto and team_id = v_squadra) then
    return query select 'hai_passato'::public.esito_asta,
      'Hai passato su questo calciatore.', v_lotto.current_bid; return;
  end if;

  if p_importo <= v_lotto.current_bid then
    return query select 'offerta_troppo_bassa'::public.esito_asta,
      format('Sei stato superato: ora siamo a %s. Rilancia?', v_lotto.current_bid),
      v_lotto.current_bid; return;
  end if;

  select role into v_ruolo from public.players where id = v_lotto.player_id;
  if public.slot_liberi_ruolo(v_squadra, v_ruolo) <= 0 then
    return query select 'ruolo_pieno'::public.esito_asta,
      'Hai già completato questo reparto.', v_lotto.current_bid; return;
  end if;

  select * into v_budget from public.team_budget where team_id = v_squadra;
  if p_importo > v_budget.massimo_offribile then
    return query select 'oltre_il_massimo'::public.esito_asta,
      format('Puoi arrivare al massimo a %s: devi tenere %s crediti per gli slot che ti restano.',
             v_budget.massimo_offribile, v_budget.credits_remaining - v_budget.massimo_offribile),
      v_lotto.current_bid; return;
  end if;

  update public.auction_lots
  set current_bid = p_importo, current_bidder_team_id = v_squadra, last_bid_at = now()
  where id = p_lotto;

  insert into public.bids (lot_id, team_id, amount) values (p_lotto, v_squadra, p_importo);

  insert into public.auction_events (auction_id, type, payload, actor_user_id)
  values (v_asta.id, 'rilancio',
          jsonb_build_object('lotto', p_lotto, 'squadra', v_squadra, 'importo', p_importo),
          (select auth.uid()));

  return query select 'ok'::public.esito_asta, 'Offerta accettata.', p_importo;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Chiusura del lotto allo scadere
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * Chiude il lotto se il tempo è davvero finito.
 *
 * La chiama il dispositivo che vede il countdown a zero, ma **decide il
 * server**: ricalcola dai propri istanti e rifiuta se non è scaduto. Così la
 * chiusura è immediata per chi è al tavolo e nessun orologio sfasato può
 * anticiparla. Vedi ADR-0005.
 */
create or replace function public.chiudi_lotto_se_scaduto(p_lotto uuid)
returns table (esito public.esito_asta, messaggio text, squadra uuid, prezzo int)
language plpgsql security definer set search_path = '' as $$
declare
  v_lotto public.auction_lots%rowtype;
  v_asta  public.auctions%rowtype;
begin
  select * into v_lotto from public.auction_lots where id = p_lotto for update;
  if not found then
    return query select 'lotto_chiuso'::public.esito_asta, 'Lotto inesistente.', null::uuid, 0; return;
  end if;
  if v_lotto.status <> 'open' then
    return query select 'lotto_chiuso'::public.esito_asta, 'Già chiuso.',
      v_lotto.awarded_team_id, coalesce(v_lotto.final_price, 0); return;
  end if;

  select * into v_asta from public.auctions where id = v_lotto.auction_id;
  if v_asta.status <> 'open' then
    return query select 'asta_non_aperta'::public.esito_asta, 'L''asta è in pausa.', null::uuid, 0; return;
  end if;

  if now() < v_lotto.last_bid_at
      + make_interval(secs => v_asta.inactivity_seconds + v_asta.countdown_seconds) then
    return query select 'non_ancora_scaduto'::public.esito_asta,
      'Il tempo non è ancora finito.', null::uuid, 0; return;
  end if;

  -- Crediti e rosa cambiano nella STESSA transazione dell'aggiudicazione:
  -- separarli lascerebbe una squadra col calciatore e senza lo scalo.
  update public.auction_lots
  set status = 'awarded', awarded_team_id = v_lotto.current_bidder_team_id,
      final_price = v_lotto.current_bid, closed_at = now()
  where id = p_lotto;

  insert into public.roster_players (league_id, team_id, player_id, price, source)
  values (v_asta.league_id, v_lotto.current_bidder_team_id, v_lotto.player_id,
          v_lotto.current_bid, 'auction');

  update public.teams
  set credits_remaining = credits_remaining - v_lotto.current_bid, updated_at = now()
  where id = v_lotto.current_bidder_team_id;

  insert into public.auction_events (auction_id, type, payload)
  values (v_asta.id, 'aggiudicazione',
          jsonb_build_object('lotto', p_lotto, 'calciatore', v_lotto.player_id,
                             'squadra', v_lotto.current_bidder_team_id,
                             'prezzo', v_lotto.current_bid));

  perform public.avanza_turno(v_asta.id);

  return query select 'ok'::public.esito_asta, 'Aggiudicato.',
    v_lotto.current_bidder_team_id, v_lotto.current_bid;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Pausa
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.pausa_asta(p_lega uuid, p_in_pausa boolean)
returns table (esito public.esito_asta, messaggio text)
language plpgsql security definer set search_path = '' as $$
declare v_asta public.auctions%rowtype;
begin
  if not public.e_admin_lega(p_lega) then
    return query select 'non_autorizzato'::public.esito_asta,
      'Solo l''amministratore può mettere in pausa.'; return;
  end if;
  select * into v_asta from public.auctions where league_id = p_lega;

  if p_in_pausa then
    update public.auctions set status = 'paused', updated_at = now()
    where id = v_asta.id and status = 'open';
  else
    -- Riprendendo, il tempo del lotto aperto riparte da adesso: nessuno deve
    -- perdere il diritto di rilanciare per una pausa caffè.
    update public.auction_lots set last_bid_at = now()
    where auction_id = v_asta.id and status = 'open';
    update public.auctions set status = 'open', updated_at = now()
    where id = v_asta.id and status = 'paused';
  end if;

  insert into public.auction_events (auction_id, type, payload, actor_user_id)
  values (v_asta.id, case when p_in_pausa then 'pausa' else 'ripresa' end,
          '{}'::jsonb, (select auth.uid()));

  return query select 'ok'::public.esito_asta,
    case when p_in_pausa then 'Asta in pausa.' else 'Si riprende.' end;
end;
$$;

create trigger aste_tocca_updated_at
  before update on public.auctions
  for each row execute function public.tocca_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- Aggiornamenti in tempo reale
-- ═══════════════════════════════════════════════════════════════════════════
-- Le superfici si iscrivono a queste tabelle per vedere le stesse cose nello
-- stesso istante. Passano solo dati pubblici della lega: gli obiettivi non
-- sono qui dentro e non ci finiranno mai.

alter publication supabase_realtime add table public.auctions;
alter publication supabase_realtime add table public.auction_lots;
alter publication supabase_realtime add table public.bids;
alter publication supabase_realtime add table public.roster_players;
alter publication supabase_realtime add table public.teams;
