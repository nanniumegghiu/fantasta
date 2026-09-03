-- ═══════════════════════════════════════════════════════════════════════════
-- 0023 · Gli scambi fra squadre
--
-- Fetta 7. Le regole erano gia' scritte in docs/02-dominio-fantacalcio.md e non
-- cambiano: uno scambio e' una proposta fra due squadre, diventa effettivo solo
-- con l'accettazione di entrambe, e deve lasciare **entrambe le rose valide**.
--
-- LA REGOLA CHE DECIDE TUTTO IL RESTO
--
-- «Valide» vuol dire una cosa precisa: stesso numero di calciatori per ruolo.
-- Un difensore si scambia con un difensore, due centrocampisti con due
-- centrocampisti. Non e' una limitazione arbitraria, e' l'unica forma che
-- lascia in piedi due rose gia' complete: scambiare un difensore per un
-- attaccante lascerebbe uno con la difesa scoperta e l'altro con un attaccante
-- che non puo' schierare, e la lega si troverebbe con due rose non valide
-- create da un gesto che l'app aveva permesso.
--
-- Il controllo sta qui e non nell'interfaccia, perche' e' una regola del gioco.
--
-- PERCHE' LO SCAMBIO E' UNA PROPOSTA E NON UN'AZIONE
--
-- Tocca la rosa di un altro. Nessuno deve poter cambiare la squadra di
-- qualcun altro senza che quel qualcuno abbia detto di si': per questo esiste
-- un passaggio in due tempi, e per questo la proposta si puo' ritirare finche'
-- non e' stata accettata.
--
-- PERCHE' SI RICONTROLLA TUTTO AL MOMENTO DELL'ACCETTAZIONE
--
-- Fra la proposta e la risposta possono passare giorni. Nel frattempo uno dei
-- calciatori puo' essere finito in un altro scambio, o essere stato tolto
-- dalla rosa da una correzione dell'amministratore, o i crediti possono non
-- bastare piu'. Accettare esegue i controlli da capo, tutti: fidarsi di quelli
-- fatti alla proposta vorrebbe dire eseguire uno scambio impossibile.
-- ═══════════════════════════════════════════════════════════════════════════

create type public.stato_scambio as enum (
  'proposto', 'accettato', 'rifiutato', 'ritirato', 'decaduto'
);

create table public.trades (
  id            uuid primary key default gen_random_uuid(),
  league_id     uuid not null references public.leagues (id) on delete cascade,
  from_team_id  uuid not null references public.teams (id) on delete cascade,
  to_team_id    uuid not null references public.teams (id) on delete cascade,

  -- Conguaglio in crediti, dal proponente a chi riceve. Negativo vuol dire il
  -- contrario. Zero e' lo scambio secco, che e' il caso normale.
  credits       int  not null default 0,

  status        public.stato_scambio not null default 'proposto',
  -- Il messaggio che accompagna la proposta: «ti do Dimarco perche' ho tre
  -- terzini». Serve a chi riceve per capire se e' un affare o una fregatura.
  note          text check (note is null or char_length(note) <= 300),

  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   uuid references auth.users (id) on delete set null,

  constraint scambio_fra_due_squadre_diverse check (from_team_id <> to_team_id)
);

create index scambi_lega_idx on public.trades (league_id, created_at desc);
create index scambi_squadra_idx on public.trades (to_team_id, status);

comment on table public.trades is
  'Proposte di scambio fra due squadre. Diventano effettive solo con l accettazione di chi riceve.';

/**
 * I calciatori dello scambio.
 *
 * `from_team_id` dice da quale delle due squadre parte quel calciatore: senza,
 * per sapere chi da' cosa bisognerebbe interrogare le rose, che pero' dopo
 * l'esecuzione sono gia' cambiate e non lo direbbero piu'.
 */
create table public.trade_players (
  trade_id     uuid not null references public.trades (id) on delete cascade,
  player_id    int  not null references public.players (id) on delete restrict,
  from_team_id uuid not null references public.teams (id) on delete cascade,
  primary key (trade_id, player_id)
);

create index scambi_calciatori_idx on public.trade_players (player_id);

-- ─── Chi vede cosa ──────────────────────────────────────────────────────────
--
-- Gli scambi li vedono **tutti i partecipanti della lega**, non solo le due
-- squadre coinvolte. Uno scambio cambia gli equilibri di tutti, e una lega in
-- cui si scambia di nascosto e' una lega in cui si litiga.
--
-- Nessuna policy di scrittura: si passa dalle funzioni, che sono l'unico posto
-- dove i controlli esistono.

