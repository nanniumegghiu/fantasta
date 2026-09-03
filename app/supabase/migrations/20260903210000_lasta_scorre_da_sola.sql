-- ═══════════════════════════════════════════════════════════════════════════
-- 0019 · L'asta scorre da sola, e alla fine si riempie a mano
--
-- DUE COSE, TROVATE PROVANDO UN'ASTA VERA
--
-- 1. DOPO OGNI CHIUSURA BISOGNAVA PREMERE «ESTRAI IL PROSSIMO»
--
-- Nei metodi automatici il server sceglie lui chi va all'asta. Ma dopo ogni
-- aggiudicazione e dopo ogni «non lo vuole nessuno» restava lì fermo, ad
-- aspettare che l'amministratore premesse un pulsante per fare una cosa che
-- avrebbe potuto fare da solo. Parole dell'utente: «dover cliccare sempre
-- estrai il prossimo è davvero antipatico e inutile».
--
-- Aveva ragione, e il difetto e' piu' profondo di un pulsante di troppo: in
-- un'asta a estrazione l'amministratore non deve **condurre**, deve
-- **guardare**. Ogni gesto che gli si chiede e' un momento in cui la stanza
-- aspetta lui.
--
-- Adesso il lotto successivo si apre dentro la chiusura del precedente. Non
-- vale per l'asta a chiamata, dove il prossimo nome lo dice una persona.
--
-- 2. QUANDO IL LISTONE FINISCE, L'ASTA NON DEVE CHIUDERSI
--
-- `apri_prossimo_lotto` chiudeva l'asta appena non trovava piu' nessuno da
-- estrarre. Sbagliato: si esaurisce il listone **prima** che le rose siano
-- piene, perche' i calciatori che nessuno ha voluto restano fuori e gli slot
-- restano vuoti. Chiudere li' vuol dire lasciare squadre incomplete.
--
-- Da qui la richiesta: «quando viene chiamata tutta la lista e finisce il
-- primo giro di ogni ruolo ci deve essere la possibilita' di aprire aste per
-- giocatori cercati con ricerca nome dall'amministratore».
--
-- Adesso l'asta si chiude da sola **solo** se tutte le rose sono complete. Se
-- il listone e' finito ma qualcuno ha ancora slot vuoti, resta aperta e
-- risponde `listone_finito`: e' il momento del riempimento a mano.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Il motore dell'estrazione, senza controllo dei permessi ────────────────
--
-- PERCHE' SEPARATO
-- Serviva chiamarlo da dentro la chiusura di un lotto, e quella puo' partire
-- da chiunque: dal client di un partecipante che si accorge che il countdown
-- e' scaduto, o dal compito pianificato che gira ogni dieci secondi. Nessuno
-- dei due e' l'amministratore. Il controllo dei permessi resta dove ha senso,
-- sulla porta d'ingresso, non su un ingranaggio interno.

