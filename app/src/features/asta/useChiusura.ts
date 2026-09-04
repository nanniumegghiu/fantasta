import { useEffect, useRef } from 'react'

/**
 * Chiede al server di chiudere il lotto scaduto, e insiste finché non è chiuso.
 *
 * PERCHE' UN GANCIO E NON DUE EFFETTI UGUALI
 *
 * Lo stesso pezzo serve alla vista personale e allo schermo condiviso. Scritto
 * due volte, si è rotto una volta sola — e quella volta ha portato giù la
 * schermata che guardano tutti insieme.
 *
 * IL DIFETTO CHE QUESTO GANCIO ESISTE PER NON RIFARE
 *
 * La versione precedente aveva nelle dipendenze la **funzione** da chiamare e
 * l'**oggetto** del lotto. Tutti e due nascono nuovi a ogni render: la funzione
 * perché avvolgeva l'oggetto di una mutazione, che react-query ricrea ogni
 * volta.
 *
 * Il risultato, allo scadere del countdown, era un anello chiuso:
 *
 *     chiedo la chiusura → la richiesta invalida le query → arriva il nuovo
 *     stato → render → la funzione cambia identità → l'effetto riparte →
 *     chiedo la chiusura → …
 *
 * Nessuna di quelle chiamate era sbagliata presa da sola. Insieme erano
 * centinaia al secondo: la scheda si inchiodava, i rilanci non arrivavano più,
 * l'aggiudicazione non si vedeva, e l'unica via d'uscita era ricaricare la
 * pagina. **Un ciclo di render non si vede leggendo la riga che lo causa**: si
 * vede solo guardando quali dipendenze sono stabili e quali no.
 *
 * Quindi qui dentro:
 *   · le dipendenze sono **solo primitivi** — la fase e l'identificativo del
 *     lotto — e nient'altro può farlo ripartire;
 *   · la funzione da chiamare vive in un riferimento, che cambia senza
 *     rieseguire niente;
 *   · e c'è comunque un freno: due richieste per lo stesso lotto non partono
 *     mai a meno di un secondo l'una dall'altra, qualunque cosa succeda sopra.
 *
 * Il freno è ridondante rispetto alle dipendenze, ed è messo apposta: la
 * correzione delle dipendenze si può disfare per sbaglio in una riga, il freno
 * no.
 */
export function useChiusuraInsistente(
  fase: string,
  idLotto: string | undefined,
  chiedi: ((idLotto: string) => void) | undefined,
) {
  const chiediRef = useRef(chiedi)
  chiediRef.current = chiedi

  // Quando abbiamo chiesto l'ultima volta, per quale lotto.
  const ultima = useRef<{ lotto: string; quando: number } | null>(null)

  useEffect(() => {
    if (fase !== 'scaduto' || !idLotto) return

    const chiediOra = () => {
      const adesso = Date.now()
      const prima = ultima.current
      if (prima && prima.lotto === idLotto && adesso - prima.quando < 1000) return
      ultima.current = { lotto: idLotto, quando: adesso }
      chiediRef.current?.(idLotto)
    }

    chiediOra()
    const insisti = setInterval(chiediOra, 1500)
    return () => clearInterval(insisti)
  }, [fase, idLotto])
}
