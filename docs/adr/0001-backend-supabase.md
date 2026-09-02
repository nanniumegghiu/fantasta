# ADR-0001 · Supabase come backend

**Stato** · Accettato · **Data** · 2026-09-02 · **Decide** · l'utente, su raccomandazione del
project-manager

---

## Contesto

Fantasta deve tenere sincronizzati fino a una decina di dispositivi nella stessa stanza durante
un'asta, custodire dati che devono restare segreti fra partecipanti della stessa lega — le liste
obiettivi — e far rispettare regole numeriche che nessun client deve poter aggirare.

Il metodo di lavoro adottato dal progetto impone tre cose che vincolano la scelta: accesso ai dati
riga per riga con default negato, migrazioni versionate come file di testo, e il server come unica
autorità su ciò che conta.

## Opzioni valutate

### A · Supabase

**Pro** · PostgreSQL gestito: il dominio del fantacalcio è fatto di relazioni e in SQL si esprime
naturalmente. Sicurezza riga per riga nativa nel database, che è esattamente lo strumento per
rendere invisibile la lista obiettivi di un partecipante agli altri, amministratore compreso.
Migrazioni versionate in file di testo. Autenticazione con Google ed email già pronte. Canale
realtime incluso. Archivio file incluso, quindi PDF del regolamento e facepack senza altri servizi.
Piano gratuito adeguato. È Postgres standard: i dati si portano via.

**Contro** · Il piano gratuito sospende il progetto dopo circa una settimana di inattività, con
alcuni secondi di attesa alla prima richiesta successiva. Il canale realtime ha limiti di messaggi
al secondo sul piano gratuito. Le funzioni server richiedono uno strumento a riga di comando
aggiuntivo.

### B · Firebase

**Pro** · Sincronia realtime molto matura. Accesso con Google immediato. Nessuna sospensione.

**Contro** · Database a documenti: calcoli aggregati come «crediti residui e slot mancanti di tutte
le squadre» richiedono letture multiple o duplicazione di dati da tenere allineata a mano. Le regole
di sicurezza sono meno espressive di SQL proprio sui casi che servono qui. Nessuna migrazione
versionata, in contrasto diretto col metodo adottato. Fatturazione a lettura, con uno schermo
condiviso che resta in ascolto per ore.

### C · Backend proprio su server noleggiato

**Pro** · Controllo totale, nessun limite di piano.

**Contro** · Manutenzione del server a carico nostro. Costo fisso tutto l'anno per un'app usata
poche sere. Autenticazione, archivio file e canale realtime da costruire da zero.

## Decisione

**Supabase.** È l'unica opzione che soddisfa contemporaneamente i tre vincoli del metodo, e l'unica
in cui la segretezza delle liste obiettivi si ottiene con una policy dichiarativa nel database
invece che con disciplina applicativa.

## Conseguenze

**Diventa più facile** · Esprimere le regole del dominio; proteggere i dati privati; ricostruire
l'ambiente da zero partendo dalle migrazioni; generare i tipi TypeScript dallo schema.

**Diventa più difficile** · Nulla di rilevante. Va però ricordato che il progetto si sospende per
inattività: **l'app va aperta almeno un'ora prima dell'asta** per risvegliarla. Questo vincolo è
operativo e va scritto nelle istruzioni per l'amministratore.

**Rischio accettato** · Se la lega crescesse molto oltre le previsioni, i limiti del piano gratuito
si farebbero sentire. Mitigazione: il piano a pagamento costa circa 25 dollari al mese e non
richiede alcuna modifica al codice.

## Reversibilità

**Bassa.** Cambiare backend significa riscrivere accesso ai dati, policy di sicurezza e sincronia.
È il motivo per cui questa decisione è stata presa prima di scrivere codice.
