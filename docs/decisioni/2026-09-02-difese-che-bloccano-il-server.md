# Registro · Due difese che bloccavano il server stesso

**Data** · 2026-09-02 · **Chi** · backend-engineer, segnalato dalla prova automatica della Fetta 4a
**Dove** · migrazioni 0002 e 0006, corrette dalle migrazioni 0007 e 0008

---

## Cosa è successo

Alla prima esecuzione delle prove del motore d'asta, l'aggiudicazione falliva. Il lotto restava
aperto, i crediti non venivano scalati e la funzione non diceva niente di comprensibile.

La causa era una difesa scritta da noi: il trigger che impedisce a un client di modificarsi i
crediti bloccava anche **il server**, cioè il codice che quei crediti li deve scalare per mestiere.

Poco dopo, lo stesso schema si è ripetuto: il trigger che rende il registro dell'asta a sola
aggiunta impediva di cancellare una lega, perché la cancellazione a cascata porta via anche gli
eventi.

## Perché

Il controllo guardava la variabile di sessione `role`. Quando l'applicazione chiama una funzione
del database, il servizio imposta `role = authenticated` per tutta la transazione. Una funzione
dichiarata `SECURITY DEFINER` cambia l'**utente effettivo**, ma non quella variabile: che resta
`authenticated` anche mentre gira il codice del server.

Il trigger quindi non distingueva «il browser sta scrivendo» da «il server sta scrivendo», perché
guardava la cosa sbagliata.

## Cosa abbiamo scelto

Guardare `current_user`, cioè **chi sta scrivendo davvero**. Una richiesta diretta dal browser
arriva come `authenticated` o `anon`; il codice del server arriva come proprietario delle funzioni.

La protezione per il client resta identica, ed è stata riverificata: la prova «un partecipante non
può darsi crediti da solo» continua a essere respinta con lo stesso messaggio.

Per il registro eventi vale una distinzione in più: **una modifica resta vietata a chiunque**, anche
in amministrazione, perché il registro racconta com'è andata la serata e non si riscrive. La
cancellazione a cascata di una lega intera invece passa: lì non si sta riscrivendo niente, si sta
buttando via una lega.

## Cosa ci portiamo dietro

1. **Una difesa che blocca anche chi deve poter passare non è una difesa, è un guasto.** E si
   manifesta nel modo peggiore: non quando qualcuno attacca, ma quando il sistema fa il suo lavoro.
2. **`role` e `current_user` non sono la stessa cosa.** Ogni volta che un controllo deve distinguere
   il client dal server, si guarda `current_user`.
3. **La difesa vera sono le policy, il trigger è la seconda serratura.** Su queste tabelle un client
   non ha comunque nessuna policy di scrittura: senza il trigger, le sue richieste toccherebbero
   zero righe lo stesso. Il trigger serve a rendere esplicito l'intento, non a reggere da solo.
4. **Trovato eseguendo, non leggendo.** Il codice sembrava giusto a chiunque lo leggesse, ed era
   passato per due migrazioni. È lo stesso motivo per cui la regola 4 del progetto dice di
   verificare invece di dichiarare.
