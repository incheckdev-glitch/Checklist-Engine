import { AlertTriangle, SlidersHorizontal } from 'lucide-react'
import { catalogByType } from '../lib/catalog'
import type { ChecklistItem, ChecklistSection } from '../types'

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function ConfigField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

export function Inspector({
  item,
  section,
  onChangeItem,
  onChangeSection,
}: {
  item: ChecklistItem | null
  section: ChecklistSection | null
  onChangeItem: (patch: Partial<ChecklistItem>) => void
  onChangeSection: (patch: Partial<ChecklistSection>) => void
}) {
  if (!item && !section) {
    return <aside className="inspector panel"><div className="empty-inspector"><SlidersHorizontal size={26} /><strong>Select an item or section</strong><span>Its settings will appear here.</span></div></aside>
  }

  if (!item && section) {
    return (
      <aside className="inspector panel">
        <div className="panel-heading"><div><span>SECTION SETTINGS</span><strong>Edit selected section</strong></div></div>
        <div className="inspector-scroll form-stack">
          <ConfigField label="Section title"><input value={section.title} onChange={(e) => onChangeSection({ title: e.target.value })} /></ConfigField>
          <ConfigField label="Instructions"><textarea rows={5} value={section.instructions} onChange={(e) => onChangeSection({ instructions: e.target.value })} /></ConfigField>
          <div className="info-card">Sections organize items and appear as clear steps in the mobile checklist.</div>
        </div>
      </aside>
    )
  }

  const selected = item as ChecklistItem
  const catalog = catalogByType.get(selected.type)
  const config = selected.config
  const setConfig = (patch: Record<string, unknown>) => onChangeItem({ config: { ...config, ...patch } })

  return (
    <aside className="inspector panel">
      <div className="panel-heading"><div><span>ITEM SETTINGS</span><strong>{catalog?.label || selected.type}</strong></div></div>
      <div className="inspector-scroll form-stack">
        <ConfigField label="Question / label"><textarea rows={3} value={selected.label} onChange={(e) => onChangeItem({ label: e.target.value })} /></ConfigField>
        <ConfigField label="Help text"><textarea rows={3} value={selected.description} onChange={(e) => onChangeItem({ description: e.target.value })} placeholder="Optional instructions for the user" /></ConfigField>
        <div className="toggle-grid">
          <label className="toggle"><input type="checkbox" checked={selected.required} onChange={(e) => onChangeItem({ required: e.target.checked })} /><span>Required</span></label>
          <label className="toggle"><input type="checkbox" checked={selected.critical} onChange={(e) => onChangeItem({ critical: e.target.checked })} /><span>Critical</span></label>
          <label className="toggle"><input type="checkbox" checked={selected.allow_na} onChange={(e) => onChangeItem({ allow_na: e.target.checked })} /><span>Allow N/A</span></label>
        </div>
        <ConfigField label="Score weight"><input type="number" min="0" max="100" value={selected.weight} onChange={(e) => onChangeItem({ weight: asNumber(e.target.value) })} /></ConfigField>

        {selected.type === 'yes_no' ? (
          <div className="config-block">
            <h4>Yes / No rules</h4>
            <ConfigField label="Compliant answer"><select value={String(config.compliant_value ?? true)} onChange={(e) => setConfig({ compliant_value: e.target.value === 'true' })}><option value="true">Yes</option><option value="false">No</option></select></ConfigField>
          </div>
        ) : null}

        {selected.type === 'measurement' ? (
          <div className="config-block">
            <h4>Measurement ranges</h4>
            <div className="two-columns">
              <ConfigField label="Unit"><input value={String(config.unit ?? '')} onChange={(e) => setConfig({ unit: e.target.value })} /></ConfigField>
              <ConfigField label="Decimals"><input type="number" min="0" max="4" value={asNumber(config.decimal_places, 1)} onChange={(e) => setConfig({ decimal_places: asNumber(e.target.value, 1) })} /></ConfigField>
              <ConfigField label="Normal min"><input type="number" value={asNumber(config.normal_min)} onChange={(e) => setConfig({ normal_min: asNumber(e.target.value) })} /></ConfigField>
              <ConfigField label="Normal max"><input type="number" value={asNumber(config.normal_max)} onChange={(e) => setConfig({ normal_max: asNumber(e.target.value) })} /></ConfigField>
              <ConfigField label="Warning min"><input type="number" value={asNumber(config.warning_min)} onChange={(e) => setConfig({ warning_min: asNumber(e.target.value) })} /></ConfigField>
              <ConfigField label="Warning max"><input type="number" value={asNumber(config.warning_max)} onChange={(e) => setConfig({ warning_max: asNumber(e.target.value) })} /></ConfigField>
            </div>
          </div>
        ) : null}

        {selected.type === 'multiple_choice' ? (
          <div className="config-block">
            <h4>Choices</h4>
            <ConfigField label="One option per line"><textarea rows={6} value={Array.isArray(config.options) ? config.options.join('\n') : ''} onChange={(e) => setConfig({ options: e.target.value.split('\n').map((value) => value.trim()).filter(Boolean) })} /></ConfigField>
            <label className="toggle"><input type="checkbox" checked={Boolean(config.allow_multiple)} onChange={(e) => setConfig({ allow_multiple: e.target.checked })} /><span>Allow multiple selections</span></label>
          </div>
        ) : null}

        {['rating_1_5', 'rating_1_10', 'rating_custom'].includes(selected.type) ? (
          <div className="config-block">
            <h4>Rating settings</h4>
            <div className="two-columns">
              <ConfigField label="Minimum"><input type="number" value={asNumber(config.min, 1)} onChange={(e) => setConfig({ min: asNumber(e.target.value, 1) })} /></ConfigField>
              <ConfigField label="Maximum"><input type="number" value={asNumber(config.max, 5)} onChange={(e) => setConfig({ max: asNumber(e.target.value, 5) })} /></ConfigField>
              <ConfigField label="Pass threshold"><input type="number" value={asNumber(config.pass_threshold, 4)} onChange={(e) => setConfig({ pass_threshold: asNumber(e.target.value, 4) })} /></ConfigField>
              <ConfigField label="Step"><input type="number" min="0.1" step="0.1" value={asNumber(config.step, 1)} onChange={(e) => setConfig({ step: asNumber(e.target.value, 1) })} /></ConfigField>
            </div>
          </div>
        ) : null}

        {selected.type === 'formula' ? (
          <div className="config-block">
            <h4>Formula</h4>
            <ConfigField label="Expression"><textarea rows={4} value={String(config.expression ?? '')} onChange={(e) => setConfig({ expression: e.target.value })} placeholder="weighted_pass_percentage()" /></ConfigField>
            <ConfigField label="Display unit"><input value={String(config.display_unit ?? '')} onChange={(e) => setConfig({ display_unit: e.target.value })} /></ConfigField>
          </div>
        ) : null}

        {['picture', 'video'].includes(selected.type) ? (
          <div className="config-block">
            <h4>Media settings</h4>
            <div className="two-columns">
              <ConfigField label="Minimum files"><input type="number" min="0" value={asNumber(config.min_files)} onChange={(e) => setConfig({ min_files: asNumber(e.target.value) })} /></ConfigField>
              <ConfigField label="Maximum files"><input type="number" min="1" value={asNumber(config.max_files, 1)} onChange={(e) => setConfig({ max_files: asNumber(e.target.value, 1) })} /></ConfigField>
            </div>
            <label className="toggle"><input type="checkbox" checked={Boolean(config.camera_only)} onChange={(e) => setConfig({ camera_only: e.target.checked })} /><span>Camera only</span></label>
          </div>
        ) : null}

        {['qr', 'barcode'].includes(selected.type) ? (
          <div className="config-block">
            <h4>Scanning rules</h4>
            <ConfigField label="Expected code"><input value={String(config.expected_code ?? '')} onChange={(e) => setConfig({ expected_code: e.target.value })} placeholder="Leave empty to accept any valid code" /></ConfigField>
            <label className="toggle"><input type="checkbox" checked={Boolean(config.duplicate_prevention)} onChange={(e) => setConfig({ duplicate_prevention: e.target.checked })} /><span>Prevent duplicate scans</span></label>
          </div>
        ) : null}

        {selected.type === 'stopwatch' ? (
          <div className="config-block">
            <h4>Duration limits</h4>
            <div className="two-columns">
              <ConfigField label="Minimum seconds"><input type="number" min="0" value={asNumber(config.min_seconds)} onChange={(e) => setConfig({ min_seconds: asNumber(e.target.value) })} /></ConfigField>
              <ConfigField label="Maximum seconds"><input type="number" min="0" value={asNumber(config.max_seconds)} onChange={(e) => setConfig({ max_seconds: asNumber(e.target.value) })} /></ConfigField>
            </div>
          </div>
        ) : null}

        <div className="config-block">
          <h4>Corrective action</h4>
          <label className="toggle"><input type="checkbox" checked={Boolean(selected.corrective_action?.enabled)} onChange={(e) => onChangeItem({ corrective_action: e.target.checked ? { enabled: true, trigger: 'failed', require_comment: true, require_picture: false } : null })} /><span>Create corrective action on failure</span></label>
          {selected.corrective_action?.enabled ? (
            <>
              <ConfigField label="Trigger"><select value={selected.corrective_action.trigger} onChange={(e) => onChangeItem({ corrective_action: { ...selected.corrective_action!, trigger: e.target.value as 'failed' | 'warning' | 'critical' | 'always' } })}><option value="failed">Failed</option><option value="warning">Warning</option><option value="critical">Critical</option><option value="always">Always</option></select></ConfigField>
              <label className="toggle"><input type="checkbox" checked={Boolean(selected.corrective_action.require_comment)} onChange={(e) => onChangeItem({ corrective_action: { ...selected.corrective_action!, require_comment: e.target.checked } })} /><span>Require comment</span></label>
              <label className="toggle"><input type="checkbox" checked={Boolean(selected.corrective_action.require_picture)} onChange={(e) => onChangeItem({ corrective_action: { ...selected.corrective_action!, require_picture: e.target.checked } })} /><span>Require picture</span></label>
            </>
          ) : null}
        </div>

        {selected.critical ? <div className="warning-card"><AlertTriangle size={17} /> This item is marked critical and should be treated as a high-priority failure.</div> : null}
      </div>
    </aside>
  )
}
