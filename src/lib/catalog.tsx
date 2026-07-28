import type { ComponentType } from 'react'
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
} from 'lucide-react'
import type { ItemType } from '../types'

export type CatalogItem = {
  type: ItemType
  label: string
  icon: ComponentType<{ size?: number; strokeWidth?: number }>
  defaultConfig?: Record<string, unknown>
}

export type CatalogGroup = {
  name: string
  items: CatalogItem[]
}

export const itemCatalog: CatalogGroup[] = [
  {
    name: 'Quick Inputs',
    items: [
      { type: 'checkmark', label: 'Checkmark', icon: CheckSquare, defaultConfig: { checked_label: 'Completed' } },
      { type: 'yes_no', label: 'Yes/No', icon: BadgeCheck, defaultConfig: { compliant_value: true } },
      { type: 'signature', label: 'Signature', icon: FileSignature, defaultConfig: { signer_role: '' } },
    ],
  },
  {
    name: 'Selections',
    items: [
      { type: 'staff_member', label: 'Staff Member', icon: UserRound, defaultConfig: { allow_multiple: false } },
      { type: 'multiple_choice', label: 'Multiple Choice', icon: ListChecks, defaultConfig: { options: ['Option 1', 'Option 2'], allow_multiple: false } },
    ],
  },
  {
    name: 'Media Capture',
    items: [
      { type: 'video', label: 'Video', icon: Video, defaultConfig: { min_files: 1, max_files: 1, camera_only: true } },
      { type: 'picture', label: 'Picture', icon: Camera, defaultConfig: { min_files: 1, max_files: 3, camera_only: false } },
    ],
  },
  {
    name: 'Code Scanning',
    items: [
      { type: 'qr', label: 'QR', icon: QrCode, defaultConfig: { expected_code: '', duplicate_prevention: true } },
      { type: 'barcode', label: 'Barcode', icon: Barcode, defaultConfig: { expected_code: '', duplicate_prevention: true } },
    ],
  },
  {
    name: 'Values',
    items: [
      { type: 'measurement', label: 'Measurement', icon: Ruler, defaultConfig: { unit: '°C', decimal_places: 1, normal_min: 0, normal_max: 5, warning_min: 5.1, warning_max: 7 } },
      { type: 'rating_1_5', label: 'Rating (1–5)', icon: Star, defaultConfig: { min: 1, max: 5, pass_threshold: 4 } },
      { type: 'rating_1_10', label: 'Rating (1–10)', icon: Gauge, defaultConfig: { min: 1, max: 10, pass_threshold: 7 } },
      { type: 'rating_custom', label: 'Rating (Custom)', icon: Hash, defaultConfig: { min: 0, max: 100, step: 1, pass_threshold: 80 } },
      { type: 'formula', label: 'Formula', icon: Sigma, defaultConfig: { expression: '', display_unit: '%' } },
    ],
  },
  {
    name: 'Time Tracking',
    items: [
      { type: 'date_time', label: 'Date-Time', icon: CalendarClock, defaultConfig: { default_now: true } },
      { type: 'date', label: 'Date', icon: Calendar, defaultConfig: { default_today: true } },
      { type: 'time', label: 'Time', icon: Clock3, defaultConfig: { default_now: true } },
      { type: 'stopwatch', label: 'Stopwatch', icon: Timer, defaultConfig: { min_seconds: 0, max_seconds: 0 } },
    ],
  },
  {
    name: 'Free Responses',
    items: [
      { type: 'long_entry', label: 'Long Entry', icon: TextQuote, defaultConfig: { min_length: 0, max_length: 2000 } },
      { type: 'short_entry', label: 'Short Entry', icon: TextCursorInput, defaultConfig: { min_length: 0, max_length: 255 } },
    ],
  },
  {
    name: 'Non-Editable',
    items: [
      { type: 'instructions', label: 'Instructions', icon: Info, defaultConfig: {} },
      { type: 'title', label: 'Title', icon: TextQuote, defaultConfig: { level: 2 } },
    ],
  },
  {
    name: 'Subchecklist',
    items: [
      { type: 'sub_checklist', label: 'Sub-Checklist', icon: Layers3, defaultConfig: { checklist_id: '', allow_multiple: false, independent_scoring: true } },
    ],
  },
]

export const catalogByType = new Map(itemCatalog.flatMap((group) => group.items).map((item) => [item.type, item]))
