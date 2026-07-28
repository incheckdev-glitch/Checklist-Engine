import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { itemCatalog } from '../lib/catalog'
import type { ItemType } from '../types'

export function Palette({ onAdd }: { onAdd: (type: ItemType) => void }) {
  const [query, setQuery] = useState('')
  const groups = useMemo(() => itemCatalog.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
  })).filter((group) => group.items.length), [query])

  return (
    <aside className="palette panel">
      <div className="panel-heading"><div><span>FIELD LIBRARY</span><strong>Add checklist items</strong></div></div>
      <div className="search-box"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search fields…" /></div>
      <div className="palette-scroll">
        {groups.map((group) => (
          <section className="palette-group" key={group.name}>
            <h3>{group.name}</h3>
            <div className="palette-items">
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <button key={item.type} className="palette-item" onClick={() => onAdd(item.type)} draggable onDragStart={(e) => e.dataTransfer.setData('application/x-item-type', item.type)}>
                    <span className="item-icon"><Icon size={17} /></span><span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </aside>
  )
}
