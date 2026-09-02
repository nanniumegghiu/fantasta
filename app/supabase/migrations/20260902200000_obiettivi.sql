-- ═══════════════════════════════════════════════════════════════════════════
-- 0005 · La lista obiettivi
--
-- Fetta 3 della roadmap. È il dato più delicato dell'intero progetto: se
-- trapela, il gioco è finito prima di cominciare. Regola 3 di CLAUDE.md.
--
-- **L'AMMINISTRATORE DI LEGA NON È UN SUPERUTENTE.** Non deve poter leggere le
-- liste altrui. Qui non c'è nessuna eccezione per lui, ed è voluto.
--
-- I quattro metodi richiesti dall'utente vivono tutti su una struttura sola:
--
--   fasce            → `tiers` + `targets.tier_id`
--   tetto di spesa   → `targets.max_price`
--   slot della rosa  → `roster_slots` + `slot_candidates`
--   incrocio portieri→ `goalkeeper_pairings` + `pairing_members`
--
-- Slot e incroci puntano a un **obiettivo**, non direttamente a un calciatore.
-- Così tetto, nota e fascia di quel calciatore stanno scritti in un posto solo:
-- se puntassero al calciatore, la stessa informazione finirebbe in tre tabelle
-- diverse e prima o poi divergerebbero.
-- ═══════════════════════════════════════════════════════════════════════════

create type public.stato_obiettivo as enum ('open', 'taken', 'won', 'dropped');

-- ─── La lista, una per utente per lega ──────────────────────────────────────

create table public.target_lists (
  id         uuid primary key default gen_random_uuid(),
  league_id  uuid not null references public.leagues (id) on delete cascade,
  user_id    uuid not null references auth.users (id)     on delete cascade,

  -- Quali metodi ha acceso il proprietario. Nessuno è obbligatorio e si
  -- combinano liberamente: è il senso della richiesta «completamente
  -- personalizzabile secondo il metodo che ognuno preferisce».
  usa_fasce   boolean not null default true,
  usa_tetti   boolean not null default true,
  usa_slot    boolean not null default false,
  usa_incroci boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, user_id)
);

-- ─── Fasce ──────────────────────────────────────────────────────────────────

create table public.tiers (
  id       uuid primary key default gen_random_uuid(),
  list_id  uuid not null references public.target_lists (id) on delete cascade,
  name     text not null check (char_length(btrim(name)) between 1 and 30),
  -- Colore scelto fra quelli del design system, salvato per nome e non come
  -- codice esadecimale: così un cambio di palette non lascia colori orfani.
  color    text not null default 'oro'
           check (color in ('oro', 'arancio', 'verde', 'azzurro', 'rosso', 'fumo')),
  position int  not null default 0,
  unique (list_id, name)
);

create index tiers_lista_idx on public.tiers (list_id, position);

-- ─── Obiettivi ──────────────────────────────────────────────────────────────

create table public.targets (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.target_lists (id) on delete cascade,
  player_id  int  not null references public.players (id)      on delete cascade,

  tier_id    uuid references public.tiers (id) on delete set null,
  -- Il tetto di spesa: quanto sono disposto ad arrivare, non quanto vale.
  max_price  int check (max_price is null or max_price >= 0),
  priority   int not null default 0,
  note       text check (note is null or char_length(note) <= 500),
  status     public.stato_obiettivo not null default 'open',

  created_at timestamptz not null default now(),
  unique (list_id, player_id)
);

create index targets_lista_idx  on public.targets (list_id);
create index targets_fascia_idx on public.targets (tier_id);

-- ─── Slot della rosa ideale ─────────────────────────────────────────────────

create table public.roster_slots (
  id       uuid primary key default gen_random_uuid(),
  list_id  uuid not null references public.target_lists (id) on delete cascade,
  role     public.ruolo_calciatore not null,
  -- Es. «Attaccante 1 — top», «Portiere titolare», «Scommessa».
  label    text not null check (char_length(btrim(label)) between 1 and 40),
  position int  not null default 0
);

create index roster_slots_lista_idx on public.roster_slots (list_id, role, position);

create table public.slot_candidates (
  slot_id   uuid not null references public.roster_slots (id) on delete cascade,
  target_id uuid not null references public.targets (id)      on delete cascade,
  position  int  not null default 0,
  primary key (slot_id, target_id)
);

-- ─── Incrocio portieri ──────────────────────────────────────────────────────

create table public.goalkeeper_pairings (
  id       uuid primary key default gen_random_uuid(),
  list_id  uuid not null references public.target_lists (id) on delete cascade,
  name     text not null check (char_length(btrim(name)) between 1 and 40),
  -- La nota sull'alternanza dei calendari: «Verona in casa quando il Torino
  -- va a Napoli». È l'informazione che rende utile l'incrocio.
  note     text check (note is null or char_length(note) <= 500),
  position int not null default 0
);

