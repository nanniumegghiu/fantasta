-- ═══════════════════════════════════════════════════════════════════════════
-- 0025 · Sistemare i volti a mano
--
-- L'abbinamento automatico arriva al 98% dei calciatori abbinabili. Il resto
-- richiede un occhio: nomi scritti in modo strano, omonimi che l'iniziale non
-- distingue, calciatori che nel database del gioco non ci sono proprio.
--
-- ADR-0011 lo prevedeva fin dall'inizio: «cio' che resta scoperto va nella
-- schermata di abbinamento manuale, che serve comunque».
--
-- COSA MANCAVA
--
-- `imposta_volto` c'era gia' e sa scrivere una corrispondenza `confermata`.
-- Mancavano due cose per poterci lavorare davvero:
--
-- 1. **Togliere un volto sbagliato.** Un abbinamento automatico puo' aver
--    messo la faccia di un altro: finche' non si puo' cancellare, l'unico modo
--    di rimediare e' sovrascriverlo con quello giusto, che pero' bisogna avere.
--    Poter dire «questo e' sbagliato, e non so ancora quale sia» e' meta' del
--    lavoro di revisione.
--
-- 2. **Sapere a chi guardare.** Chi rivede non deve scorrere cinquecento
--    calciatori: deve vedere quelli senza volto e quelli il cui volto e' stato
--    **dedotto** dal solo cognome, che sono i piu' a rischio di essere la
--    persona sbagliata. Gli abbinamenti nati con squadra e cognome insieme
--    sono affidabili; quelli dedotti no, e vanno guardati.
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * Toglie il volto di un calciatore.
 *
 * Cancella anche l'identificativo di Football Manager: se la faccia era
 * sbagliata, quasi sempre era sbagliata anche la persona a cui il calciatore
 * era stato abbinato, e lasciare l'identificativo vorrebbe dire che al
 * prossimo giro automatico tornerebbe la stessa faccia.
 *
 * L'immagine nell'archivio non si tocca: il percorso e' `<stagione>/<id>.png`,
 * quindi caricarne un'altra la sostituisce, e una immagine orfana non fa male
 * a nessuno. Cancellarla vorrebbe dire una seconda chiamata che puo' fallire
 * per conto suo e lasciare il database e l'archivio a raccontare cose diverse.
 */
create or replace function public.togli_volto(p_player_id int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.e_admin_app() then
    raise exception 'I volti li gestisce chi amministra l''applicazione.' using errcode = '42501';
  end if;

  update public.players
  set photo_path = null, fm_id = null, fm_origine = null, updated_at = now()
  where id = p_player_id;

  return found;
end;
$$;

/**
 * Conferma un volto che c'e' gia', senza cambiarlo.
 *
 * Serve a chi rivede: guarda una faccia dedotta, riconosce la persona, e dice
 * «questa e' giusta». Da quel momento nessun giro automatico la sovrascrive
 * piu', e non ricompare fra le cose da controllare.
 */
create or replace function public.conferma_volto(p_player_id int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.e_admin_app() then
    raise exception 'I volti li gestisce chi amministra l''applicazione.' using errcode = '42501';
  end if;

  update public.players
  set fm_origine = 'confermata', updated_at = now()
  where id = p_player_id and photo_path is not null;

  return found;
end;
$$;

-- ─── A chi guardare ─────────────────────────────────────────────────────────

create or replace view public.volti_da_rivedere
with (security_invoker = true) as
select
  p.id,
  p.season,
  p.name,
  p.role,
  p.serie_a_team,
  p.quotation,
  p.photo_path,
  p.fm_id,
  p.fm_origine,
  -- Perché è in questo elenco. Chi rivede lavora diversamente nei due casi:
  -- «manca» si risolve caricando un'immagine, «da controllare» si risolve
  -- guardando e dicendo sì o no.
  case
    when p.photo_path is null then 'manca'
    else 'da_controllare'
  end as motivo
from public.players p
where p.active
  and (p.photo_path is null or p.fm_origine = 'dedotta');

comment on view public.volti_da_rivedere is
  'I calciatori senza volto e quelli con un volto dedotto dal solo cognome, che e il caso in cui puo essere la faccia di un altro.';
