-- ═══════════════════════════════════════════════════════════════════════════
-- 0012 · La lista obiettivi ha un metodo solo
--
-- PERCHE' CAMBIA
--
-- La prima versione lasciava accendere insieme fasce e slot, e all'uso è
-- risultata confusa: sono due modi alternativi di rispondere alla stessa
-- domanda, «in che ordine provo a comprare», e tenerli accesi insieme non
-- aiuta a decidere, raddoppia il lavoro.
--
-- Da qui in avanti:
--   · si sceglie UN metodo, fasce oppure slot;
--   · il tetto di spesa è un'aggiunta accendibile in tutti e due;
--   · l'incrocio portieri è indipendente e si affianca a entrambi;
--   · la nota c'è sempre, perché è quella che serve davvero al momento
--     della chiamata.
--
-- Spegnere o cambiare metodo non cancella niente: le fasce restano dove sono
-- anche mentre si lavora a slot, e tornando indietro si ritrovano.
-- ═══════════════════════════════════════════════════════════════════════════

create type public.metodo_lista as enum ('fasce', 'slot');

alter table public.target_lists
  add column metodo public.metodo_lista not null default 'fasce',
  -- Vero solo dopo che il proprietario ha scelto davvero. Finché è falso, la
  -- schermata apre sulla scelta del metodo invece che su un ambiente già
  -- impostato per lui.
  add column metodo_confermato boolean not null default false;

-- Chi aveva già una lista si porta dietro la scelta che aveva fatto di fatto.
update public.target_lists
set metodo = case when usa_slot and not usa_fasce then 'slot'::public.metodo_lista
                  else 'fasce'::public.metodo_lista end,
    metodo_confermato = true
where usa_fasce or usa_slot;

-- Due colonne che dicevano la stessa cosa in due modi diversi ora sarebbero
-- due fonti di verità: si tolgono.
alter table public.target_lists drop column usa_fasce, drop column usa_slot;

-- ═══════════════════════════════════════════════════════════════════════════
-- Riordino
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * Riscrive l'ordine di un gruppo di obiettivi in una chiamata sola.
 *
 * Trascinare una riga cambia la posizione di tutte quelle che stanno sotto:
 * mandarle una per una significherebbe otto richieste per un gesto, e su una
 * connessione lenta si vedrebbe la lista riassestarsi a scatti.
 *
 * Riceve: [{ "id": "...", "priorita": 0, "fascia": "..." }, ...]
 * `fascia` è facoltativo e serve quando una riga cambia anche fascia.
 */
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
begin
  for r in select * from jsonb_array_elements(coalesce(p_righe, '[]'::jsonb)) loop
    select list_id into v_lista from public.targets where id = (r ->> 'id')::uuid;

    -- Ogni riga viene toccata solo se la lista è di chi sta chiamando.
    -- Il controllo sta qui, dentro il ciclo: un elenco può contenere
    -- identificativi di liste diverse, e uno solo altrui basterebbe.
    if v_lista is not null and public.e_mia_lista(v_lista) then
      update public.targets
      set priority = coalesce((r ->> 'priorita')::int, priority),
          tier_id  = case when r ? 'fascia'
                          then nullif(r ->> 'fascia', '')::uuid
                          else tier_id end
      where id = (r ->> 'id')::uuid;
      v_quanti := v_quanti + 1;
    end if;
  end loop;
  return v_quanti;
end;
$$;

