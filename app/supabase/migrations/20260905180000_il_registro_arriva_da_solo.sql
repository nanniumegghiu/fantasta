-- ═══════════════════════════════════════════════════════════════════════════
-- Il registro dell'asta arriva da solo, come tutto il resto.
--
-- Il client si iscrive da sempre a sei tabelle, ma nella pubblicazione del
-- tempo reale ce n'erano cinque: `auction_events` non c'era. L'iscrizione non
-- dava errore — il canale risultava collegato, il pallino verde — e
-- semplicemente da quella tabella non arrivava mai niente.
--
-- Conseguenza: le correzioni dell'amministratore comparivano nel registro solo
-- a chi ricaricava la pagina. E il registro esiste **proprio** perche' tutti
-- vedano quelle correzioni mentre succedono: una garanzia che si vede solo
-- ricaricando non e' una garanzia.
--
-- Il caso peggiore e' quello silenzioso: non un errore, ma una tabella in meno
-- in un elenco, in un posto diverso da quello dove si legge il codice che la
-- usa.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'auction_events'
  ) then
    alter publication supabase_realtime add table public.auction_events;
  end if;
end $$;
