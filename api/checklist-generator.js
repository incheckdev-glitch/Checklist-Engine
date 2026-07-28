const supportedTypes = [
  'checkmark', 'yes_no', 'signature', 'staff_member', 'multiple_choice', 'video', 'picture',
  'qr', 'barcode', 'measurement', 'rating_1_5', 'rating_1_10', 'rating_custom', 'formula',
  'date_time', 'date', 'time', 'stopwatch', 'long_entry', 'short_entry', 'instructions', 'title',
  'sub_checklist',
]

function send(res, status, body) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(body)
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asText(value, fallback = '', maxLength = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : fallback
}

function asBoolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function asNumber(value, fallback, min, max) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

function normalizeConfig(value) {
  if (!isRecord(value)) return {}
  const result = {}
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
    if (Array.isArray(entry)) result[key] = entry.filter((item) => typeof item === 'string').slice(0, 15)
    else if (typeof entry === 'string') result[key] = entry.slice(0, 500)
    else if (typeof entry === 'number' && Number.isFinite(entry)) result[key] = entry
    else if (typeof entry === 'boolean') result[key] = entry
  }
  return result
}

function normalizeChecklist(value, request) {
  if (!isRecord(value)) throw new Error('OpenAI returned an invalid checklist object.')

  const assignedRole = asText(value.assigned_role, request.assigned_role || '', 120)
  const rawSections = Array.isArray(value.sections) ? value.sections : []
  const sections = []
  let remainingItems = 18

  for (const rawSection of rawSections) {
    if (sections.length >= 6 || remainingItems <= 0) break
    if (!isRecord(rawSection)) continue

    const rawItems = Array.isArray(rawSection.items) ? rawSection.items : []
    const items = []

    for (const rawItem of rawItems) {
      if (remainingItems <= 0) break
      if (!isRecord(rawItem)) continue

      const requestedType = String(rawItem.type || '')
      const type = supportedTypes.includes(requestedType) ? requestedType : 'yes_no'
      const nonScored = [
        'title', 'instructions', 'picture', 'video', 'signature', 'date', 'time',
        'date_time', 'staff_member', 'formula',
      ].includes(type)

      let correctiveAction = null
      if (isRecord(rawItem.corrective_action) && rawItem.corrective_action.enabled !== false) {
        const requestedTrigger = String(rawItem.corrective_action.trigger || 'failed')
        correctiveAction = {
          enabled: true,
          trigger: ['failed', 'warning', 'critical', 'always'].includes(requestedTrigger) ? requestedTrigger : 'failed',
          require_comment: asBoolean(rawItem.corrective_action.require_comment, true),
          require_picture: asBoolean(rawItem.corrective_action.require_picture, false),
          assign_role: asText(rawItem.corrective_action.assign_role, assignedRole, 120),
        }
      }

      items.push({
        type,
        label: asText(rawItem.label, `Checklist item ${items.length + 1}`, 350),
        description: asText(rawItem.description, '', 500),
        required: asBoolean(rawItem.required, !['title', 'instructions', 'formula'].includes(type)),
        weight: nonScored ? 0 : asNumber(rawItem.weight, 5, 0, 100),
        critical: asBoolean(rawItem.critical, false),
        allow_na: asBoolean(rawItem.allow_na, false),
        config: normalizeConfig(rawItem.config),
        conditions: [],
        corrective_action: correctiveAction,
      })
      remainingItems -= 1
    }

    if (items.length) {
      sections.push({
        title: asText(rawSection.title, `Section ${sections.length + 1}`, 160),
        instructions: asText(rawSection.instructions, '', 500),
        items,
      })
    }
  }

  if (!sections.length) throw new Error('OpenAI returned no usable checklist sections.')

  return {
    name: asText(value.name, request.purpose ? `${request.purpose} Checklist` : 'AI Generated Checklist', 180),
    description: asText(value.description, request.description, 1200),
    industry: asText(value.industry, request.industry || '', 120),
    purpose: asText(value.purpose, request.purpose || '', 180),
    assigned_role: assignedRole,
    frequency: asText(value.frequency, request.frequency || 'As needed', 80),
    estimated_minutes: Math.round(asNumber(value.estimated_minutes, request.estimated_minutes || 10, 1, 180)),
    scoring_enabled: asBoolean(value.scoring_enabled, request.scoring_enabled !== false),
    sections,
  }
}

function extractOutputText(response) {
  if (typeof response.output_text === 'string' && response.output_text.trim()) return response.output_text
  const output = Array.isArray(response.output) ? response.output : []
  for (const outputItem of output) {
    if (!isRecord(outputItem)) continue
    const content = Array.isArray(outputItem.content) ? outputItem.content : []
    for (const contentItem of content) {
      if (isRecord(contentItem) && contentItem.type === 'output_text' && typeof contentItem.text === 'string') {
        return contentItem.text
      }
    }
  }
  throw new Error('OpenAI returned no checklist output.')
}

function openAIError(payload) {
  if (isRecord(payload.error)) return asText(payload.error.message, 'OpenAI request failed.', 1000)
  return 'OpenAI request failed.'
}

async function verifyUser(req) {
  const authorization = req.headers.authorization
  if (!authorization?.startsWith('Bearer ')) throw new Error('Authorization is required.')

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Supabase server environment variables are missing in Vercel.')

  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      Authorization: authorization,
      apikey: supabaseAnonKey,
    },
  })
  if (!response.ok) throw new Error('Your session is invalid or expired. Sign in again.')
  return await response.json()
}

