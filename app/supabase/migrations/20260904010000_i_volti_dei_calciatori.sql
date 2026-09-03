-- ═══════════════════════════════════════════════════════════════════════════
-- 0022 · I volti dei calciatori
--
-- Fetta 5. Un'asta con i nomi scritti funziona; un'asta con le facce si
-- riconosce da tre metri, e quando lo schermo dice «Bastoni» tutti sanno già
-- chi è prima di leggere.
--
-- COME ARRIVANO LE FOTO, IN BREVE
--
-- Il facepack è di Football Manager e i file si chiamano con l'identificativo
-- del gioco: `14110660.png`. Il listone del fantacalcio non conosce quegli
-- identificativi, quindi il ponte va costruito. ADR-0011 spiega come e perché:
-- si scarica in blocco l'elenco dei calciatori di Serie A da un servizio di
-- ricerca pubblico, si abbina per cognome e squadra, e **la corrispondenza
-- vive da noi**. La sera dell'asta nessun servizio esterno viene interpellato.
--
-- COSA AGGIUNGE QUESTA MIGRAZIONE
--
-- 1. Dove sta scritta la corrispondenza, e **come è nata**: scaricata,
--    dedotta, o confermata a mano. La differenza conta: una corrispondenza
--    confermata da una persona non si sovrascrive mai con una dedotta da un
--    algoritmo, nemmeno rilanciando tutto la stagione dopo.
-- 2. L'archivio dove finiscono le immagini, con le sue regole d'accesso.
-- 3. La funzione che scrive la corrispondenza, con quella regola dentro.
--
-- PERCHE' L'ARCHIVIO NON E' PUBBLICO
-- Le immagini sono opera di terzi, distribuite per l'uso personale dentro
-- Football Manager (vedi ADR-0011, dichiarato e accettato). Restano dietro
-- l'autenticazione: le vede chi usa l'app, non il primo che passa.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Ripetibile ─────────────────────────────────────────────────────────────
-- Il file si applica tutto insieme: se una riga in fondo fallisce, quelle
-- sopra sono già passate e il registro non segna la migrazione come fatta.
-- Rilanciandola si inciamperebbe su «esiste già». Scritta così, si può
-- rilanciare finché non passa per intero.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'origine_volto') then
    create type public.origine_volto as enum ('scaricata', 'dedotta', 'confermata');
  end if;
end
$$;

alter table public.players
  add column if not exists fm_id       bigint,
  add column if not exists fm_origine  public.origine_volto;

comment on column public.players.fm_id is
  'Identificativo del calciatore in Football Manager: e il nome del file nel facepack.';
comment on column public.players.fm_origine is
  'Come e nata la corrispondenza. Una confermata a mano non si sovrascrive mai.';

-- Serve a trovare in fretta chi è ancora senza volto quando si ricarica.
create index if not exists players_senza_volto_idx
  on public.players (season) where photo_path is null;

-- ─── L'archivio delle immagini ──────────────────────────────────────────────
--
-- Un archivio solo per tutta l'applicazione, non uno per lega: il listone è
-- unico e vale per tutti, e le foto seguono il listone. I file stanno in
-- `<stagione>/<identificativo>.png`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('volti', 'volti', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "volti: li vede chi usa l applicazione" on storage.objects;
create policy "volti: li vede chi usa l applicazione"
  on storage.objects for select to authenticated
  using (bucket_id = 'volti');

drop policy if exists "volti: li carica chi amministra l applicazione" on storage.objects;
create policy "volti: li carica chi amministra l applicazione"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'volti' and public.e_admin_app());

drop policy if exists "volti: li sostituisce chi amministra l applicazione" on storage.objects;
create policy "volti: li sostituisce chi amministra l applicazione"
  on storage.objects for update to authenticated
  using (bucket_id = 'volti' and public.e_admin_app());

drop policy if exists "volti: li cancella chi amministra l applicazione" on storage.objects;
create policy "volti: li cancella chi amministra l applicazione"
  on storage.objects for delete to authenticated
  using (bucket_id = 'volti' and public.e_admin_app());

-- ─── Scrivere una corrispondenza ────────────────────────────────────────────

/**
 * Registra il volto di un calciatore.
 *
 * LA REGOLA CHE VALE PIU' DI TUTTE
 * Una corrispondenza `confermata` — cioè decisa da una persona guardando la
 * foto — non viene sovrascritta da una `dedotta` o `scaricata`. Rilanciare
 * l'abbinamento automatico la stagione prossima non deve buttare via il lavoro
 * di chi ha sistemato a mano i casi difficili: sono proprio quelli che
 * l'algoritmo continuerà a sbagliare allo stesso modo.
 *
 * Restituisce quante righe ha davvero cambiato, così chi chiama può dire
 * «aggiornati 412, lasciati stare 8» invece di «fatto».
 */
create or replace function public.imposta_volto(
  p_player_id int,
  p_fm_id     bigint,
  p_percorso  text,
  p_origine   public.origine_volto
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare v_quante int;
begin
  if not public.e_admin_app() then
    raise exception 'I volti li gestisce chi amministra l''applicazione.' using errcode = '42501';
  end if;

  update public.players
  set fm_id      = p_fm_id,
      photo_path = p_percorso,
      fm_origine = p_origine,
      updated_at = now()
  where id = p_player_id
    -- Il cuore della funzione: si scrive solo se non si sta cancellando una
    -- decisione presa da una persona.
    and (fm_origine is distinct from 'confermata' or p_origine = 'confermata');

  get diagnostics v_quante = row_count;
  return v_quante;
end;
$$;

/**
 * Registra molte corrispondenze in una chiamata sola.
 *
 * Seicento chiamate separate sarebbero seicento viaggi di rete per un lavoro
 * che si fa una volta a stagione: si manda un array e si torna con il conto.
 */
create or replace function public.imposta_volti(p_righe jsonb)
returns table (aggiornati int, saltati int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r        jsonb;
  v_fatti  int := 0;
  v_saltati int := 0;
  v_esito  int;
begin
  if not public.e_admin_app() then
    raise exception 'I volti li gestisce chi amministra l''applicazione.' using errcode = '42501';
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_righe, '[]'::jsonb)) loop
    update public.players
    set fm_id      = (r ->> 'fm_id')::bigint,
        photo_path = r ->> 'percorso',
        fm_origine = (r ->> 'origine')::public.origine_volto,
        updated_at = now()
    where id = (r ->> 'calciatore')::int
      and (fm_origine is distinct from 'confermata'
           or (r ->> 'origine')::public.origine_volto = 'confermata');

    get diagnostics v_esito = row_count;
    if v_esito > 0 then v_fatti := v_fatti + 1; else v_saltati := v_saltati + 1; end if;
  end loop;

  return query select v_fatti, v_saltati;
end;
$$;

-- ─── La vista del listone porta anche il volto ──────────────────────────────
--
-- `photo_path` c'era già; si aggiungono l'identificativo e l'origine, perché
-- la schermata di abbinamento manuale deve poter dire «questa l'ha decisa un
-- algoritmo» e «questa l'hai confermata tu».
--
-- Le colonne nuove vanno **in fondo**, e le vecchie restano nell'ordine di
-- prima: `create or replace view` non permette di rinominare o riordinare
-- quelle esistenti, e infilarle in mezzo le rinominerebbe tutte da lì in poi.
-- Il resto della definizione è identico a quello della migrazione 0004: se
-- cambiasse anche una condizione, cambierebbe cosa vede il listone.

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
  s.red_cards,
  p.fm_id,
  p.fm_origine
from public.players p
left join public.player_stats s on s.player_id = p.id;
