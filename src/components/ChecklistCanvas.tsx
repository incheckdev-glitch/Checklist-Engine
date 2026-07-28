import { ChevronDown, ChevronUp, Copy, Grid2X2, GripVertical, List, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { catalogByType } from '../lib/catalog'
import type { Checklist, ItemType } from '../types'

export function ChecklistCanvas({
  checklist,
  selectedItemId,
  selectedSectionId,
  onSelectItem,
  onSelectSection,
  onAddSection,
  onOpenItemPicker,
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
  onOpenItemPicker: (sectionId?: string) => void
  onAddItem: (type: ItemType, sectionId?: string) => void
  onDeleteSection: (sectionId: string) => void
  onDeleteItem: (sectionId: string, itemId: string) => void
  onDuplicateItem: (sectionId: string, itemId: string) => void
  onMoveItem: (sectionId: string, itemId: string, direction: -1 | 1) => void
}) {
  const [viewMode, setViewMode] = useState<'list' | 'compact'>('list')

  return (
    <main className="canvas panel">
      <div className="canvas-header">
        <div><span>ITEMS</span><strong>{checklist.sections.reduce((sum, section) => sum + section.items.length, 0)} checklist items</strong></div>
        <div className="canvas-header-actions">
          <div className="view-toggle">
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} title="List view"><List size={15} /></button>
            <button className={viewMode === 'compact' ? 'active' : ''} onClick={() => setViewMode('compact')} title="Compact view"><Grid2X2 size={15} /></button>
          </div>
          <button className="secondary small" onClick={onAddSection}><Plus size={15} /> Section</button>
          <button className="primary small" onClick={() => onOpenItemPicker(selectedSectionId || undefined)}><Plus size={15} /> New Item</button>
        </div>
      </div>
      <div className={`canvas-scroll ${viewMode === 'compact' ? 'compact-canvas' : ''}`}>
        {checklist.sections.map((section, sectionIndex) => (
          <section
            className={`builder-section ${selectedSectionId === section.id ? 'selected-section' : ''}`}
            key={section.id}
            onClick={() => onSelectSection(section.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const type = event.dataTransfer.getData('application/x-item-type') as ItemType
              if (type) onAddItem(type, section.id)
            }}
          >
            <header>
              <div className="section-number">{String(sectionIndex + 1).padStart(2, '0')}</div>
              <div className="section-title"><strong>{section.title || 'Untitled Section'}</strong><span>{section.instructions || 'No section instructions'}</span></div>
              <button className="icon-button" onClick={(event) => { event.stopPropagation(); onOpenItemPicker(section.id) }} title="Add item"><Plus size={16} /></button>
              <button className="icon-button danger-hover" onClick={(event) => { event.stopPropagation(); onDeleteSection(section.id) }} title="Delete section"><Trash2 size={16} /></button>
            </header>
            <div className="section-items">
              {section.items.length === 0 ? (
                <button className="empty-section clickable" onClick={(event) => { event.stopPropagation(); onOpenItemPicker(section.id) }}>Choose an item type to start this section</button>
              ) : section.items.map((item, itemIndex) => {
                const catalog = catalogByType.get(item.type)
                const Icon = catalog?.icon
                const background = typeof item.config.background_color === 'string' ? item.config.background_color : undefined
                const markAs = typeof item.config.mark_as === 'string' ? item.config.mark_as : ''
                const labelTag = typeof item.config.label_tag === 'string' ? item.config.label_tag : ''
                return (
                  <article
                    key={item.id}
                    className={`builder-item ${selectedItemId === item.id ? 'selected-item' : ''}`}
                    style={background ? { backgroundColor: background, color: '#182033' } : undefined}
                    onClick={(event) => { event.stopPropagation(); onSelectItem(section.id, item.id) }}
                  >
                    <GripVertical size={17} className="drag-handle" />
                    <span className="item-order">{itemIndex + 1}</span>
                    <span className="item-icon">{Icon ? <Icon size={17} /> : null}</span>
                    <div className="builder-item-copy">
                      <strong>{item.label || catalog?.label || 'Untitled item'}</strong>
                      <span>{catalog?.label}{markAs ? ` · Mark as: ${markAs}` : ''}{labelTag ? ` · ${labelTag}` : ''}{item.required ? ' · Required' : ''}{item.critical ? ' · Critical' : ''}{item.weight ? ` · ${item.weight} pts` : ''}</span>
                    </div>
                    <div className="item-actions">
                      <button className="icon-button" disabled={itemIndex === 0} onClick={(event) => { event.stopPropagation(); onMoveItem(section.id, item.id, -1) }}><ChevronUp size={15} /></button>
                      <button className="icon-button" disabled={itemIndex === section.items.length - 1} onClick={(event) => { event.stopPropagation(); onMoveItem(section.id, item.id, 1) }}><ChevronDown size={15} /></button>
                      <button className="icon-button" onClick={(event) => { event.stopPropagation(); onDuplicateItem(section.id, item.id) }}><Copy size={15} /></button>
                      <button className="icon-button danger-hover" onClick={(event) => { event.stopPropagation(); onDeleteItem(section.id, item.id) }}><Trash2 size={15} /></button>
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