create table public.pairing_members (
  pairing_id uuid not null references public.goalkeeper_pairings (id) on delete cascade,
  target_id  uuid not null references public.targets (id)             on delete cascade,
  position   int  not null default 0,
  primary key (pairing_id, target_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Regole di accesso: tutto e soltanto del proprietario
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.target_lists        enable row level security;
alter table public.tiers               enable row level security;
alter table public.targets             enable row level security;
alter table public.roster_slots        enable row level security;
alter table public.slot_candidates     enable row level security;
alter table public.goalkeeper_pairings enable row level security;
alter table public.pairing_members     enable row level security;

-- La lista: si vede e si modifica solo la propria, e si può creare solo dentro
-- una lega di cui si fa parte.
create policy "lista: solo la mia"
  on public.target_lists for select to authenticated
  using (user_id = (select auth.uid()));

create policy "lista: la creo solo per me, in una lega mia"
  on public.target_lists for insert to authenticated
  with check (user_id = (select auth.uid()) and public.e_membro_lega(league_id));

create policy "lista: aggiorno solo la mia"
  on public.target_lists for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "lista: cancello solo la mia"
  on public.target_lists for delete to authenticated
  using (user_id = (select auth.uid()));

/**
 * Le tabelle figlie si controllano risalendo alla lista.
 *
 * La sottointerrogazione passa a sua volta dalle regole di `target_lists`:
 * se la lista non è mia, non restituisce niente e l'accesso cade. Non c'è
 * ricorsione, perché la regola di `target_lists` guarda solo `user_id` e non
 * torna a interrogare le figlie.
 */
create or replace function public.e_mia_lista(p_lista uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.target_lists l
    where l.id = p_lista and l.user_id = (select auth.uid())
  );
$$;

-- Le figlie dirette della lista.
do $$
declare
  t text;
begin
  foreach t in array array['tiers', 'targets', 'roster_slots', 'goalkeeper_pairings'] loop
    execute format($f$
      create policy "%1$s: solo dalla mia lista"
        on public.%1$I for all to authenticated
        using (public.e_mia_lista(list_id))
        with check (public.e_mia_lista(list_id));
    $f$, t);
  end loop;
end
$$;

-- I candidati agli slot risalgono passando dallo slot.
create policy "candidati: solo dai miei slot"
  on public.slot_candidates for all to authenticated
  using (
    exists (select 1 from public.roster_slots s
            where s.id = slot_id and public.e_mia_lista(s.list_id))
  )
  with check (
    exists (select 1 from public.roster_slots s
            where s.id = slot_id and public.e_mia_lista(s.list_id))
    and exists (select 1 from public.targets t
                where t.id = target_id and public.e_mia_lista(t.list_id))
  );

create policy "incroci: solo dai miei gruppi"
  on public.pairing_members for all to authenticated
  using (
    exists (select 1 from public.goalkeeper_pairings g
            where g.id = pairing_id and public.e_mia_lista(g.list_id))
  )
  with check (
    exists (select 1 from public.goalkeeper_pairings g
            where g.id = pairing_id and public.e_mia_lista(g.list_id))
    and exists (select 1 from public.targets t
                where t.id = target_id and public.e_mia_lista(t.list_id))
  );

create trigger liste_tocca_updated_at
  before update on public.target_lists
  for each row execute function public.tocca_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- Creazione della lista alla prima apertura
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * Restituisce la lista dell'utente per quella lega, creandola se non c'è.
 *
 * Esiste come funzione e non come inserimento dal client per un motivo
 * pratico: due schede aperte insieme creerebbero due liste, e il vincolo di
 * unicità farebbe fallire la seconda con un errore incomprensibile.
 */
create or replace function public.assicura_lista_obiettivi(p_lega uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utente uuid := (select auth.uid());
  v_lista  uuid;
begin
  if v_utente is null then
    raise exception 'Devi aver fatto l''accesso.' using errcode = '42501';
  end if;
  if not public.e_membro_lega(p_lega) then
    raise exception 'Non fai parte di questa lega.' using errcode = '42501';
  end if;

  select id into v_lista
  from public.target_lists
  where league_id = p_lega and user_id = v_utente;

  if v_lista is not null then
    return v_lista;
  end if;

  insert into public.target_lists (league_id, user_id)
  values (p_lega, v_utente)
  on conflict (league_id, user_id) do update set updated_at = now()
  returning id into v_lista;

  -- Tre fasce di partenza: una lista vuota davanti non aiuta nessuno, e
  -- queste si rinominano o si cancellano in un tocco.
  insert into public.tiers (list_id, name, color, position) values
    (v_lista, 'Da prendere assolutamente', 'oro', 0),
    (v_lista, 'Buone alternative', 'arancio', 1),
    (v_lista, 'Se avanzano crediti', 'verde', 2);

  return v_lista;
end;
$$;
