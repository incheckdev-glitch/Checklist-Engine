import { Camera, Check, Clock3, FileSignature, QrCode, X } from 'lucide-react'
import type { Checklist, ChecklistItem } from '../types'

function PreviewInput({ item }: { item: ChecklistItem }) {
  const config = item.config
  switch (item.type) {
    case 'yes_no':
      return <div className="segmented"><button>Yes</button><button>No</button></div>
    case 'checkmark':
      return <label className="preview-check"><input type="checkbox" /> Confirmed</label>
    case 'short_entry':
      return <input placeholder="Enter response" />
    case 'long_entry':
      return <textarea rows={3} placeholder="Enter observations" />
    case 'measurement':
      return <div className="measurement-input"><input type="number" placeholder="0.0" /><span>{String(config.unit ?? '')}</span></div>
    case 'multiple_choice':
      return <select><option>Select an option</option>{(Array.isArray(config.options) ? config.options : []).map((option) => <option key={String(option)}>{String(option)}</option>)}</select>
    case 'picture':
    case 'video':
      return <button className="evidence-button"><Camera size={17} /> Capture {item.type === 'picture' ? 'picture' : 'video'}</button>
    case 'qr':
    case 'barcode':
      return <button className="evidence-button"><QrCode size={17} /> Scan code</button>
    case 'signature':
      return <div className="signature-box"><FileSignature size={22} /> Tap to sign</div>
    case 'date':
      return <input type="date" />
    case 'time':
      return <input type="time" />
    case 'date_time':
      return <input type="datetime-local" />
    case 'stopwatch':
      return <button className="evidence-button"><Clock3 size={17} /> Start timer</button>
    case 'rating_1_5':
    case 'rating_1_10':
    case 'rating_custom': {
      const min = Number(config.min ?? 1)
      const max = Number(config.max ?? (item.type === 'rating_1_10' ? 10 : 5))
      const values = Array.from({ length: Math.min(max - min + 1, 10) }, (_, index) => min + index)
      return <div className="rating-row">{values.map((value) => <button key={value}>{value}</button>)}</div>
    }
    case 'instructions':
      return <div className="preview-instructions">{item.description || item.label}</div>
    case 'title':
      return null
    case 'formula':
      return <div className="formula-preview">Calculated automatically</div>
    case 'staff_member':
      return <select><option>Select staff member</option></select>
    case 'sub_checklist':
      return <button className="evidence-button">Open sub-checklist</button>
    default:
      return <input placeholder="Enter response" />
  }
}

export function PreviewModal({ checklist, onClose }: { checklist: Checklist; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="preview-modal" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-header"><div><span>MOBILE PREVIEW</span><strong>{checklist.name}</strong></div><button className="icon-button" onClick={onClose}><X size={18} /></button></header>
        <div className="phone-frame">
          <div className="phone-top"><span>9:41</span><span>● ● ●</span></div>
          <div className="phone-content">
            <div className="preview-title"><span>{checklist.frequency}</span><h2>{checklist.name}</h2><p>{checklist.description}</p></div>
            {checklist.sections.map((section, sectionIndex) => (
              <section className="preview-section" key={section.id}>
                <div className="preview-section-title"><span>{sectionIndex + 1}</span><div><strong>{section.title}</strong><p>{section.instructions}</p></div></div>
                {section.items.map((item) => (
                  <div className={`preview-item ${item.type === 'title' ? 'preview-heading-item' : ''}`} key={item.id}>
                    <label>{item.label}{item.required ? <em>*</em> : null}</label>
                    {item.description && item.type !== 'instructions' ? <small>{item.description}</small> : null}
                    <PreviewInput item={item} />
                  </div>
                ))}
              </section>
            ))}
            <button className="primary wide"><Check size={17} /> Submit checklist</button>
          </div>
        </div>
      </section>
    </div>
  )
}
