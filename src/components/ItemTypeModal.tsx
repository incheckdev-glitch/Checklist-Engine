import { Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { itemCatalog } from '../lib/catalog'
import type { ItemType } from '../types'

export function ItemTypeModal({
  onClose,
  onSelect,
}: {
  onClose: () => void
  onSelect: (type: ItemType) => void
}) {
  const [query, setQuery] = useState('')
  const groups = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return itemCatalog
    return itemCatalog
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.label.toLowerCase().includes(normalized)),
      }))
      .filter((group) => group.items.length)
  }, [query])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="item-picker-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header className="item-picker-header">
          <div>
            <span>CHECKLIST BUILDER</span>
            <strong>Choose an Item Type</strong>
            <p>Select the response or content type to add to the checklist.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button>
        </header>

        <div className="item-picker-search">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search item types" autoFocus />
        </div>

        <div className="item-picker-grid">
          {groups.map((group) => (
            <section className="item-picker-group" key={group.name}>
              <h3>{group.name}</h3>
              <div>
                {group.items.map((entry) => {
                  const Icon = entry.icon
                  return (
                    <button key={entry.type} onClick={() => onSelect(entry.type)}>
                      <span><Icon size={20} /></span>
                      <strong>{entry.label}</strong>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
          {!groups.length ? <div className="empty-section">No item types match your search.</div> : null}
        </div>
      </section>
    </div>
  )
}
