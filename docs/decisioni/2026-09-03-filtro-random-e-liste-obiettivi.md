# Registro · Il filtro dell'asta random che abbiamo scartato

**Data** · 2026-09-03 · **Chi** · backend-engineer, con il security-officer
**Dove** · `prossimo_calciatore`, migrazione 0009 · decisione D9

---

## Il problema

Nell'asta random il server estrae a sorte chi mettere all'asta. Sul listone intero, oltre
cinquecento nomi di cui la maggior parte non interessa a nessuno, l'estrazione produce decine di
passaggi a vuoto: si estrae, nessuno offre, si passa, si estrae di nuovo. L'asta si allunga senza
che succeda niente.

Serviva un modo per restringere il bacino.

## Le due strade

**Filtrare per quotazione.** L'amministratore fissa una soglia e si estrae solo sopra quella. È
quello che abbiamo fatto.

**Estrarre solo fra i calciatori presenti in almeno una lista obiettivi.** Era l'idea più elegante:
il bacino si restringe esattamente ai nomi che a qualcuno interessano davvero, senza che nessuno
debba scegliere una soglia arbitraria.

## Perché la seconda è stata scartata

Perché avrebbe aperto una porta di servizio sul dato più protetto del progetto.

Nessuno vedrebbe mai una lista altrui. Ma estrazione dopo estrazione, chi guarda impara una cosa
che non dovrebbe sapere: **che quel calciatore sta nella lista di qualcuno**. E per esclusione, che
tutti i nomi mai estratti non stanno nella lista di nessuno. In una lega da dieci persone, dopo
qualche decina di estrazioni, è informazione utilizzabile.

La regola 3 del progetto dice che la lista obiettivi è privata. Una fuga di informazione indiretta
resta una fuga: non si aggira una regola perché il modo di aggirarla è ingegnoso.

## Cosa ci portiamo dietro

1. **Le funzioni del server possono leggere tutto**, e proprio per questo vanno guardate con
   sospetto: `SECURITY DEFINER` è la sede naturale delle fughe indirette. La domanda giusta non è
   «questa funzione restituisce dati privati?», è «da quello che restituisce, cosa si può dedurre?».
2. La soglia sulla quotazione risolve il problema pratico all'ottanta per cento e non deduce
   niente su nessuno. Meno elegante, ma innocua.
3. Il motivo dello scarto sta scritto anche nel codice, sopra la funzione che estrae: chi la
   leggerà fra sei mesi avrà la stessa idea e deve trovare lì la risposta.
