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
  'pass_threshold', 'expression', 'display_unit', 'expected_code',
  'duplicate_prevention', 'default_now', 'default_today', 'min_seconds',
  'max_seconds', 'min_length', 'max_length', 'signer_role', 'checklist_id',
  'independent_scoring', 'checked_label', 'level',
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
          .slice(0, 30)
      }
      continue
    }

    if (typeof entry === 'string') normalized[key] = entry.slice(0, 1000)
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

  const sections = rawSections
    .filter(isRecord)
    .slice(0, 12)
    .map((section, sectionIndex) => {
      const rawItems = Array.isArray(section.items) ? section.items : []
      const items = rawItems
        .filter(isRecord)
        .slice(0, 25)
        .map((item, itemIndex) => {
          const requestedType = String(item.type || '')
          const type: ItemType = supportedTypes.includes(requestedType as ItemType)
            ? requestedType as ItemType
            : 'yes_no'

          const nonScored = [
            'title', 'instructions', 'picture', 'video', 'signature', 'date', 'time',
            'date_time', 'staff_member', 'formula',
          ].includes(type)

          return {
            type,
            label: asString(item.label, `Checklist item ${itemIndex + 1}`, 500),
            description: asString(item.description, '', 1000),
            required: asBoolean(item.required, !['title', 'instructions', 'formula'].includes(type)),
            weight: nonScored ? 0 : asNumber(item.weight, 5, 0, 100),
            critical: asBoolean(item.critical, false),
            allow_na: asBoolean(item.allow_na, false),
            config: normalizeConfig(item.config),
            conditions: [],
            corrective_action: normalizeCorrectiveAction(item.corrective_action, assignedRole),
          }
        })

      return {
        title: asString(section.title, `Section ${sectionIndex + 1}`, 180),
        instructions: asString(section.instructions, '', 1000),
        items,
      }
    })
    .filter((section) => section.items.length > 0)

  if (!sections.length) throw new Error('OpenAI returned a checklist without usable sections or items.')

  return {
    name: asString(value.name, request.purpose ? `${request.purpose} Checklist` : 'AI Generated Checklist', 180),
    description: asString(value.description, request.description, 2000),
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
  if (isRecord(response.error)) {
    return asString(response.error.message, 'OpenAI request failed.', 1000)
  }
  return 'OpenAI request failed.'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const openAIKey = Deno.env.get('OPENAI_API_KEY')
  const model = Deno.env.get('OPENAI_MODEL') || 'gpt-5-mini'
  const authorization = req.headers.get('Authorization')

  if (req.method === 'GET') {
    return jsonResponse({
      ok: true,
      function: 'checklist-generator',
      openai_configured: Boolean(openAIKey),
      model,
    })
  }
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: 'Supabase environment is incomplete.' }, 500)
  }
  if (!openAIKey) {
    return jsonResponse({ error: 'OPENAI_API_KEY secret is not configured.' }, 500)
  }
  if (!authorization) return jsonResponse({ error: 'Authorization is required.' }, 401)

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return jsonResponse({ error: 'Invalid or expired authenticated user session.' }, 401)
  }

  let body: GenerationRequest
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON.' }, 400)
  }

  if (!body.description?.trim()) {
    return jsonResponse({ error: 'Checklist description is required.' }, 400)
  }
  if (body.description.length > 6000 || (body.source_text?.length || 0) > 30000) {
    return jsonResponse({ error: 'The description or source text is too long.' }, 400)
  }

  const systemPrompt = `
You are an operational compliance checklist architect for InCheck 360.
Return one valid JSON object only. Do not use markdown or code fences.

Use this exact structure:
{
  "name": "string",
  "description": "string",
  "industry": "string",
  "purpose": "string",
  "assigned_role": "string",
  "frequency": "string",
  "estimated_minutes": 10,
  "scoring_enabled": true,
  "sections": [
    {
      "title": "string",
      "instructions": "string",
      "items": [
        {
          "type": "one supported type",
          "label": "string",
          "description": "string",
          "required": true,
          "weight": 5,
          "critical": false,
          "allow_na": false,
          "config": {},
          "corrective_action": null
        }
      ]
    }
  ]
}

Supported item types:
${supportedTypes.join(', ')}.

Only add configuration keys that apply to the selected item:
- measurement: unit, decimal_places, normal_min, normal_max, warning_min, warning_max, critical_min, critical_max
- yes_no: compliant_value
- multiple_choice: options, failure_options, allow_multiple
- picture/video: min_files, max_files, camera_only
- rating: min, max, step, pass_threshold
- formula: expression, display_unit
- qr/barcode: expected_code, duplicate_prevention
- date_time: default_now
- date: default_today
- stopwatch: min_seconds, max_seconds
- short_entry/long_entry: min_length, max_length
- signature: signer_role
- sub_checklist: checklist_id, independent_scoring
- checkmark: checked_label
- title: level

Corrective action object when needed:
{
  "enabled": true,
  "trigger": "failed | warning | critical | always",
  "require_comment": true,
  "require_picture": false,
  "assign_role": "string"
}

Mandatory design rules:
- Create no more than 8 sections and no more than 24 total items.
- Begin with identification/context, continue with operational checks, and finish with review/approval.
- Do not make every item yes/no. Use measurements for numeric ranges, media only for useful evidence,
  staff_member for accountability, signature only for formal approval, and sub_checklist for repeated processes.
- Keep labels concise, action-oriented, and free of duplicates.
- Mark only genuinely high-risk items as critical.
- Add corrective actions to failed or out-of-range operational items.
- Non-scored information, evidence, formula, and signature items must have weight 0.
- Keep the checklist realistic for the requested completion time.
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
${body.source_text?.trim() ? `Source SOP/procedure text:\n${body.source_text.trim()}` : ''}
`.trim()

  try {
    const openAIResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        store: false,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
          { role: 'user', content: [{ type: 'input_text', text: userPrompt }] },
        ],
        text: {
          format: { type: 'json_object' },
        },
        max_output_tokens: 30000,
      }),
    })

    const openAIJson = await openAIResponse.json() as JsonRecord
    if (!openAIResponse.ok) throw new Error(getOpenAIError(openAIJson))

    if (openAIJson.status === 'incomplete') {
      const reason = isRecord(openAIJson.incomplete_details)
        ? asString(openAIJson.incomplete_details.reason, 'unknown reason', 100)
        : 'unknown reason'
      throw new Error(
        `OpenAI returned an incomplete checklist (${reason}). Retry with a shorter SOP or a shorter requested checklist.`,
      )
    }
    if (openAIJson.status === 'failed') throw new Error(getOpenAIError(openAIJson))

    const outputText = extractOutputText(openAIJson).trim()
    let rawChecklist: unknown
    try {
      rawChecklist = JSON.parse(outputText)
    } catch (parseError) {
      const detail = parseError instanceof Error ? parseError.message : 'Invalid JSON.'
      throw new Error(`OpenAI returned incomplete or invalid JSON: ${detail}. Please retry.`)
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
    const message = error instanceof Error ? error.message : 'Checklist generation failed.'
    await supabase.from('ai_generation_logs').insert({
      user_id: userData.user.id,
      request_summary: body.description.slice(0, 500),
      model,
      status: 'failed',
      error_message: message.slice(0, 1000),
    })
    return jsonResponse({ error: message }, 500)
  }
})
