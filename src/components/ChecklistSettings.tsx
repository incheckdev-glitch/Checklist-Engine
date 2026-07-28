import { Settings2 } from 'lucide-react'
import type { Checklist } from '../types'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

export function ChecklistSettings({
  checklist,
  onChange,
}: {
  checklist: Checklist
  onChange: (patch: Partial<Checklist>) => void
}) {
  return (
    <main className="checklist-settings panel">
      <div className="panel-heading">
        <div><span>CHECKLIST SETTINGS</span><strong><Settings2 size={17} /> Configure checklist</strong></div>
      </div>
      <div className="checklist-settings-body form-stack">
        <div className="settings-section">
          <h3>General information</h3>
          <div className="two-columns">
            <Field label="Checklist name"><input value={checklist.name} onChange={(event) => onChange({ name: event.target.value })} /></Field>
            <Field label="Assigned role"><input value={checklist.assigned_role} onChange={(event) => onChange({ assigned_role: event.target.value })} placeholder="Branch Manager" /></Field>
            <Field label="Industry"><input value={checklist.industry} onChange={(event) => onChange({ industry: event.target.value })} /></Field>
            <Field label="Purpose"><input value={checklist.purpose} onChange={(event) => onChange({ purpose: event.target.value })} /></Field>
          </div>
          <Field label="Description"><textarea rows={4} value={checklist.description} onChange={(event) => onChange({ description: event.target.value })} /></Field>
        </div>

        <div className="settings-section">
          <h3>Scheduling and completion</h3>
          <div className="two-columns">
            <Field label="Frequency">
              <select value={checklist.frequency} onChange={(event) => onChange({ frequency: event.target.value })}>
                <option>Daily</option><option>Weekly</option><option>Monthly</option><option>Per shift</option><option>As needed</option>
              </select>
            </Field>
            <Field label="Estimated minutes"><input type="number" min="1" max="180" value={checklist.estimated_minutes} onChange={(event) => onChange({ estimated_minutes: Number(event.target.value) })} /></Field>
          </div>
          <label className="toggle"><input type="checkbox" checked={checklist.scoring_enabled} onChange={(event) => onChange({ scoring_enabled: event.target.checked })} /><span>Enable weighted compliance scoring</span></label>
        </div>

        <div className="info-card">Published checklists retain their saved version. Editing a published checklist creates a new draft version.</div>
      </div>
    </main>
  )
}
