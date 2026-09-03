-- ═══════════════════════════════════════════════════════════════════════════
-- 0027 · Riaprire un'asta chiusa, e cambiare chi guida una squadra
--
-- DUE COSE CHE MANCAVANO, TROVATE DALL'USO
--
-- 1. **Un'asta chiusa per sbaglio bloccava la lega.** `chiudi_asta` esisteva,
--    il suo contrario no. E un'asta per lega è una sola: chiusa quella, non se
--    ne apre un'altra e non si torna indietro. Parole dell'utente: «mi trovo
--    bloccato, non posso aprirne una nuova o sbloccare quella chiusa».
--
--    È il difetto peggiore di tutti quelli trovati finora, perché non c'è
--    niente da fare: nessun'altra funzione, nessun percorso alternativo,
--    nessun modo di rimediare dall'applicazione. La lega resta ferma.
--
--    La lezione: **ogni azione che chiude una porta deve avere il suo
--    contrario**, o non è un'azione, è una trappola. Vale per `chiudi_asta` e
--    valeva già per `apri_asta`, che infatti aveva `annulla_ultima_aggiudicazione`
--    a rimettere le cose a posto.
--
-- 2. **Una squadra non poteva cambiare proprietario.** Se uno lascia il
--    gruppo, la sua rosa e i suoi crediti se ne andavano con lui, e chi
--    arrivava ripartiva da zero a metà stagione. Sono due cose separate — la
--    persona e la squadra — e finora erano una sola.
--
-- IL CAMBIO CHE RENDE POSSIBILE LA SECONDA
--
-- `teams.user_id` diventa **facoltativo**. Una squadra senza proprietario è
-- uno stato legittimo e temporaneo: la rosa c'è, i crediti ci sono, manca
-- soltanto chi la guida. Le regole di accesso continuano a funzionare da sole,
-- perché confrontano `user_id` con chi sta guardando e un valore nullo non
-- corrisponde a nessuno.
--
-- Il turno d'asta invece va insegnato: una squadra senza nessuno non può
-- chiamare, e senza questa correzione l'asta si fermerebbe sul suo turno
-- aspettando una persona che non c'è.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Una squadra può restare senza proprietario ─────────────────────────────

alter table public.teams alter column user_id drop not null;

comment on column public.teams.user_id is
  'Chi guida la squadra. Nullo quando il partecipante ha lasciato la lega e la squadra aspetta qualcun altro: la rosa e i crediti restano.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Riaprire un'asta chiusa
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * Rimette in gioco un'asta che era stata chiusa.
 *
 * Non cancella niente: rose, crediti e registro restano dov'erano. È il
 * contrario esatto di `chiudi_asta`, e serve tutte le volte che quella è
 * stata premuta per sbaglio — oppure quando ci si accorge dopo che una rosa
 * era rimasta incompleta.
 *
 * PERCHE' RICHIEDE UN MOTIVO
 * Riaprire un'asta chiusa cambia le regole del gioco a partita finita. È il
 * genere di gesto che, in una lega fra amici, va spiegato mentre lo si fa e
 * non dopo. Vale la stessa scelta delle correzioni sulle rose: il motivo
 * finisce nel registro che leggono tutti.
 */
create or replace function public.riapri_asta(p_lega uuid, p_motivo text)
returns table (esito public.esito_asta, messaggio text)
language plpgsql security definer set search_path = '' as $$
declare
  v_asta  public.auctions%rowtype;
  v_vuoti int;
begin
  if not public.e_admin_lega(p_lega) then
    return query select 'non_autorizzato'::public.esito_asta,
      'Riapre l''asta l''amministratore della lega.'; return;
  end if;

  if p_motivo is null or char_length(btrim(p_motivo)) < 3 then
    return query select 'non_autorizzato'::public.esito_asta,
      'Scrivi il motivo: finisce nel registro che vedono tutti.'; return;
  end if;

  select * into v_asta from public.auctions where league_id = p_lega for update;
  if v_asta.id is null then
    return query select 'asta_non_aperta'::public.esito_asta,
      'Questa lega non ha ancora un''asta.'; return;
  end if;
  if v_asta.status <> 'closed' then
    return query select 'asta_non_aperta'::public.esito_asta,
      format('L''asta non è chiusa: è %s.', v_asta.status); return;
  end if;

  update public.auctions set status = 'open', closed_at = null where id = v_asta.id;
  update public.leagues set status = 'auction' where id = p_lega;

  -- Il turno può essere rimasto su una squadra che non può più chiamare.
  perform public.avanza_turno(v_asta.id);

  select coalesce(sum(b.slot_rimanenti), 0) into v_vuoti
  from public.team_budget b where b.league_id = p_lega;

  insert into public.auction_events (auction_id, type, payload, actor_user_id)
  values (v_asta.id, 'riapertura',
          jsonb_build_object('slot_vuoti', v_vuoti, 'motivo_admin', btrim(p_motivo)),
          (select auth.uid()));

  return query select 'ok'::public.esito_asta,
    format('Asta riaperta. Restano %s slot da riempire.', v_vuoti);
