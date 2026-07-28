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

export type Condition = {
  source_item_id: string
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains'
  value: string | number | boolean
  action: 'show' | 'hide' | 'require' | 'create_corrective_action'
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
  config: Record<string, unknown>
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
