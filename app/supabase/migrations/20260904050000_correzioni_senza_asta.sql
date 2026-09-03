-- ═══════════════════════════════════════════════════════════════════════════
-- 0024 · Le correzioni non esplodono se l'asta non c'è
--
-- IL DIFETTO
--
-- `rimuovi_dalla_rosa` e `correggi_prezzo` scrivono nel registro dell'asta, e
-- per farlo prendono l'asta della lega. Se quella lega un'asta non ce l'ha, la
-- riga risulta nulla e l'inserimento nel registro fallisce su un vincolo,
-- sollevando un'eccezione: la transazione si annulla per intero e chi ha
-- chiamato riceve un errore del database invece di un esito.
--
-- E' la regola del progetto scritta in `docs/decisioni/eccezioni-e-transazioni`:
-- **un esito previsto si restituisce, non si solleva**. Qui era previsto
-- eccome, e veniva sollevato.
--
-- COME E' SALTATO FUORI
--
-- Non leggendo il codice, e nemmeno dalle prove delle correzioni: quelle
-- costruiscono sempre un'asta prima. L'ha trovato la verifica **degli
-- scambi**, che prepara le rose scrivendole direttamente e quindi lavora su
-- leghe senza asta. Una prova che passava e non avrebbe dovuto: la rimozione
-- falliva in silenzio e lo scambio andava a buon fine perche' il calciatore
-- era ancora dov'era.
--
-- IN PRATICA CAMBIA POCO, E VA CORRETTO LO STESSO
--
-- Nell'uso vero una rosa nasce solo dall'asta, quindi l'asta c'e' sempre. Ma
-- una funzione che risponde con un errore incomprensibile invece che con una
-- frase, in un caso che si puo' descrivere in una riga, e' una funzione che
-- prima o poi confonde qualcuno.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.rimuovi_dalla_rosa(
  p_lega uuid, p_player_id int, p_motivo text
)
returns table (esito public.esito_asta, messaggio text)
language plpgsql security definer set search_path = '' as $$
declare
  v_asta   public.auctions%rowtype;
  v_riga   public.roster_players%rowtype;
  v_nome   text;
  v_squadra text;
begin
  if not public.e_admin_lega(p_lega) then
    return query select 'non_autorizzato'::public.esito_asta,
      'Solo l''amministratore può correggere le rose.'; return;
  end if;

  if p_motivo is null or char_length(btrim(p_motivo)) < 3 then
    return query select 'non_autorizzato'::public.esito_asta,
      'Scrivi il motivo della correzione: finisce nel registro che vedono tutti.'; return;
  end if;

  select * into v_riga from public.roster_players
  where league_id = p_lega and player_id = p_player_id;
  if not found then
    return query select 'gia_acquistato'::public.esito_asta,
      'Questo calciatore non è nella rosa di nessuno.'; return;
  end if;

  select * into v_asta from public.auctions where league_id = p_lega for update;
  if v_asta.id is null then
    return query select 'asta_non_aperta'::public.esito_asta,
      'Questa lega non ha un''asta: non c''è niente da correggere qui.'; return;
  end if;

  select name into v_nome from public.players where id = p_player_id;
  select name into v_squadra from public.teams where id = v_riga.team_id;

  update public.teams set credits_remaining = credits_remaining + v_riga.price
  where id = v_riga.team_id;

  delete from public.roster_players where id = v_riga.id;

  -- Senza questo il calciatore resta escluso dall'estrazione per sempre,
  -- perché il motore salta chi è già aggiudicato.
  update public.auction_lots set status = 'cancelled'
  where auction_id = v_asta.id and player_id = p_player_id and status = 'awarded';

  if v_asta.status = 'closed' then
    update public.auctions set status = 'open', closed_at = null where id = v_asta.id;
    update public.leagues set status = 'auction' where id = p_lega;
  end if;

  insert into public.auction_events (auction_id, type, payload, actor_user_id)
  values (v_asta.id, 'rimozione',
          jsonb_build_object('calciatore', p_player_id, 'squadra', v_riga.team_id,
                             'prezzo', v_riga.price, 'motivo_admin', btrim(p_motivo)),
          (select auth.uid()));

  return query select 'ok'::public.esito_asta,
    format('%s tolto dalla rosa di %s: %s crediti restituiti.', v_nome, v_squadra, v_riga.price);
end;
$$;

create or replace function public.correggi_prezzo(
  p_lega uuid, p_player_id int, p_prezzo int, p_motivo text
)
returns table (esito public.esito_asta, messaggio text)
language plpgsql security definer set search_path = '' as $$
declare
  v_asta    public.auctions%rowtype;
  v_lega    public.leagues%rowtype;
  v_riga    public.roster_players%rowtype;
  v_budget  public.team_budget%rowtype;
  v_delta   int;
  v_nome    text;
  v_squadra text;
begin
  if not public.e_admin_lega(p_lega) then
    return query select 'non_autorizzato'::public.esito_asta,
      'Solo l''amministratore può correggere i prezzi.'; return;
  end if;

  if p_motivo is null or char_length(btrim(p_motivo)) < 3 then
    return query select 'non_autorizzato'::public.esito_asta,
      'Scrivi il motivo della correzione: finisce nel registro che vedono tutti.'; return;
  end if;

  if p_prezzo is null or p_prezzo < 0 then
    return query select 'offerta_troppo_bassa'::public.esito_asta,
      'Il prezzo non può essere negativo.'; return;
  end if;

  select * into v_riga from public.roster_players
  where league_id = p_lega and player_id = p_player_id;
  if not found then
    return query select 'gia_acquistato'::public.esito_asta,
      'Questo calciatore non è nella rosa di nessuno.'; return;
  end if;

  if p_prezzo = v_riga.price then
    return query select 'ok'::public.esito_asta, 'Il prezzo era già quello.'; return;
  end if;

  select * into v_asta from public.auctions where league_id = p_lega for update;
  if v_asta.id is null then
    return query select 'asta_non_aperta'::public.esito_asta,
      'Questa lega non ha un''asta: non c''è niente da correggere qui.'; return;
  end if;

  select * into v_lega from public.leagues where id = p_lega;
  select * into v_budget from public.team_budget where team_id = v_riga.team_id;
  select name into v_nome from public.players where id = p_player_id;
  select name into v_squadra from public.teams where id = v_riga.team_id;

  v_delta := p_prezzo - v_riga.price;

  if v_budget.credits_remaining - v_delta < v_budget.slot_rimanenti * v_lega.min_bid then
    return query select 'oltre_il_massimo'::public.esito_asta,
      format('%s non ci arriva: ha %s crediti e deve tenerne %s per i %s slot che le restano.',
             v_squadra, v_budget.credits_remaining,
             v_budget.slot_rimanenti * v_lega.min_bid, v_budget.slot_rimanenti); return;
  end if;

  update public.roster_players set price = p_prezzo where id = v_riga.id;
  update public.teams set credits_remaining = credits_remaining - v_delta
  where id = v_riga.team_id;

  insert into public.auction_events (auction_id, type, payload, actor_user_id)
  values (v_asta.id, 'correzione_prezzo',
          jsonb_build_object('calciatore', p_player_id, 'squadra', v_riga.team_id,
                             'prezzo_prima', v_riga.price, 'prezzo', p_prezzo,
                             'motivo_admin', btrim(p_motivo)),
          (select auth.uid()));

  return query select 'ok'::public.esito_asta,
    format('%s: da %s a %s crediti nella rosa di %s.', v_nome, v_riga.price, p_prezzo, v_squadra);
end;
$$;
