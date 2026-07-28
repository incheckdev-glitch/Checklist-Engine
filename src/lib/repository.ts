import type { Checklist, ChecklistItem, ChecklistSection, GeneratedChecklist, GenerationRequest } from '../types'
import { generateDemoChecklist, makeBlankChecklist } from './demo'
import { isSupabaseConfigured, supabase } from './supabase'

const STORAGE_KEY = 'incheck-ai-checklists-v1'

function readLocal(): Checklist[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as Checklist[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocal(checklists: Checklist[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(checklists))
}

function normalizeRows(checklistRow: Record<string, unknown>, sections: Array<Record<string, unknown>>, items: Array<Record<string, unknown>>): Checklist {
  return {
    id: String(checklistRow.id),
    name: String(checklistRow.name || ''),
    description: String(checklistRow.description || ''),
    industry: String(checklistRow.industry || ''),
    purpose: String(checklistRow.purpose || ''),
    assigned_role: String(checklistRow.assigned_role || ''),
    frequency: String(checklistRow.frequency || ''),
    estimated_minutes: Number(checklistRow.estimated_minutes || 0),
    scoring_enabled: Boolean(checklistRow.scoring_enabled),
    status: checklistRow.status as Checklist['status'],
    current_version: Number(checklistRow.current_version || 0),
    created_at: String(checklistRow.created_at || ''),
    updated_at: String(checklistRow.updated_at || ''),
    sections: sections
      .filter((section) => section.checklist_id === checklistRow.id)
      .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
      .map((section) => ({
        id: String(section.id),
        title: String(section.title || ''),
        instructions: String(section.instructions || ''),
        sort_order: Number(section.sort_order || 0),
        items: items
          .filter((item) => item.section_id === section.id)
          .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
          .map((item) => ({
            id: String(item.id),
            section_id: String(item.section_id),
            type: item.type as ChecklistItem['type'],
            label: String(item.label || ''),
            description: String(item.description || ''),
            required: Boolean(item.required),
            weight: Number(item.weight || 0),
            critical: Boolean(item.critical),
            allow_na: Boolean(item.allow_na),
            sort_order: Number(item.sort_order || 0),
            config: (item.config || {}) as Record<string, unknown>,
            conditions: (item.conditions || []) as ChecklistItem['conditions'],
            corrective_action: (item.corrective_action || null) as ChecklistItem['corrective_action'],
          })),
      })),
  }
}

export async function listChecklists(): Promise<Checklist[]> {
  if (!isSupabaseConfigured || !supabase) {
    const local = readLocal()
    if (local.length) return local
    const starter = makeBlankChecklist()
    writeLocal([starter])
    return [starter]
  }

  const [{ data: checklists, error: checklistError }, { data: sections, error: sectionError }, { data: items, error: itemError }] = await Promise.all([
    supabase.from('checklists').select('*').order('updated_at', { ascending: false }),
    supabase.from('checklist_sections').select('*').order('sort_order'),
    supabase.from('checklist_items').select('*').order('sort_order'),
  ])
  if (checklistError) throw checklistError
  if (sectionError) throw sectionError
  if (itemError) throw itemError
  return (checklists || []).map((checklist) => normalizeRows(checklist, sections || [], items || []))
}

export async function saveChecklist(checklist: Checklist): Promise<Checklist> {
  const normalized: Checklist = {
    ...checklist,
    sections: checklist.sections.map((section, sectionIndex) => ({
      ...section,
      sort_order: sectionIndex,
      items: section.items.map((item, itemIndex) => ({ ...item, section_id: section.id, sort_order: itemIndex })),
    })),
  }

  if (!isSupabaseConfigured || !supabase) {
    const all = readLocal()
    const next = [normalized, ...all.filter((entry) => entry.id !== normalized.id)]
    writeLocal(next)
    return normalized
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw userError || new Error('You must be signed in.')

  const { error: checklistError } = await supabase.from('checklists').upsert({
    id: normalized.id,
    owner_id: userData.user.id,
    name: normalized.name,
    description: normalized.description,
    industry: normalized.industry,
    purpose: normalized.purpose,
    assigned_role: normalized.assigned_role,
    frequency: normalized.frequency,
    estimated_minutes: normalized.estimated_minutes,
    scoring_enabled: normalized.scoring_enabled,
    status: normalized.status,
    current_version: normalized.current_version,
  })
  if (checklistError) throw checklistError

  const sectionIds = normalized.sections.map((section) => section.id)
  const itemIds = normalized.sections.flatMap((section) => section.items.map((item) => item.id))

  const { data: existingSections, error: existingSectionError } = await supabase
    .from('checklist_sections')
    .select('id')
    .eq('checklist_id', normalized.id)
  if (existingSectionError) throw existingSectionError

  const staleSectionIds = (existingSections || []).map((row) => row.id).filter((id) => !sectionIds.includes(id))
  if (staleSectionIds.length) {
    const { error } = await supabase.from('checklist_sections').delete().in('id', staleSectionIds)
    if (error) throw error
  }

  if (normalized.sections.length) {
    const { error } = await supabase.from('checklist_sections').upsert(
      normalized.sections.map((section) => ({
        id: section.id,
        checklist_id: normalized.id,
        title: section.title,
        instructions: section.instructions,
        sort_order: section.sort_order,
      })),
    )
    if (error) throw error
  }

  const { data: existingItems, error: existingItemError } = await supabase
    .from('checklist_items')
    .select('id')
    .eq('checklist_id', normalized.id)
  if (existingItemError) throw existingItemError
  const staleItemIds = (existingItems || []).map((row) => row.id).filter((id) => !itemIds.includes(id))
  if (staleItemIds.length) {
    const { error } = await supabase.from('checklist_items').delete().in('id', staleItemIds)
    if (error) throw error
  }

  const flatItems = normalized.sections.flatMap((section) => section.items)
  if (flatItems.length) {
    const { error } = await supabase.from('checklist_items').upsert(
      flatItems.map((item) => ({
        id: item.id,
        checklist_id: normalized.id,
        section_id: item.section_id,
        type: item.type,
        label: item.label,
        description: item.description,
        required: item.required,
        weight: item.weight,
        critical: item.critical,
        allow_na: item.allow_na,
        sort_order: item.sort_order,
        config: item.config,
        conditions: item.conditions,
        corrective_action: item.corrective_action,
      })),
    )
    if (error) throw error
  }

  return normalized
}

export async function deleteChecklist(id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    writeLocal(readLocal().filter((entry) => entry.id !== id))
    return
  }
  const { error } = await supabase.from('checklists').delete().eq('id', id)
  if (error) throw error
}

export async function publishChecklist(id: string, notes: string): Promise<number> {
  if (!isSupabaseConfigured || !supabase) {
    const all = readLocal()
    const target = all.find((entry) => entry.id === id)
    if (!target) throw new Error('Checklist not found.')
    target.status = 'published'
    target.current_version += 1
    writeLocal(all)
    return target.current_version
  }
  const { data, error } = await supabase.rpc('publish_checklist', {
    p_checklist_id: id,
    p_change_notes: notes,
  })
  if (error) throw error
  return Number(data)
}

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : 'Failed to call the checklist generator.'
  if (!error || typeof error !== 'object') return fallback

  const context = (error as { context?: unknown }).context
  if (!(context instanceof Response)) return fallback

  try {
    const response = context.clone()
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const body = await response.json() as { error?: unknown; message?: unknown }
      const message = body.error ?? body.message
      if (typeof message === 'string' && message.trim()) return message
    }

    const text = await context.clone().text()
    if (text.trim()) return text
  } catch {
    // Fall back to the Supabase client error message.
  }

  return fallback
}

