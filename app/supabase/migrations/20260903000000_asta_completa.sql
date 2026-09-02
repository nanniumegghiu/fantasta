-- ═══════════════════════════════════════════════════════════════════════════
-- 0009 · L'asta completa: varianti, poteri dell'amministratore, passo
--
-- Sotto-fette 4c, 4d ed 4e. Completa il motore della migrazione 0006.
--
-- LE SETTE COMBINAZIONI
--   chiamata  × totale     → chiami chiunque, quando tocca a te
--   chiamata  × per_ruolo  → un reparto per volta, dai portieri agli attaccanti
--   chiamata  × ibrida     → prima i portieri di tutti, poi movimento libero
--   alfabetico× totale     → il server apre i lotti dalla A alla Z
--   alfabetico× per_ruolo  → dalla A alla Z, un reparto per volta
--   random    × totale     → il server estrae a sorte
--   random    × per_ruolo  → estrazione a sorte dentro il reparto aperto
--
-- Nei metodi alfabetico e random nessuno chiama: il lotto si apre senza
-- offerente e la prima offerta valida vale come apertura. Se non arriva
-- nessuna offerta, il calciatore viene passato.
-- ═══════════════════════════════════════════════════════════════════════════

-- Il filtro del bacino per l'asta random, deciso prima dell'apertura.
alter table public.auctions
  add column if not exists random_pool_filter jsonb not null default '{}'::jsonb;

-- Nei metodi automatici un lotto nasce senza nessuna offerta.
alter table public.auction_lots
  alter column current_bid set default 0;

-- ═══════════════════════════════════════════════════════════════════════════
-- La fase per ruolo
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * Ricalcola quale reparto è aperto.
 *
 * Un reparto si chiude quando **nessuna squadra** ha più uno slot libero in
 * quel ruolo: da quel momento tenerlo aperto sarebbe solo una perdita di tempo.
 */
create or replace function public.aggiorna_fase(p_asta uuid)
returns public.ruolo_calciatore
language plpgsql security definer set search_path = '' as $$
declare
  v_asta  public.auctions%rowtype;
  v_ruolo public.ruolo_calciatore;
  v_ordine public.ruolo_calciatore[] := array['P','D','C','A']::public.ruolo_calciatore[];
  i int;
begin
  select * into v_asta from public.auctions where id = p_asta;

  -- Nella variante totale non esistono reparti: si può chiamare chiunque.
  if v_asta.variant = 'totale' then
    update public.auctions set current_role_phase = null where id = p_asta;
    return null;
  end if;

  -- Nell'ibrida esiste solo la fase dei portieri; poi tutto libero.
  if v_asta.variant = 'ibrida' then
    if exists (
      select 1 from public.teams t
      where t.league_id = v_asta.league_id and public.slot_liberi_ruolo(t.id, 'P') > 0
    ) then
      update public.auctions set current_role_phase = 'P' where id = p_asta;
      return 'P';
    end if;
    update public.auctions set current_role_phase = null where id = p_asta;
    return null;
  end if;

  -- Per ruolo: si scorre P, D, C, A e ci si ferma al primo ancora scoperto.
  for i in 1..4 loop
    v_ruolo := v_ordine[i];
    if exists (
      select 1 from public.teams t
      where t.league_id = v_asta.league_id and public.slot_liberi_ruolo(t.id, v_ruolo) > 0
    ) then
      update public.auctions set current_role_phase = v_ruolo where id = p_asta;
      return v_ruolo;
    end if;
  end loop;

  update public.auctions set current_role_phase = null where id = p_asta;
  return null;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Avanzamento del turno, ora consapevole del reparto aperto
-- ═══════════════════════════════════════════════════════════════════════════

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
-- Impostazioni: ora tutte le combinazioni sono disponibili
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists public.configura_asta(uuid, public.metodo_asta, public.variante_asta,
  public.conduzione_asta, public.tipo_chiamata, int, int);

