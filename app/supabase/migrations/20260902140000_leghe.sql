-- ═══════════════════════════════════════════════════════════════════════════
-- 0002 · Leghe, partecipanti, squadre e codici di invito
--
-- Fetta 1 della roadmap. Come sempre: ogni tabella nasce con le sue policy
-- nella stessa migrazione, e l'accesso e' negato per impostazione predefinita.
--
-- Nota sulla ricorsione: le policy di `league_members` devono chiedere "sei
-- membro di questa lega?", che si risponde leggendo `league_members`. Se la
-- domanda passasse dalle policy, si entrerebbe in ricorsione infinita. Per
-- questo le funzioni di appartenenza sono SECURITY DEFINER: girano con i
-- permessi del proprietario e scavalcano le policy, che e' esattamente cio'
-- che serve per rispondere a una domanda di appartenenza.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Tipi ───────────────────────────────────────────────────────────────────

create type public.ruolo_partecipante as enum ('admin', 'member');
create type public.stato_lega          as enum ('setup', 'auction', 'done');

-- ─── Leghe ──────────────────────────────────────────────────────────────────

create table public.leagues (
  id                          uuid primary key default gen_random_uuid(),
  name                        text not null check (char_length(btrim(name)) between 2 and 60),
  season                      text not null check (char_length(season) between 4 and 12),
  admin_user_id               uuid not null references auth.users (id) on delete restrict,

  -- Codice di invito. Alfabeto senza caratteri ambigui: niente O/0, I/1.
  invite_code                 text not null unique check (invite_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  invite_active               boolean not null default true,

  rules_pdf_path              text,

  -- Regole della lega. Colonne tipizzate, non un campo libero: cosi' il
  -- database puo' rifiutare i valori assurdi invece di ospitarli.
  credits_initial             int  not null default 500 check (credits_initial between 1 and 100000),
  slots_p                     int  not null default 3   check (slots_p between 1 and 10),
  slots_d                     int  not null default 8   check (slots_d between 1 and 20),
  slots_c                     int  not null default 8   check (slots_c between 1 and 20),
  slots_a                     int  not null default 6   check (slots_a between 1 and 20),
  min_bid                     int  not null default 1   check (min_bid between 1 and 100),
  trades_enabled              boolean not null default false,
  trades_with_credits_enabled boolean not null default false,
  max_members                 int  not null default 10  check (max_members between 2 and 20),

  status                      public.stato_lega not null default 'setup',
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  -- Il conguaglio in crediti ha senso solo se gli scambi sono permessi.
  constraint scambi_coerenti check (trades_enabled or not trades_with_credits_enabled)
);

comment on table public.leagues is
  'Una lega di amici per una stagione. Regole in docs/02-dominio-fantacalcio.md';

create index leagues_admin_idx on public.leagues (admin_user_id);

-- ─── Partecipanti ───────────────────────────────────────────────────────────

create table public.league_members (
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id   uuid not null references auth.users (id)     on delete cascade,
  role      public.ruolo_partecipante not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

create index league_members_user_idx on public.league_members (user_id);

-- ─── Squadre ────────────────────────────────────────────────────────────────

create table public.teams (
  id                uuid primary key default gen_random_uuid(),
  league_id         uuid not null references public.leagues (id) on delete cascade,
  user_id           uuid not null references auth.users (id)     on delete cascade,
  name              text not null check (char_length(btrim(name)) between 2 and 40),
  credits_remaining int  not null check (credits_remaining >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (league_id, user_id),
  -- Due squadre con lo stesso nome nella stessa lega sarebbero un incubo
  -- durante l'asta: "a chi l'ho assegnato?"
  unique (league_id, name)
);

create index teams_league_idx on public.teams (league_id);

-- ─── Tentativi sul codice di invito ─────────────────────────────────────────
-- Serve a limitare chi prova codici a caso. Tabella di servizio: nessuno la
-- legge dal client.

create table public.invite_attempts (
  id         bigserial primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  code_tried text not null,
  succeeded  boolean not null,
  tried_at   timestamptz not null default now()
);

create index invite_attempts_user_time_idx on public.invite_attempts (user_id, tried_at desc);

-- ═══════════════════════════════════════════════════════════════════════════
-- Funzioni di appartenenza (SECURITY DEFINER: vedi nota in testa al file)
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.e_membro_lega(p_league uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.league_members m
    where m.league_id = p_league and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.e_admin_lega(p_league uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.league_members m
    where m.league_id = p_league
      and m.user_id = (select auth.uid())
      and m.role = 'admin'
  );
$$;

-- Vero se l'utente indicato condivide almeno una lega con chi sta chiedendo.
create or replace function public.condivide_lega(p_user uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.league_members mio
    join public.league_members altrui on altrui.league_id = mio.league_id
    where mio.user_id = (select auth.uid())
      and altrui.user_id = p_user
  );
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Regole di accesso
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.leagues         enable row level security;
alter table public.league_members  enable row level security;
alter table public.teams           enable row level security;
alter table public.invite_attempts enable row level security;

-- Leghe: le vedono i suoi partecipanti. Le modifica solo l'amministratore.
-- L'inserimento passa solo dalla funzione crea_lega, quindi niente policy.
create policy "lega: la vedono i partecipanti"
  on public.leagues for select to authenticated
  using (public.e_membro_lega(id));

create policy "lega: la modifica l amministratore"
  on public.leagues for update to authenticated
  using (public.e_admin_lega(id))
  with check (public.e_admin_lega(id));

-- Partecipanti: li vedono i partecipanti della stessa lega.
create policy "partecipanti: li vedono i compagni di lega"
  on public.league_members for select to authenticated
  using (public.e_membro_lega(league_id));

-- Uscire da una lega si puo', solo dalla propria riga e solo prima dell'asta.
create policy "partecipanti: si puo uscire prima dell asta"
  on public.league_members for delete to authenticated
  using (
    user_id = (select auth.uid())
    and role <> 'admin'
    and exists (select 1 from public.leagues l where l.id = league_id and l.status = 'setup')
  );

-- Squadre: le vedono tutti i partecipanti, perche' durante l'asta ognuno deve
-- poter guardare le rose e i crediti degli avversari.
create policy "squadre: le vedono i partecipanti"
  on public.teams for select to authenticated
  using (public.e_membro_lega(league_id));

-- Il proprietario cambia il nome della sua squadra. I CREDITI NO: quelli li
-- scrive solo il server. La colonna e' protetta dal controllo qui sotto.
create policy "squadre: il nome lo cambia il proprietario"
  on public.teams for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.blocca_modifica_crediti()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Il ruolo `authenticated` e' quello del client. Le funzioni del server
  -- girano come proprietario e non passano di qui.
  if current_setting('role', true) = 'authenticated'
     and new.credits_remaining is distinct from old.credits_remaining then
    raise exception 'I crediti li aggiorna solo il server.' using errcode = '42501';
  end if;
  if new.league_id is distinct from old.league_id
     or new.user_id is distinct from old.user_id then
    raise exception 'Squadra non trasferibile.' using errcode = '42501';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger squadre_proteggi_crediti
  before update on public.teams
  for each row execute function public.blocca_modifica_crediti();

-- Tentativi di invito: nessuna policy. Ci scrive solo la funzione di ingresso.

-- Profili: ora che esistono le leghe, si vedono anche i compagni di lega.
-- La policy precedente viene sostituita, non affiancata.
drop policy if exists "profilo: leggo il mio" on public.profiles;

create policy "profilo: io e i compagni di lega"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id or public.condivide_lega(id));

-- ═══════════════════════════════════════════════════════════════════════════
-- Codice di invito
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.genera_codice_invito()
returns text
language plpgsql
set search_path = ''
as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- niente O 0 I 1
  candidato text;
  i int;
begin
  for tentativo in 1..50 loop
    candidato := '';
    for i in 1..6 loop
      candidato := candidato || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    if not exists (select 1 from public.leagues l where l.invite_code = candidato) then
      return candidato;
    end if;
  end loop;
  raise exception 'Non riesco a generare un codice di invito libero.';
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Creazione di una lega: lega, amministratore e squadra in una transazione
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.crea_lega(
  p_nome            text,
  p_stagione        text,
  p_nome_squadra    text,
  p_crediti         int  default 500,
  p_slot_p          int  default 3,
  p_slot_d          int  default 8,
  p_slot_c          int  default 8,
  p_slot_a          int  default 6,
  p_offerta_minima  int  default 1,
  p_scambi          boolean default false,
  p_scambi_crediti  boolean default false,
  p_max_partecipanti int default 10
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utente uuid := (select auth.uid());
  v_lega   uuid;
begin
  if v_utente is null then
    raise exception 'Devi aver fatto l''accesso.' using errcode = '42501';
  end if;

  -- La rosa deve stare nel budget: con l'offerta minima per ogni slot, il
  -- budget deve bastare. Altrimenti la lega nasce gia' impossibile.
  if p_crediti < (p_slot_p + p_slot_d + p_slot_c + p_slot_a) * p_offerta_minima then
    raise exception 'I crediti non bastano nemmeno a pagare l''offerta minima per ogni slot.'
      using errcode = '22023';
  end if;

  insert into public.leagues (
    name, season, admin_user_id, invite_code,
    credits_initial, slots_p, slots_d, slots_c, slots_a, min_bid,
    trades_enabled, trades_with_credits_enabled, max_members
  ) values (
    btrim(p_nome), btrim(p_stagione), v_utente, public.genera_codice_invito(),
    p_crediti, p_slot_p, p_slot_d, p_slot_c, p_slot_a, p_offerta_minima,
    p_scambi, p_scambi and p_scambi_crediti, p_max_partecipanti
  )
  returning id into v_lega;

  insert into public.league_members (league_id, user_id, role)
  values (v_lega, v_utente, 'admin');

  insert into public.teams (league_id, user_id, name, credits_remaining)
  values (v_lega, v_utente, btrim(p_nome_squadra), p_crediti);

  return v_lega;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Ingresso con codice di invito
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.entra_in_lega(
  p_codice       text,
  p_nome_squadra text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utente    uuid := (select auth.uid());
  v_lega      public.leagues%rowtype;
  v_falliti   int;
  v_quanti    int;
  v_codice    text := upper(btrim(p_codice));
begin
  if v_utente is null then
    raise exception 'Devi aver fatto l''accesso.' using errcode = '42501';
  end if;

  -- Limite ai tentativi: dieci fallimenti in dieci minuti e ci si ferma.
  select count(*) into v_falliti
  from public.invite_attempts a
  where a.user_id = v_utente
    and a.succeeded = false
    and a.tried_at > now() - interval '10 minutes';

  if v_falliti >= 10 then
    raise exception 'Troppi codici sbagliati. Riprova fra dieci minuti.' using errcode = '42901';
  end if;

  select * into v_lega from public.leagues l where l.invite_code = v_codice;

  if not found or not v_lega.invite_active then
    insert into public.invite_attempts (user_id, code_tried, succeeded)
    values (v_utente, v_codice, false);
    raise exception 'Codice non valido. Controlla le lettere e riprova.' using errcode = '22023';
  end if;

  if v_lega.status <> 'setup' then
    insert into public.invite_attempts (user_id, code_tried, succeeded)
    values (v_utente, v_codice, false);
    raise exception 'L''asta di questa lega è già cominciata: non si entra più.'
      using errcode = '22023';
  end if;

  if exists (select 1 from public.league_members m
             where m.league_id = v_lega.id and m.user_id = v_utente) then
    -- Non e' un errore da punire: sei gia' dentro, ti riportiamo li'.
    insert into public.invite_attempts (user_id, code_tried, succeeded)
    values (v_utente, v_codice, true);
    return v_lega.id;
  end if;

  select count(*) into v_quanti
  from public.league_members m where m.league_id = v_lega.id;

  if v_quanti >= v_lega.max_members then
    insert into public.invite_attempts (user_id, code_tried, succeeded)
    values (v_utente, v_codice, false);
    raise exception 'Questa lega è al completo: % partecipanti su %.', v_quanti, v_lega.max_members
      using errcode = '22023';
  end if;

  if exists (select 1 from public.teams t
             where t.league_id = v_lega.id and lower(t.name) = lower(btrim(p_nome_squadra))) then
    raise exception 'In questa lega c''è già una squadra con questo nome. Scegline un altro.'
      using errcode = '23505';
  end if;

  insert into public.league_members (league_id, user_id, role)
  values (v_lega.id, v_utente, 'member');

  insert into public.teams (league_id, user_id, name, credits_remaining)
  values (v_lega.id, v_utente, btrim(p_nome_squadra), v_lega.credits_initial);

  insert into public.invite_attempts (user_id, code_tried, succeeded)
  values (v_utente, v_codice, true);

  return v_lega.id;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Gestione del codice da parte dell'amministratore
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.rigenera_codice_invito(p_lega uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nuovo text;
begin
  if not public.e_admin_lega(p_lega) then
    raise exception 'Solo l''amministratore della lega può farlo.' using errcode = '42501';
  end if;
  v_nuovo := public.genera_codice_invito();
  update public.leagues set invite_code = v_nuovo, invite_active = true, updated_at = now()
  where id = p_lega;
  return v_nuovo;
end;
$$;

create or replace function public.imposta_invito_attivo(p_lega uuid, p_attivo boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.e_admin_lega(p_lega) then
    raise exception 'Solo l''amministratore della lega può farlo.' using errcode = '42501';
  end if;
  update public.leagues set invite_active = p_attivo, updated_at = now() where id = p_lega;
end;
$$;

-- Anteprima pubblica di un invito: serve a mostrare "Stai entrando in <lega>"
-- PRIMA di entrare, quando ancora non si e' membri e quindi non si vedrebbe
-- nulla. Restituisce solo il minimo indispensabile, mai le regole complete.
create or replace function public.anteprima_invito(p_codice text)
returns table (nome text, stagione text, partecipanti int, massimo int, aperta boolean)
language sql
security definer
stable
set search_path = ''
as $$
  select l.name,
         l.season,
         (select count(*)::int from public.league_members m where m.league_id = l.id),
         l.max_members,
         (l.invite_active and l.status = 'setup')
  from public.leagues l
  where l.invite_code = upper(btrim(p_codice));
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Aggiornamento automatico di updated_at
-- ═══════════════════════════════════════════════════════════════════════════

create trigger leghe_tocca_updated_at
  before update on public.leagues
  for each row execute function public.tocca_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- Archivio del PDF del regolamento
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('regolamenti', 'regolamenti', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- I file stanno in <id della lega>/regolamento.pdf, cosi' il primo pezzo del
-- percorso dice a quale lega appartengono e le policy possono controllarlo.
create policy "regolamento: lo leggono i partecipanti"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'regolamenti'
    and public.e_membro_lega(((storage.foldername(name))[1])::uuid)
  );

create policy "regolamento: lo carica l amministratore"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'regolamenti'
    and public.e_admin_lega(((storage.foldername(name))[1])::uuid)
  );

create policy "regolamento: lo sostituisce l amministratore"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'regolamenti'
    and public.e_admin_lega(((storage.foldername(name))[1])::uuid)
  );

create policy "regolamento: lo cancella l amministratore"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'regolamenti'
    and public.e_admin_lega(((storage.foldername(name))[1])::uuid)
  );