create or replace function public.apri_lotto_automatico(p_asta uuid)
returns table (esito public.esito_asta, messaggio text, lotto uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_asta       public.auctions%rowtype;
  v_calciatore int;
  v_lotto      uuid;
  v_incompiute int;
begin
  select * into v_asta from public.auctions where id = p_asta;
  if v_asta.status <> 'open' then
    return query select 'asta_non_aperta'::public.esito_asta, 'L''asta non è aperta.', null::uuid; return;
  end if;
  if v_asta.method = 'chiamata' then
    return query select 'metodo_non_disponibile'::public.esito_asta,
      'In questa asta i calciatori li chiamano i partecipanti.', null::uuid; return;
  end if;
  if exists (select 1 from public.auction_lots where auction_id = p_asta and status = 'open') then
    return query select 'lotto_chiuso'::public.esito_asta, 'C''è già un calciatore all''asta.', null::uuid; return;
  end if;

  perform public.aggiorna_fase(p_asta);
  v_calciatore := public.prossimo_calciatore(p_asta);

  if v_calciatore is null then
    -- Distinzione che prima non c'era, e che cambia tutto: le rose sono
    -- davvero piene, o è il listone a essere finito prima di loro?
    select count(*) into v_incompiute
    from public.team_budget b
    where b.league_id = v_asta.league_id and b.slot_rimanenti > 0;

    if v_incompiute = 0 then
      update public.auctions set status = 'closed', closed_at = now() where id = p_asta;
      update public.leagues set status = 'done' where id = v_asta.league_id;
      insert into public.auction_events (auction_id, type) values (p_asta, 'chiusura');
      return query select 'rosa_completa'::public.esito_asta,
        'Tutte le rose sono complete. L''asta è finita.', null::uuid; return;
    end if;

    return query select 'listone_finito'::public.esito_asta,
      format('Il listone è finito ma %s squadre hanno ancora slot vuoti. Cerca i calciatori per nome e mettili all''asta.',
             v_incompiute),
      null::uuid; return;
  end if;

  -- Nasce senza offerente: la prima offerta valida vale come apertura.
  insert into public.auction_lots (auction_id, player_id, current_bid, current_bidder_team_id, last_bid_at)
  values (p_asta, v_calciatore, 0, null, now())
  returning id into v_lotto;

  insert into public.auction_events (auction_id, type, payload, actor_user_id)
  values (p_asta, 'estrazione',
          jsonb_build_object('lotto', v_lotto, 'calciatore', v_calciatore, 'metodo', v_asta.method),
          (select auth.uid()));

  return query select 'ok'::public.esito_asta, 'Lotto aperto.', v_lotto;
end;
$$;

-- La porta d'ingresso resta com'era: la usa l'amministratore per far partire
-- il primo lotto, e come rete se qualcosa si fosse inceppato.
create or replace function public.apri_prossimo_lotto(p_lega uuid)
returns table (esito public.esito_asta, messaggio text, lotto uuid)
language plpgsql security definer set search_path = '' as $$
declare v_asta uuid;
begin
  if not public.e_admin_lega(p_lega) then
    return query select 'non_autorizzato'::public.esito_asta,
      'Apre i lotti l''amministratore.', null::uuid; return;
  end if;

  select id into v_asta from public.auctions where league_id = p_lega for update;
  if v_asta is null then
    return query select 'asta_non_aperta'::public.esito_asta, 'Questa lega non ha un''asta.', null::uuid; return;
  end if;

  return query select * from public.apri_lotto_automatico(v_asta);
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- La chiusura di un lotto tira dentro il successivo
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.esegui_chiusura_lotto(
  p_lotto uuid, p_squadra uuid, p_prezzo int, p_tipo text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_lotto public.auction_lots%rowtype;
  v_asta  public.auctions%rowtype;
begin
  select * into v_lotto from public.auction_lots where id = p_lotto;
  select * into v_asta  from public.auctions where id = v_lotto.auction_id;

  if p_squadra is null then
    update public.auction_lots set status = 'passed', closed_at = now() where id = p_lotto;
    insert into public.auction_events (auction_id, type, payload, actor_user_id)
    values (v_asta.id, 'passaggio',
            jsonb_build_object('lotto', p_lotto, 'calciatore', v_lotto.player_id, 'motivo', p_tipo),
            (select auth.uid()));
  else
    update public.auction_lots
    set status = 'awarded', awarded_team_id = p_squadra, final_price = p_prezzo, closed_at = now()
    where id = p_lotto;

    insert into public.roster_players (league_id, team_id, player_id, price, source)
    values (v_asta.league_id, p_squadra, v_lotto.player_id, p_prezzo,
            case when p_tipo = 'quick_assign' then 'quick_assign'::public.fonte_acquisto
                 else 'auction'::public.fonte_acquisto end);

    update public.teams set credits_remaining = credits_remaining - p_prezzo where id = p_squadra;

    insert into public.auction_events (auction_id, type, payload, actor_user_id)
    values (v_asta.id, 'aggiudicazione',
            jsonb_build_object('lotto', p_lotto, 'calciatore', v_lotto.player_id,
                               'squadra', p_squadra, 'prezzo', p_prezzo, 'modo', p_tipo),
            (select auth.uid()));
  end if;

  perform public.avanza_turno(v_asta.id);

  -- Il prossimo si apre da solo. L'esito non si guarda apposta: se il listone
  -- e' finito o le rose sono complete, `apri_lotto_automatico` fa la cosa
  -- giusta e lo dice a chi guarda lo schermo. Qui non c'e' niente da decidere.
  if v_asta.method <> 'chiamata' then
    perform public.apri_lotto_automatico(v_asta.id);
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Il riempimento: l'amministratore mette all'asta un nome che cerca lui
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * Apre un lotto su un calciatore scelto per nome dall'amministratore.
 *
 * A COSA SERVE
 * Alla fine del giro restano due cose insieme: calciatori che nessuno ha
 * voluto e slot ancora vuoti. Senza questa funzione le due cose non si
 * incontrano piu', e le rose finiscono incomplete.
 *
 * PERCHE' RIPESCA ANCHE CHI ERA STATO PASSATO
 * Un calciatore «passato» non e' un calciatore rifiutato per sempre: e' uno
 * che a quel prezzo, in quel momento, con quegli slot ancora liberi non
 * interessava. Mezz'ora dopo, a chi ha tre buchi in difesa, interessa eccome.
 * Per questo il filtro guarda solo chi e' gia' stato **comprato**.
 *
 * PERCHE' RISPETTA IL REPARTO IN CORSO
 * Se il reparto che si sta giocando ha ancora calciatori da estrarre, aprire
 * un attaccante nel mezzo dei portieri scavalcherebbe la regola della lega
 * senza che nessuno l'abbia deciso. Si puo' scavalcare il reparto solo quando
 * quel reparto e' davvero finito: allora non e' piu' una scorciatoia, e' la
 * ripresa.
 */
create or replace function public.apri_lotto_scelto(p_lega uuid, p_player_id int)
returns table (esito public.esito_asta, messaggio text, lotto uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_asta     public.auctions%rowtype;
  v_lega     public.leagues%rowtype;
  v_ruolo    public.ruolo_calciatore;
  v_stagione text;
  v_nome     text;
  v_lotto    uuid;
  v_restano  int;
begin
  if not public.e_admin_lega(p_lega) then
    return query select 'non_autorizzato'::public.esito_asta,
      'Mette all''asta un nome scelto solo l''amministratore.', null::uuid; return;
  end if;

  select * into v_asta from public.auctions where league_id = p_lega for update;
  if v_asta.id is null or v_asta.status <> 'open' then
    return query select 'asta_non_aperta'::public.esito_asta, 'L''asta non è aperta.', null::uuid; return;
  end if;
  if exists (select 1 from public.auction_lots where auction_id = v_asta.id and status = 'open') then
    return query select 'lotto_chiuso'::public.esito_asta,
      'C''è già un calciatore all''asta: aspetta che si chiuda.', null::uuid; return;
  end if;

  select * into v_lega from public.leagues where id = p_lega;

  select p.role, p.season, p.name into v_ruolo, v_stagione, v_nome
  from public.players p where p.id = p_player_id and p.active;

  if v_ruolo is null then
    return query select 'gia_acquistato'::public.esito_asta,
      'Questo calciatore non è nel listone.', null::uuid; return;
  end if;
  if v_stagione is distinct from v_lega.season then
    return query select 'gia_acquistato'::public.esito_asta,
      format('%s è del listone %s, ma la lega è della stagione %s.', v_nome, v_stagione, v_lega.season),
      null::uuid; return;
  end if;

  if exists (select 1 from public.roster_players
             where league_id = p_lega and player_id = p_player_id) then
    return query select 'gia_acquistato'::public.esito_asta,
      format('%s è già stato comprato.', v_nome), null::uuid; return;
  end if;

  -- Il reparto in corso si scavalca solo se è finito davvero.
  if v_asta.current_role_phase is not null and v_ruolo <> v_asta.current_role_phase then
    select count(*) into v_restano
    from public.players p
    where p.active and p.season = v_lega.season and p.role = v_asta.current_role_phase
      and not exists (select 1 from public.roster_players r
                      where r.league_id = p_lega and r.player_id = p.id)
      and not exists (select 1 from public.auction_lots l
                      where l.auction_id = v_asta.id and l.player_id = p.id
                        and l.status in ('awarded', 'passed'));

    if v_restano > 0 then
      return query select 'reparto_chiuso'::public.esito_asta,
        format('Il reparto in corso non è finito: restano %s calciatori da chiamare.', v_restano),
        null::uuid; return;
    end if;
  end if;

  -- Deve esserci almeno una squadra che possa prenderlo, altrimenti si apre
  -- un'asta a cui nessuno può partecipare.
  if not exists (select 1 from public.teams t
                 where t.league_id = p_lega and public.slot_liberi_ruolo(t.id, v_ruolo) > 0) then
    return query select 'ruolo_pieno'::public.esito_asta,
      format('Nessuna squadra ha ancora uno slot libero in quel reparto: %s non servirebbe a nessuno.', v_nome),
      null::uuid; return;
  end if;

  insert into public.auction_lots (auction_id, player_id, current_bid, current_bidder_team_id, last_bid_at)
  values (v_asta.id, p_player_id, 0, null, now())
  returning id into v_lotto;

  insert into public.auction_events (auction_id, type, payload, actor_user_id)
  values (v_asta.id, 'estrazione',
          jsonb_build_object('lotto', v_lotto, 'calciatore', p_player_id, 'metodo', 'riempimento'),
          (select auth.uid()));

  return query select 'ok'::public.esito_asta, format('%s è all''asta.', v_nome), v_lotto;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Chiudere l'asta a mano
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * Prima l'asta si chiudeva da sola appena finiva il listone, e non c'era
 * nessun altro modo di chiuderla. Adesso che resta aperta per il riempimento,
 * serve un modo di dire «basta»: magari due squadre restano incomplete perche'
 * chi le guida ha finito i crediti, e nessuno ha voglia di andare avanti.
 */
create or replace function public.chiudi_asta(p_lega uuid)
returns table (esito public.esito_asta, messaggio text)
language plpgsql security definer set search_path = '' as $$
declare
  v_asta   public.auctions%rowtype;
  v_vuoti  int;
begin
  if not public.e_admin_lega(p_lega) then
    return query select 'non_autorizzato'::public.esito_asta,
      'Chiude l''asta l''amministratore.'; return;
  end if;

  select * into v_asta from public.auctions where league_id = p_lega for update;
  if v_asta.id is null or v_asta.status = 'closed' then
    return query select 'asta_non_aperta'::public.esito_asta, 'L''asta è già chiusa.'; return;
  end if;
  if exists (select 1 from public.auction_lots where auction_id = v_asta.id and status = 'open') then
    return query select 'lotto_chiuso'::public.esito_asta,
      'C''è un calciatore all''asta: chiudi prima quello.'; return;
  end if;

  select coalesce(sum(b.slot_rimanenti), 0) into v_vuoti
  from public.team_budget b where b.league_id = p_lega;

  update public.auctions set status = 'closed', closed_at = now() where id = v_asta.id;
  update public.leagues set status = 'done' where id = p_lega;
  insert into public.auction_events (auction_id, type, payload, actor_user_id)
  values (v_asta.id, 'chiusura', jsonb_build_object('slot_vuoti', v_vuoti), (select auth.uid()));

  -- Il messaggio dice quanto e' rimasto scoperto: chiudere con dei buchi e'
  -- una scelta legittima, ma va vista mentre la si fa.
  return query select 'ok'::public.esito_asta,
    case when v_vuoti = 0 then 'Asta chiusa. Tutte le rose sono complete.'
         else format('Asta chiusa con %s slot ancora vuoti.', v_vuoti) end;
end;
$$;
