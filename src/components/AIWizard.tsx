import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  FileText,
  Home,
  LoaderCircle,
  Moon,
  ShieldAlert,
  Sparkles,
  Thermometer,
  Wand2,
  Wrench,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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

type Starter = {
  title: string
  subtitle: string
  description: string
  industry: string
  purpose: string
  role: string
  frequency: string
  icon: LucideIcon
}

const starters: Starter[] = [
  {
    title: 'Opening Ritual',
    subtitle: 'Start every day ready',
    description: 'Create a location opening checklist covering team readiness, cleanliness, equipment, food safety, evidence, corrective actions, and manager approval.',
    industry: 'Food & Beverage',
    purpose: 'Location Opening',
    role: 'Branch Manager',
    frequency: 'Daily',
    icon: Home,
  },
  {
    title: 'Closing Reset',
    subtitle: 'Leave nothing unfinished',
    description: 'Create a closing checklist covering cash-up confirmation, cleaning, equipment shutdown, waste, security, unresolved issues, and supervisor sign-off.',
    industry: 'Retail & Hospitality',
    purpose: 'Location Closing',
    role: 'Shift Supervisor',
    frequency: 'Per shift',
    icon: Moon,
  },
  {
    title: 'Temperature Story',
    subtitle: 'Track every critical reading',
    description: 'Create a temperature-control checklist with date and time, item identification, measurement ranges, manual/probe/detector input, repeat readings, leftovers, corrective measures, and completion by staff.',
    industry: 'Food & Beverage',
    purpose: 'Temperature Monitoring',
    role: 'Food Safety Officer',
    frequency: 'Per shift',
    icon: Thermometer,
  },
  {
    title: 'Equipment Pulse',
    subtitle: 'Catch failures early',
    description: 'Create an equipment inspection checklist with asset identification, operating condition, measurements, media evidence, barcode or QR scanning, issue severity, and maintenance follow-up.',
    industry: 'Operations',
    purpose: 'Equipment Inspection',
    role: 'Maintenance Supervisor',
    frequency: 'Weekly',
    icon: Wrench,
  },
  {
    title: 'Safety Walk',
    subtitle: 'Turn risk into action',
    description: 'Create a safety inspection checklist covering hazards, emergency exits, PPE, fire equipment, incident evidence, critical failures, corrective checklists, and final approval.',
    industry: 'Health & Safety',
    purpose: 'Safety Inspection',
    role: 'Safety Officer',
    frequency: 'Weekly',
    icon: ShieldAlert,
  },
]

const ideaChips = [
  'Add conditional follow-up questions',
  'Require pictures only on failure',
  'Use detector readings where relevant',
  'Add a linked corrective checklist',
  'Repeat a block for every item inspected',
  'Finish with staff member and signature',
]

