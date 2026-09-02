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

// ─── Metodi attivi ──────────────────────────────────────────────────────────

export function useImpostaMetodi(idLega: string | undefined) {
  return useAzione<{ idLista: string; campo: 'usa_fasce' | 'usa_tetti' | 'usa_slot' | 'usa_incroci'; acceso: boolean }>(
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
