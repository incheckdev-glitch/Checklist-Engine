import { AlertTriangle, FileUp, Plus, Save, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { catalogByType } from '../lib/catalog'
import type {
  AnswerTagRule,
  Checklist,
  ChecklistItem,
  ChecklistSection,
  Condition,
  CorrectionMeasure,
  MeasurementRange,
  ReferenceMaterial,
  VisibilitySettings,
} from '../types'

const TEMPLATE_KEY = 'incheck-choice-templates-v1'
const colorOptions = ['#ffffff', '#eef4ff', '#e8f8ef', '#fff8df', '#ffeceb', '#f4edff', '#eaf7fa']

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function ConfigField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

function readTemplates(): Array<{ name: string; options: string[] }> {
  try {
    const parsed = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function defaultVisibility(): VisibilitySettings {
  return { mode: 'always', match: 'all', conditions: [] }
}

function defaultCorrectionMeasure(): CorrectionMeasure {
  return { enabled: false, checklist_id: '', optional: false, trigger_answer: '', action: 'do_not_repeat' }
}

export function Inspector({
  item,
  section,
  checklist,
  checklists,
  onChangeItem,
  onChangeSection,
}: {
  item: ChecklistItem | null
  section: ChecklistSection | null
  checklist: Checklist
  checklists: Checklist[]
  onChangeItem: (patch: Partial<ChecklistItem>) => void
  onChangeSection: (patch: Partial<ChecklistSection>) => void
}) {
  const [templateName, setTemplateName] = useState('')
  const [templates, setTemplates] = useState(readTemplates)
  const [fileError, setFileError] = useState('')

  const sourceItems = useMemo(() => checklist.sections.flatMap((entry) => entry.items).filter((entry) => entry.id !== item?.id), [checklist, item?.id])

  if (!item && !section) {
    return <aside className="inspector panel"><div className="empty-inspector"><SlidersHorizontal size={26} /><strong>Select an item or section</strong><span>Its settings will appear here.</span></div></aside>
  }

  if (!item && section) {
    return (
      <aside className="inspector panel">
        <div className="panel-heading"><div><span>SECTION SETTINGS</span><strong>Edit selected section</strong></div></div>
        <div className="inspector-scroll form-stack">
          <ConfigField label="Section title"><input value={section.title} onChange={(event) => onChangeSection({ title: event.target.value })} /></ConfigField>
          <ConfigField label="Instructions"><textarea rows={5} value={section.instructions} onChange={(event) => onChangeSection({ instructions: event.target.value })} /></ConfigField>
          <div className="info-card">Sections organize items and appear as clear steps in the mobile checklist.</div>
        </div>
      </aside>
    )
  }

  const selected = item as ChecklistItem
  const catalog = catalogByType.get(selected.type)
  const config = selected.config
  const setConfig = (patch: Record<string, unknown>) => onChangeItem({ config: { ...config, ...patch } })

  const visibility = (config.visibility || defaultVisibility()) as VisibilitySettings
  const correction = (config.correction_measure || defaultCorrectionMeasure()) as CorrectionMeasure
  const ranges = Array.isArray(config.ranges) ? config.ranges as MeasurementRange[] : []
  const answerTags = Array.isArray(config.answer_tags) ? config.answer_tags as AnswerTagRule[] : []
  const reference = (config.reference_material || null) as ReferenceMaterial | null
  const inputMethods = (config.input_methods || { manual: true, temperature_probe: false, detector: false }) as { manual: boolean; temperature_probe: boolean; detector: boolean }

  function setVisibility(next: VisibilitySettings) {
    setConfig({ visibility: next })
    onChangeItem({ conditions: next.mode === 'conditional' ? next.conditions : [] })
  }

  function addVisibilityCondition() {
    const source = sourceItems[0]
    if (!source) return
    const condition: Condition = { source_item_id: source.id, operator: 'equals', value: '', action: 'show' }
    setVisibility({ ...visibility, mode: 'conditional', conditions: [...visibility.conditions, condition] })
  }

  function updateVisibilityCondition(index: number, patch: Partial<Condition>) {
    setVisibility({ ...visibility, conditions: visibility.conditions.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...patch } : entry) })
  }

  function addRange() {
    const next: MeasurementRange = { id: crypto.randomUUID(), label: 'New range', min: null, max: null, status: 'normal' }
    setConfig({ ranges: [...ranges, next] })
  }

  function updateRange(id: string, patch: Partial<MeasurementRange>) {
    setConfig({ ranges: ranges.map((entry) => entry.id === id ? { ...entry, ...patch } : entry) })
  }

  function addAnswerTag() {
    const next: AnswerTagRule = { id: crypto.randomUUID(), operator: 'equals', value: '', tag: '' }
    setConfig({ answer_tags: [...answerTags, next] })
  }

  function updateAnswerTag(id: string, patch: Partial<AnswerTagRule>) {
    setConfig({ answer_tags: answerTags.map((entry) => entry.id === id ? { ...entry, ...patch } : entry) })
  }

  function saveChoiceTemplate() {
    const options = Array.isArray(config.options) ? config.options.filter((entry): entry is string => typeof entry === 'string') : []
    const name = templateName.trim()
    if (!name || !options.length) return
    const next = [{ name, options }, ...templates.filter((entry) => entry.name !== name)]
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(next))
    setTemplates(next)
    setConfig({ template_name: name })
  }

  function handleReferenceFile(file: File | undefined) {
    setFileError('')
    if (!file) return
    if (file.size > 750 * 1024) {
      setFileError('Reference files are limited to 750 KB in this builder. Use the URL field for larger documents.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setConfig({
      reference_material: {
        name: file.name,
        mime_type: file.type,
        size: file.size,
        data_url: String(reader.result || ''),
        display_inline: reference?.display_inline || false,
      },
    })
    reader.readAsDataURL(file)
  }

  return (
    <aside className="inspector panel">
      <div className="panel-heading"><div><span>ITEM SETTINGS</span><strong>{catalog?.label || selected.type}</strong></div></div>
      <div className="inspector-scroll form-stack">
        <div className="config-block">
          <h4>General</h4>
          <ConfigField label="Prompt Text"><textarea rows={3} value={selected.label} onChange={(event) => onChangeItem({ label: event.target.value })} /></ConfigField>
          <ConfigField label="Allow users to mark as"><input value={String(config.mark_as || '')} onChange={(event) => setConfig({ mark_as: event.target.value })} placeholder="Optional short or alternate name" /></ConfigField>
          <ConfigField label="Help text"><textarea rows={3} value={selected.description} onChange={(event) => onChangeItem({ description: event.target.value })} placeholder="Optional guidance shown below the prompt" /></ConfigField>
          <ConfigField label="Label"><input value={String(config.label_tag || '')} onChange={(event) => setConfig({ label_tag: event.target.value })} placeholder="Example: Food Safety" /></ConfigField>
        </div>

        <div className="config-block">
          <h4>Popup Condition</h4>
          <ConfigField label="Visibility"><select value={visibility.mode} onChange={(event) => setVisibility({ ...visibility, mode: event.target.value as VisibilitySettings['mode'], conditions: event.target.value === 'always' ? [] : visibility.conditions })}><option value="always">Always Visible</option><option value="conditional">Show conditionally</option></select></ConfigField>
          {visibility.mode === 'conditional' ? (
            <>
              <ConfigField label="Match rules"><select value={visibility.match} onChange={(event) => setVisibility({ ...visibility, match: event.target.value as VisibilitySettings['match'] })}><option value="all">All conditions</option><option value="any">Any condition</option></select></ConfigField>
              {visibility.conditions.map((condition, index) => (
                <div className="condition-row" key={`${condition.source_item_id}-${index}`}>
                  <select value={condition.source_item_id} onChange={(event) => updateVisibilityCondition(index, { source_item_id: event.target.value })}>{sourceItems.map((entry) => <option value={entry.id} key={entry.id}>{entry.label}</option>)}</select>
                  <select value={condition.operator} onChange={(event) => updateVisibilityCondition(index, { operator: event.target.value as Condition['operator'] })}><option value="equals">Equals</option><option value="not_equals">Does not equal</option><option value="greater_than">Greater than</option><option value="less_than">Less than</option><option value="contains">Contains</option></select>
                  <input value={String(condition.value)} onChange={(event) => updateVisibilityCondition(index, { value: event.target.value })} placeholder="Answer" />
                  <button className="icon-button danger-hover" onClick={() => setVisibility({ ...visibility, conditions: visibility.conditions.filter((_, entryIndex) => entryIndex !== index) })}><Trash2 size={15} /></button>
                </div>
              ))}
              <button className="secondary small" onClick={addVisibilityCondition} disabled={!sourceItems.length}><Plus size={14} /> Add Condition</button>
            </>
          ) : null}
        </div>

        <div className="config-block">
          <h4>Appearance & Reference Material</h4>
          <ConfigField label="Background color options">
            <div className="color-options">
              {colorOptions.map((color) => <button key={color} className={String(config.background_color || '#ffffff') === color ? 'selected' : ''} style={{ backgroundColor: color }} onClick={() => setConfig({ background_color: color })} aria-label={color} />)}
              <input type="color" value={String(config.background_color || '#ffffff')} onChange={(event) => setConfig({ background_color: event.target.value })} />
            </div>
          </ConfigField>
          <ConfigField label="Upload reference material"><div className="file-input-button"><FileUp size={16} /><input type="file" onChange={(event) => handleReferenceFile(event.target.files?.[0])} /></div></ConfigField>
          <ConfigField label="Reference URL"><input value={reference?.url || ''} onChange={(event) => setConfig({ reference_material: { name: reference?.name || 'Reference link', url: event.target.value, display_inline: reference?.display_inline || false } })} placeholder="https://..." /></ConfigField>
          {reference ? <div className="reference-chip"><span>{reference.name}</span><button className="icon-button danger-hover" onClick={() => setConfig({ reference_material: null })}><Trash2 size={14} /></button></div> : null}
          {fileError ? <div className="error-card">{fileError}</div> : null}
          <label className="toggle"><input type="checkbox" checked={Boolean(reference?.display_inline)} onChange={(event) => setConfig({ reference_material: reference ? { ...reference, display_inline: event.target.checked } : { name: 'Reference material', display_inline: event.target.checked } })} /><span>Display attached material inline</span></label>
        </div>

        <div className="toggle-grid">
          <label className="toggle"><input type="checkbox" checked={selected.required} onChange={(event) => onChangeItem({ required: event.target.checked })} /><span>Required</span></label>
          <label className="toggle"><input type="checkbox" checked={selected.critical} onChange={(event) => onChangeItem({ critical: event.target.checked })} /><span>Critical</span></label>
          <label className="toggle"><input type="checkbox" checked={selected.allow_na} onChange={(event) => onChangeItem({ allow_na: event.target.checked })} /><span>Allow N/A</span></label>
        </div>
        <ConfigField label="Score weight"><input type="number" min="0" max="100" value={selected.weight} onChange={(event) => onChangeItem({ weight: asNumber(event.target.value) })} /></ConfigField>

        {selected.type === 'yes_no' ? (
          <div className="config-block">
            <h4>Yes / No Settings</h4>
            <ConfigField label="Completion"><select value={String(config.completion_mode || 'manual')} onChange={(event) => setConfig({ completion_mode: event.target.value })}><option value="auto">Auto Complete</option><option value="manual">Manually Complete</option></select></ConfigField>
            <ConfigField label="Compliant answer"><select value={String(config.compliant_value ?? true)} onChange={(event) => setConfig({ compliant_value: event.target.value === 'true' })}><option value="true">Yes</option><option value="false">No</option></select></ConfigField>
          </div>
        ) : null}

        {selected.type === 'measurement' ? (
          <div className="config-block">
            <h4>Measurement Settings</h4>
            <div className="two-columns">
              <ConfigField label="Unit"><input value={String(config.unit || '')} onChange={(event) => setConfig({ unit: event.target.value })} placeholder="°C, kg, units" /></ConfigField>
              <ConfigField label="Decimals"><input type="number" min="0" max="4" value={asNumber(config.decimal_places, 1)} onChange={(event) => setConfig({ decimal_places: asNumber(event.target.value, 1) })} /></ConfigField>
            </div>
            <h5>Ranges</h5>
            {ranges.map((range) => (
              <div className="range-row" key={range.id}>
                <input value={range.label} onChange={(event) => updateRange(range.id, { label: event.target.value })} placeholder="Range label" />
                <input type="number" value={range.min ?? ''} onChange={(event) => updateRange(range.id, { min: event.target.value === '' ? null : Number(event.target.value) })} placeholder="Min" />
                <input type="number" value={range.max ?? ''} onChange={(event) => updateRange(range.id, { max: event.target.value === '' ? null : Number(event.target.value) })} placeholder="Max" />
                <select value={range.status} onChange={(event) => updateRange(range.id, { status: event.target.value as MeasurementRange['status'] })}><option value="normal">Normal</option><option value="warning">Warning</option><option value="critical">Critical</option></select>
                <button className="icon-button danger-hover" onClick={() => setConfig({ ranges: ranges.filter((entry) => entry.id !== range.id) })}><Trash2 size={15} /></button>
              </div>
            ))}
            <button className="secondary small" onClick={addRange}><Plus size={14} /> Add Range</button>
            <h5>Available input methods</h5>
            <div className="toggle-grid">
              <label className="toggle"><input type="checkbox" checked={inputMethods.manual} onChange={(event) => setConfig({ input_methods: { ...inputMethods, manual: event.target.checked } })} /><span>Manual Input</span></label>
              <label className="toggle"><input type="checkbox" checked={inputMethods.temperature_probe} onChange={(event) => setConfig({ input_methods: { ...inputMethods, temperature_probe: event.target.checked } })} /><span>Temperature Probe</span></label>
              <label className="toggle"><input type="checkbox" checked={inputMethods.detector} onChange={(event) => setConfig({ input_methods: { ...inputMethods, detector: event.target.checked } })} /><span>Detector</span></label>
            </div>
          </div>
        ) : null}

        {selected.type === 'multiple_choice' ? (
          <div className="config-block">
            <h4>Multiple Choice Settings</h4>
            <ConfigField label="Use Multiple Choice Template"><select value={String(config.template_name || '')} onChange={(event) => { const template = templates.find((entry) => entry.name === event.target.value); if (template) setConfig({ template_name: template.name, options: template.options }) }}><option value="">Create New</option>{templates.map((entry) => <option key={entry.name}>{entry.name}</option>)}</select></ConfigField>
            <ConfigField label="Choices — one per line"><textarea rows={6} value={Array.isArray(config.options) ? config.options.join('\n') : ''} onChange={(event) => setConfig({ options: event.target.value.split('\n').map((value) => value.trim()).filter(Boolean) })} /></ConfigField>
            <label className="toggle"><input type="checkbox" checked={Boolean(config.allow_multiple)} onChange={(event) => setConfig({ allow_multiple: event.target.checked })} /><span>Allow multiple answer selections</span></label>
            <label className="toggle"><input type="checkbox" checked={Boolean(config.inline_mobile)} onChange={(event) => setConfig({ inline_mobile: event.target.checked })} /><span>Show choices inline in the mobile application</span></label>
            <div className="template-save"><input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Template name" /><button className="secondary small" onClick={saveChoiceTemplate}><Save size={14} /> Save Template</button></div>
          </div>
        ) : null}

        {['rating_1_5', 'rating_1_10', 'rating_custom'].includes(selected.type) ? (
          <div className="config-block">
            <h4>Rating Settings</h4>
            <div className="two-columns">
              <ConfigField label="Minimum"><input type="number" value={asNumber(config.min, 1)} onChange={(event) => setConfig({ min: asNumber(event.target.value, 1) })} /></ConfigField>
              <ConfigField label="Maximum"><input type="number" value={asNumber(config.max, 5)} onChange={(event) => setConfig({ max: asNumber(event.target.value, 5) })} /></ConfigField>
              <ConfigField label="Pass threshold"><input type="number" value={asNumber(config.pass_threshold, 4)} onChange={(event) => setConfig({ pass_threshold: asNumber(event.target.value, 4) })} /></ConfigField>
              <ConfigField label="Step"><input type="number" min="0.1" step="0.1" value={asNumber(config.step, 1)} onChange={(event) => setConfig({ step: asNumber(event.target.value, 1) })} /></ConfigField>
            </div>
          </div>
        ) : null}

        {selected.type === 'formula' ? (
          <div className="config-block">
            <h4>Formula</h4>
            <ConfigField label="Expression"><textarea rows={4} value={String(config.expression || '')} onChange={(event) => setConfig({ expression: event.target.value })} placeholder="weighted_pass_percentage()" /></ConfigField>
            <ConfigField label="Display unit"><input value={String(config.display_unit || '')} onChange={(event) => setConfig({ display_unit: event.target.value })} /></ConfigField>
          </div>
        ) : null}

        {['picture', 'video'].includes(selected.type) ? (
          <div className="config-block">
            <h4>Media Settings</h4>
            <div className="two-columns">
              <ConfigField label="Minimum files"><input type="number" min="0" value={asNumber(config.min_files)} onChange={(event) => setConfig({ min_files: asNumber(event.target.value) })} /></ConfigField>
              <ConfigField label="Maximum files"><input type="number" min="1" value={asNumber(config.max_files, 1)} onChange={(event) => setConfig({ max_files: asNumber(event.target.value, 1) })} /></ConfigField>
            </div>
            <label className="toggle"><input type="checkbox" checked={Boolean(config.camera_only)} onChange={(event) => setConfig({ camera_only: event.target.checked })} /><span>Camera only</span></label>
          </div>
        ) : null}

        {['qr', 'barcode'].includes(selected.type) ? (
          <div className="config-block">
            <h4>Scanning Rules</h4>
            <ConfigField label="Expected code"><input value={String(config.expected_code || '')} onChange={(event) => setConfig({ expected_code: event.target.value })} placeholder="Leave empty to accept any valid code" /></ConfigField>
            <label className="toggle"><input type="checkbox" checked={Boolean(config.duplicate_prevention)} onChange={(event) => setConfig({ duplicate_prevention: event.target.checked })} /><span>Prevent duplicate scans</span></label>
          </div>
        ) : null}

        {selected.type === 'stopwatch' ? (
          <div className="config-block">
            <h4>Duration Limits</h4>
            <div className="two-columns">
              <ConfigField label="Minimum seconds"><input type="number" min="0" value={asNumber(config.min_seconds)} onChange={(event) => setConfig({ min_seconds: asNumber(event.target.value) })} /></ConfigField>
              <ConfigField label="Maximum seconds"><input type="number" min="0" value={asNumber(config.max_seconds)} onChange={(event) => setConfig({ max_seconds: asNumber(event.target.value) })} /></ConfigField>
            </div>
          </div>
        ) : null}

        {['yes_no', 'measurement', 'multiple_choice', 'rating_1_5', 'rating_1_10', 'rating_custom'].includes(selected.type) ? (
          <div className="config-block">
            <h4>Add Tags Based on the Answer</h4>
            {answerTags.map((rule) => (
              <div className="tag-rule-row" key={rule.id}>
                <select value={rule.operator} onChange={(event) => updateAnswerTag(rule.id, { operator: event.target.value as AnswerTagRule['operator'] })}><option value="equals">Equals</option><option value="not_equals">Does not equal</option><option value="greater_than">Greater than</option><option value="less_than">Less than</option><option value="contains">Contains</option></select>
                <input value={String(rule.value)} onChange={(event) => updateAnswerTag(rule.id, { value: event.target.value })} placeholder="Answer/value" />
                <input value={rule.tag} onChange={(event) => updateAnswerTag(rule.id, { tag: event.target.value })} placeholder="Tag" />
                <button className="icon-button danger-hover" onClick={() => setConfig({ answer_tags: answerTags.filter((entry) => entry.id !== rule.id) })}><Trash2 size={15} /></button>
              </div>
            ))}
            <button className="secondary small" onClick={addAnswerTag}><Plus size={14} /> Add Tag Rule</button>
          </div>
        ) : null}

        <div className="config-block correction-block">
          <h4>Correction Measure</h4>
          <label className="toggle"><input type="checkbox" checked={correction.enabled} onChange={(event) => setConfig({ correction_measure: { ...correction, enabled: event.target.checked } })} /><span>Enable correction measure</span></label>
          {correction.enabled ? (
            <>
              <ConfigField label="Choose corrective checklist"><select value={correction.checklist_id} onChange={(event) => setConfig({ correction_measure: { ...correction, checklist_id: event.target.value } })}><option value="">Select checklist</option>{checklists.filter((entry) => entry.id !== checklist.id).map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select></ConfigField>
              <label className="toggle"><input type="checkbox" checked={correction.optional} onChange={(event) => setConfig({ correction_measure: { ...correction, optional: event.target.checked } })} /><span>Make corrective measure optional</span></label>
              <ConfigField label="Trigger answer / condition"><input value={correction.trigger_answer} onChange={(event) => setConfig({ correction_measure: { ...correction, trigger_answer: event.target.value } })} placeholder="Example: No or Below 75°C" /></ConfigField>
              <ConfigField label="After correction"><select value={correction.action} onChange={(event) => setConfig({ correction_measure: { ...correction, action: event.target.value as CorrectionMeasure['action'] } })}><option value="additional_action">Require additional employee action</option><option value="repeat_item">Repeat this item</option><option value="repeat_checklist">Repeat this checklist</option><option value="do_not_repeat">Do not repeat</option></select></ConfigField>
            </>
          ) : null}
        </div>

        {selected.critical ? <div className="warning-card"><AlertTriangle size={17} /> This item is marked critical and should be treated as a high-priority failure.</div> : null}
      </div>
    </aside>
  )
}
