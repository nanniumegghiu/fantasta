-- ═══════════════════════════════════════════════════════════════════════════
-- 0007 · Il guardiano dei crediti deve riconoscere il server
--
-- PERCHE' QUESTA MIGRAZIONE ESISTE
--
-- La migrazione 0002 protegge i crediti con un trigger: nessun client può
-- modificarli, li scrive solo il server. Il controllo guardava però la
-- variabile di sessione `role`, e lì stava l'errore.
--
-- Quando l'applicazione chiama una funzione del database, il servizio imposta
-- `role = authenticated` per tutta la transazione. Una funzione dichiarata
-- SECURITY DEFINER cambia l'**utente effettivo**, ma non quella variabile: che
-- resta `authenticated` anche mentre gira il codice del server.
--
-- Risultato: al momento dell'aggiudicazione, il motore d'asta tentava di
-- scalare i crediti e **veniva bloccato dalla propria difesa**. L'eccezione
-- annullava l'intera transazione, quindi il lotto restava aperto e nessuno
-- capiva perché.
--
-- La correzione guarda **chi sta scrivendo davvero**, non una variabile di
-- sessione. Una scrittura diretta dal browser arriva come utente
-- `authenticated` o `anon`; il codice del server arriva come proprietario
-- delle funzioni. La protezione resta identica per il client, e il server
-- smette di essere respinto da se stesso.
--
-- Trovato dalla prova automatica della Fetta 4a, non leggendo il codice.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.blocca_modifica_crediti()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- `current_user` è l'utente effettivo: dentro una funzione SECURITY DEFINER
  -- diventa il proprietario, mentre una richiesta diretta dal browser resta
  -- `authenticated` o `anon`. È la distinzione che serve.
  if current_user in ('authenticated', 'anon')
     and new.credits_remaining is distinct from old.credits_remaining then
    raise exception 'I crediti li aggiorna solo il server.' using errcode = '42501';
  end if;

  if new.league_id is distinct from old.league_id
     or new.user_id is distinct from old.user_id then
    raise exception 'Squadra non trasferibile.' using errcode = '42501';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

comment on function public.blocca_modifica_crediti() is
  'I crediti li scrive solo il server. Guarda current_user, non la variabile di sessione role: vedi la migrazione 0007.';
