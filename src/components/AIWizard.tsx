import { FormEvent, useState } from 'react'
import { FileText, LoaderCircle, Sparkles, X } from 'lucide-react'
import type { GenerationRequest } from '../types'

const initial: GenerationRequest = {
  description: 'Create a restaurant opening checklist covering hygiene, food safety, equipment readiness, staff readiness, evidence, corrective actions, and final approval.',
  industry: 'Food & Beverage',
  purpose: 'Restaurant Opening',
  assigned_role: 'Branch Manager',
  frequency: 'Daily',
  evidence_level: 'balanced',
  scoring_enabled: true,
  estimated_minutes: 15,
  source_text: '',
}

export function AIWizard({
  onClose,
  onGenerate,
}: {
  onClose: () => void
  onGenerate: (request: GenerationRequest) => Promise<void>
}) {
  const [request, setRequest] = useState(initial)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setWorking(true)
    setError('')
    try {
      await onGenerate(request)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checklist generation failed.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="ai-modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div><span>AI CHECKLIST ENGINE</span><strong><Sparkles size={18} /> Generate a complete draft</strong></div>
          <button type="button" className="icon-button" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="ai-body form-stack">
          <label className="field"><span>Describe the checklist</span><textarea rows={5} required value={request.description} onChange={(e) => setRequest({ ...request, description: e.target.value })} /></label>
          <div className="two-columns">
            <label className="field"><span>Industry</span><input value={request.industry} onChange={(e) => setRequest({ ...request, industry: e.target.value })} placeholder="Food & Beverage" /></label>
            <label className="field"><span>Purpose</span><input value={request.purpose} onChange={(e) => setRequest({ ...request, purpose: e.target.value })} placeholder="Opening inspection" /></label>
            <label className="field"><span>Assigned role</span><input value={request.assigned_role} onChange={(e) => setRequest({ ...request, assigned_role: e.target.value })} placeholder="Branch Manager" /></label>
            <label className="field"><span>Frequency</span><select value={request.frequency} onChange={(e) => setRequest({ ...request, frequency: e.target.value })}><option>Daily</option><option>Weekly</option><option>Monthly</option><option>Per shift</option><option>As needed</option></select></label>
            <label className="field"><span>Evidence level</span><select value={request.evidence_level} onChange={(e) => setRequest({ ...request, evidence_level: e.target.value as GenerationRequest['evidence_level'] })}><option value="none">Minimal</option><option value="balanced">Balanced</option><option value="strict">Strict</option></select></label>
            <label className="field"><span>Target duration (minutes)</span><input type="number" min="3" max="180" value={request.estimated_minutes} onChange={(e) => setRequest({ ...request, estimated_minutes: Number(e.target.value) })} /></label>
          </div>
          <label className="toggle"><input type="checkbox" checked={request.scoring_enabled} onChange={(e) => setRequest({ ...request, scoring_enabled: e.target.checked })} /><span>Generate weighted compliance scoring</span></label>
          <label className="field"><span><FileText size={14} /> Optional SOP / procedure text</span><textarea rows={5} value={request.source_text} onChange={(e) => setRequest({ ...request, source_text: e.target.value })} placeholder="Paste source procedure text here. The AI will convert it into sections and checklist items." /></label>
          {error ? <div className="error-card">{error}</div> : null}
          <div className="info-card">The API key remains inside the Supabase Edge Function. It is never exposed to the browser.</div>
        </div>
        <footer className="modal-footer">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={working}>{working ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />} Generate checklist</button>
        </footer>
      </form>
    </div>
  )
}
