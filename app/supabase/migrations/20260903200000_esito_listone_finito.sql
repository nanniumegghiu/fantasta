-- ═══════════════════════════════════════════════════════════════════════════
-- 0018 · Un esito nuovo: il listone è finito, ma le rose no
--
-- Finora «non c'è più nessuno da estrarre» e «l'asta è finita» erano la stessa
-- risposta, `rosa_completa`. Sono due cose diverse, e confonderle costa caro:
-- quando il listone si esaurisce con le rose ancora incomplete, l'asta **non**
-- deve chiudersi, perché è proprio il momento in cui serve di più, per
-- riempire gli slot rimasti vuoti chiamando i nomi a mano.
--
-- Sta in una migrazione tutta sua perche' un valore aggiunto a un tipo
-- enumerato non si puo' usare nella stessa transazione in cui lo si aggiunge.
-- Le funzioni che lo useranno stanno nella 0019.
-- ═══════════════════════════════════════════════════════════════════════════

alter type public.esito_asta add value if not exists 'listone_finito';
