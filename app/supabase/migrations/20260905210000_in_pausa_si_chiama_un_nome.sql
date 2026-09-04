-- ═══════════════════════════════════════════════════════════════════════════
-- In pausa si può chiamare un nome preciso.
--
-- LA PAUSA E' IL MOMENTO IN CUI SI SISTEMANO LE COSE
--
-- `apri_lotto_scelto` pretendeva l'asta aperta. Ma la pausa non la si mette
-- per niente: la si mette **perché c'è qualcosa da sistemare**, e sistemarlo
-- vuol dire quasi sempre una di due cose — rimettere all'asta un nome preciso,
-- o assegnare un calciatore senza asta. La seconda era già ammessa in pausa
-- (`assegna_rapido` accetta `open` e `paused`); la prima no, senza una ragione
-- che qualcuno avesse scritto.
--
-- PERCHE' APRIRE UN LOTTO DURANTE UNA PAUSA E' SICURO
--
-- Sembra la trappola contro cui esiste la migrazione del cambio di reparto:
-- un calciatore all'asta mentre nessuno può rilanciare, con il countdown che
-- scorre. Non lo è, e per una riga scritta tempo fa in `pausa_asta`: alla
-- ripresa **il tempo dei lotti aperti riparte da zero**.
--
--     update public.auction_lots set last_bid_at = now()
--     where auction_id = v_asta.id and status = 'open';
--
-- Quindi il calciatore chiamato in pausa resta lì fermo quanto serve, e i
-- secondi cominciano a scendere quando la stanza è di nuovo pronta. È la
-- differenza fra chiamare a mano — un gesto di chi conduce, che sa cosa sta
-- facendo — ed estrarre in automatico, che resta vietato: la catena è ferma
-- proprio perché non deve andare avanti da sola.
-- ═══════════════════════════════════════════════════════════════════════════

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
  -- In pausa si può: alla ripresa il tempo dei lotti aperti riparte da zero.
  if v_asta.id is null or v_asta.status not in ('open', 'paused') then
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

  return query select 'ok'::public.esito_asta,
    case when v_asta.status = 'paused'
      then format('%s è all''asta: i secondi partono quando riprendi.', v_nome)
      else format('%s è all''asta.', v_nome)
    end,
    v_lotto;
end;
$$;