create or replace function public.configura_asta(
  p_lega               uuid,
  p_metodo             public.metodo_asta,
  p_variante           public.variante_asta,
  p_conduzione         public.conduzione_asta,
  p_tipo_chiamata      public.tipo_chiamata,
  p_secondi_inattivita int,
  p_secondi_countdown  int,
  p_filtro_random      jsonb default '{}'::jsonb
)
returns table (esito public.esito_asta, messaggio text)
language plpgsql security definer set search_path = '' as $$
declare v_asta uuid;
begin
  if not public.e_admin_lega(p_lega) then
    return query select 'non_autorizzato'::public.esito_asta,
      'Solo l''amministratore della lega può cambiare le impostazioni.'; return;
  end if;

  -- L'ibrida ha senso solo a chiamata: nei metodi automatici il server apre i
  -- lotti da solo, e «prima i portieri poi tutto libero» coincide con per_ruolo.
  if p_metodo <> 'chiamata' and p_variante = 'ibrida' then
    return query select 'metodo_non_disponibile'::public.esito_asta,
      'La variante ibrida esiste solo per l''asta a chiamata.'; return;
  end if;

  v_asta := public.assicura_asta(p_lega);

  update public.auctions set
    method = p_metodo, variant = p_variante, conduction = p_conduzione,
    bid_type = p_tipo_chiamata,
    inactivity_seconds = p_secondi_inattivita,
    countdown_seconds = p_secondi_countdown,
    random_pool_filter = coalesce(p_filtro_random, '{}'::jsonb)
  where id = v_asta and status = 'draft';

  if not found then
    return query select 'asta_non_aperta'::public.esito_asta,
      'Le impostazioni si cambiano solo prima di aprire l''asta.'; return;
  end if;

  return query select 'ok'::public.esito_asta, 'Impostazioni salvate.';
end;
$$;

-- All'apertura si imposta subito il reparto di partenza.
create or replace function public.apri_asta(p_lega uuid, p_sorteggia boolean default true)
returns table (esito public.esito_asta, messaggio text)
language plpgsql security definer set search_path = '' as $$
declare
  v_asta   uuid;
  v_ordine uuid[];
