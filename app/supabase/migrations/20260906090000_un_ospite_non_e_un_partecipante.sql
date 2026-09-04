-- ═══════════════════════════════════════════════════════════════════════════
-- Un ospite non è un partecipante.
--
-- IL DIFETTO, RACCONTATO COM'È SUCCESSO
--
-- Per il televisore serviva che una pagina senza accesso potesse **firmare gli
-- indirizzi delle immagini**, e per questo è stato acceso l'accesso anonimo di
-- Supabase. La pagina della TV lo usa, e sembrava confinato lì.
--
-- Non lo era. Un utente anonimo, per Supabase, ha il ruolo `authenticated`
-- come tutti gli altri: cambia solo una voce dentro il gettone,
-- `is_anonymous`. E la sessione anonima resta salvata nel browser, nello
-- stesso posto di tutte le altre. Chi aveva aperto una volta il link della TV
-- si ritrovava «dentro» l'applicazione per sempre — e aprendo un invito
-- entrava in lega **creando una squadra senza account**: senza email, senza
-- nome, senza modo di sapere di chi fosse.
--
-- È successo davvero: nella lega vera c'era una squadra di nessuno.
--
-- PERCHE' LA DIFESA STA QUI E NON SOLO NELL'INTERFACCIA
--
-- Il client adesso tratta una sessione anonima come «non sei entrato», ed è
-- giusto che lo faccia — ma è la parte che si può aggirare. Chi arriva con un
-- gettone anonimo e chiama la funzione direttamente deve trovare la porta
-- chiusa **qui**, dove nessuna schermata può contraddirla.
--
-- QUELLO CHE UN OSPITE CONTINUA A POTER FARE
--
-- Esattamente una cosa: guardare lo schermo condiviso con il codice della TV,
-- e firmare le immagini che quella schermata mostra. È tutto quello per cui
-- l'accesso anonimo è stato acceso, ed è tutto quello che serve.
--
-- Le due funzioni qui sotto sono **identiche a prima**, con in più il
-- controllo: sono ricopiate per intero perché una migrazione deve dire cosa
-- c'è dopo, non una toppa che va letta insieme a quello che c'era.
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * Vero se chi sta chiamando è entrato senza account.
 *
 * Si legge dal gettone e non dalla tabella degli utenti: il gettone è quello
 * che il chiamante ha davvero in mano, ed è la stessa cosa che guarda Supabase.
 */
create or replace function public.e_ospite()
returns boolean language sql stable set search_path = '' as $ospite$
  select coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false);
$ospite$;

comment on function public.e_ospite() is
  'Vero per le sessioni anonime: servono solo allo schermo della TV.';

grant execute on function public.e_ospite() to authenticated, anon;

