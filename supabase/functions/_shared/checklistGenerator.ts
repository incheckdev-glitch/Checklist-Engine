import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const supportedTypes = [
  'checkmark', 'yes_no', 'signature', 'staff_member', 'multiple_choice', 'video', 'picture',
  'qr', 'barcode', 'measurement', 'rating_1_5', 'rating_1_10', 'rating_custom', 'formula',
  'date_time', 'date', 'time', 'stopwatch', 'long_entry', 'short_entry', 'instructions', 'title',
  'sub_checklist',
] as const

type ItemType = typeof supportedTypes[number]
type JsonRecord = Record<string, unknown>

type GenerationRequest = {
  description: string
  industry?: string
  purpose?: string
  assigned_role?: string
  frequency?: string
  evidence_level?: 'none' | 'balanced' | 'strict'
  scoring_enabled?: boolean
  estimated_minutes?: number
  source_text?: string
}

const allowedConfigKeys = new Set([
  'unit', 'decimal_places', 'normal_min', 'normal_max', 'warning_min', 'warning_max',
  'critical_min', 'critical_max', 'compliant_value', 'options', 'failure_options',
  'allow_multiple', 'min_files', 'max_files', 'camera_only', 'min', 'max', 'step',
  'pass_threshold', 'expression', 'display_unit', 'expected_code', 'duplicate_prevention',
  'default_now', 'default_today', 'min_seconds', 'max_seconds', 'min_length', 'max_length',
  'signer_role', 'checklist_id', 'independent_scoring', 'checked_label', 'level',
])

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asString(value: unknown, fallback = '', maxLength = 2000): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : fallback
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function asNumber(value: unknown, fallback = 0, min = -1_000_000, max = 1_000_000): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function asInteger(value: unknown, fallback = 0, min = -1_000_000, max = 1_000_000): number {
  return Math.round(asNumber(value, fallback, min, max))
}

function normalizeConfig(value: unknown): JsonRecord {
  if (!isRecord(value)) return {}

  const normalized: JsonRecord = {}
  for (const [key, entry] of Object.entries(value)) {
    if (!allowedConfigKeys.has(key) || entry === null || entry === undefined) continue

    if (key === 'options' || key === 'failure_options') {
      if (Array.isArray(entry)) {
        normalized[key] = entry
          .filter((option): option is string => typeof option === 'string')
          .map((option) => option.trim())
          .filter(Boolean)
          .slice(0, 20)
      }
      continue
    }

    if (typeof entry === 'string') normalized[key] = entry.slice(0, 500)
    else if (typeof entry === 'number' && Number.isFinite(entry)) normalized[key] = entry
    else if (typeof entry === 'boolean') normalized[key] = entry
  }
  return normalized
}

function normalizeCorrectiveAction(value: unknown, assignedRole: string): JsonRecord | null {
  if (!isRecord(value) || value.enabled === false) return null

  const trigger = ['failed', 'warning', 'critical', 'always'].includes(String(value.trigger))
    ? String(value.trigger)
    : 'failed'

  return {
    enabled: true,
    trigger,
    require_comment: asBoolean(value.require_comment, true),
    require_picture: asBoolean(value.require_picture, false),
    assign_role: asString(value.assign_role, assignedRole, 120),
  }
}

