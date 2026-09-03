-- ═══════════════════════════════════════════════════════════════════════════
-- 0028 · Una squadra può cambiare mano, ma solo dal server
--
-- IL DIFETTO
--
-- `blocca_modifica_crediti` vietava di cambiare `user_id` a **chiunque**,
-- server compreso: «Squadra non trasferibile». Era giusto quando è stata
-- scritta — nessuno deve poter prendersi la squadra di un altro dal browser —
-- e sbagliato adesso, perché `libera_squadra` e `affida_squadra` fanno
-- esattamente quello, e per una ragione legittima.
--
-- Il risultato era che `libera_squadra` sollevava un'eccezione, la transazione
-- si annullava per intero e la funzione restituiva un errore del database
-- invece di un esito. Nella schermata sarebbe comparso un messaggio
-- incomprensibile, e nessuno avrebbe capito che il divieto veniva da lì.
--
-- È la **quarta volta** che una difesa scritta senza distinguere chi sta
-- scrivendo blocca il server stesso: migrazioni 0007 (i crediti), 0008 (il
-- registro), 0017 (l'attore che si stacca), e adesso questa. La regola che
-- vale la pena scriversi da qualche parte: **una difesa che non guarda
-- `current_user` prima o poi impedisce a noi quello che voleva impedire a
-- loro.**
--
-- LA CORREZIONE
--
-- Il divieto resta identico per il client. Dal server la squadra può cambiare
-- mano, perché è l'unico posto dove esistono i controlli che rendono quel
-- passaggio legittimo: solo l'amministratore della lega, solo verso una
-- squadra libera, e con l'evento scritto nel registro che leggono tutti.
--
-- La lega invece non cambia mai: una squadra appartiene alla sua lega e basta,
-- e non c'è nessuna operazione che debba spostarla. Quel divieto resta per
-- tutti, server compreso, perché non serve a nessuno poterlo scavalcare.
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
  if current_user in ('authenticated', 'anon') then
    if new.credits_remaining is distinct from old.credits_remaining then
      raise exception 'I crediti li aggiorna solo il server.' using errcode = '42501';
    end if;
    -- Dal browser una squadra non cambia mai proprietario: sarebbe il modo
    -- più diretto di prendersi la rosa di un altro.
    if new.user_id is distinct from old.user_id then
      raise exception 'Una squadra non cambia mano da qui.' using errcode = '42501';
    end if;
  end if;

  -- Questo invece vale per tutti: una squadra appartiene alla sua lega, e
  -- nessuna operazione ha motivo di spostarla altrove.
  if new.league_id is distinct from old.league_id then
    raise exception 'Una squadra non si sposta di lega.' using errcode = '42501';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

comment on function public.blocca_modifica_crediti() is
  'Dal browser non si toccano crediti ne proprietario. Dal server la squadra puo cambiare mano, perche li ci sono i controlli che lo rendono legittimo: vedi le migrazioni 0007 e 0028.';
