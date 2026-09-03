-- ═══════════════════════════════════════════════════════════════════════════
-- 0021 · Anche la ripresa è un intervento
--
-- `evento_manuale`, scritta nella 0020, elencava `pausa` e non `ripresa`.
-- Il motore le scrive come due tipi distinti: mettere in pausa compariva fra
-- gli interventi, togliere la pausa no.
--
-- È un'incoerenza piccola e proprio per questo va tolta subito: un registro che
-- mostra metà di una coppia di azioni fa dubitare di tutto il resto, e il suo
-- unico valore è che non se ne dubiti.
--
-- Vale la regola del metodo: una migrazione applicata non si modifica, si
-- supera con la successiva.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.evento_manuale(p_tipo text, p_payload jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_tipo
    when 'annullamento'      then true
    when 'rimozione'         then true
    when 'correzione_prezzo' then true
    when 'pausa'             then true
    when 'ripresa'           then true
    -- Un'aggiudicazione è manuale quando non l'ha decisa il timer.
    when 'aggiudicazione'    then coalesce(p_payload ->> 'modo', '') in ('quick_assign', 'admin')
    -- Un passaggio è manuale quando l'ha deciso l'amministratore, non l'assenza di offerte.
    when 'passaggio'         then coalesce(p_payload ->> 'motivo', '') = 'admin'
    -- Un'estrazione è manuale quando il nome l'ha cercato lui.
    when 'estrazione'        then coalesce(p_payload ->> 'metodo', '') = 'riempimento'
    else false
  end;
$$;
