import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { richiediSupabase } from '@/lib/supabase'
import { messaggioErrore } from '@/lib/messaggioErrore'
import type { ColoreFascia, ListaObiettivi } from './tipi'
import type { Ruolo } from '@/domain/listone'

const CAMPI =
  '*,' +
  'tiers(id,list_id,name,color,position),' +
  'targets(id,list_id,player_id,tier_id,max_price,priority,note,status,players(id,name,role,serie_a_team,quotation,photo_path)),' +
  'roster_slots(id,list_id,role,label,position,slot_candidates(slot_id,target_id,position)),' +
  'goalkeeper_pairings(id,list_id,name,note,position,pairing_members(pairing_id,target_id,position))'

/**
 * Scarica la lista intera in una richiesta sola.
 *
 * Sono dati piccoli e strettamente collegati fra loro: fare cinque richieste
 * separate significherebbe mostrare la schermata a pezzi, con le fasce già
 * disegnate e gli obiettivi ancora vuoti.
 */
export function useListaObiettivi(idLega: string | undefined) {
  return useQuery({
    queryKey: ['obiettivi', idLega],
    enabled: Boolean(idLega),
    queryFn: async (): Promise<ListaObiettivi> => {
      const sb = richiediSupabase()

      // La lista viene creata al primo ingresso, dal server: due schede aperte
      // insieme non devono poter creare due liste.
      const { data: idLista, error: erroreCreazione } = await sb.rpc('assicura_lista_obiettivi', {
        p_lega: idLega!,
      })
      if (erroreCreazione) throw new Error(messaggioErrore(erroreCreazione))

      const { data, error } = await sb
        .from('target_lists')
        .select(CAMPI)
        .eq('id', idLista as string)
        .single()
      if (error) throw new Error(messaggioErrore(error))
      return data as unknown as ListaObiettivi
    },
  })
}

function useAzione<T>(idLega: string | undefined, azione: (v: T) => Promise<void>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: azione,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obiettivi', idLega] }),
  })
}

async function esegui(promessa: PromiseLike<{ error: unknown }>) {
  const { error } = await promessa
  if (error) throw new Error(messaggioErrore(error))
}

// ─── Il metodo e le sue aggiunte ────────────────────────────────────────────

/** Sceglie fasce oppure slot, e segna la scelta come fatta. */
export function useScegliMetodo(idLega: string | undefined) {
  return useAzione<{ idLista: string; metodo: 'fasce' | 'slot' }>(idLega, async (v) =>
    esegui(
      richiediSupabase()
        .from('target_lists')
        .update({ metodo: v.metodo, metodo_confermato: true })
        .eq('id', v.idLista),
    ),
  )
}

export function useImpostaOpzione(idLega: string | undefined) {
  return useAzione<{ idLista: string; campo: 'usa_tetti' | 'usa_incroci'; acceso: boolean }>(
    idLega,
    async (v) =>
      esegui(
        richiediSupabase()
          .from('target_lists')
          .update({ [v.campo]: v.acceso })
          .eq('id', v.idLista),
      ),
  )
}

// ─── Riordino ───────────────────────────────────────────────────────────────

/**
 * Riscrive l'ordine di un gruppo in una chiamata sola.
 * Spostare una riga cambia la posizione di tutte quelle sotto: mandarle una
 * per una farebbe riassestare la lista a scatti su una connessione lenta.
 */
export function useRiordinaObiettivi(idLega: string | undefined) {
  return useAzione<Array<{ id: string; priorita: number; fascia?: string | null }>>(
    idLega,
    async (righe) => {
      const { error } = await richiediSupabase().rpc('riordina_obiettivi', { p_righe: righe })
      if (error) throw new Error(messaggioErrore(error))
    },
  )
}

export function useRiordinaCandidati(idLega: string | undefined) {
  return useAzione<{ idSlot: string; ordine: string[] }>(idLega, async (v) => {
    const { error } = await richiediSupabase().rpc('riordina_candidati', {
      p_slot: v.idSlot,
      p_ordine: v.ordine,
    })
    if (error) throw new Error(messaggioErrore(error))
  })
}

// ─── Aggiunte fatte dal posto giusto ────────────────────────────────────────

/** Crea l'obiettivo se manca e lo aggancia allo slot: un gesto solo. */
export function useAggiungiASlot(idLega: string | undefined) {
  return useAzione<{ idSlot: string; idCalciatori: number[] }>(idLega, async (v) => {
    const { error } = await richiediSupabase().rpc('aggiungi_a_slot', {
      p_slot: v.idSlot,
      p_calciatori: v.idCalciatori,
    })
    if (error) throw new Error(messaggioErrore(error))
  })
}

export function useAggiungiAIncrocio(idLega: string | undefined) {
  return useAzione<{ idIncrocio: string; idCalciatori: number[] }>(idLega, async (v) => {
    const { error } = await richiediSupabase().rpc('aggiungi_a_incrocio', {
      p_incrocio: v.idIncrocio,
      p_calciatori: v.idCalciatori,
    })
    if (error) throw new Error(messaggioErrore(error))
  })
}

export function useCreaSlotStandard(idLega: string | undefined) {
  return useAzione<string>(idLega, async (idLista) => {
    const { error } = await richiediSupabase().rpc('crea_slot_standard', { p_lista: idLista })
    if (error) throw new Error(messaggioErrore(error))
  })
}