function normalizeChecklist(value: unknown, request: GenerationRequest): JsonRecord {
  if (!isRecord(value)) throw new Error('OpenAI returned an invalid checklist object.')

  const assignedRole = asString(value.assigned_role, request.assigned_role || '', 120)
  const rawSections = Array.isArray(value.sections) ? value.sections : []
  const sections: JsonRecord[] = []
  let remainingItems = 18

  for (let sectionIndex = 0; sectionIndex < rawSections.length && sections.length < 6 && remainingItems > 0; sectionIndex += 1) {
    const rawSection = rawSections[sectionIndex]
    if (!isRecord(rawSection)) continue

    const rawItems = Array.isArray(rawSection.items) ? rawSection.items : []
    const items: JsonRecord[] = []

    for (let itemIndex = 0; itemIndex < rawItems.length && remainingItems > 0; itemIndex += 1) {
      const item = rawItems[itemIndex]
      if (!isRecord(item)) continue

      const requestedType = String(item.type || '')
      const type: ItemType = supportedTypes.includes(requestedType as ItemType)
        ? requestedType as ItemType
        : 'yes_no'

      const nonScored = [
        'title', 'instructions', 'picture', 'video', 'signature', 'date', 'time',
        'date_time', 'staff_member', 'formula',
      ].includes(type)

      items.push({
        type,
        label: asString(item.label, `Checklist item ${itemIndex + 1}`, 350),
        description: asString(item.description, '', 600),
        required: asBoolean(item.required, !['title', 'instructions', 'formula'].includes(type)),
        weight: nonScored ? 0 : asNumber(item.weight, 5, 0, 100),
        critical: asBoolean(item.critical, false),
        allow_na: asBoolean(item.allow_na, false),
        config: normalizeConfig(item.config),
        conditions: [],
        corrective_action: normalizeCorrectiveAction(item.corrective_action, assignedRole),
      })
      remainingItems -= 1
    }

    if (items.length) {
      sections.push({
        title: asString(rawSection.title, `Section ${sections.length + 1}`, 160),
        instructions: asString(rawSection.instructions, '', 600),
        items,
      })
    }
  }

  if (!sections.length) throw new Error('OpenAI returned a checklist without usable sections or items.')

  return {
    name: asString(value.name, request.purpose ? `${request.purpose} Checklist` : 'AI Generated Checklist', 180),
    description: asString(value.description, request.description, 1200),
    industry: asString(value.industry, request.industry || '', 120),
    purpose: asString(value.purpose, request.purpose || '', 180),
    assigned_role: assignedRole,
    frequency: asString(value.frequency, request.frequency || 'As needed', 80),
    estimated_minutes: asInteger(value.estimated_minutes, request.estimated_minutes || 10, 1, 180),
    scoring_enabled: asBoolean(value.scoring_enabled, request.scoring_enabled !== false),
    sections,
  }
}

function extractOutputText(response: JsonRecord): string {
  if (typeof response.output_text === 'string' && response.output_text.trim()) return response.output_text

  const output = Array.isArray(response.output) ? response.output : []
  for (const outputItem of output) {
    if (!isRecord(outputItem)) continue
    const content = Array.isArray(outputItem.content) ? outputItem.content : []
    for (const contentItem of content) {
      if (isRecord(contentItem) && contentItem.type === 'output_text' && typeof contentItem.text === 'string') {
        return contentItem.text
      }
      if (isRecord(contentItem) && contentItem.type === 'refusal' && typeof contentItem.refusal === 'string') {
        throw new Error(contentItem.refusal)
      }
    }
  }
  throw new Error('OpenAI returned no checklist output.')
}

