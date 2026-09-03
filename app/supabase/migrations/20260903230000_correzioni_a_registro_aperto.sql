-- ═══════════════════════════════════════════════════════════════════════════
-- 0020 · L'amministratore corregge, e ogni correzione si vede
--
-- PERCHE'
--
-- Un'asta fra amici dura tre ore e qualcosa va storto per forza: un prezzo
-- battuto male, un calciatore aggiudicato a chi non aveva rilanciato, un nome
-- omonimo. Finora si poteva solo annullare **l'ultima** aggiudicazione: se
-- l'errore era di due giri prima, non c'era niente da fare.
--
-- Servono due poteri in più: togliere un calciatore da qualunque rosa, e
-- correggere il prezzo di un acquisto già fatto.
--
-- IL PROBLEMA CHE CREANO, E COME LO RISOLVIAMO
--
-- Sono poteri che, in mano a chi conduce **e gioca**, possono cambiare il
-- risultato della serata. Parole dell'utente: «per la garanzia di genuinità
-- verranno salvate in un log di asta in cui saranno presenti tutte le azioni
-- manuali effettuate dall'amministratore scongiurando interventi maliziosi
-- volti a favorire o danneggiare qualcuno».
--
-- La risposta non è limitare il potere: chi conduce deve poter sistemare le
-- cose, altrimenti l'asta si blocca. La risposta è **renderlo visibile**. Tre
-- scelte, e nessuna delle tre è un dettaglio:
--
-- 1. **Il motivo è obbligatorio.** Non una casella facoltativa: senza motivo
--    la funzione rifiuta. Un registro di venti righe che dicono soltanto
--    «prezzo cambiato» non protegge nessuno; venti righe che dicono perché
--    sono una spiegazione che chi ha scritto deve poter difendere a voce.
--
-- 2. **Il registro lo leggono tutti**, non l'amministratore. Un controllo che
--    solo il controllato può vedere non è un controllo. `auction_events` era
--    già leggibile da tutti i partecipanti: qui si aggiunge la vista che lo
--    rende comprensibile, con i nomi al posto degli identificativi.
--
-- 3. **Non si può cancellare né riscrivere**, nemmeno dall'amministratore, e
--    nemmeno «per pulizia». Vale la migrazione 0008: il registro è a sola
--    aggiunta, e le uniche eccezioni sono la cascata di una lega cancellata e
--    il distacco dell'attore quando l'account sparisce.
--
-- QUELLO CHE UNA CORREZIONE DEVE SISTEMARE, OLTRE AL DATO
--
-- Togliere un calciatore da una rosa non è cancellare una riga: bisogna
-- restituire i crediti, liberare lo slot, e **rimettere il calciatore in
-- circolazione**. Quest'ultima è la parte che si dimentica: il motore esclude
-- dall'estrazione chi è già stato aggiudicato, quindi senza annullare anche il
-- lotto quel calciatore non riapparirebbe mai più.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Cos'è un intervento manuale ────────────────────────────────────────────
--
-- La definizione sta **in un posto solo**, e vale anche per gli eventi già
-- scritti. L'alternativa era una colonna da riempire a ogni inserimento, con
-- il rischio che qualcuno un giorno se ne dimenticasse e l'intervento
-- sparisse dal registro proprio nel caso in cui conta.

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
    -- Un'aggiudicazione è manuale quando non l'ha decisa il timer.
    when 'aggiudicazione'    then coalesce(p_payload ->> 'modo', '') in ('quick_assign', 'admin')
    -- Un passaggio è manuale quando l'ha deciso l'amministratore, non l'assenza di offerte.
    when 'passaggio'         then coalesce(p_payload ->> 'motivo', '') = 'admin'
    -- Un'estrazione è manuale quando il nome l'ha cercato lui.
    when 'estrazione'        then coalesce(p_payload ->> 'metodo', '') = 'riempimento'
    else false
  end;
$$;

comment on function public.evento_manuale(text, jsonb) is
  'Dice se un evento del registro è un intervento dell amministratore invece che una conseguenza del gioco. Definizione unica, valida anche sugli eventi già scritti.';

-- ─── Il registro leggibile ──────────────────────────────────────────────────
--
-- `security_invoker` perché le regole di accesso restano quelle di
-- `auction_events`: ogni partecipante vede il registro della propria lega, e
-- nient'altro.

create or replace view public.registro_asta
with (security_invoker = true) as
select
  e.seq,
  e.auction_id,
  a.league_id,
  e.type,
  e.payload,
  e.created_at,
  e.actor_user_id,
  pr.display_name                       as attore,
  public.evento_manuale(e.type, e.payload) as manuale,
  e.payload ->> 'motivo_admin'          as motivo,
  pl.name                               as calciatore,
  pl.role                               as ruolo,
  t.name                                as squadra
from public.auction_events e
join public.auctions a on a.id = e.auction_id
left join public.profiles pr on pr.id = e.actor_user_id
left join public.players  pl on pl.id = (e.payload ->> 'calciatore')::int
left join public.teams    t  on t.id  = (e.payload ->> 'squadra')::uuid;

comment on view public.registro_asta is
  'Il registro dell asta con i nomi al posto degli identificativi. Lo leggono tutti i partecipanti: un controllo che vede solo il controllato non è un controllo.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Togliere un calciatore da una rosa
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
  select name into v_nome from public.players where id = p_player_id;
  select name into v_squadra from public.teams where id = v_riga.team_id;

  update public.teams set credits_remaining = credits_remaining + v_riga.price
  where id = v_riga.team_id;

  delete from public.roster_players where id = v_riga.id;

  -- La parte che si dimentica: senza questo il calciatore resta escluso
  -- dall'estrazione per sempre, perché il motore salta chi è già aggiudicato.
  update public.auction_lots set status = 'cancelled'
  where auction_id = v_asta.id and player_id = p_player_id and status = 'awarded';

  -- Se l'asta si era chiusa perché le rose erano complete, adesso non lo sono più.
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

-- ═══════════════════════════════════════════════════════════════════════════
-- Correggere il prezzo di un acquisto
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * PERCHE' IL CONTROLLO SUI CREDITI E' DIVERSO DA QUELLO DI UN'OFFERTA
 *
 * Quando si rilancia, il vincolo è il **massimo offribile**: devi tenere da
 * parte l'offerta minima per ognuno degli slot che ti restano, meno quello che
 * stai comprando adesso. Qui la rosa non cambia: alzando il prezzo di un
 * calciatore già preso, gli slot rimasti restano gli stessi, e i crediti
 * devono bastare per tutti quelli.
 */
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

  select * into v_asta from public.auctions where league_id = p_lega for update;

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