export async function generateChecklist(request: GenerationRequest): Promise<GeneratedChecklist> {
  if (!isSupabaseConfigured || !supabase) return generateDemoChecklist(request)

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (!sessionData.session) throw new Error('Your session has expired. Sign in again and retry.')

  const { data, error } = await supabase.functions.invoke('checklist-generator', {
    body: request,
    headers: {
      Authorization: `Bearer ${sessionData.session.access_token}`,
    },
  })
  if (error) throw new Error(await getFunctionErrorMessage(error))
  if (!data?.checklist) throw new Error(data?.error || 'The AI function returned an invalid checklist.')
  return data.checklist as GeneratedChecklist
}

export function blankChecklist(): Checklist {
  return makeBlankChecklist()
}

export function duplicateChecklist(source: Checklist): Checklist {
  const draft = makeBlankChecklist()
  const sectionIdMap = new Map<string, string>()
  draft.name = `${source.name} Copy`
  draft.description = source.description
  draft.industry = source.industry
  draft.purpose = source.purpose
  draft.assigned_role = source.assigned_role
  draft.frequency = source.frequency
  draft.estimated_minutes = source.estimated_minutes
  draft.scoring_enabled = source.scoring_enabled
  draft.sections = source.sections.map((section, sectionIndex): ChecklistSection => {
    const newSectionId = crypto.randomUUID()
    sectionIdMap.set(section.id, newSectionId)
    return {
      id: newSectionId,
      title: section.title,
      instructions: section.instructions,
      sort_order: sectionIndex,
      items: section.items.map((item, itemIndex) => ({
        ...item,
        id: crypto.randomUUID(),
        section_id: newSectionId,
        sort_order: itemIndex,
      })),
    }
  })
  return draft
}
