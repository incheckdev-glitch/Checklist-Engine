import type { Checklist, ChecklistItem, GenerationRequest, GeneratedChecklist, ItemConfiguration, ItemType } from '../types'
import { builderDefaults } from './catalog'
import { newId } from './ids'

export function makeBlankChecklist(): Checklist {
  const checklistId = newId('checklist')
  const sectionId = newId('section')
  return {
    id: checklistId,
    name: 'Untitled Checklist',
    description: '',
    industry: '',
    purpose: '',
    assigned_role: '',
    frequency: 'As needed',
    estimated_minutes: 10,
    scoring_enabled: true,
    status: 'draft',
    current_version: 0,
    sections: [
      {
        id: sectionId,
        title: 'General',
        instructions: '',
        sort_order: 0,
        items: [],
      },
    ],
  }
}

function item(type: ItemType, label: string, config: ItemConfiguration = {}, extra: Partial<ChecklistItem> = {}): Omit<ChecklistItem, 'id' | 'section_id' | 'sort_order'> {
  return {
    type,
    label,
    description: '',
    required: true,
    weight: 5,
    critical: false,
    allow_na: false,
    config: { ...builderDefaults(), ...config },
    conditions: [],
    corrective_action: null,
    ...extra,
  }
}

export function generateDemoChecklist(request: GenerationRequest): GeneratedChecklist {
  const strictEvidence = request.evidence_level === 'strict'
  return {
    name: request.purpose ? `${request.purpose} Checklist` : 'AI Generated Checklist',
    description: request.description,
    industry: request.industry,
    purpose: request.purpose,
    assigned_role: request.assigned_role,
    frequency: request.frequency,
    estimated_minutes: request.estimated_minutes,
    scoring_enabled: request.scoring_enabled,
    sections: [
      {
        title: 'Checklist Information',
        instructions: 'Complete the information below before starting the operational inspection.',
        items: [
          item('date_time', 'Inspection date and time', { default_now: true }, { weight: 0 }),
          item('staff_member', 'Staff member completing the checklist', { allow_multiple: false }, { weight: 0 }),
          item('short_entry', 'Location or area reference', { max_length: 255 }, { weight: 0 }),
        ],
      },
      {
        title: 'Operational Verification',
        instructions: 'Verify each requirement and provide evidence when a requirement is not met.',
        items: [
          item('yes_no', 'Is the area clean, organized, and ready for operation?', {
            compliant_value: true,
            completion_mode: 'manual',
            answer_tags: [{ id: newId('tag'), operator: 'equals', value: false, tag: 'Needs attention' }],
            correction_measure: {
              enabled: true,
              checklist_id: '',
              optional: false,
              trigger_answer: 'No',
              action: 'additional_action',
            },
          }, { critical: true }),
          item('measurement', 'Record the main operating measurement', {
            unit: request.industry.toLowerCase().includes('food') ? '°C' : 'unit',
            decimal_places: 1,
            ranges: [
              { id: newId('range'), label: 'Normal', min: 0, max: 5, status: 'normal' },
              { id: newId('range'), label: 'Warning', min: 5.1, max: 7, status: 'warning' },
              { id: newId('range'), label: 'Critical', min: 7.1, max: null, status: 'critical' },
            ],
            input_methods: { manual: true, temperature_probe: true, detector: true },
            correction_measure: {
              enabled: true,
              checklist_id: '',
              optional: false,
              trigger_answer: 'Warning or critical range',
              action: 'repeat_item',
            },
          }, { critical: true }),
          item('multiple_choice', 'Select the current operational status', {
            options: ['Compliant', 'Minor issue', 'Major issue'],
            allow_multiple: false,
            inline_mobile: true,
            failure_options: ['Major issue'],
          }),
          item('picture', 'Upload supporting evidence', { min_files: strictEvidence ? 1 : 0, max_files: 3, camera_only: false }, { required: strictEvidence, weight: 0 }),
          item('long_entry', 'Observations and follow-up notes', { max_length: 2000 }, { required: false, weight: 0 }),
        ],
      },
      {
        title: 'Completion',
        instructions: 'Review the checklist before final approval.',
        items: [
          item('rating_1_5', 'Rate the overall readiness', { min: 1, max: 5, pass_threshold: 4, step: 1 }),
          item('formula', 'Compliance score', { expression: 'weighted_pass_percentage()', display_unit: '%' }, { required: false, weight: 0 }),
          item('signature', 'Final approval signature', { signer_role: request.assigned_role }, { weight: 0 }),
        ],
      },
    ],
  }
}

export function materializeGenerated(generated: GeneratedChecklist): Checklist {
  const checklistId = newId('checklist')
  return {
    ...generated,
    id: checklistId,
    status: 'draft',
    current_version: 0,
    sections: generated.sections.map((section, sectionIndex) => {
      const sectionId = newId('section')
      return {
        id: sectionId,
        title: section.title,
        instructions: section.instructions,
        sort_order: sectionIndex,
        items: section.items.map((generatedItem, itemIndex) => ({
          ...generatedItem,
          id: newId('item'),
          section_id: sectionId,
          sort_order: itemIndex,
          config: { ...builderDefaults(), ...generatedItem.config },
          conditions: generatedItem.conditions || [],
          corrective_action: generatedItem.corrective_action || null,
        })),
      }
    }),
  }
}
