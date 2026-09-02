-- ═══════════════════════════════════════════════════════════════════════════
-- 0010 · La rete di sicurezza gira da sola
--
-- Seconda gamba del meccanismo di ADR-0005. La prima è la richiesta del
-- dispositivo che vede il countdown a zero: rende la chiusura istantanea per
-- chi è al tavolo. Questa evita che un lotto resti aperto per sempre quando al
-- tavolo non c'è più nessuno, perché tutti hanno chiuso l'app.
--
-- Dieci secondi sono un compromesso: abbastanza spesso da non lasciare un
-- lotto appeso, abbastanza raro da non pesare. Nel caso normale non fa niente,
-- perché il lotto è già stato chiuso dalla prima gamba.
--
-- La pianificazione sta qui e non in un pannello: la configurazione è un file
-- versionato, così ogni scelta è tracciata e l'ambiente si ricostruisce da zero.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;

-- `cron.schedule` con lo stesso nome sostituisce il compito esistente:
-- rilanciare questa migrazione non crea doppioni.
select cron.schedule(
  'fantasta-lotti-scaduti',
  '10 seconds',
  'select public.chiudi_lotti_scaduti();'
);
