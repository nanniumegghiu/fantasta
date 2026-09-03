-- ═══════════════════════════════════════════════════════════════════════════
-- 0016 · Gli slot sono quelli del regolamento, e hanno un massimale a testa
--
-- PERCHE' CAMBIA
--
-- Gli slot erano contenitori liberi: se ne creavano quanti se ne voleva, con
-- il nome che si voleva, e il tetto di spesa stava su ogni singolo calciatore.
-- All'uso è risultato sbagliato su tutti e due i punti.
--
-- LA QUANTITA' NON SI SCEGLIE
-- Uno slot è **un posto della rosa**, e i posti li decide il regolamento della
-- lega: tre portieri, otto difensori, otto centrocampisti, sei attaccanti. Se
-- ne puoi creare dodici in attacco, non stai più preparando una rosa, stai
-- facendo un altro elenco di preferenze. La quantità viene dalla lega, sempre,
-- e si allinea da sola quando la lega cambia le sue regole.
--
-- IL NOME SI CAMBIA
-- «Attaccante 1» diventa «il bomber», «Difensore 8» diventa «il quinto di
-- riserva». Il nome è l'unica cosa che serve personalizzare, perché è quello
-- che ti ricorda che ruolo ha quel posto nella tua idea di squadra.
--
-- IL MASSIMALE STA SULLO SLOT, NON SUL CALCIATORE
-- La domanda a cui rispondono gli slot non è «quanto vale questo nome», è
-- «quanto sono disposto a spendere per riempire questo posto». Dentro lo slot
-- ci sono cinque nomi che per te valgono la stessa cosa: il massimale è uno,
-- e vale per chiunque di loro arrivi per primo. Un tetto per ogni nome
-- sarebbe la stessa cifra ripetuta cinque volte, con cinque occasioni di
-- scriverla diversa per sbaglio.
--
-- Il tetto per calciatore resta dov'era: serve al metodo delle fasce, e chi
-- passa da un metodo all'altro non deve perdere quello che aveva scritto.
-- ═══════════════════════════════════════════════════════════════════════════

-- Quanto sono disposto a spendere per riempire questo posto, con chiunque dei
-- suoi candidati. Facoltativo: si accende con l'opzione «tetto di spesa».
alter table public.roster_slots
  add column max_price int check (max_price is null or max_price > 0);

comment on column public.roster_slots.max_price is
  'Massimale dello slot: vale per qualunque candidato lo riempia, non per un nome in particolare.';

-- ═══════════════════════════════════════════════════════════════════════════
-- La quantità viene dalla lega
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * Porta gli slot di una lista a coincidere con il regolamento della lega:
 * ne crea quanti ne mancano, ne toglie quanti ne avanzano, e rinumera le
 * posizioni perché restino contigue.
 *
 * QUALE SI TOGLIE, QUANDO NE AVANZANO
 * Il meno pieno per primo, e a parità l'ultimo della fila. Se l'amministratore
 * porta gli attaccanti da sei a cinque, si perde lo slot su cui avevi lavorato
 * meno, non l'ultimo per caso. È la scelta che salva più lavoro possibile in
 * una situazione in cui qualcosa si deve per forza perdere.
 *
 * Si chiama a ogni apertura della lista: così il giorno in cui la lega cambia
 * le sue regole, gli slot sono già giusti senza che nessuno debba accorgersene.
 */
