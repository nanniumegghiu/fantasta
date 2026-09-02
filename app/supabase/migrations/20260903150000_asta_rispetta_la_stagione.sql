-- ═══════════════════════════════════════════════════════════════════════════
-- 0015 · L'asta pesca solo dal listone della stagione della lega
--
-- PERCHE' CAMBIA
--
-- Il motore d'asta guardava soltanto se un calciatore era «in listone»,
-- senza chiedersi di quale stagione. Finché nel database c'è un listone solo
-- la differenza non si vede; appena ne convivono due, una lega del 2026/27
-- può mettere all'asta un calciatore rimasto dal 2025/26.
--
-- L'importazione ritira i calciatori mancanti **della stagione che si sta
-- caricando**, e questo è giusto: caricare il listone nuovo non deve
-- cancellare la storia di quello vecchio. Ma allora il filtro sulla stagione
-- deve stare da questa parte, in chi legge.
--
-- Ogni lega dichiara la sua stagione quando viene creata: si usa quella.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.prossimo_calciatore(p_asta uuid)
returns int
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_asta     public.auctions%rowtype;
  v_stagione text;
  v_min_qta  int;
  v_id       int;
begin
  select * into v_asta from public.auctions where id = p_asta;
  select season into v_stagione from public.leagues where id = v_asta.league_id;
  v_min_qta := coalesce((v_asta.random_pool_filter ->> 'quotazione_minima')::int, 0);

  select p.id into v_id
  from public.players p
  where p.active
    and p.season = v_stagione
    and (v_asta.current_role_phase is null or p.role = v_asta.current_role_phase)
    and p.quotation >= case when v_asta.method = 'random' then v_min_qta else 0 end
    and not exists (select 1 from public.roster_players r
                    where r.league_id = v_asta.league_id and r.player_id = p.id)
    and not exists (select 1 from public.auction_lots l
                    where l.auction_id = p_asta and l.player_id = p.id
                      and l.status in ('awarded', 'passed'))
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

create or replace function public.chiama_calciatore(
  p_lega uuid, p_player_id int, p_importo int
)
returns table (esito public.esito_asta, messaggio text, lotto uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_asta     public.auctions%rowtype;
  v_lega     public.leagues%rowtype;
  v_squadra  uuid;
  v_budget   public.team_budget%rowtype;
  v_ruolo    public.ruolo_calciatore;
  v_stagione text;
  v_lotto    uuid;
begin
  select * into v_asta from public.auctions where league_id = p_lega for update;
  if not found or v_asta.status <> 'open' then
    return query select 'asta_non_aperta'::public.esito_asta, 'L''asta non è aperta.', null::uuid; return;
  end if;

  if v_asta.method <> 'chiamata' then
    return query select 'metodo_non_disponibile'::public.esito_asta,
      'In questa asta i calciatori li estrae il server: non si chiama.', null::uuid; return;
  end if;

  select * into v_lega from public.leagues where id = p_lega;

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

  select role, season into v_ruolo, v_stagione
  from public.players where id = p_player_id and active;

  if v_ruolo is null then
    return query select 'gia_acquistato'::public.esito_asta, 'Questo calciatore non è nel listone.', null::uuid; return;
  end if;

  -- Il messaggio nomina tutte e due le stagioni: se un giorno non
  -- combaciassero, chi legge deve capire subito qual è il disallineamento
  -- invece di trovarsi un rifiuto senza spiegazione.
  if v_stagione is distinct from v_lega.season then
    return query select 'gia_acquistato'::public.esito_asta,
      format('Questo calciatore è del listone %s, ma la lega è della stagione %s.',
             v_stagione, v_lega.season),
      null::uuid; return;
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

  select * into v_budget from public.team_budget where team_id = v_squadra;

  if p_importo < v_lega.min_bid then
    return query select 'offerta_troppo_bassa'::public.esito_asta,
      format('L''offerta minima è %s.', v_lega.min_bid), null::uuid; return;
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
