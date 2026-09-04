-- ═══════════════════════════════════════════════════════════════════════════
-- A reparto finito, il server dice due strade invece di una.
--
-- Quando il mazzo di un reparto si esaurisce, `apri_lotto_automatico`
-- rispondeva: «Cerca i calciatori per nome e mettili all'asta». Era l'unica
-- strada che esistesse, e il consiglio era giusto.
--
-- Adesso ce n'è una seconda — `nuovo_giro` rimette in ballo tutti gli
-- invenduti del reparto in un colpo solo — ed è quasi sempre quella buona:
-- cercare venti nomi a mano, uno per volta, con otto persone che aspettano,
-- non lo fa nessuno.
--
-- Un messaggio che consiglia la strada peggiore perché nessuno l'ha aggiornato
-- vale quanto un messaggio sbagliato: chi conduce legge quello, e fa quello.
--
-- Cambia anche una parola che era imprecisa: non è «il listone» a essere
-- finito, è **il reparto in corso**. Nella variante per ruolo restano ancora
-- tre reparti da giocare, e leggere «il listone è finito» a metà serata fa
-- pensare a un guasto.
--
-- La funzione si riscrive per intero. Ritoccarla partendo dal proprio testo
-- sarebbe stato più corto e sarebbe stato un trucco: una migrazione deve dire
-- cosa c'è dopo, non come ci si è arrivati.
-- ═══════════════════════════════════════════════════════════════════════════

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
    -- davvero piene, o è il mazzo a essere finito prima di loro?
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