create or replace function public.sincronizza_slot(p_lista uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lega    uuid;
  v_ruolo   public.ruolo_calciatore;
  v_nome    text;
  v_previsti int;
  v_ora     int;
  v_da_togliere uuid;
  v_cambi   int := 0;
  i         int;
  l         record;
begin
  select league_id into v_lega from public.target_lists where id = p_lista;
  if v_lega is null or not public.e_mia_lista(p_lista) then
    return 0;
  end if;

  select slots_p, slots_d, slots_c, slots_a into l from public.leagues where id = v_lega;

  foreach v_ruolo in array array['P','D','C','A']::public.ruolo_calciatore[] loop
    v_previsti := case v_ruolo when 'P' then l.slots_p when 'D' then l.slots_d
                               when 'C' then l.slots_c else l.slots_a end;
    v_nome := case v_ruolo when 'P' then 'Portiere' when 'D' then 'Difensore'
                           when 'C' then 'Centrocampista' else 'Attaccante' end;

    select count(*) into v_ora
    from public.roster_slots where list_id = p_lista and role = v_ruolo;

    -- Ne mancano: si creano in fondo, con il nome predefinito.
    while v_ora < v_previsti loop
      insert into public.roster_slots (list_id, role, label, position)
      values (p_lista, v_ruolo, format('%s %s', v_nome, v_ora + 1), v_ora);
      v_ora := v_ora + 1;
      v_cambi := v_cambi + 1;
    end loop;

    -- Ne avanzano: via il meno pieno, a parità l'ultimo.
    while v_ora > v_previsti loop
      select s.id into v_da_togliere
      from public.roster_slots s
      where s.list_id = p_lista and s.role = v_ruolo
      order by (select count(*) from public.slot_candidates c where c.slot_id = s.id) asc,
               s.position desc
      limit 1;

      delete from public.roster_slots where id = v_da_togliere;
      v_ora := v_ora - 1;
      v_cambi := v_cambi + 1;
    end loop;

    -- Le posizioni restano contigue: 0, 1, 2… senza buchi lasciati indietro.
    with numerate as (
      select id, row_number() over (order by position, label) - 1 as nuova
      from public.roster_slots where list_id = p_lista and role = v_ruolo
    )
    update public.roster_slots s
    set position = n.nuova
    from numerate n
    where s.id = n.id and s.position is distinct from n.nuova;
  end loop;

  return v_cambi;
end;
$$;

-- `crea_slot_standard` chiedeva all'utente di premere un pulsante per avere
-- quello che adesso c'è sempre. Non serve più, e lasciarlo in giro
-- significherebbe due modi di fare la stessa cosa.
drop function if exists public.crea_slot_standard(uuid);

-- ═══════════════════════════════════════════════════════════════════════════
-- La lista nasce e si riapre con gli slot già giusti
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
  v_nuova  boolean := false;
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

  if v_lista is null then
    insert into public.target_lists (league_id, user_id)
    values (p_lega, v_utente)
    on conflict (league_id, user_id) do update set updated_at = now()
    returning id into v_lista;
    v_nuova := true;
  end if;

  if v_nuova then
    -- Tre fasce per ogni reparto: una lista vuota davanti non aiuta nessuno, e
    -- queste si rinominano o si cancellano in un tocco.
    foreach v_ruolo in array array['P','D','C','A']::public.ruolo_calciatore[] loop
      insert into public.tiers (list_id, role, name, color, position) values
        (v_lista, v_ruolo, 'Da prendere assolutamente', 'oro', 0),
        (v_lista, v_ruolo, 'Buone alternative', 'arancio', 1),
        (v_lista, v_ruolo, 'Se avanzano crediti', 'verde', 2);
    end loop;
  end if;

  -- Gli slot invece si allineano **ogni volta**: sono i posti della rosa
  -- decisi dalla lega, e la lega può cambiarli anche dopo.
  perform public.sincronizza_slot(v_lista);

  return v_lista;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Togliere un candidato da uno slot
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * Toglie il calciatore da quello slot, e se non è rimasto in nessun altro
 * posto lo toglie anche dalla lista.
 *
 * PERCHE' NON SOLO IL LEGAME
 * Nel metodo degli slot un obiettivo esiste **perché** è candidato a un posto.
 * Staccarlo e lasciarlo nella lista produrrebbe un calciatore che sta lì senza
 * stare da nessuna parte: comparirebbe fra gli avanzi e andrebbe tolto una
 * seconda volta. Chi tocca la croce vuole non vederlo più.
 *
 * Se invece è candidato anche altrove, resta: si stava togliendo da un posto,
 * non dalla testa.
 */
create or replace function public.togli_da_slot(p_slot uuid, p_obiettivo uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lista   uuid;
  v_rimasti int;
begin
  select list_id into v_lista from public.roster_slots where id = p_slot;
  if v_lista is null or not public.e_mia_lista(v_lista) then
    return false;
  end if;

  delete from public.slot_candidates
  where slot_id = p_slot and target_id = p_obiettivo;

  select count(*) into v_rimasti
  from public.slot_candidates where target_id = p_obiettivo;

  if v_rimasti = 0 then
    delete from public.targets where id = p_obiettivo and list_id = v_lista;
  end if;

  return true;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Il numero degli slot non si tocca dal client
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La regola «la quantità viene dalla lega» va difesa dove i dati vivono, non
-- soltanto nella schermata. Chi ha in mano la chiave pubblica può parlare
-- direttamente con il database: se lì può creare uno slot, la regola non c'è.
--
-- Restano permessi la lettura e la modifica di **due sole colonne**: il nome,
-- che è tuo, e il massimale, che è la tua strategia. Il ruolo, la posizione e
-- l'esistenza dello slot appartengono al regolamento.

drop policy if exists "roster_slots: solo dalla mia lista" on public.roster_slots;

create policy "slot: leggo solo i miei"
  on public.roster_slots for select to authenticated
  using (public.e_mia_lista(list_id));

create policy "slot: cambio solo i miei"
  on public.roster_slots for update to authenticated
  using (public.e_mia_lista(list_id))
  with check (public.e_mia_lista(list_id));

revoke all on public.roster_slots from authenticated, anon;
grant select on public.roster_slots to authenticated;
grant update (label, max_price) on public.roster_slots to authenticated;
