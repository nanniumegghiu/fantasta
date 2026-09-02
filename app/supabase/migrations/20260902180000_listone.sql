-- ═══════════════════════════════════════════════════════════════════════════
-- 0004 · Listone dei calciatori e statistiche di campionato
--
-- Fetta 2 della roadmap. Il listone e' GLOBALE, non per lega: lo stesso
-- calciatore serve a tutte le leghe, e duplicarlo significherebbe caricare
-- foto e statistiche N volte. Vedi docs/03-modello-dati.md.
--
-- Chi puo' caricarlo: solo gli amministratori dell'applicazione, non gli
-- amministratori di lega. Decisione D11: un listone sbagliato caricato da un
-- amministratore di lega romperebbe la sua lega senza che se ne accorga.
-- ═══════════════════════════════════════════════════════════════════════════

create type public.ruolo_calciatore as enum ('P', 'D', 'C', 'A');

-- ─── Amministratori dell'applicazione ───────────────────────────────────────

create table public.app_admins (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);

-- Chi diventa amministratore dell'applicazione al momento della registrazione.
-- E' un elenco esplicito e leggibile, invece di un controllo nascosto dentro
-- una funzione: chi legge il progetto deve poter vedere chi ha i poteri.
create table public.app_admin_emails (
  email text primary key,
  nota  text
);

insert into public.app_admin_emails (email, nota)
values ('gcarta93@gmail.com', 'Proprietario del progetto')
on conflict (email) do nothing;

alter table public.app_admins       enable row level security;
alter table public.app_admin_emails enable row level security;

-- Ognuno puo' sapere se e' amministratore, nessuno puo' sapere chi altro lo e'.
create policy "amministratori: so se lo sono io"
  on public.app_admins for select to authenticated
  using (user_id = (select auth.uid()));

-- app_admin_emails resta senza policy: la legge solo il trigger, che gira
-- con i permessi del proprietario.

create or replace function public.e_admin_app()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.app_admins a where a.user_id = (select auth.uid())
  );
$$;

