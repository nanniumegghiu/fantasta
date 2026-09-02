-- ═══════════════════════════════════════════════════════════════════════════
-- 0014 · Anche le fasce appartengono a un ruolo
--
-- PERCHE' CAMBIA
--
-- Gli slot avevano già un ruolo, le fasce no: erano contenitori misti dentro
-- cui i calciatori venivano poi divisi per reparto solo al momento di
-- mostrarli. All'uso è emerso che la divisione per ruolo non è un modo di
-- visualizzare, è **la prima divisione della preparazione**.
--
-- Durante l'asta si chiamano i portieri: in quel momento difensori,
-- centrocampisti e attaccanti sono rumore, e vanno nascosti. Se la fascia
-- appartiene a un ruolo, filtrare diventa immediato; se è mista, bisogna
-- frugarci dentro ogni volta.
--
-- Conseguenza pratica: quando scegli i difensori non ti vengono proposti gli
-- attaccanti. La fascia sa già di che reparto è.
--
-- MIGRAZIONE DEI DATI ESISTENTI
-- Ogni fascia senza ruolo viene replicata nei quattro ruoli, e i calciatori
-- che conteneva finiscono nella copia del loro reparto. Nessuno perde niente:
-- chi aveva «Da prendere assolutamente» se lo ritrova per portieri,
-- difensori, centrocampisti e attaccanti.
-- ═══════════════════════════════════════════════════════════════════════════

-- Lo stesso nome può ripetersi in reparti diversi: «Da prendere assolutamente»
-- ha senso per i portieri e per gli attaccanti insieme.
alter table public.tiers drop constraint if exists tiers_list_id_name_key;

alter table public.tiers add column role public.ruolo_calciatore;

do $$
declare
  v_vecchia record;
  v_ruolo   public.ruolo_calciatore;
  v_nuova   uuid;
begin
  for v_vecchia in select * from public.tiers where role is null loop
    foreach v_ruolo in array array['P','D','C','A']::public.ruolo_calciatore[] loop
      insert into public.tiers (list_id, name, color, position, role)
      values (v_vecchia.list_id, v_vecchia.name, v_vecchia.color, v_vecchia.position, v_ruolo)
      returning id into v_nuova;

      -- I calciatori che erano nella fascia mista vanno nella copia del
      -- loro reparto.
      update public.targets t
      set tier_id = v_nuova
      where t.tier_id = v_vecchia.id
        and exists (select 1 from public.players p where p.id = t.player_id and p.role = v_ruolo);
    end loop;

    delete from public.tiers where id = v_vecchia.id;
  end loop;
end
$$;

alter table public.tiers alter column role set not null;
alter table public.tiers add constraint fasce_nome_unico_per_ruolo unique (list_id, role, name);

create index tiers_lista_ruolo_idx on public.tiers (list_id, role, position);

-- ═══════════════════════════════════════════════════════════════════════════
-- Le fasce di partenza nascono già divise per reparto
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.assicura_lista_obiettivi(p_lega uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utente uuid := (select auth.uid());
  v_lista  uuid;
  v_ruolo  public.ruolo_calciatore;
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

  -- Tre fasce per ogni reparto: una lista vuota davanti non aiuta nessuno, e
  -- queste si rinominano o si cancellano in un tocco.
  foreach v_ruolo in array array['P','D','C','A']::public.ruolo_calciatore[] loop
    insert into public.tiers (list_id, role, name, color, position) values
      (v_lista, v_ruolo, 'Da prendere assolutamente', 'oro', 0),
      (v_lista, v_ruolo, 'Buone alternative', 'arancio', 1),
      (v_lista, v_ruolo, 'Se avanzano crediti', 'verde', 2);
  end loop;

  return v_lista;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Aggiungere calciatori dentro una fascia
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * Crea l'obiettivo se manca e lo mette in quella fascia, in un gesto solo.
 *
 * Accetta **solo calciatori del ruolo della fascia**: una fascia di difensori
 * non prende attaccanti. Il controllo sta qui e non solo nell'interfaccia,
 * perché è una regola del modello, non un aiuto alla scelta.
 */
create or replace function public.aggiungi_a_fascia(p_fascia uuid, p_calciatori int[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lista  uuid;
  v_ruolo  public.ruolo_calciatore;
  v_ordine int;
  c        int;
  v_quanti int := 0;
begin
  select list_id, role into v_lista, v_ruolo from public.tiers where id = p_fascia;
  if v_lista is null or not public.e_mia_lista(v_lista) then
    return 0;
  end if;

  select coalesce(max(priority) + 1, 0) into v_ordine
  from public.targets where list_id = v_lista and tier_id = p_fascia;

  foreach c in array p_calciatori loop
    if exists (select 1 from public.players p where p.id = c and p.role = v_ruolo) then
      insert into public.targets (list_id, player_id, tier_id, priority)
      values (v_lista, c, p_fascia, v_ordine)
      on conflict (list_id, player_id) do update
        set tier_id = excluded.tier_id, priority = excluded.priority;

      v_ordine := v_ordine + 1;
      v_quanti := v_quanti + 1;
    end if;
  end loop;
  return v_quanti;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Il riordino non può spostare un calciatore in una fascia di un altro ruolo
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.riordina_obiettivi(p_righe jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quanti int := 0;
  r        jsonb;
  v_lista  uuid;
  v_ruolo  public.ruolo_calciatore;
  v_fascia uuid;
begin
  for r in select * from jsonb_array_elements(coalesce(p_righe, '[]'::jsonb)) loop
    select t.list_id, p.role into v_lista, v_ruolo
    from public.targets t join public.players p on p.id = t.player_id
    where t.id = (r ->> 'id')::uuid;

    if v_lista is not null and public.e_mia_lista(v_lista) then
      v_fascia := case when r ? 'fascia' then nullif(r ->> 'fascia', '')::uuid else null end;

      -- Una fascia di un altro reparto non è un posto dove si possa finire:
      -- si lascia il calciatore dov'era invece di creare un miscuglio.
      if v_fascia is not null and not exists (
        select 1 from public.tiers f
        where f.id = v_fascia and f.list_id = v_lista and f.role = v_ruolo
      ) then
        continue;
      end if;

      update public.targets
      set priority = coalesce((r ->> 'priorita')::int, priority),
          tier_id  = case when r ? 'fascia' then v_fascia else tier_id end
      where id = (r ->> 'id')::uuid;
      v_quanti := v_quanti + 1;
    end if;
  end loop;
  return v_quanti;
end;
$$;
