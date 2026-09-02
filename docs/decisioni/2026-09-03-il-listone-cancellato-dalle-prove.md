# Registro · Ho cancellato il listone vero con gli script di verifica

**Data** · 2026-09-03 · **Chi** · backend-engineer · **Segnalato da** · l'utente
**Dove** · il ramo `--pulisci` di cinque script in `scripts/`

---

## Cosa è successo

Il proprietario del progetto ha caricato il listone dal computer. Poco dopo si è collegato dallo
smartphone con lo stesso account e il listone non c'era più. Lo ha segnalato come un difetto
dell'applicazione.

Non era un difetto dell'applicazione. Il listone è globale e funzionava: chiunque abbia fatto
l'accesso lo vede, su qualsiasi dispositivo, e la prova che lo dimostra esisteva già. Era sparito
perché **l'ho cancellato io**.

Cinque script di verifica avevano nel ramo di pulizia questa riga:

```sql
delete from public.players;
```

Nessuna condizione. Ogni volta che rilanciavo la batteria di prove, l'ultima istruzione di pulizia
buttava via tutti i calciatori: quelli finti creati dalla prova e quelli veri caricati dall'utente.

## Perché è passato inosservato

Perché gli script *funzionavano*. Le centoquarantasei prove restavano verdi, il progetto risultava
pulito alla fine, e la pulizia faceva esattamente quello che le avevo chiesto di fare. Il difetto
non era nel comportamento, era nella **portata**: avevo scritto «cancella i calciatori» pensando
«cancella i calciatori di prova», e le due cose coincidevano soltanto finché nel database non c'era
niente di vero.

Il momento in cui hanno smesso di coincidere è esattamente il momento in cui il progetto ha
cominciato a essere usato.

## La correzione

Gli identificativi dei calciatori di prova sono stati spostati **oltre 900000**. Quelli del listone
ufficiale sono numeri di quattro o cinque cifre e non arrivano mai lì. La pulizia ora dice:

```sql
delete from public.players where id >= 900000;
```

«Cancella i calciatori di prova» è diventata una condizione scritta, non un'intenzione nella mia
testa.

In più c'è una prova nuova, che nasce da questo danno: inserisce una **sentinella** con un
identificativo da listone vero, esegue le stesse identiche istruzioni della pulizia, e controlla che
la sentinella sia ancora lì. Se un domani qualcuno riallarga la cancellazione, quella prova diventa
rossa prima che il danno arrivi all'utente.

## Cosa ci portiamo dietro

1. **Uno script di prova che cancella dati non è codice di prova: è codice che gira sul database
   vero.** Va scritto con la stessa cura di una migrazione, non con quella di un appunto.
2. **Le cancellazioni si scrivono sempre con una condizione**, anche quando «tanto lì dentro c'è
   solo roba di prova». Quella frase ha una data di scadenza, ed è il giorno in cui qualcuno comincia
   a usare l'applicazione.
3. **I dati di prova vanno in uno spazio riservato e riconoscibile.** Un intervallo di identificativi
   che non può collidere con quelli veri costa niente e rende ogni pulizia una condizione precisa.
4. **La segnalazione dell'utente diceva una cosa e il problema ne era un'altra.** Ha riferito «il
   listone non si vede da telefono», che sembrava un difetto di sincronizzazione o di permessi. La
   prima cosa da fare è stata guardare il database invece di cercare il difetto dove veniva
   indicato: lì il listone non era assente, era stato **rimosso**, e quella distinzione ha cambiato
   tutta la diagnosi.
