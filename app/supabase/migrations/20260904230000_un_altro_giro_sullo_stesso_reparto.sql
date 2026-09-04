-- ═══════════════════════════════════════════════════════════════════════════
-- Un altro giro sullo stesso reparto.
--
-- IL PROBLEMA, VISTO IN UN'ASTA VERA
--
-- Nei metodi a estrazione ogni calciatore viene proposto **una volta sola**:
-- `prossimo_calciatore` scarta chi ha gia' un lotto `awarded` o `passed`. E'
-- giusto per il primo giro — altrimenti la stessa faccia tornerebbe ogni due
-- minuti — ma quando il reparto finisce la situazione tipica non e' «tutti
-- hanno la rosa piena»: e' «restano tre portieri da prendere e cinquanta
-- portieri che nessuno ha voluto a un credito, mezz'ora fa, quando i soldi
-- erano tanti e le idee altre».
--
-- Finora l'unica via era chiamarli per nome uno per uno. Funziona per due o
-- tre buchi, non per venti: e chi conduce si ritrova a leggere ad alta voce
-- un listone.
--
-- LA SCELTA: RIMETTERLI NEL MAZZO, NON RIAPRIRE I LOTTI
--
-- Si potrebbe cancellare i lotti passati. Non si fa: quei lotti sono successi,
-- e il registro dell'asta e' a sola aggiunta per una ragione che vale piu'
-- della pulizia. Si usa invece lo stato `cancelled`, che esiste gia' e che
-- `prossimo_calciatore` non guarda: il lotto resta li' a dire «questo giro e'
-- andato deserto», e il calciatore torna disponibile.
--
-- Serve **una scelta esplicita di chi conduce**, non un automatismo: un
-- secondo giro che parte da solo vorrebbe dire un'asta che non finisce mai, e
-- toglierebbe a chi conduce l'unico momento in cui puo' dire «ragazzi, ne
-- restano quattro e vi mancano sei posti».
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.nuovo_giro(p_lega uuid)
returns table (esito public.esito_asta, messaggio text, rimessi int)
language plpgsql security definer set search_path = '' as $$
declare
  v_asta    public.auctions%rowtype;
  v_quanti  int;
  v_reparto text;
begin
  if not public.e_admin_lega(p_lega) then
    return query select 'non_autorizzato'::public.esito_asta,
      'Un nuovo giro lo apre chi conduce l''asta.', 0; return;
  end if;

  select * into v_asta from public.auctions where league_id = p_lega for update;
  if v_asta.id is null or v_asta.status <> 'open' then
    return query select 'asta_non_aperta'::public.esito_asta,
      'L''asta non è aperta.', 0; return;
  end if;

  -- Con un calciatore ancora all'asta non si rimescola niente: si finirebbe
  -- per rimettere nel mazzo mentre qualcuno sta rilanciando.
  if exists (select 1 from public.auction_lots
             where auction_id = v_asta.id and status = 'open') then
    return query select 'lotto_chiuso'::public.esito_asta,
      'C''è un calciatore all''asta: aspetta che si chiuda.', 0; return;
  end if;

  -- Solo il reparto in corso. Nella variante totale non ci sono reparti e si
  -- rimette dentro tutto quello che era andato deserto.
  update public.auction_lots l
  set status = 'cancelled'
  where l.auction_id = v_asta.id
    and l.status = 'passed'
    and exists (
      select 1 from public.players p
      where p.id = l.player_id
        and (v_asta.current_role_phase is null or p.role = v_asta.current_role_phase)
        -- Chi nel frattempo e' finito in una rosa non torna nel mazzo.
        and not exists (select 1 from public.roster_players r
                        where r.league_id = p_lega and r.player_id = p.id)
        -- E nemmeno chi gioca in un reparto che ormai e' pieno per tutti.
        and exists (select 1 from public.teams t
                    where t.league_id = p_lega
                      and public.slot_liberi_ruolo(t.id, p.role) > 0)
    );
  get diagnostics v_quanti = row_count;

  if v_quanti = 0 then
    return query select 'listone_finito'::public.esito_asta,
      'Non c''è nessuno da rimettere nel mazzo: sono già stati presi tutti.', 0; return;
  end if;

  v_reparto := coalesce(v_asta.current_role_phase::text, 'tutti i reparti');

  insert into public.auction_events (auction_id, type, payload, actor_user_id)
  values (v_asta.id, 'nuovo_giro',
          jsonb_build_object('reparto', v_reparto, 'rimessi', v_quanti),
          (select auth.uid()));

  return query select 'ok'::public.esito_asta,
    format('%s calciatori rimessi nel mazzo. Si ricomincia.', v_quanti), v_quanti;
end;
$$;

comment on function public.nuovo_giro(uuid) is
  'Rimette all''asta i calciatori del reparto in corso rimasti invenduti, e lo scrive nel registro.';

revoke all on function public.nuovo_giro(uuid) from public;
grant execute on function public.nuovo_giro(uuid) to authenticated;

-- ─── Chi rimescola il mazzo lo dichiara a tutti ────────────────────────────
--
-- Rimettere all'asta i calciatori invenduti e' una scelta di chi conduce, e
-- cambia le carte in tavola per tutti: chi aveva rinunciato a un portiere per
-- tenersi i crediti si ritrova quel portiere di nuovo in ballo. Quindi non e'
-- gioco normale, e' un intervento — e finisce nell'elenco che si apre per
-- primo nel registro, insieme alle correzioni.

create or replace function public.evento_manuale(p_tipo text, p_payload jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select case p_tipo
    when 'annullamento'      then true
    when 'rimozione'         then true
    when 'correzione_prezzo' then true
    when 'pausa'             then true
    when 'ripresa'           then true
    when 'riapertura'        then true
    when 'partecipante_via'  then true
    when 'squadra_affidata'  then true
    when 'nuovo_giro'        then true
    when 'aggiudicazione'    then coalesce(p_payload ->> 'modo', '') in ('quick_assign', 'admin')
    when 'passaggio'         then coalesce(p_payload ->> 'motivo', '') = 'admin'
    when 'estrazione'        then coalesce(p_payload ->> 'metodo', '') = 'riempimento'
    else false
  end;
$$;
