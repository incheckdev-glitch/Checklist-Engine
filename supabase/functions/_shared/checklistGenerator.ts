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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function text(value: unknown, fallback = '', max = 1000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : fallback
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function numberValue(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

function normalizeConfig(value: unknown): JsonRecord {
  if (!isRecord(value)) return {}
  const result: JsonRecord = {}
  const allowed = [
    'unit', 'decimal_places', 'normal_min', 'normal_max', 'warning_min', 'warning_max',
    'critical_min', 'critical_max', 'compliant_value', 'options', 'failure_options',
    'allow_multiple', 'min_files', 'max_files', 'camera_only', 'min', 'max', 'step',
    'pass_threshold', 'expression', 'display_unit', 'expected_code', 'duplicate_prevention',
    'default_now', 'default_today', 'min_seconds', 'max_seconds', 'min_length', 'max_length',
    'signer_role', 'checklist_id', 'independent_scoring', 'checked_label', 'level',
  ]

  for (const key of allowed) {
    const entry = value[key]
    if (entry === null || entry === undefined) continue
    if (Array.isArray(entry)) {
      result[key] = entry.filter((item) => typeof item === 'string').slice(0, 15)
    } else if (typeof entry === 'string') {
      result[key] = entry.slice(0, 500)
    } else if (typeof entry === 'number' && Number.isFinite(entry)) {
      result[key] = entry
    } else if (typeof entry === 'boolean') {
      result[key] = entry
    }
  }
  return result
}

function normalizeChecklist(value: unknown, request: GenerationRequest): JsonRecord {
  if (!isRecord(value)) throw new Error('OpenAI returned an invalid checklist object.')

  const assignedRole = text(value.assigned_role, request.assigned_role || '', 120)
  const sections: JsonRecord[] = []
  const rawSections = Array.isArray(value.sections) ? value.sections : []
  let remainingItems = 12

  for (const rawSection of rawSections) {
    if (sections.length >= 4 || remainingItems <= 0) break
    if (!isRecord(rawSection)) continue

    const items: JsonRecord[] = []
    const rawItems = Array.isArray(rawSection.items) ? rawSection.items : []

    for (const rawItem of rawItems) {
      if (remainingItems <= 0) break
      if (!isRecord(rawItem)) continue

      const requestedType = String(rawItem.type || '')
      const type: ItemType = supportedTypes.includes(requestedType as ItemType)
        ? requestedType as ItemType
        : 'yes_no'
      const nonScored = [
        'title', 'instructions', 'picture', 'video', 'signature', 'date', 'time',
        'date_time', 'staff_member', 'formula',
      ].includes(type)

      let correctiveAction: JsonRecord | null = null
      if (isRecord(rawItem.corrective_action) && rawItem.corrective_action.enabled !== false) {
        const trigger = ['failed', 'warning', 'critical', 'always'].includes(String(rawItem.corrective_action.trigger))
          ? String(rawItem.corrective_action.trigger)
          : 'failed'
        correctiveAction = {
          enabled: true,
          trigger,
          require_comment: bool(rawItem.corrective_action.require_comment, true),
          require_picture: bool(rawItem.corrective_action.require_picture, false),
          assign_role: text(rawItem.corrective_action.assign_role, assignedRole, 120),
        }
      }

      items.push({
        type,
        label: text(rawItem.label, `Checklist item ${items.length + 1}`, 350),
        description: text(rawItem.description, '', 500),
        required: bool(rawItem.required, !['title', 'instructions', 'formula'].includes(type)),
        weight: nonScored ? 0 : numberValue(rawItem.weight, 5, 0, 100),
        critical: bool(rawItem.critical, false),
        allow_na: bool(rawItem.allow_na, false),
        config: normalizeConfig(rawItem.config),
        conditions: [],
        corrective_action: correctiveAction,
      })
      remainingItems -= 1
    }

    if (items.length) {
      sections.push({
        title: text(rawSection.title, `Section ${sections.length + 1}`, 160),
        instructions: text(rawSection.instructions, '', 400),
        items,
      })
    }
  }

  if (!sections.length) throw new Error('OpenAI returned no usable checklist sections.')

  return {
    name: text(value.name, request.purpose ? `${request.purpose} Checklist` : 'AI Generated Checklist', 180),
    description: text(value.description, request.description, 1000),
    industry: text(value.industry, request.industry || '', 120),
    purpose: text(value.purpose, request.purpose || '', 180),
    assigned_role: assignedRole,
    frequency: text(value.frequency, request.frequency || 'As needed', 80),
    estimated_minutes: Math.round(numberValue(value.estimated_minutes, request.estimated_minutes || 10, 1, 180)),
    scoring_enabled: bool(value.scoring_enabled, request.scoring_enabled !== false),
    sections,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const openAIKey = Deno.env.get('OPENAI_API_KEY')
  const model = Deno.env.get('OPENAI_CHECKLIST_MODEL')?.trim() || 'gpt-4.1-mini'
  const authorization = req.headers.get('Authorization')

  if (req.method === 'GET') {
    return jsonResponse({
      ok: true,
      function: 'checklist-generator',
      openai_configured: Boolean(openAIKey),
      model,
      implementation: 'low-compute',
    })
  }
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)
  if (!openAIKey) return jsonResponse({ error: 'OPENAI_API_KEY secret is not configured.' }, 500)
  if (!authorization) return jsonResponse({ error: 'Authorization is required.' }, 401)

  let body: GenerationRequest
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON.' }, 400)
  }

  if (!body.description?.trim()) return jsonResponse({ error: 'Checklist description is required.' }, 400)
  if (body.description.length > 4000) return jsonResponse({ error: 'The checklist description is too long.' }, 400)

  const sourceText = body.source_text?.trim().slice(0, 6000) || ''
  const prompt = `Create one compact operational checklist as valid JSON only.

Top-level keys: name, description, industry, purpose, assigned_role, frequency, estimated_minutes, scoring_enabled, sections.
Each section: title, instructions, items.
Each item: type, label, description, required, weight, critical, allow_na, config, corrective_action.
Supported types: ${supportedTypes.join(', ')}.
Corrective action is null or {"enabled":true,"trigger":"failed","require_comment":true,"require_picture":false,"assign_role":"role"}.
Use only relevant config values. Maximum 4 sections and 12 total items. Use varied field types, concise labels, and weight 0 for information, media, date/time, staff, formula, and signature fields.

Request: ${body.description.trim()}
Industry: ${body.industry || 'Not specified'}
Purpose: ${body.purpose || 'Not specified'}
Assigned role: ${body.assigned_role || 'Not specified'}
Frequency: ${body.frequency || 'As needed'}
Evidence: ${body.evidence_level || 'balanced'}
Scoring: ${body.scoring_enabled !== false}
Target minutes: ${body.estimated_minutes || 10}
${sourceText ? `SOP text:\n${sourceText}` : ''}`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(90000),
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are an operational checklist architect. Return a single valid JSON object only, without markdown.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_completion_tokens: 3500,
      }),
    })

    const payload = await response.json() as JsonRecord
    if (!response.ok) {
      const errorMessage = isRecord(payload.error)
        ? text(payload.error.message, 'OpenAI request failed.', 1000)
        : 'OpenAI request failed.'
      throw new Error(errorMessage)
    }

    const choices = Array.isArray(payload.choices) ? payload.choices : []
    const firstChoice = isRecord(choices[0]) ? choices[0] : null
    const message = firstChoice && isRecord(firstChoice.message) ? firstChoice.message : null
    const content = message ? text(message.content, '', 50000) : ''
    if (!content) throw new Error('OpenAI returned no checklist content.')

    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Invalid JSON.'
      throw new Error(`OpenAI returned invalid JSON: ${detail}`)
    }

    return jsonResponse({ checklist: normalizeChecklist(parsed, body), model })
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
    const message = timedOut
      ? 'AI generation exceeded 90 seconds. Retry with a shorter description or SOP.'
      : error instanceof Error
      ? error.message
      : 'Checklist generation failed.'
    return jsonResponse({ error: message }, timedOut ? 504 : 500)
  }
})