// ─── Obiettivi ──────────────────────────────────────────────────────────────

export function useAggiungiObiettivi(idLega: string | undefined) {
  return useAzione<{ idLista: string; idCalciatori: number[]; idFascia?: string | null }>(
    idLega,
    async (v) =>
      esegui(
        richiediSupabase()
          .from('targets')
          .insert(
            v.idCalciatori.map((id) => ({
              list_id: v.idLista,
              player_id: id,
              tier_id: v.idFascia ?? null,
            })),
          ),
      ),
  )
}

export function useAggiornaObiettivo(idLega: string | undefined) {
  return useAzione<{
    id: string
    campi: { tier_id?: string | null; max_price?: number | null; note?: string | null; priority?: number }
  }>(idLega, async (v) =>
    esegui(richiediSupabase().from('targets').update(v.campi).eq('id', v.id)),
  )
}

export function useTogliObiettivo(idLega: string | undefined) {
  return useAzione<string>(idLega, async (id) =>
    esegui(richiediSupabase().from('targets').delete().eq('id', id)),
  )
}

// ─── Fasce ──────────────────────────────────────────────────────────────────

export function useAggiungiFascia(idLega: string | undefined) {
  return useAzione<{ idLista: string; nome: string; colore: ColoreFascia; posizione: number }>(
    idLega,
    async (v) =>
      esegui(
        richiediSupabase()
          .from('tiers')
          .insert({ list_id: v.idLista, name: v.nome, color: v.colore, position: v.posizione }),
      ),
  )
}

export function useAggiornaFascia(idLega: string | undefined) {
  return useAzione<{ id: string; campi: { name?: string; color?: ColoreFascia; position?: number } }>(
    idLega,
    async (v) => esegui(richiediSupabase().from('tiers').update(v.campi).eq('id', v.id)),
  )
}

export function useTogliFascia(idLega: string | undefined) {
  return useAzione<string>(idLega, async (id) =>
    esegui(richiediSupabase().from('tiers').delete().eq('id', id)),
  )
}

// ─── Slot della rosa ideale ─────────────────────────────────────────────────

export function useAggiungiSlot(idLega: string | undefined) {
  return useAzione<{ idLista: string; ruolo: Ruolo; etichetta: string; posizione: number }>(
    idLega,
    async (v) =>
      esegui(
        richiediSupabase()
          .from('roster_slots')
          .insert({ list_id: v.idLista, role: v.ruolo, label: v.etichetta, position: v.posizione }),
      ),
  )
}

export function useAggiornaSlot(idLega: string | undefined) {
  return useAzione<{ id: string; campi: { label?: string; position?: number } }>(idLega, async (v) =>
    esegui(richiediSupabase().from('roster_slots').update(v.campi).eq('id', v.id)),
  )
}

export function useTogliSlot(idLega: string | undefined) {
  return useAzione<string>(idLega, async (id) =>
    esegui(richiediSupabase().from('roster_slots').delete().eq('id', id)),
  )
}

export function useAggiungiCandidato(idLega: string | undefined) {
  return useAzione<{ idSlot: string; idObiettivo: string; posizione: number }>(idLega, async (v) =>
    esegui(
      richiediSupabase()
        .from('slot_candidates')
        .insert({ slot_id: v.idSlot, target_id: v.idObiettivo, position: v.posizione }),
    ),
  )
}

export function useTogliCandidato(idLega: string | undefined) {
  return useAzione<{ idSlot: string; idObiettivo: string }>(idLega, async (v) =>
    esegui(
      richiediSupabase()
        .from('slot_candidates')
        .delete()
        .eq('slot_id', v.idSlot)
        .eq('target_id', v.idObiettivo),
    ),
  )
}

// ─── Incrocio portieri ──────────────────────────────────────────────────────

export function useAggiungiIncrocio(idLega: string | undefined) {
  return useAzione<{ idLista: string; nome: string; posizione: number }>(idLega, async (v) =>
    esegui(
      richiediSupabase()
        .from('goalkeeper_pairings')
        .insert({ list_id: v.idLista, name: v.nome, position: v.posizione }),
    ),
  )
}

export function useAggiornaIncrocio(idLega: string | undefined) {
  return useAzione<{ id: string; campi: { name?: string; note?: string | null } }>(idLega, async (v) =>
    esegui(richiediSupabase().from('goalkeeper_pairings').update(v.campi).eq('id', v.id)),
  )
}

export function useTogliIncrocio(idLega: string | undefined) {
  return useAzione<string>(idLega, async (id) =>
    esegui(richiediSupabase().from('goalkeeper_pairings').delete().eq('id', id)),
  )
}

export function useAggiungiMembroIncrocio(idLega: string | undefined) {
  return useAzione<{ idIncrocio: string; idObiettivo: string; posizione: number }>(idLega, async (v) =>
    esegui(
      richiediSupabase()
        .from('pairing_members')
        .insert({ pairing_id: v.idIncrocio, target_id: v.idObiettivo, position: v.posizione }),
    ),
  )
}

export function useTogliMembroIncrocio(idLega: string | undefined) {
  return useAzione<{ idIncrocio: string; idObiettivo: string }>(idLega, async (v) =>
    esegui(
      richiediSupabase()
        .from('pairing_members')
        .delete()
        .eq('pairing_id', v.idIncrocio)
        .eq('target_id', v.idObiettivo),
    ),
  )
}
