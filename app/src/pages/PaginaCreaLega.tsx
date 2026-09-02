import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Bottone } from '@/components/Bottone'
import { Campo } from '@/components/Campo'
import { CampoNumero } from '@/components/CampoNumero'
import { Interruttore } from '@/components/Interruttore'
import { Intestazione } from '@/components/Intestazione'
import { useCreaLega } from '@/features/leghe/api'
import { REGOLE_PREDEFINITE, type RegoleLega } from '@/features/leghe/tipi'
import { stagioneCorrente } from '@/domain/stagione'

export function PaginaCreaLega() {
  const naviga = useNavigate()
  const crea = useCreaLega()

  const [nome, setNome] = useState('')
  const [stagione, setStagione] = useState(stagioneCorrente())
  const [nomeSquadra, setNomeSquadra] = useState('')
  const [regole, setRegole] = useState<RegoleLega>(REGOLE_PREDEFINITE)
  const [errore, setErrore] = useState<string | null>(null)

  const rosa = regole.slotP + regole.slotD + regole.slotC + regole.slotA
  const minimoNecessario = rosa * regole.offertaMinima
  const creditiInsufficienti = regole.crediti < minimoNecessario

  function aggiorna<K extends keyof RegoleLega>(chiave: K, valore: RegoleLega[K]) {
    setRegole((r) => {
      const nuove = { ...r, [chiave]: valore }
      // Il conguaglio in crediti non ha senso senza gli scambi: si spegne da solo.
      if (chiave === 'scambi' && valore === false) nuove.scambiConCrediti = false
      return nuove
    })
  }

  async function invia(e: React.FormEvent) {
    e.preventDefault()
    setErrore(null)

    if (nome.trim().length < 2) return setErrore('Dai un nome alla lega, almeno due lettere.')
    if (nomeSquadra.trim().length < 2) return setErrore('Dai un nome alla tua squadra.')
    if (creditiInsufficienti) {
      return setErrore(
        `Con ${rosa} slot e offerta minima ${regole.offertaMinima}, servono almeno ${minimoNecessario} crediti.`,
      )
    }

    try {
      const id = await crea.mutateAsync({
        nome: nome.trim(),
        stagione: stagione.trim(),
        nomeSquadra: nomeSquadra.trim(),
        regole,
      })
      naviga(`/lega/${id}`, { replace: true })
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Non sono riuscito a creare la lega.')
    }
  }

  return (
    <div className="min-h-dvh">
      <Intestazione titolo="Crea una lega" indietroA="/leghe" />

      <form onSubmit={invia} className="mx-auto max-w-3xl px-4 py-6 pb-28">
        <Sezione titolo="La lega" sottotitolo="Puoi cambiare tutto finché l'asta non comincia.">
          <Campo
            etichetta="Nome della lega"
            valore={nome}
            onChange={setNome}
            placeholder="Es. Lega dei Fenomeni"
            richiesto
          />
          <Campo
            etichetta="Stagione"
            valore={stagione}
            onChange={setStagione}
            placeholder="2026/27"
            richiesto
          />
          <Campo
            etichetta="Il nome della tua squadra"
            valore={nomeSquadra}
            onChange={setNomeSquadra}
            placeholder="Es. Real Madrink"
            aiuto="Lo vedranno tutti gli altri durante l'asta."
            richiesto
          />
          <CampoNumero
            etichetta="Quanti partecipanti al massimo"
            valore={regole.maxPartecipanti}
            onChange={(v) => aggiorna('maxPartecipanti', v)}
            minimo={2}
            massimo={20}
          />
        </Sezione>

        <Sezione titolo="I crediti" sottotitolo="Il budget con cui parte ogni squadra.">
          <CampoNumero
            etichetta="Crediti a testa"
            valore={regole.crediti}
            onChange={(v) => aggiorna('crediti', v)}
            minimo={1}
            massimo={100000}
            passo={10}
          />
          <CampoNumero
            etichetta="Offerta minima"
            valore={regole.offertaMinima}
            onChange={(v) => aggiorna('offertaMinima', v)}
            minimo={1}
            massimo={100}
            aiuto="Quanto vale la prima offerta su un calciatore."
          />
        </Sezione>

        <Sezione
          titolo="La rosa"
          sottotitolo={`${rosa} calciatori in tutto. Lo standard del Classic è 3-8-8-6.`}
        >
          <div className="grid grid-cols-2 gap-4">
            <CampoNumero
              etichetta="Portieri"
              valore={regole.slotP}
              onChange={(v) => aggiorna('slotP', v)}
              minimo={1}
              massimo={10}
            />
            <CampoNumero
              etichetta="Difensori"
              valore={regole.slotD}
              onChange={(v) => aggiorna('slotD', v)}
              minimo={1}
              massimo={20}
            />
            <CampoNumero
              etichetta="Centrocampisti"
              valore={regole.slotC}
              onChange={(v) => aggiorna('slotC', v)}
              minimo={1}
              massimo={20}
            />
            <CampoNumero
              etichetta="Attaccanti"
              valore={regole.slotA}
              onChange={(v) => aggiorna('slotA', v)}
              minimo={1}
              massimo={20}
            />
          </div>

          {/* Avviso preventivo: meglio dirlo qui che farlo scoprire dall'errore
              del server dopo aver premuto Crea. */}
          {creditiInsufficienti && (
            <p className="rounded-xl border border-oro/40 bg-oro/10 px-4 py-3 text-sm text-oro">
              Con {rosa} slot e offerta minima {regole.offertaMinima}, servono almeno{' '}
              {minimoNecessario} crediti. Adesso ne hai messi {regole.crediti}.
            </p>
          )}
        </Sezione>

        <Sezione titolo="Gli scambi" sottotitolo="Si possono attivare anche dopo.">
          <Interruttore
            etichetta="Scambi fra squadre"
            descrizione="Due squadre possono scambiarsi calciatori."
            acceso={regole.scambi}
            onChange={(v) => aggiorna('scambi', v)}
          />
          <Interruttore
            etichetta="Scambi con conguaglio in crediti"
            descrizione="Allo scambio si può aggiungere una differenza in crediti."
            acceso={regole.scambiConCrediti}
            onChange={(v) => aggiorna('scambiConCrediti', v)}
            disabilitato={!regole.scambi}
            motivoBlocco="Prima devi permettere gli scambi."
          />
        </Sezione>

        {errore && (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-errore/40 bg-errore/10 px-4 py-3 text-sm text-errore"
          >
            {errore}
          </p>
        )}

        <div className="fixed inset-x-0 bottom-0 border-t border-verde-campo bg-verde-notte/95 backdrop-blur">
          <div className="mx-auto max-w-3xl px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Bottone
              type="submit"
              misura="grande"
              larghezzaPiena
              inCorso={crea.isPending}
              disabilitato={creditiInsufficienti}
            >
              Crea la lega
            </Bottone>
          </div>
        </div>
      </form>
    </div>
  )
}

function Sezione({
  titolo,
  sottotitolo,
  children,
}: {
  titolo: string
  sottotitolo?: string
  children: React.ReactNode
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26 }}
      className="mt-5 rounded-2xl border border-verde-campo bg-verde-campo/30 p-4"
    >
      <h2 className="text-base font-bold text-nebbia">{titolo}</h2>
      {sottotitolo && <p className="mt-0.5 mb-4 text-xs text-fumo">{sottotitolo}</p>}
      <div className="flex flex-col gap-4">{children}</div>
    </motion.section>
  )
}
