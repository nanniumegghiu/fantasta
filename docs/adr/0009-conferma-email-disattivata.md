# ADR-0009 · La conferma dell'indirizzo email è disattivata

**Stato** · Accettato · **Data** · 2026-09-02 · **Decide** · l'utente, su raccomandazione del
security-officer

---

## Contesto

Un progetto Supabase nasce con la conferma dell'indirizzo email obbligatoria e con il servizio di
invio incluso, che è **limitato a 2 email all'ora per l'intero progetto**. Il limite è stato letto
dalla configurazione reale del progetto, non ipotizzato:

```
mailer_autoconfirm      false
smtp_host               null
rate_limit_email_sent   2
```

Lo scenario d'uso è dieci amici che si registrano nella stessa mezz'ora, la sera prima dell'asta.
Con quel limite, otto di loro restano fuori senza capire perché, e l'app sembra rotta.

## Opzioni valutate

### A · Disattivare la conferma dell'indirizzo

**Pro** · La registrazione funziona subito, per tutti, senza inviare nessuna email. Nessun servizio
esterno, nessuna credenziale in più.

**Contro** · Chi si registra può scrivere un indirizzo che non è suo. In un'applicazione aperta al
pubblico sarebbe inaccettabile: qui il danno possibile è occupare un indirizzo altrui, e per entrare
in una lega serve comunque il codice di invito, che circola solo nella chat degli amici. Chi entra
con Google è verificato da Google.

### B · Collegare un servizio di invio esterno

Resend, Brevo o simili, con piano gratuito.

**Pro** · La conferma funziona davvero, e lo stesso servizio servirebbe poi al recupero password.

**Contro** · Serve un account su un servizio in più, una chiave da custodire, e la verifica di un
indirizzo mittente. Tre passaggi manuali per l'utente prima ancora di vedere l'app funzionare.

### C · Lasciare tutto com'è

**Contro** · La registrazione con email è di fatto rotta per un gruppo. Non è un'opzione.

## Decisione

**Opzione A.** La conferma dell'indirizzo è disattivata: `mailer_autoconfirm` vale ora `true`,
impostato dall'API di gestione e verificato nella risposta.

## Conseguenze

**Diventa più facile** · Registrarsi. Nessuna email, nessun limite orario, nessuna attesa.

**Diventa più difficile** · Il **recupero password resta non disponibile**, perché richiederebbe
comunque l'invio di email. L'interfaccia lo dichiara apertamente nella schermata di accesso invece
di offrire un modulo che non porta a niente. Chi perde la password entra con Google, oppure si fa
reimpostare la password dall'amministratore dell'applicazione.

**Rischio accettato e come si rimedia** · Se in futuro l'app uscisse dalla cerchia degli amici, la
conferma va riattivata **insieme** a un servizio di invio vero. Sono una cosa sola: riattivare la
conferma senza il servizio ricrea esattamente il problema di partenza.

## Reversibilità

**Alta.** È un interruttore nella configurazione, che si riporta indietro in una chiamata. Il costo
vero non è tecnico: è che servirebbe anche l'opzione B.
