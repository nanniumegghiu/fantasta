-- ═══════════════════════════════════════════════════════════════════════════
-- Fra un reparto e l'altro l'asta si ferma da sola.
--
-- PERCHE'
--
-- Il passaggio da un reparto al successivo e' il momento in cui la stanza ha
-- bisogno di parlare: si guarda quanto si e' speso, chi ha ancora crediti, si
-- va a prendere da bere. Finora l'asta non se ne accorgeva: chiuso l'ultimo
-- portiere, un secondo dopo era gia' in ballo un difensore, e chi stava
-- ricontando i propri crediti se lo trovava addosso.
--
-- Adesso al cambio di reparto l'asta va **in pausa**, e riparte quando chi
-- conduce lo dice. E' la stessa idea del fischio a fine tempo: non serve al
-- gioco, serve alle persone.
--
-- PERCHE' NON ALL'APERTURA
--
-- `aggiorna_fase` viene chiamata anche quando l'asta si apre, e li' il reparto
-- passa da «nessuno» a «portieri»: quello non e' un cambio, e' l'inizio. Si
-- mette in pausa **solo** quando si passa da un reparto a un altro, tutti e
-- due veri.
--
-- LA TRAPPOLA CHE QUESTA MIGRAZIONE DEVE EVITARE
--
-- `apri_lotto_automatico` chiama `aggiorna_fase` e poi apre il lotto. Se la
-- fase mette in pausa e la funzione tira dritto, si aprirebbe un calciatore
-- dentro un'asta in pausa: nessuno potrebbe rilanciare, il countdown
-- scorrerebbe lo stesso, e il primo difensore andrebbe a chi capita per un
-- credito. Quindi dopo `aggiorna_fase` lo stato si **rilegge**, e se e'
-- cambiato ci si ferma li'.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.aggiorna_fase(p_asta uuid)
returns public.ruolo_calciatore
language plpgsql security definer set search_path = '' as $$
declare
  v_asta   public.auctions%rowtype;
  v_ruolo  public.ruolo_calciatore;
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
      v_ruolo := 'P';
    else
      v_ruolo := null;
    end if;
  else
    -- Per ruolo: si scorre P, D, C, A e ci si ferma al primo ancora scoperto.
    v_ruolo := null;
    for i in 1..4 loop
      if exists (
        select 1 from public.teams t
        where t.league_id = v_asta.league_id
          and public.slot_liberi_ruolo(t.id, v_ordine[i]) > 0
      ) then
        v_ruolo := v_ordine[i];
        exit;
      end if;
    end loop;
  end if;

  -- ─── Il fischio di fine tempo ────────────────────────────────────────────
  -- Solo fra due reparti veri: dal nulla al primo non è un cambio, è l'inizio.
  -- E se il reparto nuovo non c'è più, il reparto è finito insieme all'asta:
  -- ci pensa chi chiude, non questa funzione.
  if v_asta.current_role_phase is not null
     and v_ruolo is not null
     and v_ruolo <> v_asta.current_role_phase
     and v_asta.status = 'open'
  then
    update public.auctions
    set current_role_phase = v_ruolo, status = 'paused'
    where id = p_asta;

    insert into public.auction_events (auction_id, type, payload)
    values (p_asta, 'cambio_reparto',
            jsonb_build_object('da', v_asta.current_role_phase::text, 'a', v_ruolo::text));

    return v_ruolo;
  end if;

  update public.auctions set current_role_phase = v_ruolo where id = p_asta;
  return v_ruolo;
end;
$$;

-- ─── Chi apre i lotti deve accorgersi della pausa ───────────────────────────

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

  -- Si rilegge: `aggiorna_fase` può aver messo in pausa al cambio di reparto,
  -- e aprire un calciatore dentro un'asta ferma vorrebbe dire regalarlo.
  select * into v_asta from public.auctions where id = p_asta;
  if v_asta.status <> 'open' then
    return query select 'asta_non_aperta'::public.esito_asta,
      format('Reparto finito: si passa a %s. L''asta è in pausa, riprendi quando siete pronti.',
             case v_asta.current_role_phase
               when 'P' then 'i portieri' when 'D' then 'i difensori'
               when 'C' then 'i centrocampisti' when 'A' then 'gli attaccanti'
               else 'il reparto successivo' end),
      null::uuid; return;
  end if;

  v_calciatore := public.prossimo_calciatore(p_asta);

  if v_calciatore is null then
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
      format(
        'Nessun altro da estrarre, e %s squadre hanno ancora slot vuoti. Puoi rifare un giro sugli invenduti del reparto, oppure cercare i calciatori per nome.',
        v_incompiute),
      null::uuid; return;
  end if;

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
