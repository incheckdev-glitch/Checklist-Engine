import { Clock3, Search, Sparkles, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { itemCatalog } from '../lib/catalog'
import type { ItemType } from '../types'

const RECENT_KEY = 'incheck-recent-item-types-v1'

const descriptions: Record<ItemType, string> = {
  checkmark: 'A fast confirmation for a completed task or verified condition.',
  yes_no: 'A clear compliant or non-compliant answer with follow-up logic.',
  signature: 'Capture formal approval, acknowledgment, or handover.',
  staff_member: 'Assign responsibility and record who completed the step.',
  multiple_choice: 'Offer one or more structured answers, templates, and failure choices.',
  video: 'Capture motion, operation, or a process as visual evidence.',
  picture: 'Collect photographic proof, damage evidence, or completed work.',
  qr: 'Verify an asset, location, product, or reference through a QR scan.',
  barcode: 'Scan products, stock, assets, or labels without manual entry.',
  measurement: 'Record a numeric value with units, ranges, status, and detector input.',
  rating_1_5: 'Collect a focused five-point quality or readiness score.',
  rating_1_10: 'Use a broader ten-point rating for performance or experience.',
  rating_custom: 'Define a custom scale, step size, and pass threshold.',
  formula: 'Calculate a live result from checklist answers and measurements.',
  date_time: 'Capture the exact date and time of an event or inspection.',
  date: 'Record a date such as expiry, review, delivery, or completion.',
  time: 'Capture a specific time without adding a date.',
  stopwatch: 'Track duration, response time, or a timed operational process.',
  long_entry: 'Collect detailed observations, explanations, or incident notes.',
  short_entry: 'Capture a name, reference, code, location, or concise answer.',
  instructions: 'Guide the user with non-editable procedure or safety information.',
  title: 'Create a strong visual heading inside the checklist flow.',
  sub_checklist: 'Launch a reusable checklist inside the current workflow.',
}

const featured: ItemType[] = ['yes_no', 'measurement', 'picture', 'multiple_choice', 'staff_member', 'signature']

function readRecent(): ItemType[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((type): type is ItemType => typeof type === 'string').slice(0, 5) : []
  } catch {
    return []
  }
}

export function ItemTypeModal({
  onClose,
  onSelect,
}: {
  onClose: () => void
  onSelect: (type: ItemType) => void
}) {
  const [query, setQuery] = useState('')
  const [activeGroup, setActiveGroup] = useState('All')
  const [recent, setRecent] = useState<ItemType[]>(readRecent)

  const entries = useMemo(() => itemCatalog.flatMap((group) => group.items), [])
  const byType = useMemo(() => new Map(entries.map((entry) => [entry.type, entry])), [entries])

  const groups = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return itemCatalog
      .filter((group) => activeGroup === 'All' || group.name === activeGroup)
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (!normalized) return true
          return item.label.toLowerCase().includes(normalized) || descriptions[item.type].toLowerCase().includes(normalized)
        }),
      }))
      .filter((group) => group.items.length)
  }, [query, activeGroup])

  function select(type: ItemType) {
    const next = [type, ...recent.filter((entry) => entry !== type)].slice(0, 5)
    setRecent(next)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    onSelect(type)
  }

  const featuredEntries = featured.map((type) => byType.get(type)).filter(Boolean)
  const recentEntries = recent.map((type) => byType.get(type)).filter(Boolean)

  return (
    <div className="modal-backdrop creative-backdrop" onMouseDown={onClose}>
      <section className="item-picker-modal creative-picker" onMouseDown={(event) => event.stopPropagation()}>
        <header className="creative-picker-header">
          <div className="picker-orbit"><Sparkles size={23} /></div>
          <div>
            <span>ITEM UNIVERSE</span>
            <strong>Choose how this step should feel</strong>
            <p>Every field is a building block. Combine answers, evidence, measurements, timing, and follow-up to create a smarter operational story.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button>
        </header>

        <div className="creative-picker-toolbar">
          <div className="item-picker-search creative-search">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by field, purpose, evidence, range…" autoFocus />
            {query ? <button className="icon-button" onClick={() => setQuery('')}><X size={14} /></button> : null}
          </div>
          <div className="category-pills">
            {['All', ...itemCatalog.map((group) => group.name)].map((group) => (
              <button className={activeGroup === group ? 'active' : ''} onClick={() => setActiveGroup(group)} key={group}>{group}</button>
            ))}
          </div>
        </div>

        {!query && activeGroup === 'All' ? (
          <div className="picker-inspiration">
            <section>
              <div className="inspiration-title"><Sparkles size={15} /><span>SMART STARTERS</span></div>
              <div className="featured-item-row">
                {featuredEntries.map((entry) => {
                  if (!entry) return null
                  const Icon = entry.icon
                  return (
                    <button onClick={() => select(entry.type)} key={entry.type}>
                      <span><Icon size={19} /></span>
                      <div><strong>{entry.label}</strong><small>{descriptions[entry.type]}</small></div>
                    </button>
                  )
                })}
              </div>
            </section>

            {recentEntries.length ? (
              <section className="recent-items-block">
                <div className="inspiration-title"><Clock3 size={15} /><span>RECENTLY USED</span></div>
                <div>{recentEntries.map((entry) => entry ? <button onClick={() => select(entry.type)} key={entry.type}>{entry.label}</button> : null)}</div>
              </section>
            ) : null}
          </div>
        ) : null}

        <div className="item-picker-grid creative-item-grid">
          {groups.map((group) => (
            <section className="item-picker-group creative-item-group" key={group.name}>
              <div className="group-heading"><h3>{group.name}</h3><span>{group.items.length} building blocks</span></div>
              <div>
                {group.items.map((entry) => {
                  const Icon = entry.icon
                  return (
                    <button className="creative-item-card" key={entry.type} onClick={() => select(entry.type)}>
                      <span className="creative-item-icon"><Icon size={20} /></span>
                      <span className="creative-item-copy"><strong>{entry.label}</strong><small>{descriptions[entry.type]}</small></span>
                      <span className="add-item-badge">+</span>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
          {!groups.length ? (
            <div className="creative-empty-search">
              <Search size={28} />
              <strong>No building block found</strong>
              <span>Try searching for “temperature,” “evidence,” “approval,” or “time.”</span>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
