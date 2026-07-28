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

const configProperties = {
  unit: { type: ['string', 'null'] },
  decimal_places: { type: ['integer', 'null'] },
  normal_min: { type: ['number', 'null'] },
  normal_max: { type: ['number', 'null'] },
  warning_min: { type: ['number', 'null'] },
  warning_max: { type: ['number', 'null'] },
  critical_min: { type: ['number', 'null'] },
  critical_max: { type: ['number', 'null'] },
  compliant_value: { type: ['boolean', 'null'] },
  options: { type: ['array', 'null'], items: { type: 'string' } },
  failure_options: { type: ['array', 'null'], items: { type: 'string' } },
  allow_multiple: { type: ['boolean', 'null'] },
  min_files: { type: ['integer', 'null'] },
  max_files: { type: ['integer', 'null'] },
  camera_only: { type: ['boolean', 'null'] },
  min: { type: ['number', 'null'] },
  max: { type: ['number', 'null'] },
  step: { type: ['number', 'null'] },
  pass_threshold: { type: ['number', 'null'] },
  expression: { type: ['string', 'null'] },
  display_unit: { type: ['string', 'null'] },
  expected_code: { type: ['string', 'null'] },
  duplicate_prevention: { type: ['boolean', 'null'] },
  default_now: { type: ['boolean', 'null'] },
  default_today: { type: ['boolean', 'null'] },
  min_seconds: { type: ['integer', 'null'] },
  max_seconds: { type: ['integer', 'null'] },
  min_length: { type: ['integer', 'null'] },
  max_length: { type: ['integer', 'null'] },
  signer_role: { type: ['string', 'null'] },
  checklist_id: { type: ['string', 'null'] },
  independent_scoring: { type: ['boolean', 'null'] },
  checked_label: { type: ['string', 'null'] },
  level: { type: ['integer', 'null'] },
} as const

const checklistSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'name', 'description', 'industry', 'purpose', 'assigned_role', 'frequency',
    'estimated_minutes', 'scoring_enabled', 'sections',
  ],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 180 },
    description: { type: 'string', maxLength: 2000 },
    industry: { type: 'string', maxLength: 120 },
    purpose: { type: 'string', maxLength: 180 },
    assigned_role: { type: 'string', maxLength: 120 },
    frequency: { type: 'string', maxLength: 80 },
    estimated_minutes: { type: 'integer', minimum: 1, maximum: 180 },
    scoring_enabled: { type: 'boolean' },
    sections: {
      type: 'array',
      minItems: 1,
      maxItems: 15,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'instructions', 'items'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 180 },
          instructions: { type: 'string', maxLength: 1000 },
          items: {
            type: 'array',
            minItems: 1,
            maxItems: 30,
            items: {
              type: 'object',
              additionalProperties: false,
              required: [
                'type', 'label', 'description', 'required', 'weight', 'critical', 'allow_na',
                'config', 'conditions', 'corrective_action',
              ],
              properties: {
                type: { type: 'string', enum: supportedTypes },
                label: { type: 'string', minLength: 1, maxLength: 500 },
                description: { type: 'string', maxLength: 1000 },
                required: { type: 'boolean' },
                weight: { type: 'number', minimum: 0, maximum: 100 },
                critical: { type: 'boolean' },
                allow_na: { type: 'boolean' },
                config: {
                  type: 'object',
                  additionalProperties: false,
                  required: Object.keys(configProperties),
                  properties: configProperties,
                },
                conditions: {
                  type: 'array',
                  maxItems: 0,
                  items: { type: 'string' },
                },
                corrective_action: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['enabled', 'trigger', 'require_comment', 'require_picture', 'assign_role'],
                  properties: {
                    enabled: { type: 'boolean' },
                    trigger: { type: 'string', enum: ['failed', 'warning', 'critical', 'always'] },
                    require_comment: { type: 'boolean' },
                    require_picture: { type: 'boolean' },
                    assign_role: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const

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

function extractOutputText(response: Record<string, unknown>): string {
  const output = Array.isArray(response.output) ? response.output : []
  for (const outputItem of output) {
    if (!outputItem || typeof outputItem !== 'object') continue
    const content = Array.isArray((outputItem as Record<string, unknown>).content)
      ? (outputItem as Record<string, unknown>).content as Array<Record<string, unknown>>
      : []
    for (const contentItem of content) {
      if (contentItem.type === 'output_text' && typeof contentItem.text === 'string') return contentItem.text
    }
  }
  throw new Error('OpenAI returned no structured output text.')
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

  if (!supabaseUrl || !supabaseAnonKey) return jsonResponse({ error: 'Supabase environment is incomplete.' }, 500)
  if (!openAIKey) return jsonResponse({ error: 'OPENAI_API_KEY secret is not configured.' }, 500)
  if (!authorization) return jsonResponse({ error: 'Authorization is required.' }, 401)

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return jsonResponse({ error: 'Invalid authenticated user.' }, 401)

  let body: GenerationRequest
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON.' }, 400)
  }

  if (!body.description?.trim()) return jsonResponse({ error: 'Checklist description is required.' }, 400)
  if (body.description.length > 6000 || (body.source_text?.length || 0) > 30000) {
    return jsonResponse({ error: 'The description or source text is too long.' }, 400)
  }

  const systemPrompt = `
You are an operational compliance checklist architect for InCheck 360.
Create a complete, practical, frontline-ready checklist using only these item types:
${supportedTypes.join(', ')}.

Mandatory design rules:
- Begin with useful identification/context fields, then operational sections, then review/approval.
- Do not make every item yes/no. Use measurement for values and ranges, media only for valuable evidence,
  staff_member for accountability, signature only for formal approval, and sub_checklist for repeated processes.
- Use clear action-oriented labels. Avoid duplicated, vague, or compound questions.
- Mark only truly high-risk items as critical.
- For failed or out-of-range operational items, add an appropriate corrective_action rule.
- For measurement config include relevant unit, decimal_places, normal_min, normal_max, warning_min, and warning_max.
- For multiple_choice config include options, allow_multiple, and failure_options.
- For ratings include min, max, step, and pass_threshold.
- For media include min_files, max_files, and camera_only.
- For yes_no include compliant_value.
- For formula use an expression such as weighted_pass_percentage().
- Conditions may be empty because item IDs are assigned by the application after generation.
- Non-scored information/evidence/signature items should have weight 0.
- Keep the full checklist realistic for the target completion time.
- Return only the structured checklist object.
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
          format: {
            type: 'json_schema',
            name: 'incheck_checklist',
            strict: true,
            schema: checklistSchema,
          },
        },
        max_output_tokens: 12000,
      }),
    })

    const openAIRaw = await openAIResponse.text()
    let openAIJson: Record<string, unknown> = {}
    try {
      openAIJson = openAIRaw ? JSON.parse(openAIRaw) as Record<string, unknown> : {}
    } catch {
      if (!openAIResponse.ok) throw new Error(`OpenAI request failed with status ${openAIResponse.status}.`)
      throw new Error('OpenAI returned an invalid JSON response.')
    }

    if (!openAIResponse.ok) {
      const apiError = typeof openAIJson.error === 'object' && openAIJson.error
        ? String((openAIJson.error as Record<string, unknown>).message || 'OpenAI request failed.')
        : `OpenAI request failed with status ${openAIResponse.status}.`
      throw new Error(apiError)
    }

    const outputText = extractOutputText(openAIJson)
    const checklist = JSON.parse(outputText) as Record<string, unknown>

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
