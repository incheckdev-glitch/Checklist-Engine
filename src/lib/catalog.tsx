import {
  BadgeCheck,
  Barcode,
  Calendar,
  CalendarClock,
  Camera,
  CheckSquare,
  Clock3,
  FileSignature,
  Gauge,
  Hash,
  Info,
  Layers3,
  ListChecks,
  QrCode,
  Ruler,
  Sigma,
  Star,
  TextCursorInput,
  TextQuote,
  Timer,
  UserRound,
  Video,
  type LucideIcon,
} from 'lucide-react'
import type { ItemConfiguration, ItemType } from '../types'

export type CatalogItem = {
  type: ItemType
  label: string
  icon: LucideIcon
  defaultConfig?: ItemConfiguration
}

export type CatalogGroup = {
  name: string
  items: CatalogItem[]
}

export function builderDefaults(): ItemConfiguration {
  return {
    mark_as: '',
    background_color: '#ffffff',
    label_tag: '',
    visibility: { mode: 'always', match: 'all', conditions: [] },
    reference_material: null,
    completion_mode: 'manual',
    answer_tags: [],
    correction_measure: {
      enabled: false,
      checklist_id: '',
      optional: false,
      trigger_answer: '',
      action: 'do_not_repeat',
    },
  }
}

function config(specific: ItemConfiguration = {}): ItemConfiguration {
  return { ...builderDefaults(), ...specific }
}

export const itemCatalog: CatalogGroup[] = [
  {
    name: 'Quick Inputs',
    items: [
      { type: 'checkmark', label: 'Checkmark', icon: CheckSquare, defaultConfig: config({ checked_label: 'Completed' }) },
      { type: 'yes_no', label: 'Yes/No', icon: BadgeCheck, defaultConfig: config({ compliant_value: true, completion_mode: 'manual' }) },
      { type: 'signature', label: 'Signature', icon: FileSignature, defaultConfig: config({ signer_role: '' }) },
    ],
  },
  {
    name: 'Selections',
    items: [
      { type: 'staff_member', label: 'Staff Member', icon: UserRound, defaultConfig: config({ allow_multiple: false }) },
      { type: 'multiple_choice', label: 'Multiple Choice', icon: ListChecks, defaultConfig: config({ options: ['Option 1', 'Option 2'], allow_multiple: false, inline_mobile: false, template_name: '' }) },
    ],
  },
  {
    name: 'Media Capture',
    items: [
      { type: 'video', label: 'Video', icon: Video, defaultConfig: config({ min_files: 1, max_files: 1, camera_only: true }) },
      { type: 'picture', label: 'Picture', icon: Camera, defaultConfig: config({ min_files: 1, max_files: 3, camera_only: false }) },
    ],
  },
  {
    name: 'Code Scanning',
    items: [
      { type: 'qr', label: 'QR', icon: QrCode, defaultConfig: config({ expected_code: '', duplicate_prevention: true }) },
      { type: 'barcode', label: 'Barcode', icon: Barcode, defaultConfig: config({ expected_code: '', duplicate_prevention: true }) },
    ],
  },
  {
    name: 'Values',
    items: [
      {
        type: 'measurement',
        label: 'Measurement',
        icon: Ruler,
        defaultConfig: config({
          unit: '°C',
          decimal_places: 1,
          ranges: [{ id: crypto.randomUUID(), label: 'Acceptable', min: 0, max: 5, status: 'normal' }],
          input_methods: { manual: true, temperature_probe: false, detector: false },
        }),
      },
      { type: 'rating_1_5', label: 'Rating (1–5)', icon: Star, defaultConfig: config({ min: 1, max: 5, pass_threshold: 4, step: 1 }) },
      { type: 'rating_1_10', label: 'Rating (1–10)', icon: Gauge, defaultConfig: config({ min: 1, max: 10, pass_threshold: 7, step: 1 }) },
      { type: 'rating_custom', label: 'Rating (Custom)', icon: Hash, defaultConfig: config({ min: 0, max: 100, step: 1, pass_threshold: 80 }) },
      { type: 'formula', label: 'Formula', icon: Sigma, defaultConfig: config({ expression: '', display_unit: '%' }) },
    ],
  },
  {
    name: 'Time Tracking',
    items: [
      { type: 'date_time', label: 'Date-Time', icon: CalendarClock, defaultConfig: config({ default_now: true }) },
      { type: 'date', label: 'Date', icon: Calendar, defaultConfig: config({ default_today: true }) },
      { type: 'time', label: 'Time', icon: Clock3, defaultConfig: config({ default_now: true }) },
      { type: 'stopwatch', label: 'Stopwatch', icon: Timer, defaultConfig: config({ min_seconds: 0, max_seconds: 0 }) },
    ],
  },
  {
    name: 'Free Responses',
    items: [
      { type: 'long_entry', label: 'Long Entry', icon: TextQuote, defaultConfig: config({ min_length: 0, max_length: 2000 }) },
      { type: 'short_entry', label: 'Short Entry', icon: TextCursorInput, defaultConfig: config({ min_length: 0, max_length: 255 }) },
    ],
  },
  {
    name: 'Non-Editable',
    items: [
      { type: 'instructions', label: 'Instructions', icon: Info, defaultConfig: config({}) },
      { type: 'title', label: 'Title', icon: TextQuote, defaultConfig: config({ level: 2 }) },
    ],
  },
  {
    name: 'Subchecklist',
    items: [
      { type: 'sub_checklist', label: 'Sub-Checklist', icon: Layers3, defaultConfig: config({ checklist_id: '', allow_multiple: false, independent_scoring: true }) },
    ],
  },
]

export const catalogByType = new Map(itemCatalog.flatMap((group) => group.items).map((item) => [item.type, item]))