CREATE OR REPLACE FUNCTION public.entra_in_lega(p_codice text, p_nome_squadra text)
 RETURNS TABLE(esito esito_ingresso, messaggio text, lega uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_utente  uuid := (select auth.uid());
  v_lega    public.leagues%rowtype;
  v_falliti int;
  v_quanti  int;
  v_codice  text := upper(btrim(coalesce(p_codice, '')));
  v_nome    text := btrim(coalesce(p_nome_squadra, ''));
begin
  -- Un ospite del televisore non entra in lega: non avrebbe un'email, e la
  -- sua squadra sarebbe di nessuno.
  if v_utente is null or public.e_ospite() then
    return query select 'non_autenticato'::public.esito_ingresso,
                        'Devi aver fatto l''accesso con la tua email.', null::uuid;
    return;
  end if;

  select count(*) into v_falliti
  from public.invite_attempts a
  where a.user_id = v_utente
    and a.succeeded = false
    and a.tried_at > now() - interval '10 minutes';

  if v_falliti >= 10 then
    return query select 'troppi_tentativi'::public.esito_ingresso,
                        'Troppi codici sbagliati. Riprova fra dieci minuti.', null::uuid;
    return;
  end if;

  select * into v_lega from public.leagues l where l.invite_code = v_codice;

  if not found or not v_lega.invite_active then
    insert into public.invite_attempts (user_id, code_tried, succeeded)
    values (v_utente, v_codice, false);
    return query select 'codice_non_valido'::public.esito_ingresso,
                        'Codice non valido. Controlla le lettere e riprova.', null::uuid;
    return;
  end if;

  -- Chi e' gia' dentro non e' un errore: lo si riporta nella sua lega.
  if exists (select 1 from public.league_members m
             where m.league_id = v_lega.id and m.user_id = v_utente) then
    insert into public.invite_attempts (user_id, code_tried, succeeded)
    values (v_utente, v_codice, true);
    return query select 'gia_dentro'::public.esito_ingresso,
                        'Sei già in questa lega.', v_lega.id;
    return;
  end if;

  if v_lega.status <> 'setup' then
    insert into public.invite_attempts (user_id, code_tried, succeeded)
    values (v_utente, v_codice, false);
    return query select 'asta_iniziata'::public.esito_ingresso,
                        'L''asta di questa lega è già cominciata: non si entra più.', null::uuid;
    return;
  end if;

  select count(*) into v_quanti
  from public.league_members m where m.league_id = v_lega.id;

  if v_quanti >= v_lega.max_members then
    insert into public.invite_attempts (user_id, code_tried, succeeded)
    values (v_utente, v_codice, false);
    return query select 'lega_piena'::public.esito_ingresso,
                        format('Questa lega è al completo: %s partecipanti su %s.',
                               v_quanti, v_lega.max_members), null::uuid;
    return;
  end if;

  if char_length(v_nome) < 2 or char_length(v_nome) > 40 then
    return query select 'nome_occupato'::public.esito_ingresso,
                        'Il nome della squadra deve avere fra 2 e 40 caratteri.', null::uuid;
    return;
  end if;

  if exists (select 1 from public.teams t
             where t.league_id = v_lega.id and lower(t.name) = lower(v_nome)) then
    -- Il codice era giusto: non conta come tentativo fallito.
    return query select 'nome_occupato'::public.esito_ingresso,
                        'In questa lega c''è già una squadra con questo nome. Scegline un altro.',
                        null::uuid;
    return;
  end if;

  insert into public.league_members (league_id, user_id, role)
  values (v_lega.id, v_utente, 'member');

  insert into public.teams (league_id, user_id, name, credits_remaining)
  values (v_lega.id, v_utente, v_nome, v_lega.credits_initial);

  insert into public.invite_attempts (user_id, code_tried, succeeded)
  values (v_utente, v_codice, true);

  return query select 'ok'::public.esito_ingresso,
                      format('Sei dentro. Benvenuto in %s.', v_lega.name), v_lega.id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.crea_lega(p_nome text, p_stagione text, p_nome_squadra text, p_crediti integer DEFAULT 500, p_slot_p integer DEFAULT 3, p_slot_d integer DEFAULT 8, p_slot_c integer DEFAULT 8, p_slot_a integer DEFAULT 6, p_offerta_minima integer DEFAULT 1, p_scambi boolean DEFAULT false, p_scambi_crediti boolean DEFAULT false, p_max_partecipanti integer DEFAULT 10)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_utente uuid := (select auth.uid());
  v_lega   uuid;
begin
  if v_utente is null then
    raise exception 'Devi aver fatto l''accesso.' using errcode = '42501';
  end if;
  -- Una lega non può essere di nessuno: chi la fonda ne è l'amministratore per
  -- tutta la serata, e deve avere un nome e un'email.
  if public.e_ospite() then
    raise exception 'Serve un account con la tua email: una lega non può essere di nessuno.'
      using errcode = '42501';
  end if;

  -- La rosa deve stare nel budget: con l'offerta minima per ogni slot, il
  -- budget deve bastare. Altrimenti la lega nasce gia' impossibile.
  if p_crediti < (p_slot_p + p_slot_d + p_slot_c + p_slot_a) * p_offerta_minima then
    raise exception 'I crediti non bastano nemmeno a pagare l''offerta minima per ogni slot.'
      using errcode = '22023';
  end if;

  insert into public.leagues (
    name, season, admin_user_id, invite_code,
    credits_initial, slots_p, slots_d, slots_c, slots_a, min_bid,
    trades_enabled, trades_with_credits_enabled, max_members
  ) values (
    btrim(p_nome), btrim(p_stagione), v_utente, public.genera_codice_invito(),
    p_crediti, p_slot_p, p_slot_d, p_slot_c, p_slot_a, p_offerta_minima,
    p_scambi, p_scambi and p_scambi_crediti, p_max_partecipanti
  )
  returning id into v_lega;

  insert into public.league_members (league_id, user_id, role)
  values (v_lega, v_utente, 'admin');

  insert into public.teams (league_id, user_id, name, credits_remaining)
  values (v_lega, v_utente, btrim(p_nome_squadra), p_crediti);

  return v_lega;
end;
$function$
;
