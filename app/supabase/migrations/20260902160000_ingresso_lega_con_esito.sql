-- ═══════════════════════════════════════════════════════════════════════════
-- 0003 · L'ingresso in lega restituisce un esito, non solleva eccezioni
--
-- PERCHE' QUESTA MIGRAZIONE ESISTE
--
-- La versione precedente di `entra_in_lega` registrava il tentativo fallito e
-- poi sollevava un'eccezione. Non funzionava, e la prova automatica l'ha
-- scoperto: in PostgreSQL una funzione gira dentro una sola transazione, e
-- l'eccezione annulla tutto quello che la funzione ha fatto, **compresa la
-- registrazione del tentativo**. Il limite ai codici sbagliati quindi non
-- scattava mai: dopo dodici tentativi la tabella era ancora vuota.
--
-- La correzione non e' un trucco per far persistere la scrittura: e' cambiare
-- il modo di rispondere. Un codice sbagliato non e' un guasto del programma,
-- e' un esito previsto. Quindi la funzione restituisce un esito strutturato,
-- la transazione va a buon fine e il tentativo resta registrato.
--
-- Come effetto secondario l'interfaccia migliora: riceve un codice stabile che
-- puo' riconoscere, e un messaggio in italiano gia' pronto da mostrare, come
-- prescrive .claude/skills/contratto-dati/SKILL.md
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists public.entra_in_lega(text, text);

create type public.esito_ingresso as enum (
  'ok',
  'gia_dentro',
  'non_autenticato',
  'codice_non_valido',
  'asta_iniziata',
  'lega_piena',
  'nome_occupato',
  'troppi_tentativi'
);

create or replace function public.entra_in_lega(
  p_codice       text,
  p_nome_squadra text
)
returns table (esito public.esito_ingresso, messaggio text, lega uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utente  uuid := (select auth.uid());
  v_lega    public.leagues%rowtype;
  v_falliti int;
  v_quanti  int;
  v_codice  text := upper(btrim(coalesce(p_codice, '')));
  v_nome    text := btrim(coalesce(p_nome_squadra, ''));
begin
  if v_utente is null then
    return query select 'non_autenticato'::public.esito_ingresso,
                        'Devi aver fatto l''accesso.', null::uuid;
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
$$;

comment on function public.entra_in_lega(text, text) is
  'Restituisce un esito strutturato invece di sollevare eccezioni, cosi'' il tentativo resta registrato. Vedi la migrazione 0003.';