begin
  if not public.e_admin_lega(p_lega) then
    return query select 'non_autorizzato'::public.esito_asta,
      'Solo l''amministratore della lega può aprire l''asta.'; return;
  end if;

  v_asta := public.assicura_asta(p_lega);

  if p_sorteggia then
    select array_agg(id order by random()) into v_ordine from public.teams where league_id = p_lega;
  else
    select array_agg(id order by created_at) into v_ordine from public.teams where league_id = p_lega;
  end if;

  if coalesce(array_length(v_ordine, 1), 0) < 2 then
    return query select 'asta_non_aperta'::public.esito_asta,
      'Servono almeno due squadre per fare un''asta.'; return;
  end if;

  update public.auctions
  set status = 'open', nomination_order = v_ordine, current_turn_index = 0, opened_at = now()
  where id = v_asta and status = 'draft';

  if not found then
    return query select 'asta_non_aperta'::public.esito_asta,
      'Questa asta è già stata aperta.'; return;
  end if;

  update public.leagues set status = 'auction' where id = p_lega;
  perform public.aggiorna_fase(v_asta);

  insert into public.auction_events (auction_id, type, payload, actor_user_id)
  values (v_asta, 'apertura',
          jsonb_build_object('ordine', to_jsonb(v_ordine), 'sorteggiato', p_sorteggia),
          (select auth.uid()));

  return query select 'ok'::public.esito_asta, 'Asta aperta. Si comincia.';
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Chiamata, ora con il vincolo del reparto
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.chiama_calciatore(
  p_lega uuid, p_player_id int, p_importo int
)
returns table (esito public.esito_asta, messaggio text, lotto uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_asta    public.auctions%rowtype;
  v_squadra uuid;
  v_budget  public.team_budget%rowtype;
  v_ruolo   public.ruolo_calciatore;
  v_min     int;
  v_lotto   uuid;
begin
  select * into v_asta from public.auctions where league_id = p_lega for update;
  if not found or v_asta.status <> 'open' then
    return query select 'asta_non_aperta'::public.esito_asta, 'L''asta non è aperta.', null::uuid; return;
  end if;

  if v_asta.method <> 'chiamata' then
    return query select 'metodo_non_disponibile'::public.esito_asta,
      'In questa asta i calciatori li estrae il server: non si chiama.', null::uuid; return;
  end if;

  select id into v_squadra from public.teams
  where league_id = p_lega and user_id = (select auth.uid());
  if v_squadra is null then
    return query select 'non_autorizzato'::public.esito_asta, 'Non hai una squadra in questa lega.', null::uuid; return;
  end if;

  if v_asta.nomination_order[v_asta.current_turn_index + 1] is distinct from v_squadra then
    return query select 'non_e_il_tuo_turno'::public.esito_asta, 'Non tocca a te chiamare.', null::uuid; return;
  end if;

  if exists (select 1 from public.auction_lots where auction_id = v_asta.id and status = 'open') then
    return query select 'lotto_chiuso'::public.esito_asta, 'C''è già un calciatore all''asta.', null::uuid; return;
  end if;

  if exists (select 1 from public.roster_players where league_id = p_lega and player_id = p_player_id) then
    return query select 'gia_acquistato'::public.esito_asta, 'Questo calciatore è già stato comprato.', null::uuid; return;
  end if;

  select role into v_ruolo from public.players where id = p_player_id;
  if v_ruolo is null then
    return query select 'gia_acquistato'::public.esito_asta, 'Questo calciatore non è nel listone.', null::uuid; return;
  end if;

  if v_asta.current_role_phase is not null and v_ruolo <> v_asta.current_role_phase then
    return query select 'reparto_chiuso'::public.esito_asta,
      format('Adesso si chiamano solo i %s.',
             case v_asta.current_role_phase
               when 'P' then 'portieri' when 'D' then 'difensori'
               when 'C' then 'centrocampisti' else 'attaccanti' end),
      null::uuid; return;
  end if;

  if public.slot_liberi_ruolo(v_squadra, v_ruolo) <= 0 then
    return query select 'ruolo_pieno'::public.esito_asta, 'Hai già completato questo reparto.', null::uuid; return;
  end if;

  select min_bid into v_min from public.leagues where id = p_lega;
  select * into v_budget from public.team_budget where team_id = v_squadra;

  if p_importo < v_min then
    return query select 'offerta_troppo_bassa'::public.esito_asta,
      format('L''offerta minima è %s.', v_min), null::uuid; return;
  end if;
  if p_importo > v_budget.massimo_offribile then
    return query select 'oltre_il_massimo'::public.esito_asta,
      format('Puoi arrivare al massimo a %s: devi tenere %s crediti per gli slot che ti restano.',
             v_budget.massimo_offribile, v_budget.credits_remaining - v_budget.massimo_offribile),
      null::uuid; return;
  end if;

  insert into public.auction_lots (auction_id, player_id, nominated_by_team_id,
                                   current_bid, current_bidder_team_id, last_bid_at)
  values (v_asta.id, p_player_id, v_squadra, p_importo, v_squadra, now())
  returning id into v_lotto;

  insert into public.bids (lot_id, team_id, amount) values (v_lotto, v_squadra, p_importo);
  insert into public.auction_events (auction_id, type, payload, actor_user_id)
  values (v_asta.id, 'chiamata',
          jsonb_build_object('lotto', v_lotto, 'calciatore', p_player_id,
                             'squadra', v_squadra, 'importo', p_importo),
          (select auth.uid()));

  return query select 'ok'::public.esito_asta, 'Chiamato.', v_lotto;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Metodi automatici: il server apre il prossimo lotto
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * Il prossimo calciatore da mettere all'asta.
 *
 * Esclude chi è già stato comprato e chi è già stato passato in questa asta.
 * Nelle varianti a reparti resta dentro il reparto aperto.
 *
 * Il filtro del bacino serve all'asta random: estrarre a caso fra cinquecento
 * calciatori, la maggior parte dei quali non interessa a nessuno, produce
 * decine di passaggi a vuoto. `quotazione_minima` restringe l'estrazione.
 *
 * NOTA DELIBERATA: era stato ipotizzato anche un filtro «solo i calciatori
 * presenti in almeno una lista obiettivi». È stato **scartato**: rivelerebbe,
 * estrazione dopo estrazione, chi sta in qualche lista e chi no. Le liste
 * obiettivi sono il dato più protetto del progetto e non si aggirano da una
 * porta di servizio.
 */
create or replace function public.prossimo_calciatore(p_asta uuid)
returns int language plpgsql security definer stable set search_path = '' as $$
declare
  v_asta    public.auctions%rowtype;
  v_min_qta int;
  v_id      int;
begin
  select * into v_asta from public.auctions where id = p_asta;
  v_min_qta := coalesce((v_asta.random_pool_filter ->> 'quotazione_minima')::int, 0);

  select p.id into v_id
  from public.players p
  where p.active
    and (v_asta.current_role_phase is null or p.role = v_asta.current_role_phase)
    and p.quotation >= case when v_asta.method = 'random' then v_min_qta else 0 end
    and not exists (select 1 from public.roster_players r
                    where r.league_id = v_asta.league_id and r.player_id = p.id)
    and not exists (select 1 from public.auction_lots l
                    where l.auction_id = p_asta and l.player_id = p.id
                      and l.status in ('awarded', 'passed'))
    -- Un calciatore che nessuna squadra potrebbe comprare non si mette
    -- all'asta: sarebbe un giro a vuoto garantito.
    and exists (select 1 from public.teams t
                where t.league_id = v_asta.league_id
                  and public.slot_liberi_ruolo(t.id, p.role) > 0)
  order by
    case when v_asta.method = 'random' then random() else 0 end,
    p.name
  limit 1;

  return v_id;
end;
$$;

create or replace function public.apri_prossimo_lotto(p_lega uuid)
returns table (esito public.esito_asta, messaggio text, lotto uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_asta      public.auctions%rowtype;
  v_calciatore int;
  v_lotto     uuid;
begin
  if not public.e_admin_lega(p_lega) then
    return query select 'non_autorizzato'::public.esito_asta,
      'Apre i lotti l''amministratore.', null::uuid; return;
  end if;

  select * into v_asta from public.auctions where league_id = p_lega for update;
  if v_asta.status <> 'open' then
    return query select 'asta_non_aperta'::public.esito_asta, 'L''asta non è aperta.', null::uuid; return;
  end if;
  if v_asta.method = 'chiamata' then
    return query select 'metodo_non_disponibile'::public.esito_asta,
      'In questa asta i calciatori li chiamano i partecipanti.', null::uuid; return;
  end if;
  if exists (select 1 from public.auction_lots where auction_id = v_asta.id and status = 'open') then
    return query select 'lotto_chiuso'::public.esito_asta, 'C''è già un calciatore all''asta.', null::uuid; return;
  end if;

  perform public.aggiorna_fase(v_asta.id);
  v_calciatore := public.prossimo_calciatore(v_asta.id);

  if v_calciatore is null then
    update public.auctions set status = 'closed', closed_at = now() where id = v_asta.id;
    update public.leagues set status = 'done' where id = p_lega;
    insert into public.auction_events (auction_id, type) values (v_asta.id, 'chiusura');
    return query select 'rosa_completa'::public.esito_asta,
      'Non c''è più nessuno da mettere all''asta.', null::uuid; return;
  end if;

  -- Nasce senza offerente: la prima offerta valida vale come apertura.
  insert into public.auction_lots (auction_id, player_id, current_bid, current_bidder_team_id, last_bid_at)
  values (v_asta.id, v_calciatore, 0, null, now())
  returning id into v_lotto;

  insert into public.auction_events (auction_id, type, payload, actor_user_id)
  values (v_asta.id, 'estrazione',
          jsonb_build_object('lotto', v_lotto, 'calciatore', v_calciatore, 'metodo', v_asta.method),
          (select auth.uid()));

  return query select 'ok'::public.esito_asta, 'Lotto aperto.', v_lotto;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rilancio, ora anche come prima offerta e con la modalità live
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.rilancia(p_lotto uuid, p_importo int)
returns table (esito public.esito_asta, messaggio text, offerta int)
language plpgsql security definer set search_path = '' as $$
declare
  v_lotto   public.auction_lots%rowtype;
  v_asta    public.auctions%rowtype;
  v_squadra uuid;
  v_budget  public.team_budget%rowtype;
  v_ruolo   public.ruolo_calciatore;
  v_min     int;
begin
  select * into v_lotto from public.auction_lots where id = p_lotto for update;
  if not found then
    return query select 'lotto_chiuso'::public.esito_asta, 'Questo lotto non esiste.', 0; return;
  end if;

  select * into v_asta from public.auctions where id = v_lotto.auction_id;

  if v_lotto.status <> 'open' then
    return query select 'lotto_chiuso'::public.esito_asta,
      'Il calciatore è stato appena assegnato.', v_lotto.current_bid; return;
  end if;
  if v_asta.status <> 'open' then
    return query select 'asta_non_aperta'::public.esito_asta, 'L''asta è in pausa.', v_lotto.current_bid; return;
  end if;

  -- In modalità live il tempo non conta: chiude l'amministratore.
  if v_asta.conduction = 'app'
     and now() >= v_lotto.last_bid_at
         + make_interval(secs => v_asta.inactivity_seconds + v_asta.countdown_seconds) then
    return query select 'lotto_chiuso'::public.esito_asta,
      'Tempo scaduto: il calciatore sta per essere assegnato.', v_lotto.current_bid; return;
  end if;

  select id into v_squadra from public.teams
  where league_id = v_asta.league_id and user_id = (select auth.uid());
  if v_squadra is null then
    return query select 'non_autorizzato'::public.esito_asta, 'Non hai una squadra in questa lega.', v_lotto.current_bid; return;
  end if;

  if v_asta.bid_type = 'con_passo'
     and exists (select 1 from public.lot_passes where lot_id = p_lotto and team_id = v_squadra) then
    return query select 'hai_passato'::public.esito_asta,
      'Hai passato su questo calciatore: non puoi più rilanciare.', v_lotto.current_bid; return;
  end if;

  select min_bid into v_min from public.leagues where id = v_asta.league_id;

  -- Lotto ancora senza offerente: vale l'offerta minima, non un rilancio.
  if v_lotto.current_bidder_team_id is null then
    if p_importo < v_min then
      return query select 'offerta_troppo_bassa'::public.esito_asta,
        format('L''offerta minima è %s.', v_min), v_lotto.current_bid; return;
    end if;
  elsif p_importo <= v_lotto.current_bid then
    return query select 'offerta_troppo_bassa'::public.esito_asta,
      format('Sei stato superato: ora siamo a %s. Rilancia?', v_lotto.current_bid),
      v_lotto.current_bid; return;
  end if;

  select role into v_ruolo from public.players where id = v_lotto.player_id;
  if public.slot_liberi_ruolo(v_squadra, v_ruolo) <= 0 then
    return query select 'ruolo_pieno'::public.esito_asta, 'Hai già completato questo reparto.', v_lotto.current_bid; return;
  end if;

  select * into v_budget from public.team_budget where team_id = v_squadra;
  if p_importo > v_budget.massimo_offribile then
    return query select 'oltre_il_massimo'::public.esito_asta,
      format('Puoi arrivare al massimo a %s: devi tenere %s crediti per gli slot che ti restano.',
             v_budget.massimo_offribile, v_budget.credits_remaining - v_budget.massimo_offribile),
      v_lotto.current_bid; return;
  end if;

  update public.auction_lots
  set current_bid = p_importo, current_bidder_team_id = v_squadra, last_bid_at = now()
  where id = p_lotto;

  insert into public.bids (lot_id, team_id, amount) values (p_lotto, v_squadra, p_importo);
  insert into public.auction_events (auction_id, type, payload, actor_user_id)
  values (v_asta.id, 'rilancio',
          jsonb_build_object('lotto', p_lotto, 'squadra', v_squadra, 'importo', p_importo),
          (select auth.uid()));

  return query select 'ok'::public.esito_asta, 'Offerta accettata.', p_importo;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Chiusura di un lotto: il pezzo condiviso
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * Chiude un lotto e ne trae le conseguenze. Non controlla i permessi né il
 * tempo: lo fanno le funzioni che la chiamano.
 *
 * Crediti e rosa cambiano nella STESSA transazione: separarli lascerebbe una
 * squadra col calciatore e senza lo scalo.
 */
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
end;
$$;

create or replace function public.chiudi_lotto_se_scaduto(p_lotto uuid)
returns table (esito public.esito_asta, messaggio text, squadra uuid, prezzo int)
language plpgsql security definer set search_path = '' as $$
declare
  v_lotto public.auction_lots%rowtype;
  v_asta  public.auctions%rowtype;
begin
  select * into v_lotto from public.auction_lots where id = p_lotto for update;
  if not found then
    return query select 'lotto_chiuso'::public.esito_asta, 'Lotto inesistente.', null::uuid, 0; return;
  end if;
  if v_lotto.status <> 'open' then
    return query select 'lotto_chiuso'::public.esito_asta, 'Già chiuso.',
      v_lotto.awarded_team_id, coalesce(v_lotto.final_price, 0); return;
  end if;

  select * into v_asta from public.auctions where id = v_lotto.auction_id;
  if v_asta.status <> 'open' then
    return query select 'asta_non_aperta'::public.esito_asta, 'L''asta è in pausa.', null::uuid, 0; return;
  end if;
  if v_asta.conduction <> 'app' then
    return query select 'non_ancora_scaduto'::public.esito_asta,
      'In modalità live chiude l''amministratore.', null::uuid, 0; return;
  end if;
  if now() < v_lotto.last_bid_at
      + make_interval(secs => v_asta.inactivity_seconds + v_asta.countdown_seconds) then
    return query select 'non_ancora_scaduto'::public.esito_asta, 'Il tempo non è ancora finito.', null::uuid, 0; return;
  end if;

  perform public.esegui_chiusura_lotto(
    p_lotto, v_lotto.current_bidder_team_id, v_lotto.current_bid, 'timer');

  if v_lotto.current_bidder_team_id is null then
    return query select 'ok'::public.esito_asta,
      'Nessuno lo voleva: passato.', null::uuid, 0;
  else
    return query select 'ok'::public.esito_asta, 'Aggiudicato.',
      v_lotto.current_bidder_team_id, v_lotto.current_bid;
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4e · La chiamata con passo
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * Dichiara passo su un lotto: irreversibile, come deve essere.
 *
 * Quando tutti quelli che potrebbero ancora comprarlo hanno passato tranne
 * uno, il lotto si chiude subito: aspettare il timer sarebbe solo tempo perso.
 */
create or replace function public.passa(p_lotto uuid)
returns table (esito public.esito_asta, messaggio text, chiuso boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_lotto     public.auction_lots%rowtype;
  v_asta      public.auctions%rowtype;
  v_squadra   uuid;
  v_ruolo     public.ruolo_calciatore;
  v_min       int;
  v_in_gioco  int;
begin
  select * into v_lotto from public.auction_lots where id = p_lotto for update;
  if not found or v_lotto.status <> 'open' then
    return query select 'lotto_chiuso'::public.esito_asta, 'Il lotto è già chiuso.', false; return;
  end if;

  select * into v_asta from public.auctions where id = v_lotto.auction_id;
  if v_asta.bid_type <> 'con_passo' then
    return query select 'metodo_non_disponibile'::public.esito_asta,
      'In questa asta la chiamata è libera: non si passa.', false; return;
  end if;
  if v_asta.status <> 'open' then
    return query select 'asta_non_aperta'::public.esito_asta, 'L''asta è in pausa.', false; return;
  end if;

  select id into v_squadra from public.teams
  where league_id = v_asta.league_id and user_id = (select auth.uid());
  if v_squadra is null then
    return query select 'non_autorizzato'::public.esito_asta, 'Non hai una squadra in questa lega.', false; return;
  end if;

  insert into public.lot_passes (lot_id, team_id) values (p_lotto, v_squadra)
  on conflict do nothing;

  insert into public.auction_events (auction_id, type, payload, actor_user_id)
  values (v_asta.id, 'passo', jsonb_build_object('lotto', p_lotto, 'squadra', v_squadra),
          (select auth.uid()));

  select role into v_ruolo from public.players where id = v_lotto.player_id;
  select min_bid into v_min from public.leagues where id = v_asta.league_id;

  -- Chi è ancora in gioco: ha slot per quel ruolo, crediti a sufficienza, e
  -- non ha passato.
  select count(*)::int into v_in_gioco
  from public.team_budget b
  where b.league_id = v_asta.league_id
    and public.slot_liberi_ruolo(b.team_id, v_ruolo) > 0
    and b.massimo_offribile >= greatest(v_min, v_lotto.current_bid + 1)
    and not exists (select 1 from public.lot_passes lp
                    where lp.lot_id = p_lotto and lp.team_id = b.team_id);

  if v_in_gioco <= 1 then
    select * into v_lotto from public.auction_lots where id = p_lotto;
    perform public.esegui_chiusura_lotto(
      p_lotto, v_lotto.current_bidder_team_id, v_lotto.current_bid, 'tutti_passati');
    return query select 'ok'::public.esito_asta,
      case when v_lotto.current_bidder_team_id is null
           then 'Hanno passato tutti: il calciatore è passato.'
           else 'Hanno passato tutti gli altri: aggiudicato.' end, true;
    return;
  end if;

  return query select 'ok'::public.esito_asta, 'Hai passato. Non potrai più rilanciare su di lui.', false;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4d · I poteri dell'amministratore
-- ═══════════════════════════════════════════════════════════════════════════

/** Chiude subito il lotto al prezzo corrente. Serve in modalità live e quando non si vuole aspettare. */
create or replace function public.aggiudica_ora(p_lotto uuid)
returns table (esito public.esito_asta, messaggio text)
language plpgsql security definer set search_path = '' as $$
declare
  v_lotto public.auction_lots%rowtype;
  v_asta  public.auctions%rowtype;
begin
  select * into v_lotto from public.auction_lots where id = p_lotto for update;
  if not found or v_lotto.status <> 'open' then
    return query select 'lotto_chiuso'::public.esito_asta, 'Il lotto è già chiuso.'; return;
  end if;
  select * into v_asta from public.auctions where id = v_lotto.auction_id;
  if not public.e_admin_lega(v_asta.league_id) then
    return query select 'non_autorizzato'::public.esito_asta, 'Solo l''amministratore può farlo.'; return;
  end if;
  if v_lotto.current_bidder_team_id is null then
    return query select 'offerta_troppo_bassa'::public.esito_asta,
      'Nessuno ha offerto: usa «passa il calciatore».'; return;
  end if;

  perform public.esegui_chiusura_lotto(
    p_lotto, v_lotto.current_bidder_team_id, v_lotto.current_bid, 'admin');
  return query select 'ok'::public.esito_asta, 'Aggiudicato.';
end;
$$;

/** Chiude il lotto senza aggiudicarlo: nessuno lo voleva. */
create or replace function public.passa_lotto(p_lotto uuid)
returns table (esito public.esito_asta, messaggio text)
language plpgsql security definer set search_path = '' as $$
declare
  v_lotto public.auction_lots%rowtype;
  v_asta  public.auctions%rowtype;
begin
  select * into v_lotto from public.auction_lots where id = p_lotto for update;
  if not found or v_lotto.status <> 'open' then
    return query select 'lotto_chiuso'::public.esito_asta, 'Il lotto è già chiuso.'; return;
  end if;
  select * into v_asta from public.auctions where id = v_lotto.auction_id;
  if not public.e_admin_lega(v_asta.league_id) then
    return query select 'non_autorizzato'::public.esito_asta, 'Solo l''amministratore può farlo.'; return;
  end if;
  if v_lotto.current_bidder_team_id is not null then
    return query select 'lotto_chiuso'::public.esito_asta,
      'C''è già un''offerta: non si può passare, semmai aggiudicare.'; return;
  end if;

  perform public.esegui_chiusura_lotto(p_lotto, null, 0, 'admin');
  return query select 'ok'::public.esito_asta, 'Calciatore passato.';
end;
$$;

/** Assegna un calciatore a una squadra senza fare l'asta: c'è un solo pretendente. */
create or replace function public.assegna_rapido(
  p_lega uuid, p_player_id int, p_squadra uuid, p_prezzo int
)
returns table (esito public.esito_asta, messaggio text)
language plpgsql security definer set search_path = '' as $$
declare
  v_asta   public.auctions%rowtype;
  v_budget public.team_budget%rowtype;
  v_ruolo  public.ruolo_calciatore;
  v_lotto  uuid;
begin
  if not public.e_admin_lega(p_lega) then
    return query select 'non_autorizzato'::public.esito_asta, 'Solo l''amministratore può farlo.'; return;
  end if;

  select * into v_asta from public.auctions where league_id = p_lega for update;
  if v_asta.status not in ('open', 'paused') then
    return query select 'asta_non_aperta'::public.esito_asta, 'L''asta non è aperta.'; return;
  end if;
  if exists (select 1 from public.auction_lots where auction_id = v_asta.id and status = 'open'
             and player_id <> p_player_id) then
    return query select 'lotto_chiuso'::public.esito_asta,
      'C''è un altro calciatore all''asta: chiudi quello prima.'; return;
  end if;
  if exists (select 1 from public.roster_players where league_id = p_lega and player_id = p_player_id) then
    return query select 'gia_acquistato'::public.esito_asta, 'Questo calciatore è già stato comprato.'; return;
  end if;

  select role into v_ruolo from public.players where id = p_player_id;
  if public.slot_liberi_ruolo(p_squadra, v_ruolo) <= 0 then
    return query select 'ruolo_pieno'::public.esito_asta, 'Quella squadra ha già il reparto pieno.'; return;
  end if;

  select * into v_budget from public.team_budget where team_id = p_squadra;
  if v_budget.league_id is distinct from p_lega then
    return query select 'non_autorizzato'::public.esito_asta, 'Quella squadra non è di questa lega.'; return;
  end if;
  -- Anche l'amministratore rispetta il massimo offribile: il potere di
  -- assegnare non è il potere di far barare.
  if p_prezzo > v_budget.massimo_offribile then
    return query select 'oltre_il_massimo'::public.esito_asta,
      format('Quella squadra può arrivare al massimo a %s.', v_budget.massimo_offribile); return;
  end if;

  select id into v_lotto from public.auction_lots
  where auction_id = v_asta.id and player_id = p_player_id and status = 'open';

  if v_lotto is null then
    insert into public.auction_lots (auction_id, player_id, current_bid, current_bidder_team_id, last_bid_at)
    values (v_asta.id, p_player_id, p_prezzo, p_squadra, now())
    returning id into v_lotto;
  end if;

  perform public.esegui_chiusura_lotto(v_lotto, p_squadra, p_prezzo, 'quick_assign');
  return query select 'ok'::public.esito_asta, 'Assegnato.';
end;
$$;

/** Annulla l'ultima aggiudicazione: errore di battitura, calciatore sbagliato. */
create or replace function public.annulla_ultima_aggiudicazione(p_lega uuid)
returns table (esito public.esito_asta, messaggio text)
language plpgsql security definer set search_path = '' as $$
declare
  v_asta  public.auctions%rowtype;
  v_lotto public.auction_lots%rowtype;
begin
  if not public.e_admin_lega(p_lega) then
    return query select 'non_autorizzato'::public.esito_asta, 'Solo l''amministratore può farlo.'; return;
  end if;
  select * into v_asta from public.auctions where league_id = p_lega for update;

  select * into v_lotto from public.auction_lots
  where auction_id = v_asta.id and status = 'awarded'
  order by closed_at desc limit 1;

  if not found then
    return query select 'lotto_chiuso'::public.esito_asta, 'Non c''è nessuna aggiudicazione da annullare.'; return;
  end if;

  -- Si restituiscono i crediti, si libera lo slot, il calciatore torna
  -- disponibile. Il registro conserva sia l'aggiudicazione sia l'annullamento:
  -- la storia non si riscrive, si allunga.
  update public.teams set credits_remaining = credits_remaining + v_lotto.final_price
  where id = v_lotto.awarded_team_id;

  delete from public.roster_players
  where league_id = p_lega and player_id = v_lotto.player_id;

  update public.auction_lots set status = 'cancelled' where id = v_lotto.id;

  -- Se l'asta si era chiusa perché le rose erano complete, si riapre.
  if v_asta.status = 'closed' then
    update public.auctions set status = 'open', closed_at = null where id = v_asta.id;
    update public.leagues set status = 'auction' where id = p_lega;
  end if;

  insert into public.auction_events (auction_id, type, payload, actor_user_id)
  values (v_asta.id, 'annullamento',
          jsonb_build_object('lotto', v_lotto.id, 'calciatore', v_lotto.player_id,
                             'squadra', v_lotto.awarded_team_id, 'prezzo', v_lotto.final_price),
          (select auth.uid()));

  perform public.avanza_turno(v_asta.id);
  return query select 'ok'::public.esito_asta, 'Aggiudicazione annullata.';
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- La rete di sicurezza: i lotti che nessuno ha segnalato
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * Chiude i lotti scaduti che nessuno ha chiesto di chiudere, per esempio
 * perché tutti hanno chiuso l'app.
 *
 * È la seconda gamba del meccanismo descritto in ADR-0005: la prima è la
 * richiesta del dispositivo che vede il countdown a zero, e rende la chiusura
 * istantanea per chi è al tavolo; questa evita che un lotto resti aperto per
 * sempre quando al tavolo non c'è più nessuno.
 */
create or replace function public.chiudi_lotti_scaduti()
returns int language plpgsql security definer set search_path = '' as $$
declare
  r      record;
  quanti int := 0;
begin
  for r in
    select l.id, l.current_bidder_team_id, l.current_bid
    from public.auction_lots l
    join public.auctions a on a.id = l.auction_id
    where l.status = 'open'
      and a.status = 'open'
      and a.conduction = 'app'
      and now() >= l.last_bid_at + make_interval(secs => a.inactivity_seconds + a.countdown_seconds)
  loop
    perform public.esegui_chiusura_lotto(
      r.id, r.current_bidder_team_id, r.current_bid, 'rete_di_sicurezza');
    quanti := quanti + 1;
  end loop;
  return quanti;
end;
$$;

revoke all on function public.chiudi_lotti_scaduti() from public, anon, authenticated;