function buildPrompt(body) {
  const sourceText = asText(body.source_text, '', 12000)
  return `Create one practical operational checklist as a compact valid JSON object only. Do not use markdown.

Required top-level keys: name, description, industry, purpose, assigned_role, frequency, estimated_minutes, scoring_enabled, sections.
Each section requires: title, instructions, items.
Each item requires: type, label, description, required, weight, critical, allow_na, config, corrective_action.
Supported item types: ${supportedTypes.join(', ')}.
Corrective action is null or {"enabled":true,"trigger":"failed","require_comment":true,"require_picture":false,"assign_role":"role"}.
Use only relevant configuration keys. Create no more than 6 sections and 18 total items. Use varied field types, concise labels, and weight 0 for informational, media, date/time, staff, formula, and signature items.

Checklist request: ${asText(body.description, '', 4000)}
Industry: ${asText(body.industry, 'Not specified', 120)}
Purpose: ${asText(body.purpose, 'Not specified', 180)}
Assigned role: ${asText(body.assigned_role, 'Not specified', 120)}
Frequency: ${asText(body.frequency, 'As needed', 80)}
Evidence level: ${asText(body.evidence_level, 'balanced', 20)}
Scoring enabled: ${body.scoring_enabled !== false}
Target duration: ${asNumber(body.estimated_minutes, 10, 1, 180)} minutes
${sourceText ? `Source SOP/procedure text:\n${sourceText}` : ''}`
}

export default async function handler(req, res) {
  res.setHeader('Allow', 'GET, POST')

  try {
    const user = await verifyUser(req)
    const openAIKey = process.env.OPENAI_API_KEY
    const model = process.env.OPENAI_CHECKLIST_MODEL || 'gpt-4.1-mini'
    if (!openAIKey) return send(res, 500, { error: 'OPENAI_API_KEY is missing in Vercel Environment Variables.' })

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      if (!isRecord(body) || !asText(body.description)) return send(res, 400, { error: 'Checklist description is required.' })

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAIKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          background: true,
          store: true,
          metadata: {
            user_id: String(user.id || ''),
            description: asText(body.description, '', 500),
            industry: asText(body.industry, '', 120),
            purpose: asText(body.purpose, '', 180),
            assigned_role: asText(body.assigned_role, '', 120),
            frequency: asText(body.frequency, 'As needed', 80),
            scoring_enabled: String(body.scoring_enabled !== false),
            estimated_minutes: String(asNumber(body.estimated_minutes, 10, 1, 180)),
          },
          input: [
            { role: 'system', content: [{ type: 'input_text', text: 'You are an operational checklist architect. Return exactly one valid JSON object.' }] },
            { role: 'user', content: [{ type: 'input_text', text: buildPrompt(body) }] },
          ],
          text: { format: { type: 'json_object' } },
          max_output_tokens: 6500,
        }),
      })
      const payload = await response.json()
      if (!response.ok) return send(res, response.status, { error: openAIError(payload) })
      if (!payload.id) return send(res, 500, { error: 'OpenAI did not return a background response ID.' })

      return send(res, 202, {
        status: payload.status || 'queued',
        response_id: payload.id,
        model,
      })
    }

    if (req.method === 'GET') {
      const rawId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id
      const responseId = asText(rawId, '', 200)
      if (!responseId.startsWith('resp_')) return send(res, 400, { error: 'A valid OpenAI response ID is required.' })

      const response = await fetch(`https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}`, {
        headers: { Authorization: `Bearer ${openAIKey}` },
      })
      const payload = await response.json()
      if (!response.ok) return send(res, response.status, { error: openAIError(payload) })
      if (String(payload.metadata?.user_id || '') !== String(user.id || '')) {
        return send(res, 403, { error: 'This AI generation request belongs to another user.' })
      }

      if (['queued', 'in_progress'].includes(payload.status)) {
        return send(res, 202, { status: payload.status, response_id: responseId, model: payload.model || model })
      }
      if (payload.status === 'failed' || payload.status === 'cancelled') {
        return send(res, 500, { error: openAIError(payload), status: payload.status })
      }
      if (payload.status === 'incomplete') {
        return send(res, 500, {
          error: `OpenAI returned an incomplete checklist (${payload.incomplete_details?.reason || 'unknown reason'}).`,
          status: payload.status,
        })
      }
      if (payload.status !== 'completed') {
        return send(res, 202, { status: payload.status || 'in_progress', response_id: responseId })
      }

      let parsed
      try {
        parsed = JSON.parse(extractOutputText(payload))
      } catch (error) {
        return send(res, 500, { error: error instanceof Error ? error.message : 'OpenAI returned invalid JSON.' })
      }

      const requestSnapshot = {
        description: asText(payload.metadata?.description, 'AI generated checklist'),
        industry: asText(payload.metadata?.industry, ''),
        purpose: asText(payload.metadata?.purpose, ''),
        assigned_role: asText(payload.metadata?.assigned_role, ''),
        frequency: asText(payload.metadata?.frequency, 'As needed'),
        scoring_enabled: String(payload.metadata?.scoring_enabled) !== 'false',
        estimated_minutes: asNumber(payload.metadata?.estimated_minutes, 10, 1, 180),
      }
      return send(res, 200, {
        status: 'completed',
        checklist: normalizeChecklist(parsed, requestSnapshot),
        model: payload.model || model,
      })
    }

    return send(res, 405, { error: 'Method not allowed.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Checklist generation failed.'
    const status = message.includes('Authorization') || message.includes('session') ? 401 : 500
    return send(res, status, { error: message })
  }
}