end;
$$;

-- La riapertura è un intervento come gli altri, e nel registro deve vedersi.
create or replace function public.evento_manuale(p_tipo text, p_payload jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_tipo
    when 'annullamento'      then true
    when 'rimozione'         then true
    when 'correzione_prezzo' then true
    when 'pausa'             then true
    when 'ripresa'           then true
    when 'riapertura'        then true
    when 'partecipante_via'  then true
    when 'squadra_affidata'  then true
    when 'aggiudicazione'    then coalesce(p_payload ->> 'modo', '') in ('quick_assign', 'admin')
    when 'passaggio'         then coalesce(p_payload ->> 'motivo', '') = 'admin'
    when 'estrazione'        then coalesce(p_payload ->> 'metodo', '') = 'riempimento'
    else false
  end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Il turno salta le squadre senza nessuno
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Senza questa correzione, una squadra rimasta senza proprietario bloccherebbe
-- l'asta sul suo turno: il motore aspetterebbe una chiamata da una persona che
-- non c'è, e nessuno potrebbe farci niente.

create or replace function public.avanza_turno(p_asta uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_asta    public.auctions%rowtype;
  v_fase    public.ruolo_calciatore;
  v_quante  int;
  v_indice  int;
  v_squadra uuid;
  v_min     int;
  i         int;
begin
  v_fase := public.aggiorna_fase(p_asta);
  select * into v_asta from public.auctions where id = p_asta;
  select min_bid into v_min from public.leagues where id = v_asta.league_id;

  -- Nei metodi automatici il turno non serve: apre il server.
  if v_asta.method <> 'chiamata' then
    if not exists (
      select 1 from public.team_budget b
      where b.league_id = v_asta.league_id and b.slot_rimanenti > 0
    ) then
      update public.auctions set status = 'closed', closed_at = now() where id = p_asta;
      update public.leagues set status = 'done' where id = v_asta.league_id;
      insert into public.auction_events (auction_id, type) values (p_asta, 'chiusura');
    end if;
    return;
  end if;

  v_quante := coalesce(array_length(v_asta.nomination_order, 1), 0);
  if v_quante = 0 then return; end if;

  for i in 1..v_quante loop
    v_indice  := (v_asta.current_turn_index + i) % v_quante;
    v_squadra := v_asta.nomination_order[v_indice + 1];

    if exists (
      select 1 from public.team_budget b
      where b.team_id = v_squadra and b.slot_rimanenti > 0 and b.massimo_offribile >= v_min
    )
    -- Nelle varianti a reparti si salta anche chi ha quel reparto già pieno.
    and (v_fase is null or public.slot_liberi_ruolo(v_squadra, v_fase) > 0)
    -- E si salta chi non ha nessuno che la guidi: aspetterebbe per sempre.
    and exists (select 1 from public.teams t where t.id = v_squadra and t.user_id is not null)
    then
      update public.auctions set current_turn_index = v_indice where id = p_asta;
      return;
    end if;
  end loop;

  update public.auctions set status = 'closed', closed_at = now() where id = p_asta;
  update public.leagues set status = 'done' where id = v_asta.league_id;
  insert into public.auction_events (auction_id, type) values (p_asta, 'chiusura');
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- La persona se ne va, la squadra resta
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * Toglie un partecipante dalla lega **lasciando la sua squadra dov'è**.
 *
 * Rosa, crediti e nome restano intatti: cambia solo che nessuno la guida. Se
 * la persona era l'amministratore non si fa niente, perché una lega senza
 * amministratore non ha più nessuno che possa rimediare a nulla — e questo
 * documento ha già raccontato cosa succede quando non c'è modo di rimediare.
 */
create or replace function public.libera_squadra(p_lega uuid, p_squadra uuid, p_motivo text)
returns table (esito text, messaggio text)
language plpgsql security definer set search_path = '' as $$
declare
  v_squadra public.teams%rowtype;
  v_lega    public.leagues%rowtype;
  v_nome    text;
  v_asta    uuid;
begin
  if not public.e_admin_lega(p_lega) then
    return query select 'non_autorizzato', 'Solo l''amministratore della lega può farlo.'; return;
  end if;
  if p_motivo is null or char_length(btrim(p_motivo)) < 3 then
    return query select 'non_autorizzato',
      'Scrivi il motivo: finisce nel registro che vedono tutti.'; return;
  end if;

  select * into v_squadra from public.teams where id = p_squadra and league_id = p_lega;
  if not found then
    return query select 'non_trovato', 'Quella squadra non è di questa lega.'; return;
  end if;
  if v_squadra.user_id is null then
    return query select 'gia_libera', 'Quella squadra è già senza proprietario.'; return;
  end if;

  select * into v_lega from public.leagues where id = p_lega;
  if v_squadra.user_id = v_lega.admin_user_id then
    return query select 'non_autorizzato',
      'Non puoi togliere te stesso: una lega senza amministratore non si sblocca più.'; return;
  end if;

  select coalesce(p.display_name, 'qualcuno') into v_nome
  from public.profiles p where p.id = v_squadra.user_id;

  delete from public.league_members where league_id = p_lega and user_id = v_squadra.user_id;
  update public.teams set user_id = null where id = p_squadra;

  -- La lista obiettivi se ne va con la persona: era sua e privata, e chi
  -- prendera' la squadra non deve trovarsi le preferenze di un altro.
  delete from public.target_lists where league_id = p_lega and user_id = v_squadra.user_id;

  select id into v_asta from public.auctions where league_id = p_lega;
  if v_asta is not null then
    insert into public.auction_events (auction_id, type, payload, actor_user_id)
    values (v_asta, 'partecipante_via',
            jsonb_build_object('squadra', p_squadra, 'chi', v_nome,
                               'motivo_admin', btrim(p_motivo)),
            (select auth.uid()));
    -- Il turno poteva essere suo.
    perform public.avanza_turno(v_asta);
  end if;

  return query select 'ok',
    format('%s non fa più parte della lega. «%s» resta, con la sua rosa e i suoi crediti.',
           v_nome, v_squadra.name);
end;
$$;

/**
 * Affida una squadra senza proprietario a qualcuno.
 *
 * Si indica con l'indirizzo email, che è l'unica cosa che si sa di una persona
 * prima che sia in lega. Deve avere gia' un account: l'alternativa sarebbe
 * creare account per conto di altri, che è esattamente il genere di cosa che
 * un'applicazione non deve fare.
 *
 * Il nome della squadra **non cambia**: quella rosa la conoscono tutti con
 * quel nome, e cambiarlo a metà stagione renderebbe illeggibile il registro
 * dell'asta. Chi la prende può rinominarla dalle sue impostazioni, come
 * chiunque altro.
 */
create or replace function public.affida_squadra(p_lega uuid, p_squadra uuid, p_email text)
returns table (esito text, messaggio text)
language plpgsql security definer set search_path = '' as $$
declare
  v_squadra public.teams%rowtype;
  v_utente  uuid;
  v_nome    text;
  v_asta    uuid;
begin
  if not public.e_admin_lega(p_lega) then
    return query select 'non_autorizzato', 'Solo l''amministratore della lega può farlo.'; return;
  end if;

  select * into v_squadra from public.teams where id = p_squadra and league_id = p_lega;
  if not found then
    return query select 'non_trovato', 'Quella squadra non è di questa lega.'; return;
  end if;
  if v_squadra.user_id is not null then
    return query select 'gia_assegnata',
      'Quella squadra ha già un proprietario: prima va liberata.'; return;
  end if;

  select id into v_utente from auth.users where lower(email) = lower(btrim(p_email));
  if v_utente is null then
    return query select 'non_trovato',
      format('Nessun account con l''indirizzo %s. Deve registrarsi prima, poi riprova.',
             btrim(p_email)); return;
  end if;

  if exists (select 1 from public.teams where league_id = p_lega and user_id = v_utente) then
    return query select 'gia_dentro',
      'Quella persona ha già una squadra in questa lega.'; return;
  end if;

  insert into public.league_members (league_id, user_id, role)
  values (p_lega, v_utente, 'member')
  on conflict (league_id, user_id) do nothing;

  update public.teams set user_id = v_utente where id = p_squadra;

  select coalesce(p.display_name, btrim(p_email)) into v_nome
  from public.profiles p where p.id = v_utente;

  select id into v_asta from public.auctions where league_id = p_lega;
  if v_asta is not null then
    insert into public.auction_events (auction_id, type, payload, actor_user_id)
    values (v_asta, 'squadra_affidata',
            jsonb_build_object('squadra', p_squadra, 'chi', v_nome),
            (select auth.uid()));
    perform public.avanza_turno(v_asta);
  end if;

  return query select 'ok',
    format('«%s» è ora di %s, con la rosa e i crediti che aveva.', v_squadra.name, v_nome);
end;
$$;

-- ─── Le squadre senza nessuno, per la schermata ─────────────────────────────

create or replace view public.squadre_libere
with (security_invoker = true) as
select t.id, t.league_id, t.name, t.credits_remaining,
       (select count(*)::int from public.roster_players r where r.team_id = t.id) as calciatori
from public.teams t
where t.user_id is null;

comment on view public.squadre_libere is
  'Le squadre che aspettano qualcuno: la rosa e i crediti ci sono, manca chi le guida.';