alter table public.trades        enable row level security;
alter table public.trade_players enable row level security;

create policy "scambi: li vedono i partecipanti"
  on public.trades for select to authenticated
  using (public.e_membro_lega(league_id));

create policy "scambi: i calciatori li vedono i partecipanti"
  on public.trade_players for select to authenticated
  using (
    exists (select 1 from public.trades t
            where t.id = trade_id and public.e_membro_lega(t.league_id))
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- Il controllo, scritto una volta sola
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * Dice se uno scambio si puo' fare, e se no perche'.
 *
 * Sta in una funzione sua perche' serve **due volte**: quando si propone, per
 * non far partire una proposta impossibile, e quando si accetta, perche' nel
 * frattempo il mondo puo' essere cambiato. Scritto due volte, prima o poi le
 * due copie direbbero cose diverse, e lo scambio passerebbe da una e verrebbe
 * respinto dall'altra.
 *
 * Restituisce null quando va bene: cosi' chi chiama scrive
 * `if v_problema is not null then ...` e non deve interpretare niente.
 */
create or replace function public.problema_dello_scambio(
  p_lega uuid,
  p_da   uuid,
  p_a    uuid,
  p_calciatori_da int[],
  p_calciatori_a  int[],
  p_crediti int
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lega    public.leagues%rowtype;
  v_bud_da  public.team_budget%rowtype;
  v_bud_a   public.team_budget%rowtype;
  v_ruolo   public.ruolo_calciatore;
  v_n_da    int;
  v_n_a     int;
  c         int;
begin
  select * into v_lega from public.leagues where id = p_lega;

  if not v_lega.trades_enabled then
    return 'In questa lega gli scambi non sono permessi.';
  end if;
  if p_crediti <> 0 and not v_lega.trades_with_credits_enabled then
    return 'In questa lega gli scambi si fanno senza conguaglio in crediti.';
  end if;

  if coalesce(array_length(p_calciatori_da, 1), 0)
     + coalesce(array_length(p_calciatori_a, 1), 0) = 0 then
    return 'Uno scambio senza calciatori non è uno scambio.';
  end if;

  -- Ogni calciatore deve stare davvero nella rosa da cui parte. E' il
  -- controllo che scade: fra la proposta e la risposta puo' essere cambiato
  -- tutto.
  foreach c in array coalesce(p_calciatori_da, '{}') loop
    if not exists (select 1 from public.roster_players r
                   where r.league_id = p_lega and r.team_id = p_da and r.player_id = c) then
      return format('%s non è (più) nella rosa di chi propone.',
                    (select name from public.players where id = c));
    end if;
  end loop;

  foreach c in array coalesce(p_calciatori_a, '{}') loop
    if not exists (select 1 from public.roster_players r
                   where r.league_id = p_lega and r.team_id = p_a and r.player_id = c) then
      return format('%s non è (più) nella rosa dell''altra squadra.',
                    (select name from public.players where id = c));
    end if;
  end loop;

  -- ─── La regola che decide tutto: stesso numero per ruolo ──────────────────
  foreach v_ruolo in array array['P','D','C','A']::public.ruolo_calciatore[] loop
    select count(*) into v_n_da from public.players
    where id = any(coalesce(p_calciatori_da, '{}')) and role = v_ruolo;
    select count(*) into v_n_a from public.players
    where id = any(coalesce(p_calciatori_a, '{}')) and role = v_ruolo;

    if v_n_da <> v_n_a then
      return format(
        'Le rose non resterebbero valide: %s %s da una parte e %s dall''altra. In uno scambio ogni reparto deve pareggiare.',
        greatest(v_n_da, v_n_a),
        case v_ruolo when 'P' then 'portieri' when 'D' then 'difensori'
                     when 'C' then 'centrocampisti' else 'attaccanti' end,
        least(v_n_da, v_n_a));
    end if;
  end loop;

  -- ─── I crediti non vanno sotto zero ───────────────────────────────────────
  if p_crediti <> 0 then
    select * into v_bud_da from public.team_budget where team_id = p_da;
    select * into v_bud_a  from public.team_budget where team_id = p_a;

    -- Il numero di slot rimasti non cambia — i reparti pareggiano — quindi il
    -- vincolo è quello di sempre: restare capaci di riempire ciò che manca.
    if v_bud_da.credits_remaining - p_crediti < v_bud_da.slot_rimanenti * v_lega.min_bid then
      return format('%s non ha abbastanza crediti: ne ha %s e deve tenerne %s per gli slot che le restano.',
                    v_bud_da.name, v_bud_da.credits_remaining,
                    v_bud_da.slot_rimanenti * v_lega.min_bid);
    end if;
    if v_bud_a.credits_remaining + p_crediti < v_bud_a.slot_rimanenti * v_lega.min_bid then
      return format('%s non ha abbastanza crediti: ne ha %s e deve tenerne %s per gli slot che le restano.',
                    v_bud_a.name, v_bud_a.credits_remaining,
                    v_bud_a.slot_rimanenti * v_lega.min_bid);
    end if;
  end if;

  return null;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Proporre
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.proponi_scambio(
  p_lega uuid,
  p_a_squadra uuid,
  p_miei_calciatori int[],
  p_suoi_calciatori int[],
  p_crediti int default 0,
  p_nota text default null
)
returns table (esito text, messaggio text, scambio uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_mia      uuid;
  v_problema text;
  v_id       uuid;
  c          int;
begin
  select id into v_mia from public.teams
  where league_id = p_lega and user_id = (select auth.uid());
  if v_mia is null then
    return query select 'non_autorizzato', 'Non hai una squadra in questa lega.', null::uuid; return;
  end if;
  if not exists (select 1 from public.teams where id = p_a_squadra and league_id = p_lega) then
    return query select 'non_autorizzato', 'Quella squadra non è di questa lega.', null::uuid; return;
  end if;
  if v_mia = p_a_squadra then
    return query select 'non_autorizzato', 'Non puoi scambiare con te stesso.', null::uuid; return;
  end if;

  v_problema := public.problema_dello_scambio(
    p_lega, v_mia, p_a_squadra, p_miei_calciatori, p_suoi_calciatori, coalesce(p_crediti, 0));
  if v_problema is not null then
    return query select 'rifiutato', v_problema, null::uuid; return;
  end if;

  insert into public.trades (league_id, from_team_id, to_team_id, credits, note)
  values (p_lega, v_mia, p_a_squadra, coalesce(p_crediti, 0), nullif(btrim(coalesce(p_nota, '')), ''))
  returning id into v_id;

  foreach c in array coalesce(p_miei_calciatori, '{}') loop
    insert into public.trade_players (trade_id, player_id, from_team_id) values (v_id, c, v_mia);
  end loop;
  foreach c in array coalesce(p_suoi_calciatori, '{}') loop
    insert into public.trade_players (trade_id, player_id, from_team_id) values (v_id, c, p_a_squadra);
  end loop;

  return query select 'ok', 'Proposta inviata. Diventa effettiva solo se l''altra squadra accetta.', v_id;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Accettare
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.accetta_scambio(p_scambio uuid)
returns table (esito text, messaggio text)
language plpgsql security definer set search_path = '' as $$
declare
  v_s        public.trades%rowtype;
  v_problema text;
  v_miei     int[];
  v_suoi     int[];
  r          record;
begin
  select * into v_s from public.trades where id = p_scambio for update;
  if not found then
    return query select 'non_trovato', 'Questa proposta non esiste.'; return;
  end if;
  if v_s.status <> 'proposto' then
    return query select 'gia_chiuso',
      format('Questa proposta è già stata %s.', v_s.status); return;
  end if;

  -- Accetta **solo chi riceve**. Chi propone ha gia' detto la sua proponendo.
  if not exists (select 1 from public.teams
                 where id = v_s.to_team_id and user_id = (select auth.uid())) then
    return query select 'non_autorizzato',
      'Solo la squadra a cui è stata proposta può accettarla.'; return;
  end if;

  select array_agg(player_id) into v_miei from public.trade_players
  where trade_id = p_scambio and from_team_id = v_s.from_team_id;
  select array_agg(player_id) into v_suoi from public.trade_players
  where trade_id = p_scambio and from_team_id = v_s.to_team_id;

  -- Da capo, tutti: fra la proposta e adesso puo' essere cambiato tutto.
  v_problema := public.problema_dello_scambio(
    v_s.league_id, v_s.from_team_id, v_s.to_team_id,
    coalesce(v_miei, '{}'), coalesce(v_suoi, '{}'), v_s.credits);

  if v_problema is not null then
    update public.trades
    set status = 'decaduto', resolved_at = now(), resolved_by = (select auth.uid())
    where id = p_scambio;
    return query select 'decaduto',
      format('Non si può più fare: %s', v_problema); return;
  end if;

  -- ─── L'esecuzione ─────────────────────────────────────────────────────────
  for r in select player_id, from_team_id from public.trade_players where trade_id = p_scambio loop
    update public.roster_players
    set team_id = case when r.from_team_id = v_s.from_team_id then v_s.to_team_id
                       else v_s.from_team_id end
    where league_id = v_s.league_id and player_id = r.player_id;
  end loop;

  if v_s.credits <> 0 then
    update public.teams set credits_remaining = credits_remaining - v_s.credits
    where id = v_s.from_team_id;
    update public.teams set credits_remaining = credits_remaining + v_s.credits
    where id = v_s.to_team_id;
  end if;

  update public.trades
  set status = 'accettato', resolved_at = now(), resolved_by = (select auth.uid())
  where id = p_scambio;

  -- Le altre proposte che toccavano gli stessi calciatori adesso non stanno
  -- piu' in piedi. Lasciarle «proposte» vorrebbe dire farle fallire una per
  -- una al momento dell'accettazione, senza che nessuno capisca perche'.
  update public.trades t
  set status = 'decaduto', resolved_at = now()
  where t.league_id = v_s.league_id
    and t.status = 'proposto'
    and t.id <> p_scambio
    and exists (
      select 1 from public.trade_players a
      join public.trade_players b on b.player_id = a.player_id
      where a.trade_id = t.id and b.trade_id = p_scambio
    );

  return query select 'ok', 'Scambio fatto. Le rose sono aggiornate.';
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rifiutare e ritirare
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.rispondi_scambio(p_scambio uuid, p_accetto boolean)
returns table (esito text, messaggio text)
language plpgsql security definer set search_path = '' as $$
declare v_s public.trades%rowtype;
begin
  if p_accetto then
    return query select * from public.accetta_scambio(p_scambio); return;
  end if;

  select * into v_s from public.trades where id = p_scambio for update;
  if not found then
    return query select 'non_trovato', 'Questa proposta non esiste.'; return;
  end if;
  if v_s.status <> 'proposto' then
    return query select 'gia_chiuso', format('Questa proposta è già stata %s.', v_s.status); return;
  end if;

  -- Chi riceve rifiuta, chi propone ritira. Sono due gesti diversi e il
  -- registro deve poterli distinguere: «mi hanno detto di no» e «ci ho
  -- ripensato» non raccontano la stessa cosa.
  if exists (select 1 from public.teams where id = v_s.to_team_id and user_id = (select auth.uid())) then
    update public.trades set status = 'rifiutato', resolved_at = now(),
      resolved_by = (select auth.uid()) where id = p_scambio;
    return query select 'ok', 'Proposta rifiutata.'; return;
  end if;

  if exists (select 1 from public.teams where id = v_s.from_team_id and user_id = (select auth.uid())) then
    update public.trades set status = 'ritirato', resolved_at = now(),
      resolved_by = (select auth.uid()) where id = p_scambio;
    return query select 'ok', 'Proposta ritirata.'; return;
  end if;

  return query select 'non_autorizzato', 'Questa proposta non ti riguarda.';
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- La vista leggibile
-- ═══════════════════════════════════════════════════════════════════════════

create or replace view public.scambi
with (security_invoker = true) as
select
  t.id,
  t.league_id,
  t.from_team_id,
  t.to_team_id,
  da.name  as squadra_propone,
  a.name   as squadra_riceve,
  t.credits,
  t.status,
  t.note,
  t.created_at,
  t.resolved_at,
  (select coalesce(jsonb_agg(jsonb_build_object(
            'id', p.id, 'nome', p.name, 'ruolo', p.role, 'squadra', p.serie_a_team)
          order by p.role, p.name), '[]'::jsonb)
   from public.trade_players tp join public.players p on p.id = tp.player_id
   where tp.trade_id = t.id and tp.from_team_id = t.from_team_id) as danno,
  (select coalesce(jsonb_agg(jsonb_build_object(
            'id', p.id, 'nome', p.name, 'ruolo', p.role, 'squadra', p.serie_a_team)
          order by p.role, p.name), '[]'::jsonb)
   from public.trade_players tp join public.players p on p.id = tp.player_id
   where tp.trade_id = t.id and tp.from_team_id = t.to_team_id) as ricevono
from public.trades t
join public.teams da on da.id = t.from_team_id
join public.teams a  on a.id  = t.to_team_id;

comment on view public.scambi is
  'Gli scambi con i nomi e i calciatori gia uniti. Li vedono tutti i partecipanti: una lega in cui si scambia di nascosto e una lega in cui si litiga.';
