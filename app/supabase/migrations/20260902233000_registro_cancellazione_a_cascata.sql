-- ═══════════════════════════════════════════════════════════════════════════
-- 0008 · Il registro resta immutabile, ma una lega si può cancellare
--
-- PERCHE' QUESTA MIGRAZIONE ESISTE
--
-- La migrazione 0006 rende il registro dell'asta a sola aggiunta con un
-- trigger che vieta modifiche e cancellazioni. Giusto come intenzione,
-- sbagliato come portata: vietava anche la cancellazione **a cascata**.
--
-- Cancellare una lega deve poter portare via tutto ciò che le appartiene,
-- asta ed eventi compresi. Con il trigger di prima, cancellare una lega
-- falliva con «Il registro dell'asta è a sola aggiunta», che è vero ma qui
-- non c'entra niente: nessuno stava riscrivendo la storia, si stava buttando
-- via una lega intera.
--
-- La correzione usa lo stesso criterio della migrazione 0007: si guarda **chi
-- sta scrivendo davvero**. Dal browser il registro resta intoccabile, sia in
-- modifica sia in cancellazione. Le operazioni amministrative e le cascate
-- passano.
--
-- Da ricordare: la difesa vera contro le cancellazioni dal client non è questo
-- trigger, sono le policy. Su `auction_events` non esiste nessuna policy di
-- modifica o cancellazione, quindi per un client quelle operazioni toccano
-- zero righe comunque. Il trigger è la seconda serratura, non l'unica.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.registro_immutabile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    raise exception 'Il registro dell''asta è a sola aggiunta.' using errcode = '42501';
  end if;
  -- Una modifica è sempre vietata, anche a chi amministra: il registro
  -- racconta com'è andata la serata e non si riscrive.
  if tg_op = 'UPDATE' then
    raise exception 'Il registro dell''asta non si modifica.' using errcode = '42501';
  end if;
  return old;
end;
$$;

comment on function public.registro_immutabile() is
  'Vieta la riscrittura del registro. Le cancellazioni a cascata di una lega restano possibili: vedi la migrazione 0008.';