export function AIWizard({
  onClose,
  onGenerate,
}: {
  onClose: () => void
  onGenerate: (request: GenerationRequest) => Promise<void>
}) {
  const [request, setRequest] = useState(initial)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  const summary = useMemo(() => {
    const evidence = request.evidence_level === 'strict' ? 'Strict evidence' : request.evidence_level === 'none' ? 'Minimal evidence' : 'Balanced evidence'
    return [request.industry || 'Any industry', request.assigned_role || 'Any role', request.frequency, evidence, `${request.estimated_minutes} min`]
  }, [request])

  function chooseStarter(starter: Starter) {
    setRequest((current) => ({
      ...current,
      description: starter.description,
      industry: starter.industry,
      purpose: starter.purpose,
      assigned_role: starter.role,
      frequency: starter.frequency,
    }))
  }

  function addIdea(idea: string) {
    setRequest((current) => ({
      ...current,
      description: `${current.description.trim()} ${idea}.`.trim(),
    }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (step < 3) {
      setStep((current) => (current + 1) as 1 | 2 | 3)
      return
    }

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
    <div className="modal-backdrop creative-backdrop" onMouseDown={onClose}>
      <form className="creative-ai-modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <header className="creative-ai-header">
          <div className="creative-orb"><Wand2 size={24} /></div>
          <div className="creative-heading">
            <span>INCheck 360 CREATION STUDIO</span>
            <strong>Turn an operational idea into a living checklist</strong>
            <p>Describe the outcome. The engine designs the flow, fields, conditions, evidence, ranges, and corrective measures.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button>
        </header>

        <div className="creative-progress" aria-label={`Step ${step} of 3`}>
          {[
            ['1', 'Imagine'],
            ['2', 'Shape'],
            ['3', 'Launch'],
          ].map(([number, label], index) => (
            <div className={`${step >= index + 1 ? 'active' : ''} ${step === index + 1 ? 'current' : ''}`} key={number}>
              <span>{number}</span><strong>{label}</strong>
            </div>
          ))}
        </div>

        <div className="creative-ai-body">
          {step === 1 ? (
            <div className="creative-step">
              <div className="creative-step-title">
                <span><Sparkles size={16} /> START WITH A SPARK</span>
                <h2>What should your team accomplish?</h2>
                <p>Pick a starting story or write your own. Every card can be fully changed.</p>
              </div>

              <div className="starter-grid">
                {starters.map((starter) => {
                  const Icon = starter.icon
                  const selected = request.purpose === starter.purpose
                  return (
                    <button type="button" className={`starter-card ${selected ? 'selected' : ''}`} onClick={() => chooseStarter(starter)} key={starter.title}>
                      <span className="starter-icon"><Icon size={20} /></span>
                      <span><strong>{starter.title}</strong><small>{starter.subtitle}</small></span>
                      {selected ? <ClipboardCheck size={18} className="starter-check" /> : null}
                    </button>
                  )
                })}
              </div>

              <label className="creative-prompt-field">
                <span>Describe the checklist in your own words</span>
                <textarea
                  rows={6}
                  required
                  value={request.description}
                  onChange={(event) => setRequest({ ...request, description: event.target.value })}
                  placeholder="Example: Create a hot-holding checklist that repeats temperature checks for each item and opens a correction checklist when a reading is below 75°C."
                />
                <small>{request.description.length} characters · include the result, role, evidence, thresholds, and follow-up you need</small>
              </label>

              <div className="idea-chip-row">
                {ideaChips.map((idea) => <button type="button" onClick={() => addIdea(idea)} key={idea}><PlusGlyph />{idea}</button>)}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="creative-step two-pane-step">
              <div>
                <div className="creative-step-title">
                  <span><Wand2 size={16} /> SHAPE THE EXPERIENCE</span>
                  <h2>Give the AI the operational context</h2>
                  <p>These choices guide the language, evidence, timing, and responsibility built into every item.</p>
                </div>

                <div className="creative-form-grid">
                  <label><span>Industry</span><input value={request.industry} onChange={(event) => setRequest({ ...request, industry: event.target.value })} placeholder="Food & Beverage" /></label>
                  <label><span>Purpose</span><input value={request.purpose} onChange={(event) => setRequest({ ...request, purpose: event.target.value })} placeholder="Opening inspection" /></label>
                  <label><span>Responsible role</span><input value={request.assigned_role} onChange={(event) => setRequest({ ...request, assigned_role: event.target.value })} placeholder="Branch Manager" /></label>
                  <label><span>Frequency</span><select value={request.frequency} onChange={(event) => setRequest({ ...request, frequency: event.target.value })}><option>Daily</option><option>Weekly</option><option>Monthly</option><option>Per shift</option><option>As needed</option></select></label>
                </div>
              </div>

              <aside className="creative-control-card">
                <span className="control-eyebrow">EVIDENCE PERSONALITY</span>
                <div className="evidence-personality">
                  {[
                    ['none', 'Light', 'Fast completion with evidence only when essential.'],
                    ['balanced', 'Balanced', 'Practical proof on important operational checks.'],
                    ['strict', 'Audit Ready', 'Stronger media, comments, and corrective follow-up.'],
                  ].map(([value, title, description]) => (
                    <button type="button" className={request.evidence_level === value ? 'selected' : ''} onClick={() => setRequest({ ...request, evidence_level: value as GenerationRequest['evidence_level'] })} key={value}>
                      <span className="evidence-radio" /><span><strong>{title}</strong><small>{description}</small></span>
                    </button>
                  ))}
                </div>

                <label className="creative-toggle">
                  <input type="checkbox" checked={request.scoring_enabled} onChange={(event) => setRequest({ ...request, scoring_enabled: event.target.checked })} />
                  <span><strong>Compliance scoring</strong><small>Weight operational questions and calculate a result.</small></span>
                </label>
              </aside>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="creative-step launch-step">
              <div className="launch-main">
                <div className="creative-step-title">
                  <span><Sparkles size={16} /> FINAL CREATIVE BRIEF</span>
                  <h2>Polish the source and launch the build</h2>
                  <p>The AI will create a complete editable draft. Nothing is published until you review and finish it.</p>
                </div>

                <label className="duration-slider">
                  <span><strong>Target completion time</strong><b>{request.estimated_minutes} minutes</b></span>
                  <input type="range" min="3" max="90" step="1" value={request.estimated_minutes} onChange={(event) => setRequest({ ...request, estimated_minutes: Number(event.target.value) })} />
                  <small>Short checklists stay focused. Longer durations allow more sections and evidence.</small>
                </label>

                <label className="creative-source-field">
                  <span><FileText size={16} /> Add an SOP, procedure, or reference text</span>
                  <textarea rows={8} value={request.source_text} onChange={(event) => setRequest({ ...request, source_text: event.target.value })} placeholder="Paste the source procedure here. The AI will preserve the workflow and convert it into titles, instructions, questions, ranges, conditions, and corrective measures." />
                  <small>Optional · {request.source_text?.length || 0} characters</small>
                </label>
                {error ? <div className="error-card">{error}</div> : null}
              </div>

              <aside className="launch-preview-card">
                <div className="preview-glow"><Sparkles size={24} /></div>
                <span>YOUR BUILD BRIEF</span>
                <h3>{request.purpose || 'Untitled checklist'}</h3>
                <p>{request.description}</p>
                <div className="summary-pills">{summary.map((entry) => <span key={entry}>{entry}</span>)}</div>
                <div className="creation-promise">
                  <strong>The engine will design:</strong>
                  <ul>
                    <li>Sections and frontline-ready prompts</li>
                    <li>Ranges, conditions, and answer tags</li>
                    <li>Evidence and corrective-measure logic</li>
                    <li>Scoring, responsibility, and approval</li>
                  </ul>
                </div>
              </aside>
            </div>
          ) : null}
        </div>

        <footer className="creative-ai-footer">
          <button type="button" className="secondary" onClick={step === 1 ? onClose : () => setStep((step - 1) as 1 | 2 | 3)}>{step === 1 ? 'Cancel' : <><ArrowLeft size={16} /> Back</>}</button>
          <div className="creative-footer-note"><span className="pulse-dot" /> Draft remains fully editable</div>
          <button className="primary creative-next" disabled={working || !request.description.trim()}>
            {working ? <><LoaderCircle className="spin" size={17} /> Designing your checklist…</> : step < 3 ? <>Continue <ArrowRight size={17} /></> : <><Sparkles size={17} /> Create the experience</>}
          </button>
        </footer>
      </form>
    </div>
  )
}

function PlusGlyph() {
  return <span className="plus-glyph">+</span>
}
