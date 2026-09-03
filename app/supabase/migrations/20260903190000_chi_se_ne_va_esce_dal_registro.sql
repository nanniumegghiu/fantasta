-- ═══════════════════════════════════════════════════════════════════════════
-- 0017 · Chi se ne va può andarsene, anche se ha fatto un'offerta
--
-- IL DIFETTO
--
-- Il registro dell'asta tiene `actor_user_id` con `on delete set null`: se
-- l'account sparisce, l'evento resta e perde il nome. È la scelta giusta, e
-- infatti era già scritta nello schema.
--
-- Solo che quel `set null` è una UPDATE, e il trigger che rende il registro
-- immutabile vieta **ogni** UPDATE, anche al server. Risultato: un account che
-- abbia fatto anche una sola offerta non si può più cancellare. Ci si prova, e
-- si prende «Il registro dell'asta non si modifica», che è vero ma parla
-- d'altro: nessuno stava riscrivendo la storia, si stava cancellando una
-- persona.
--
-- È la stessa forma di difetto delle migrazioni 0007 e 0008: una difesa
-- corretta come intenzione, troppo larga come portata, che finisce per
-- bloccare il server stesso. La terza volta, quindi vale la pena scriverlo
-- chiaro: **una difesa che non distingue chi sta scrivendo è una difesa
-- rotta.**
--
-- COME LO TROVIAMO
-- Non leggendo il codice. È saltato fuori provando gli attrezzi che servono a
-- fare un'asta da soli: cancellare i compagni finti falliva. Sarebbe successo
-- identico il giorno in cui qualcuno avesse voluto lasciare una lega vera.
--
-- LA CORREZIONE
--
-- La UPDATE resta vietata, con una sola eccezione descritta per quello che è:
-- l'anonimizzazione che accompagna la cancellazione di un account. Non «il
-- server può modificare»: **solo** portare a null un `actor_user_id` che
-- prima c'era, senza toccare nient'altro. Ogni altra riga cambiata, compreso
-- rimettere un nome dove non c'è più, resta un rifiuto.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.registro_immutabile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Dal browser il registro è intoccabile in tutti i modi, punto.
  if current_user in ('authenticated', 'anon') then
    raise exception 'Il registro dell''asta è a sola aggiunta.' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    -- Le cascate restano possibili: cancellare una lega porta via la sua
    -- storia. Vedi la migrazione 0008.
    return old;
  end if;

  -- Da qui in giù è una UPDATE, e ne esiste una sola legittima: il nome
  -- dell'attore che si stacca perché quell'account non esiste più.
  if old.actor_user_id is not null
     and new.actor_user_id is null
     and new.seq        is not distinct from old.seq
     and new.auction_id is not distinct from old.auction_id
     and new.type       is not distinct from old.type
     and new.payload    is not distinct from old.payload
     and new.created_at is not distinct from old.created_at
  then
    return new;
  end if;

  raise exception 'Il registro dell''asta non si modifica.' using errcode = '42501';
end;
$$;

comment on function public.registro_immutabile() is
  'Registro a sola aggiunta. Passano: le cancellazioni a cascata (migrazione 0008) e il distacco dell attore quando l account viene cancellato (migrazione 0017). Nient altro.';