/** Lo stesso, per i candidati dentro uno slot. */
create or replace function public.riordina_candidati(p_slot uuid, p_ordine uuid[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lista  uuid;
  i        int;
  v_quanti int := 0;
begin
  select list_id into v_lista from public.roster_slots where id = p_slot;
  if v_lista is null or not public.e_mia_lista(v_lista) then
    return 0;
  end if;

  for i in 1..coalesce(array_length(p_ordine, 1), 0) loop
    update public.slot_candidates
    set position = i - 1
    where slot_id = p_slot and target_id = p_ordine[i];
    v_quanti := v_quanti + 1;
  end loop;
  return v_quanti;
end;
$$;

/**
 * Aggiunge calciatori direttamente dentro uno slot.
 *
 * Fa due cose che prima toccava fare separatamente: crea l'obiettivo se non
 * c'è già e lo aggancia allo slot. Dall'interfaccia è un gesto solo, «aggiungi
 * questi tre a questo slot», e deve esserlo anche qui: a metà strada si
 * resterebbe con obiettivi creati e non agganciati.
 */
create or replace function public.aggiungi_a_slot(p_slot uuid, p_calciatori int[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lista     uuid;
  v_ruolo     public.ruolo_calciatore;
  v_posizione int;
  v_target    uuid;
  c           int;
  v_quanti    int := 0;
begin
  select list_id, role into v_lista, v_ruolo from public.roster_slots where id = p_slot;
  if v_lista is null or not public.e_mia_lista(v_lista) then
    return 0;
  end if;

  select coalesce(max(position) + 1, 0) into v_posizione
  from public.slot_candidates where slot_id = p_slot;

  foreach c in array p_calciatori loop
    -- Solo calciatori del ruolo dello slot: uno slot di attaccanti non
    -- accoglie portieri, e l'errore va fermato qui, non spiegato dopo.
    if exists (select 1 from public.players p where p.id = c and p.role = v_ruolo) then
      insert into public.targets (list_id, player_id)
      values (v_lista, c)
      on conflict (list_id, player_id) do update set list_id = excluded.list_id
      returning id into v_target;

      insert into public.slot_candidates (slot_id, target_id, position)
      values (p_slot, v_target, v_posizione)
      on conflict do nothing;

      v_posizione := v_posizione + 1;
      v_quanti := v_quanti + 1;
    end if;
  end loop;
  return v_quanti;
end;
$$;

/** Lo stesso per un incrocio di portieri. */
create or replace function public.aggiungi_a_incrocio(p_incrocio uuid, p_calciatori int[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lista     uuid;
  v_posizione int;
  v_target    uuid;
  c           int;
  v_quanti    int := 0;
begin
  select list_id into v_lista from public.goalkeeper_pairings where id = p_incrocio;
  if v_lista is null or not public.e_mia_lista(v_lista) then
    return 0;
  end if;

  select coalesce(max(position) + 1, 0) into v_posizione
  from public.pairing_members where pairing_id = p_incrocio;

  foreach c in array p_calciatori loop
    if exists (select 1 from public.players p where p.id = c and p.role = 'P') then
      insert into public.targets (list_id, player_id)
      values (v_lista, c)
      on conflict (list_id, player_id) do update set list_id = excluded.list_id
      returning id into v_target;

      insert into public.pairing_members (pairing_id, target_id, position)
      values (p_incrocio, v_target, v_posizione)
      on conflict do nothing;

      v_posizione := v_posizione + 1;
      v_quanti := v_quanti + 1;
    end if;
  end loop;
  return v_quanti;
end;
$$;

/**
 * Crea in un colpo gli slot che corrispondono alla rosa della lega.
 *
 * Una schermata vuota davanti non aiuta nessuno: da qui escono «Portiere 1,
 * 2, 3», «Difensore 1…8» e così via, che poi si rinominano come si vuole.
 * Non tocca gli slot che esistono già.
 */
create or replace function public.crea_slot_standard(p_lista uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lega   uuid;
  v_quanti int := 0;
  v_ruolo  public.ruolo_calciatore;
  v_nome   text;
  v_totale int;
  i        int;
  l        record;
begin
  select league_id into v_lega from public.target_lists where id = p_lista;
  if v_lega is null or not public.e_mia_lista(p_lista) then
    return 0;
  end if;

  select slots_p, slots_d, slots_c, slots_a into l from public.leagues where id = v_lega;

  foreach v_ruolo in array array['P','D','C','A']::public.ruolo_calciatore[] loop
    v_totale := case v_ruolo when 'P' then l.slots_p when 'D' then l.slots_d
                             when 'C' then l.slots_c else l.slots_a end;
    v_nome := case v_ruolo when 'P' then 'Portiere' when 'D' then 'Difensore'
                           when 'C' then 'Centrocampista' else 'Attaccante' end;

    for i in 1..v_totale loop
      if not exists (
        select 1 from public.roster_slots s
        where s.list_id = p_lista and s.role = v_ruolo and s.position = i - 1
      ) then
        insert into public.roster_slots (list_id, role, label, position)
        values (p_lista, v_ruolo, format('%s %s', v_nome, i), i - 1);
        v_quanti := v_quanti + 1;
      end if;
    end loop;
  end loop;

  return v_quanti;
end;
$$;
