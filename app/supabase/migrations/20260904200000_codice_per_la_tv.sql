-- ═══════════════════════════════════════════════════════════════════════════
-- 0029 · Un codice per aprire lo schermo condiviso sulla TV
--
-- IL PROBLEMA, DETTO DALL'UTENTE
--
-- Con un solo telefono non si può proiettare lo schermo condiviso e nello
-- stesso tempo fare la propria asta: duplicare lo schermo manda sul televisore
-- **quello che c'è sul telefono**, quindi o si guarda o si rilancia.
--
-- La strada giusta è che sia la TV ad aprire la pagina, che è un indirizzo a
-- sé e non mostra dati privati di nessuno. Restavano due ostacoli, tutti e due
-- di digitazione col telecomando: l'indirizzo conteneva l'identificativo della
-- lega, trentasei caratteri di lettere e trattini, e la pagina chiedeva email
-- e password.
--
-- LA FORMA DELLA SOLUZIONE
--
-- Un codice di sei caratteri, dallo stesso alfabeto dei codici d'invito —
-- niente O, 0, I, 1, che al telecomando si sbagliano sempre. L'indirizzo
-- diventa `.../tv/K7M2PQ`, e non chiede nessun accesso.
--
-- PERCHE' UNA FUNZIONE SOLA CHE RESTITUISCE TUTTO
--
-- Chi apre quel link non è un partecipante: per le regole di accesso non
-- esiste, e non deve esistere. Invece di aprire venti policy a un utente
-- speciale — venti occasioni di sbagliare — c'è **una sola funzione** che
-- restituisce esattamente quello che lo schermo mostra, e niente altro. Quello
-- che non è in questa funzione, dal quel link non si vede: è un confine che si
-- legge in un posto solo.
--
-- COSA NON C'E' DENTRO, ED E' IL PUNTO
--
-- Nessuna lista obiettivi, nessun tetto di spesa, nessuna nota personale,
-- nessun indirizzo email. Sono le stesse cose che lo schermo condiviso non
-- mostrava già prima: qui smettono di essere una scelta dell'interfaccia e
-- diventano un limite del server.
--
-- IL CODICE SCADE
--
-- Un link che non scade è un link che gira per sempre. Dodici ore coprono una
-- serata con abbondanza, e il giorno dopo quel codice non apre più niente.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.tv_codes (
  code       text primary key check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  league_id  uuid not null references public.leagues (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,

  -- Uno per lega: «il codice della TV» è una cosa sola, e rigenerarlo deve
  -- spegnere il precedente. Due codici vivi insieme sarebbero due cose da
  -- ricordare e una da revocare per sbaglio.
  unique (league_id)
);

comment on table public.tv_codes is
  'Il codice che apre lo schermo condiviso su un televisore, senza accesso. Uno per lega, scade da solo.';

alter table public.tv_codes enable row level security;

-- Nessuna policy: la tabella non si legge e non si scrive dal client. Si passa
-- dalle funzioni, che sono l'unico posto dove esistono i controlli.

-- ─── Generare e revocare ────────────────────────────────────────────────────

create or replace function public.crea_codice_tv(p_lega uuid, p_ore int default 12)
returns table (esito text, messaggio text, codice text, scade timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_codice text;
  v_ore    int := greatest(1, least(coalesce(p_ore, 12), 72));
  i        int;
begin
  if not public.e_admin_lega(p_lega) then
    return query select 'non_autorizzato',
      'Il codice per la TV lo genera l''amministratore della lega.',
      null::text, null::timestamptz; return;
  end if;

  -- Si riusa il generatore dei codici d'invito: stesso alfabeto senza
  -- caratteri ambigui, e una cosa in meno da tenere allineata.
  for i in 1..20 loop
    v_codice := public.genera_codice_invito();
    exit when not exists (select 1 from public.tv_codes t where t.code = v_codice);
  end loop;

  delete from public.tv_codes where league_id = p_lega;

  insert into public.tv_codes (code, league_id, created_by, expires_at)
  values (v_codice, p_lega, (select auth.uid()), now() + make_interval(hours => v_ore));

  return query select 'ok',
    format('Codice pronto. Vale %s ore, poi non apre più niente.', v_ore),
    v_codice,
    now() + make_interval(hours => v_ore);
end;
$$;

create or replace function public.revoca_codice_tv(p_lega uuid)
returns table (esito text, messaggio text)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.e_admin_lega(p_lega) then
    return query select 'non_autorizzato', 'Solo l''amministratore della lega.'; return;
  end if;

  delete from public.tv_codes where league_id = p_lega;
  return query select 'ok', 'Codice revocato: quel link non apre più lo schermo.';
end;
$$;

/** Il codice in corso, per mostrarlo di nuovo a chi l'ha generato. */
create or replace function public.codice_tv_corrente(p_lega uuid)
returns table (codice text, scade timestamptz)
language plpgsql security definer stable set search_path = '' as $$
begin
  if not public.e_admin_lega(p_lega) then
    return;
  end if;
  return query
    select t.code, t.expires_at from public.tv_codes t
    where t.league_id = p_lega and t.expires_at > now();
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Quello che il televisore può vedere
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * Tutto lo schermo condiviso, in una risposta sola, per chi ha il codice.
 *
 * PERCHE' UNA CHIAMATA E NON DIECI
 * Chi guarda il televisore non ha una sessione da partecipante, quindi non può
 * ascoltare il canale in tempo reale: la pagina interroga a intervalli. Dieci
 * chiamate ogni volta sarebbero dieci occasioni di arrivare disallineate — le
 * squadre di un istante e il lotto di quello dopo — e sullo schermo grande si
 * vedrebbe. Una sola risposta è coerente per costruzione.
 *
 * `adesso` viaggia insieme ai dati perché il countdown si calcola dallo scarto
 * fra l'orologio del televisore e quello del server: è la stessa ragione per
 * cui esiste `useScartoOrologio` nell'app, spiegata in ADR-0005.
 */
create or replace function public.schermo_tv(p_codice text)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_lega   public.leagues%rowtype;
  v_asta   public.auctions%rowtype;
  v_stag   text;
  v_dati   jsonb;
begin
  select l.* into v_lega
  from public.tv_codes t join public.leagues l on l.id = t.league_id
  where t.code = upper(btrim(coalesce(p_codice, '')))
    and t.expires_at > now();

  if v_lega.id is null then
    return jsonb_build_object('valido', false);
  end if;

  select * into v_asta from public.auctions where league_id = v_lega.id;
  v_stag := v_lega.season;

  select jsonb_build_object(
    'valido', true,
    'adesso', now(),

    'lega', jsonb_build_object(
      'nome', v_lega.name,
      'stagione', v_lega.season,
      'slots_p', v_lega.slots_p, 'slots_d', v_lega.slots_d,
      'slots_c', v_lega.slots_c, 'slots_a', v_lega.slots_a,
      'min_bid', v_lega.min_bid
    ),

    'asta', case when v_asta.id is null then null else jsonb_build_object(
      'id', v_asta.id,
      'status', v_asta.status,
      'method', v_asta.method,
      'variant', v_asta.variant,
      'conduction', v_asta.conduction,
      'current_role_phase', v_asta.current_role_phase,
      'nomination_order', to_jsonb(v_asta.nomination_order),
      'current_turn_index', v_asta.current_turn_index,
      'inactivity_seconds', v_asta.inactivity_seconds,
      'countdown_seconds', v_asta.countdown_seconds
    ) end,

    -- Il lotto aperto, col calciatore e le sue statistiche già uniti.
    'lotto', (
      select jsonb_build_object(
        'id', lo.id,
        'current_bid', lo.current_bid,
        'current_bidder_team_id', lo.current_bidder_team_id,
        'last_bid_at', lo.last_bid_at,
        'players', jsonb_build_object(
          'id', p.id, 'name', p.name, 'role', p.role,
          'serie_a_team', p.serie_a_team, 'quotation', p.quotation,
          'photo_path', p.photo_path,
          'player_stats', case when s.player_id is null then null else jsonb_build_object(
            'matchday', s.matchday, 'games_played', s.games_played,
            'minutes', s.minutes, 'avg_vote', s.avg_vote, 'fanta_avg', s.fanta_avg,
            'goals', s.goals, 'assists', s.assists,
            'yellow_cards', s.yellow_cards, 'red_cards', s.red_cards
          ) end
        )
      )
      from public.auction_lots lo
      join public.players p on p.id = lo.player_id
      left join public.player_stats s on s.player_id = p.id
      where lo.auction_id = v_asta.id and lo.status = 'open'
      limit 1
    ),

    -- Le squadre, con quello che lo schermo mostra di loro. Nessuna email,
    -- nessun identificativo di persona: solo il nome della squadra.
    'squadre', coalesce((
      select jsonb_agg(jsonb_build_object(
        'team_id', b.team_id,
        'name', b.name,
        'credits_remaining', b.credits_remaining,
        'presi_p', b.presi_p, 'presi_d', b.presi_d,
        'presi_c', b.presi_c, 'presi_a', b.presi_a,
        'slot_rimanenti', b.slot_rimanenti,
        'massimo_offribile', b.massimo_offribile
      ) order by b.name)
      from public.team_budget b where b.league_id = v_lega.id
    ), '[]'::jsonb),

    'rose', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'team_id', r.team_id, 'price', r.price,
        'players', jsonb_build_object(
          'id', p.id, 'name', p.name, 'role', p.role,
          'serie_a_team', p.serie_a_team, 'photo_path', p.photo_path
        )
      ))
      from public.roster_players r join public.players p on p.id = r.player_id
      where r.league_id = v_lega.id
    ), '[]'::jsonb),

    -- Gli stemmi: il percorso, che la pagina firma da sé una volta entrata.
    'stemmi', coalesce((
      select jsonb_object_agg(c.serie_a_team, c.logo_path)
      from public.club_logos c
      where c.season = v_stag and c.logo_path is not null
    ), '{}'::jsonb)
  ) into v_dati;

  return v_dati;
end;
$$;

comment on function public.schermo_tv(text) is
  'Tutto e solo cio che lo schermo condiviso mostra, per chi ha il codice della TV. Quello che non e qui dentro, da quel link non si vede.';

-- Chi apre il link non e' un partecipante: entra come utente anonimo, che per
-- PostgreSQL e' comunque `authenticated`. La funzione controlla il codice da
-- sola, ed e' l'unica cosa che quel visitatore puo' chiamare sulla lega.
grant execute on function public.schermo_tv(text) to authenticated, anon;