function getOpenAIError(response: JsonRecord): string {
  if (isRecord(response.error)) return asString(response.error.message, 'OpenAI request failed.', 1000)
  return 'OpenAI request failed.'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const openAIKey = Deno.env.get('OPENAI_API_KEY')
  const model = Deno.env.get('OPENAI_CHECKLIST_MODEL')?.trim() || 'gpt-4.1-mini'
  const authorization = req.headers.get('Authorization')

  if (req.method === 'GET') {
    return jsonResponse({
      ok: true,
      function: 'checklist-generator',
      openai_configured: Boolean(openAIKey),
      model,
      timeout_protection_ms: 115000,
    })
  }
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  if (!supabaseUrl || !supabaseAnonKey) return jsonResponse({ error: 'Supabase environment is incomplete.' }, 500)
  if (!openAIKey) return jsonResponse({ error: 'OPENAI_API_KEY secret is not configured.' }, 500)
  if (!authorization) return jsonResponse({ error: 'Authorization is required.' }, 401)

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return jsonResponse({ error: 'Invalid or expired authenticated user session.' }, 401)

  let body: GenerationRequest
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON.' }, 400)
  }

  if (!body.description?.trim()) return jsonResponse({ error: 'Checklist description is required.' }, 400)
  if (body.description.length > 5000) return jsonResponse({ error: 'The checklist description is too long.' }, 400)

  const sourceText = body.source_text?.trim().slice(0, 12000) || ''
  const systemPrompt = `
You design operational compliance checklists for InCheck 360.
Return one compact valid JSON object only. Do not use markdown or code fences.

Required top-level keys:
name, description, industry, purpose, assigned_role, frequency, estimated_minutes, scoring_enabled, sections.

Each section requires: title, instructions, items.
Each item requires: type, label, description, required, weight, critical, allow_na, config, corrective_action.

Supported item types:
${supportedTypes.join(', ')}.

Use only relevant config keys:
measurement: unit, decimal_places, normal_min, normal_max, warning_min, warning_max, critical_min, critical_max
yes_no: compliant_value
multiple_choice: options, failure_options, allow_multiple
picture/video: min_files, max_files, camera_only
rating: min, max, step, pass_threshold
formula: expression, display_unit
qr/barcode: expected_code, duplicate_prevention
date_time: default_now
date: default_today
stopwatch: min_seconds, max_seconds
short_entry/long_entry: min_length, max_length
signature: signer_role
sub_checklist: checklist_id, independent_scoring
checkmark: checked_label
title: level

Corrective action is null or:
{"enabled":true,"trigger":"failed","require_comment":true,"require_picture":false,"assign_role":"role"}

Rules:
- Maximum 6 sections and 18 total items.
- Start with identification, continue with operational checks, finish with review/approval.
- Use varied field types; do not make everything yes/no.
- Keep labels and descriptions concise.
- Mark only genuine high-risk items critical.
- Use weight 0 for information, media, formula, date/time, staff member, and signature items.
- Add corrective actions only where failure or an out-of-range result needs follow-up.
`.trim()

  const userPrompt = `
Checklist request: ${body.description.trim()}
Industry: ${body.industry || 'Not specified'}
Purpose: ${body.purpose || 'Not specified'}
Assigned role: ${body.assigned_role || 'Not specified'}
Frequency: ${body.frequency || 'As needed'}
Evidence level: ${body.evidence_level || 'balanced'}
Scoring enabled: ${body.scoring_enabled !== false}
Target duration: ${body.estimated_minutes || 10} minutes
${sourceText ? `Source SOP/procedure text:\n${sourceText}` : ''}
`.trim()

  try {
    const openAIResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(115000),
      body: JSON.stringify({
        model,
        store: false,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
          { role: 'user', content: [{ type: 'input_text', text: userPrompt }] },
        ],
        text: {
          format: { type: 'json_object' },
          verbosity: 'low',
        },
        max_output_tokens: 6500,
      }),
    })

    const openAIJson = await openAIResponse.json() as JsonRecord
    if (!openAIResponse.ok) throw new Error(getOpenAIError(openAIJson))

    if (openAIJson.status === 'incomplete') {
      const reason = isRecord(openAIJson.incomplete_details)
        ? asString(openAIJson.incomplete_details.reason, 'unknown reason', 100)
        : 'unknown reason'
      throw new Error(`OpenAI returned an incomplete checklist (${reason}). Reduce the SOP length and retry.`)
    }
    if (openAIJson.status === 'failed') throw new Error(getOpenAIError(openAIJson))

    const outputText = extractOutputText(openAIJson).trim()
    let rawChecklist: unknown
    try {
      rawChecklist = JSON.parse(outputText)
    } catch (parseError) {
      const detail = parseError instanceof Error ? parseError.message : 'Invalid JSON.'
      throw new Error(`OpenAI returned invalid JSON: ${detail}. Please retry.`)
    }

    const checklist = normalizeChecklist(rawChecklist, body)

    await supabase.from('ai_generation_logs').insert({
      user_id: userData.user.id,
      request_summary: body.description.slice(0, 500),
      model,
      status: 'success',
    })

    return jsonResponse({ checklist, model })
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === 'TimeoutError'
    const message = isTimeout
      ? 'AI generation exceeded 115 seconds and was stopped before the Supabase timeout. Please retry with a shorter SOP.'
      : error instanceof Error
      ? error.message
      : 'Checklist generation failed.'

    await supabase.from('ai_generation_logs').insert({
      user_id: userData.user.id,
      request_summary: body.description.slice(0, 500),
      model,
      status: 'failed',
      error_message: message.slice(0, 1000),
    })
    return jsonResponse({ error: message }, isTimeout ? 504 : 500)
  }
})