-- Il collegamento avviene alla registrazione, dentro il trigger che esiste già.
create or replace function public.crea_profilo_alla_registrazione()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Fantallenatore'
    ), 40),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  -- Se l'indirizzo è nell'elenco, diventa amministratore dell'applicazione.
  if exists (
    select 1 from public.app_admin_emails e
    where lower(e.email) = lower(coalesce(new.email, ''))
  ) then
    insert into public.app_admins (user_id) values (new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

-- ─── Calciatori ─────────────────────────────────────────────────────────────

create table public.players (
  -- L'identificativo del listone ufficiale. Serve anche all'esportazione
  -- finale, dove è l'unica difesa contro le omonimie (ADR-0008).
  id           int primary key,
  season       text not null,
  name         text not null check (char_length(btrim(name)) between 1 and 80),
  role         public.ruolo_calciatore not null,
  serie_a_team text not null check (char_length(btrim(serie_a_team)) between 1 and 40),
  quotation    int  not null default 1 check (quotation >= 0),

  -- Ponte verso il facepack, ADR-0011. Si riempie nella Fetta 5.
  fm_id        text,
  photo_path   text,

  -- Un calciatore che sparisce dal listone NON si cancella: verrebbe giù la
  -- rosa di chi l'ha comprato. Si segna come non più in listone.
  active       boolean not null default true,
  updated_at   timestamptz not null default now()
);

create index players_ruolo_idx   on public.players (role) where active;
create index players_squadra_idx on public.players (serie_a_team) where active;
create index players_nome_idx    on public.players (lower(name));

comment on table public.players is
  'Listone globale dei calciatori quotati. Importato da file, ADR-0003.';

-- ─── Statistiche ────────────────────────────────────────────────────────────

create table public.player_stats (
  player_id    int primary key references public.players (id) on delete cascade,
  season       text not null,
  -- L'ultima giornata COMPLETA inclusa. Senza questo numero le statistiche
  -- non significano niente, e l'interfaccia deve poterlo mostrare sempre.
  matchday     int  check (matchday between 0 and 60),
  games_played int  check (games_played >= 0),
  minutes      int  check (minutes >= 0),
  avg_vote     numeric(4, 2),
  fanta_avg    numeric(4, 2),
  goals        int  check (goals >= 0),
  assists      int  check (assists >= 0),
  yellow_cards int  check (yellow_cards >= 0),
  red_cards    int  check (red_cards >= 0),
  updated_at   timestamptz not null default now()
);

-- ─── Regole di accesso ──────────────────────────────────────────────────────

alter table public.players      enable row level security;
alter table public.player_stats enable row level security;

-- Il listone lo legge chiunque abbia fatto l'accesso: non è un dato riservato,
-- è pubblicamente noto. La scrittura invece è chiusa.
create policy "listone: lo legge chi ha fatto l accesso"
  on public.players for select to authenticated using (true);

create policy "statistiche: le legge chi ha fatto l accesso"
  on public.player_stats for select to authenticated using (true);

-- Nessuna policy di scrittura: si scrive solo dalle funzioni di importazione,
-- che controllano di persona chi le sta chiamando.

-- ─── Importazione del listone ───────────────────────────────────────────────

create type public.esito_importazione as enum ('ok', 'non_autorizzato', 'file_vuoto');

/**
 * Importa il listone in una sola chiamata.
 *
 * Riceve le righe già interpretate dal client come elenco di oggetti:
 *   [{ "id": 2764, "nome": "...", "ruolo": "A", "squadra": "Inter", "quotazione": 35 }, ...]
 *
 * È ripetibile: rilanciarla sullo stesso file aggiorna e non duplica.
 * I calciatori che non compaiono nel file vengono segnati come non più in
 * listone, mai cancellati.
 */
create or replace function public.importa_listone(
  p_stagione text,
  p_righe    jsonb
)
returns table (esito public.esito_importazione, messaggio text, inseriti int, aggiornati int, ritirati int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prima     int;
  v_dopo      int;
  v_toccati   int;
  v_ritirati  int;
begin
  if not public.e_admin_app() then
    return query select 'non_autorizzato'::public.esito_importazione,
      'Solo un amministratore dell''applicazione può caricare il listone.', 0, 0, 0;
    return;
  end if;

  if p_righe is null or jsonb_array_length(p_righe) = 0 then
    return query select 'file_vuoto'::public.esito_importazione,
      'Il file non contiene nessuna riga utilizzabile.', 0, 0, 0;
    return;
  end if;

  select count(*)::int into v_prima from public.players;

  with righe as (
    select
      (r ->> 'id')::int                             as id,
      btrim(r ->> 'nome')                           as name,
      (r ->> 'ruolo')::public.ruolo_calciatore      as role,
      btrim(r ->> 'squadra')                        as serie_a_team,
      coalesce((r ->> 'quotazione')::int, 1)        as quotation
    from jsonb_array_elements(p_righe) as r
  )
  insert into public.players (id, season, name, role, serie_a_team, quotation, active, updated_at)
  select id, btrim(p_stagione), name, role, serie_a_team, quotation, true, now()
  from righe
  on conflict (id) do update set
    season       = excluded.season,
    name         = excluded.name,
    role         = excluded.role,
    serie_a_team = excluded.serie_a_team,
    quotation    = excluded.quotation,
    active       = true,
    updated_at   = now();

  get diagnostics v_toccati = row_count;
  select count(*)::int into v_dopo from public.players;

  -- Chi non c'è più nel file esce dal listone ma resta nel database.
  update public.players p
  set active = false, updated_at = now()
  where p.season = btrim(p_stagione)
    and p.active
    and not exists (
      select 1 from jsonb_array_elements(p_righe) as r where (r ->> 'id')::int = p.id
    );
  get diagnostics v_ritirati = row_count;

  return query select 'ok'::public.esito_importazione,
    format('Listone aggiornato: %s righe lette.', jsonb_array_length(p_righe)),
    v_dopo - v_prima,
    v_toccati - (v_dopo - v_prima),
    v_ritirati;
end;
$$;

/**
 * Importa le statistiche. Stessa forma, stessa idempotenza.
 * Righe: [{ "id": 2764, "partite": 12, "minuti": 900, "media": 6.4, ... }]
 */
create or replace function public.importa_statistiche(
  p_stagione text,
  p_giornata int,
  p_righe    jsonb
)
returns table (esito public.esito_importazione, messaggio text, aggiornati int, ignorati int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agg int;
  v_tot int;
begin
  if not public.e_admin_app() then
    return query select 'non_autorizzato'::public.esito_importazione,
      'Solo un amministratore dell''applicazione può caricare le statistiche.', 0, 0;
    return;
  end if;

  if p_righe is null or jsonb_array_length(p_righe) = 0 then
    return query select 'file_vuoto'::public.esito_importazione,
      'Il file non contiene nessuna riga utilizzabile.', 0, 0;
    return;
  end if;

  v_tot := jsonb_array_length(p_righe);

  with righe as (
    select
      (r ->> 'id')::int              as player_id,
      (r ->> 'partite')::int         as games_played,
      (r ->> 'minuti')::int          as minutes,
      (r ->> 'media')::numeric       as avg_vote,
      (r ->> 'fantamedia')::numeric  as fanta_avg,
      (r ->> 'gol')::int             as goals,
      (r ->> 'assist')::int          as assists,
      (r ->> 'ammonizioni')::int     as yellow_cards,
      (r ->> 'espulsioni')::int      as red_cards
    from jsonb_array_elements(p_righe) as r
  )
  insert into public.player_stats (
    player_id, season, matchday, games_played, minutes,
    avg_vote, fanta_avg, goals, assists, yellow_cards, red_cards, updated_at
  )
  select
    g.player_id, btrim(p_stagione), p_giornata, g.games_played, g.minutes,
    g.avg_vote, g.fanta_avg, g.goals, g.assists, g.yellow_cards, g.red_cards, now()
  from righe g
  -- Le righe che non corrispondono a nessun calciatore del listone si ignorano
  -- in silenzio nel database, ma il numero torna a chi ha caricato il file.
  join public.players p on p.id = g.player_id
  on conflict (player_id) do update set
    season       = excluded.season,
    matchday     = excluded.matchday,
    games_played = excluded.games_played,
    minutes      = excluded.minutes,
    avg_vote     = excluded.avg_vote,
    fanta_avg    = excluded.fanta_avg,
    goals        = excluded.goals,
    assists      = excluded.assists,
    yellow_cards = excluded.yellow_cards,
    red_cards    = excluded.red_cards,
    updated_at   = now();

  get diagnostics v_agg = row_count;

  return query select 'ok'::public.esito_importazione,
    format('Statistiche aggiornate alla giornata %s.', p_giornata),
    v_agg, v_tot - v_agg;
end;
$$;

-- ─── Vista comoda per la tabella del listone ────────────────────────────────
-- Unisce calciatori e statistiche una volta sola, così l'interfaccia ordina e
-- filtra senza dover incrociare due elenchi sul telefono.

create or replace view public.listone
with (security_invoker = true) as
select
  p.id,
  p.season,
  p.name,
  p.role,
  p.serie_a_team,
  p.quotation,
  p.photo_path,
  p.active,
  s.matchday,
  s.games_played,
  s.minutes,
  s.avg_vote,
  s.fanta_avg,
  s.goals,
  s.assists,
  s.yellow_cards,
  s.red_cards
from public.players p
left join public.player_stats s on s.player_id = p.id;

comment on view public.listone is
  'Calciatori con le statistiche già unite. security_invoker: eredita le policy di players.';
