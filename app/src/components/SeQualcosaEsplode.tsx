import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * La rete sotto l'applicazione.
 *
 * PERCHE' ESISTE
 *
 * Quando un componente React solleva un errore durante il disegno, React
 * **smonta tutto l'albero**. Senza qualcuno che lo raccolga, quello che resta
 * è la pagina vuota con lo sfondo dell'app: uno schermo verde, senza una
 * parola, senza un tasto. Parole dell'utente: «in molte schermate resta
 * schermo verde vuoto e devo aggiornare la pagina per sbloccare l'app».
 *
 * Non è un dettaglio di cortesia. La sera dell'asta, con otto persone che
 * aspettano, «ricarica la pagina» è un'informazione che vale quanto tutto il
 * resto — e nessuno la indovina guardando uno schermo verde.
 *
 * PERCHE' MOSTRA ANCHE L'ERRORE VERO
 *
 * Perché chi lo legge non è uno sviluppatore, ma è la persona che me lo dovrà
 * riferire. «Non funziona» non si corregge; una riga di errore sì. Sta in
 * fondo, piccola, dopo le due cose che servono davvero: cos'è successo e cosa
 * fare adesso.
 *
 * PERCHE' UNA CLASSE
 *
 * Perché React non ha un equivalente con i gancî: `componentDidCatch` esiste
 * solo sui componenti a classe. È l'unico posto del progetto dove serve.
 */
type Stato = { errore: Error | null }

/**
 * Il caso più frequente, e l'unico che si ripara da solo.
 *
 * Le schermate si scaricano a pezzi, quando servono. Dopo una pubblicazione
 * nuova quei pezzi cambiano nome, ma il browser ha ancora in memoria l'indice
 * vecchio, che chiede i nomi vecchi: quei file non esistono più, il caricamento
 * fallisce, e l'applicazione resta uno schermo vuoto finché non si ricarica a
 * mano. È **il** motivo per cui capitava spesso e su molte schermate: capita
 * una volta per ogni pubblicazione, su qualunque pagina si stia aprendo.
 *
 * La riparazione è sempre la stessa — ricaricare, così arriva l'indice nuovo —
 * quindi la si fa da soli invece di chiederla.
 *
 * **Una volta sola.** Se dopo la ricarica succede ancora, non era la cache: è
 * un errore vero, e va mostrato invece di far girare la pagina all'infinito.
 */
function ePezzoMancante(errore: Error): boolean {
  const t = `${errore.name} ${errore.message}`.toLowerCase()
  return (
    t.includes('dynamically imported module') ||
    t.includes('importing a module script failed') ||
    t.includes('failed to fetch dynamically')
  )
}

const GIA_RICARICATO = 'fantasta.ricaricata-per-aggiornamento'

export class SeQualcosaEsplode extends Component<{ children: ReactNode }, Stato> {
  state: Stato = { errore: null }

  static getDerivedStateFromError(errore: Error): Stato {
    return { errore }
  }

  componentDidCatch(errore: Error, dettagli: ErrorInfo) {
    // In console per intero: è quello che serve a chi verrà a cercarlo.
    console.error('Fantasta si è fermata:', errore, dettagli.componentStack)

    if (ePezzoMancante(errore)) {
      try {
        if (!sessionStorage.getItem(GIA_RICARICATO)) {
          sessionStorage.setItem(GIA_RICARICATO, '1')
          window.location.reload()
        }
      } catch {
        // Memoria del sito bloccata: resta la schermata con il tasto.
      }
    }
  }

  render() {
    if (!this.state.errore) return this.props.children

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
        <span aria-hidden className="text-5xl">
          ⚽
        </span>
        <h1 className="text-2xl font-extrabold text-nebbia">
          {ePezzoMancante(this.state.errore)
            ? 'Serve un aggiornamento'
            : 'Qui si è inceppato qualcosa'}
        </h1>
        <p className="max-w-md text-base text-fumo">
          {ePezzoMancante(this.state.errore)
            ? "È uscita una versione nuova mentre l'app era aperta. Ricarica e riparte da dov'eri."
            : "Non è colpa tua e non hai perso niente: l'asta vive sul server, non su questa schermata. Ricarica e ritrovi tutto dov'era."}
        </p>

        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-[52px] rounded-2xl bg-arancio px-6 text-[17px] font-semibold text-carbone shadow-[0_4px_0_0_var(--color-arancio-caldo)]"
          >
            Ricarica
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = `${import.meta.env.BASE_URL}leghe`
            }}
            className="min-h-[52px] rounded-2xl border border-verde-acceso/40 bg-verde-campo px-6 text-[17px] font-semibold text-nebbia"
          >
            Torna alle leghe
          </button>
        </div>

        <p className="max-w-md break-words text-xs text-fumo/70">
          Se ricapita, questo è quello che è successo:{' '}
          <span className="text-fumo">{this.state.errore.message}</span>
        </p>
      </div>
    )
  }
}
