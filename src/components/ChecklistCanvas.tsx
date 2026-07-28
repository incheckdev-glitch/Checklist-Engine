import { ChevronDown, ChevronUp, Copy, GripVertical, Plus, Trash2 } from 'lucide-react'
import { catalogByType } from '../lib/catalog'
import type { Checklist, ChecklistItem, ItemType } from '../types'

export function ChecklistCanvas({
  checklist,
  selectedItemId,
  selectedSectionId,
  onSelectItem,
  onSelectSection,
  onAddSection,
  onAddItem,
  onDeleteSection,
  onDeleteItem,
  onDuplicateItem,
  onMoveItem,
}: {
  checklist: Checklist
  selectedItemId: string | null
  selectedSectionId: string | null
  onSelectItem: (sectionId: string, itemId: string) => void
  onSelectSection: (sectionId: string) => void
  onAddSection: () => void
  onAddItem: (type: ItemType, sectionId?: string) => void
  onDeleteSection: (sectionId: string) => void
  onDeleteItem: (sectionId: string, itemId: string) => void
  onDuplicateItem: (sectionId: string, itemId: string) => void
  onMoveItem: (sectionId: string, itemId: string, direction: -1 | 1) => void
}) {
  return (
    <main className="canvas panel">
      <div className="canvas-header">
        <div><span>CHECKLIST STRUCTURE</span><strong>{checklist.sections.length} sections · {checklist.sections.reduce((sum, section) => sum + section.items.length, 0)} items</strong></div>
        <button className="secondary small" onClick={onAddSection}><Plus size={15} /> Section</button>
      </div>
      <div className="canvas-scroll">
        {checklist.sections.map((section, sectionIndex) => (
          <section
            className={`builder-section ${selectedSectionId === section.id ? 'selected-section' : ''}`}
            key={section.id}
            onClick={() => onSelectSection(section.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const type = e.dataTransfer.getData('application/x-item-type') as ItemType
              if (type) onAddItem(type, section.id)
            }}
          >
            <header>
              <div className="section-number">{String(sectionIndex + 1).padStart(2, '0')}</div>
              <div className="section-title"><strong>{section.title || 'Untitled Section'}</strong><span>{section.instructions || 'No section instructions'}</span></div>
              <button className="icon-button danger-hover" onClick={(e) => { e.stopPropagation(); onDeleteSection(section.id) }} title="Delete section"><Trash2 size={16} /></button>
            </header>
            <div className="section-items">
              {section.items.length === 0 ? (
                <div className="empty-section">Drag a field here or click a field in the library.</div>
              ) : section.items.map((item, itemIndex) => {
                const catalog = catalogByType.get(item.type)
                const Icon = catalog?.icon
                return (
                  <article
                    key={item.id}
                    className={`builder-item ${selectedItemId === item.id ? 'selected-item' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onSelectItem(section.id, item.id) }}
                  >
                    <GripVertical size={17} className="drag-handle" />
                    <span className="item-icon">{Icon ? <Icon size={17} /> : null}</span>
                    <div className="builder-item-copy">
                      <strong>{item.label || catalog?.label || 'Untitled item'}</strong>
                      <span>{catalog?.label}{item.required ? ' · Required' : ''}{item.critical ? ' · Critical' : ''}{item.weight ? ` · ${item.weight} pts` : ''}</span>
                    </div>
                    <div className="item-actions">
                      <button className="icon-button" disabled={itemIndex === 0} onClick={(e) => { e.stopPropagation(); onMoveItem(section.id, item.id, -1) }}><ChevronUp size={15} /></button>
                      <button className="icon-button" disabled={itemIndex === section.items.length - 1} onClick={(e) => { e.stopPropagation(); onMoveItem(section.id, item.id, 1) }}><ChevronDown size={15} /></button>
                      <button className="icon-button" onClick={(e) => { e.stopPropagation(); onDuplicateItem(section.id, item.id) }}><Copy size={15} /></button>
                      <button className="icon-button danger-hover" onClick={(e) => { e.stopPropagation(); onDeleteItem(section.id, item.id) }}><Trash2 size={15} /></button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
