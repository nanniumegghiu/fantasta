-- ═══════════════════════════════════════════════════════════════════════════
-- 0026 · Gli stemmi delle squadre di Serie A
--
-- Le facce dicono chi è; gli stemmi dicono per chi gioca, e da tre metri
-- arrivano prima di qualunque scritta. In una riga di listone lunga come una
-- rosa, il colore di una maglia si riconosce senza leggere.
--
-- PERCHE' UNA TABELLA E NON UNA COLONNA SU `players`
--
-- La squadra di Serie A, nel listone, è **testo su ogni calciatore**: venticinque
-- righe dell'Inter ripetono venticinque volte «Inter». Mettere lì anche lo
-- stemma vorrebbe dire ripetere venticinque volte lo stesso percorso, e
-- aggiornarlo in venticinque posti quando cambia. Lo stemma appartiene alla
-- squadra, non al calciatore, e sta dove appartiene.
--
-- PERCHE' LA CHIAVE COMPRENDE LA STAGIONE
--
-- Le squadre di Serie A cambiano ogni anno, e il nome con cui il listone le
-- scrive può cambiare anche a parità di squadra. La corrispondenza vale per un
-- listone, non per sempre.
--
-- L'ORIGINE, COME PER I VOLTI
--
-- Stessa regola e stesso motivo: uno stemma confermato da una persona non lo
-- sovrascrive nessun giro automatico. Riusa `origine_volto`, che descrive già
-- esattamente questo e non ha niente di specifico ai volti.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.club_logos (
  season       text not null,
  -- Il nome esatto con cui il listone chiama la squadra: è la chiave con cui
  -- il client cerca, perché è l'unica cosa che ha in mano.
  serie_a_team text not null,
  fm_id        bigint,
  logo_path    text,
  origine      public.origine_volto,
  updated_at   timestamptz not null default now(),
  primary key (season, serie_a_team)
);

comment on table public.club_logos is
  'Lo stemma di ogni squadra di Serie A, per stagione. Lo stemma appartiene alla squadra, non ai suoi venticinque calciatori.';

alter table public.club_logos enable row level security;

-- Lo vede chiunque abbia fatto l'accesso, come il listone: senza, le righe
-- del listone mostrerebbero un buco al posto dello stemma.
drop policy if exists "stemmi: li vede chi usa l applicazione" on public.club_logos;
create policy "stemmi: li vede chi usa l applicazione"
  on public.club_logos for select to authenticated
  using (true);

-- Nessuna policy di scrittura: si passa dalla funzione.

-- ─── L'archivio ─────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('loghi', 'loghi', false, 1048576, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

drop policy if exists "loghi: li vede chi usa l applicazione" on storage.objects;
create policy "loghi: li vede chi usa l applicazione"
  on storage.objects for select to authenticated
  using (bucket_id = 'loghi');

drop policy if exists "loghi: li carica chi amministra l applicazione" on storage.objects;
create policy "loghi: li carica chi amministra l applicazione"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'loghi' and public.e_admin_app());

drop policy if exists "loghi: li sostituisce chi amministra l applicazione" on storage.objects;
create policy "loghi: li sostituisce chi amministra l applicazione"
  on storage.objects for update to authenticated
  using (bucket_id = 'loghi' and public.e_admin_app());

drop policy if exists "loghi: li cancella chi amministra l applicazione" on storage.objects;
create policy "loghi: li cancella chi amministra l applicazione"
  on storage.objects for delete to authenticated
  using (bucket_id = 'loghi' and public.e_admin_app());

-- ─── Scrivere le corrispondenze ─────────────────────────────────────────────

/**
 * Registra gli stemmi in una chiamata sola.
 *
 * Le squadre sono venti: una chiamata per squadra sarebbe stata accettabile,
 * ma la forma è la stessa dei volti e vale la pena che si somiglino — chi
 * legge uno dei due capisce l'altro senza rileggerlo.
 *
 * Uno stemma `confermata` non viene sovrascritto da uno `scaricata` o
 * `dedotta`: identica regola dei volti, identico motivo.
 */
create or replace function public.imposta_loghi(p_righe jsonb)
returns table (aggiornati int, saltati int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r         jsonb;
  v_fatti   int := 0;
  v_saltati int := 0;
  v_esito   int;
begin
  if not public.e_admin_app() then
    raise exception 'Gli stemmi li gestisce chi amministra l''applicazione.' using errcode = '42501';
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_righe, '[]'::jsonb)) loop
    insert into public.club_logos (season, serie_a_team, fm_id, logo_path, origine, updated_at)
    values (
      r ->> 'stagione',
      r ->> 'squadra',
      nullif(r ->> 'fm_id', '')::bigint,
      r ->> 'percorso',
      (r ->> 'origine')::public.origine_volto,
      now()
    )
    on conflict (season, serie_a_team) do update
    set fm_id      = excluded.fm_id,
        logo_path  = excluded.logo_path,
        origine    = excluded.origine,
        updated_at = now()
    where public.club_logos.origine is distinct from 'confermata'
       or excluded.origine = 'confermata';

    get diagnostics v_esito = row_count;
    if v_esito > 0 then v_fatti := v_fatti + 1; else v_saltati := v_saltati + 1; end if;
  end loop;

  return query select v_fatti, v_saltati;
end;
$$;

/** Toglie lo stemma di una squadra: serve quando è quello sbagliato. */
create or replace function public.togli_logo(p_stagione text, p_squadra text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.e_admin_app() then
    raise exception 'Gli stemmi li gestisce chi amministra l''applicazione.' using errcode = '42501';
  end if;

  delete from public.club_logos where season = p_stagione and serie_a_team = p_squadra;
  return found;
end;
$$;
