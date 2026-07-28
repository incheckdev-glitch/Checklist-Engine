export type ChecklistStatus = 'draft' | 'under_review' | 'published' | 'archived'

export type ItemType =
  | 'checkmark'
  | 'yes_no'
  | 'signature'
  | 'staff_member'
  | 'multiple_choice'
  | 'video'
  | 'picture'
  | 'qr'
  | 'barcode'
  | 'measurement'
  | 'rating_1_5'
  | 'rating_1_10'
  | 'rating_custom'
  | 'formula'
  | 'date_time'
  | 'date'
  | 'time'
  | 'stopwatch'
  | 'long_entry'
  | 'short_entry'
  | 'instructions'
  | 'title'
  | 'sub_checklist'

export type ConditionOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains'

export type Condition = {
  source_item_id: string
  operator: ConditionOperator
  value: string | number | boolean
  action: 'show' | 'hide' | 'require' | 'create_corrective_action'
}

export type VisibilitySettings = {
  mode: 'always' | 'conditional'
  match: 'all' | 'any'
  conditions: Condition[]
}

export type ReferenceMaterial = {
  name: string
  mime_type?: string
  size?: number
  url?: string
  data_url?: string
  display_inline: boolean
}

export type MeasurementRange = {
  id: string
  label: string
  min: number | null
  max: number | null
  status: 'normal' | 'warning' | 'critical'
}

export type AnswerTagRule = {
  id: string
  operator: ConditionOperator
  value: string | number | boolean
  tag: string
}

export type CorrectionMeasure = {
  enabled: boolean
  checklist_id: string
  optional: boolean
  trigger_answer: string
  action: 'additional_action' | 'repeat_item' | 'repeat_checklist' | 'do_not_repeat'
}

export type ItemConfiguration = Record<string, unknown> & {
  mark_as?: string
  background_color?: string
  label_tag?: string
  visibility?: VisibilitySettings
  reference_material?: ReferenceMaterial | null
  completion_mode?: 'auto' | 'manual'
  answer_tags?: AnswerTagRule[]
  correction_measure?: CorrectionMeasure
  ranges?: MeasurementRange[]
  input_methods?: {
    manual: boolean
    temperature_probe: boolean
    detector: boolean
  }
  inline_mobile?: boolean
  template_name?: string
}

export type CorrectiveActionRule = {
  enabled: boolean
  trigger: 'failed' | 'warning' | 'critical' | 'always'
  require_comment?: boolean
  require_picture?: boolean
  assign_role?: string
}

export type ChecklistItem = {
  id: string
  section_id: string
  type: ItemType
  label: string
  description: string
  required: boolean
  weight: number
  critical: boolean
  allow_na: boolean
  sort_order: number
  config: ItemConfiguration
  conditions: Condition[]
  corrective_action: CorrectiveActionRule | null
}

export type ChecklistSection = {
  id: string
  title: string
  instructions: string
  sort_order: number
  items: ChecklistItem[]
}

export type Checklist = {
  id: string
  name: string
  description: string
  industry: string
  purpose: string
  assigned_role: string
  frequency: string
  estimated_minutes: number
  scoring_enabled: boolean
  status: ChecklistStatus
  current_version: number
  created_at?: string
  updated_at?: string
  sections: ChecklistSection[]
}

export type GenerationRequest = {
  description: string
  industry: string
  purpose: string
  assigned_role: string
  frequency: string
  evidence_level: 'none' | 'balanced' | 'strict'
  scoring_enabled: boolean
  estimated_minutes: number
  source_text?: string
}

export type GeneratedChecklist = Omit<Checklist, 'id' | 'status' | 'current_version' | 'sections'> & {
  sections: Array<{
    title: string
    instructions: string
    items: Array<Omit<ChecklistItem, 'id' | 'section_id' | 'sort_order'>>
  }>
}
