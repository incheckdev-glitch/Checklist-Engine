import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  Bot,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Copy,
  Eye,
  FilePlus2,
  ListChecks,
  LoaderCircle,
  LogOut,
  Menu,
  MoreVertical,
  Plus,
  Save,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { AIWizard } from './components/AIWizard'
import { ChecklistCanvas } from './components/ChecklistCanvas'
import { ChecklistSettings } from './components/ChecklistSettings'
import { Inspector } from './components/Inspector'
import { ItemTypeModal } from './components/ItemTypeModal'
import { PreviewModal } from './components/PreviewModal'
import { catalogByType } from './lib/catalog'
import { materializeGenerated } from './lib/demo'
import { newId } from './lib/ids'
import {
  blankChecklist,
  deleteChecklist,
  duplicateChecklist,
  generateChecklist,
  listChecklists,
  publishChecklist,
  saveChecklist,
} from './lib/repository'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { Checklist, ChecklistItem, ChecklistSection, GenerationRequest, ItemType } from './types'

export default function App() {
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [showAI, setShowAI] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showItemPicker, setShowItemPicker] = useState(false)
  const [pickerSectionId, setPickerSectionId] = useState<string | null>(null)
  const [builderTab, setBuilderTab] = useState<'items' | 'settings'>('items')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    listChecklists()
      .then((rows) => {
        setChecklists(rows)
        setActiveId(rows[0]?.id || null)
        setSelectedSectionId(rows[0]?.sections[0]?.id || null)
      })
      .catch((error) => setNotice(error instanceof Error ? error.message : 'Unable to load checklists.'))
      .finally(() => setLoading(false))
  }, [])

  const active = useMemo(() => checklists.find((checklist) => checklist.id === activeId) || null, [checklists, activeId])
  const selectedSection = active?.sections.find((section) => section.id === selectedSectionId) || null
  const selectedItem = selectedSection?.items.find((item) => item.id === selectedItemId) || null

  function updateActive(mutator: (checklist: Checklist) => Checklist) {
    if (!active) return
    setChecklists((current) => current.map((entry) => {
      if (entry.id !== active.id) return entry
      const next = mutator(entry)
      return entry.status === 'published' ? { ...next, status: 'draft' } : next
    }))
  }

  function chooseChecklist(checklist: Checklist) {
    setActiveId(checklist.id)
    setSelectedSectionId(checklist.sections[0]?.id || null)
    setSelectedItemId(null)
    setBuilderTab('items')
    if (window.innerWidth < 1000) setSidebarOpen(false)
  }

  function openItemPicker(sectionId?: string) {
    setPickerSectionId(sectionId || selectedSectionId || active?.sections[0]?.id || null)
    setShowItemPicker(true)
  }

  function addBlank() {
    const next = blankChecklist()
    setChecklists((current) => [next, ...current])
    chooseChecklist(next)
    setPickerSectionId(next.sections[0]?.id || null)
    setShowItemPicker(true)
    setNotice('Checklist created. Choose the first item type.')
  }

  function addSection() {
    if (!active) return
    const section: ChecklistSection = {
      id: newId('section'),
      title: `New Section ${active.sections.length + 1}`,
      instructions: '',
      sort_order: active.sections.length,
      items: [],
    }
    updateActive((checklist) => ({ ...checklist, sections: [...checklist.sections, section] }))
    setSelectedSectionId(section.id)
    setSelectedItemId(null)
  }

  function addItem(type: ItemType, targetSectionId?: string) {
    if (!active) return
    const sectionId = targetSectionId || pickerSectionId || selectedSectionId || active.sections[0]?.id
    if (!sectionId) return
    const catalog = catalogByType.get(type)
    const newItem: ChecklistItem = {
      id: newId('item'),
      section_id: sectionId,
      type,
      label: catalog?.label || 'New Item',
      description: '',
      required: !['title', 'instructions', 'formula'].includes(type),
      weight: ['title', 'instructions', 'picture', 'video', 'signature', 'date', 'time', 'date_time', 'staff_member', 'formula'].includes(type) ? 0 : 5,
      critical: false,
      allow_na: false,
      sort_order: 0,
      config: { ...(catalog?.defaultConfig || {}) },
      conditions: [],
      corrective_action: null,
    }
    updateActive((checklist) => ({
      ...checklist,
      sections: checklist.sections.map((section) => section.id === sectionId
        ? { ...section, items: [...section.items, { ...newItem, sort_order: section.items.length }] }
        : section),
    }))
    setSelectedSectionId(sectionId)
    setSelectedItemId(newItem.id)
    setBuilderTab('items')
    setShowItemPicker(false)
    setPickerSectionId(null)
    setNotice('Item Added Successfully')
  }

  function updateSelectedItem(patch: Partial<ChecklistItem>) {
    if (!selectedSectionId || !selectedItemId) return
    updateActive((checklist) => ({
      ...checklist,
      sections: checklist.sections.map((section) => section.id === selectedSectionId
        ? { ...section, items: section.items.map((item) => item.id === selectedItemId ? { ...item, ...patch } : item) }
        : section),
    }))
  }

  function updateSelectedSection(patch: Partial<ChecklistSection>) {
    if (!selectedSectionId) return
    updateActive((checklist) => ({
      ...checklist,
      sections: checklist.sections.map((section) => section.id === selectedSectionId ? { ...section, ...patch } : section),
    }))
  }

  function deleteSection(sectionId: string) {
    if (!active || active.sections.length <= 1) {
      setNotice('A checklist must contain at least one section.')
      return
    }
    updateActive((checklist) => ({ ...checklist, sections: checklist.sections.filter((section) => section.id !== sectionId) }))
    const remaining = active.sections.filter((section) => section.id !== sectionId)
    setSelectedSectionId(remaining[0]?.id || null)
    setSelectedItemId(null)
  }

  function deleteItem(sectionId: string, itemId: string) {
    updateActive((checklist) => ({
      ...checklist,
      sections: checklist.sections.map((section) => section.id === sectionId ? { ...section, items: section.items.filter((item) => item.id !== itemId) } : section),
    }))
    if (selectedItemId === itemId) setSelectedItemId(null)
  }

  function duplicateItem(sectionId: string, itemId: string) {
    updateActive((checklist) => ({
      ...checklist,
      sections: checklist.sections.map((section) => {
        if (section.id !== sectionId) return section
        const index = section.items.findIndex((item) => item.id === itemId)
        const source = section.items[index]
        if (!source) return section
        const copy = {
          ...source,
          id: newId('item'),
          label: `${source.label} Copy`,
          config: structuredClone(source.config),
          conditions: structuredClone(source.conditions),
          corrective_action: source.corrective_action ? { ...source.corrective_action } : null,
        }
        const items = [...section.items]
        items.splice(index + 1, 0, copy)
        return { ...section, items }
      }),
    }))
  }

  function moveItem(sectionId: string, itemId: string, direction: -1 | 1) {
    updateActive((checklist) => ({
      ...checklist,
      sections: checklist.sections.map((section) => {
        if (section.id !== sectionId) return section
        const index = section.items.findIndex((item) => item.id === itemId)
        const target = index + direction
        if (index < 0 || target < 0 || target >= section.items.length) return section
        const items = [...section.items]
        ;[items[index], items[target]] = [items[target], items[index]]
        return { ...section, items }
      }),
    }))
  }

  async function save() {
    if (!active) return
    setSaving(true)
    setNotice('')
    try {
      const saved = await saveChecklist(active)
      setChecklists((current) => current.map((entry) => entry.id === saved.id ? saved : entry))
      setNotice('Checklist saved successfully.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to save checklist.')
    } finally {
      setSaving(false)
    }
  }

  async function publish() {
    if (!active) return
    await save()
    try {
      const version = await publishChecklist(active.id, `Published version ${active.current_version + 1}`)
      updateActive((checklist) => ({ ...checklist, status: 'published', current_version: version }))
      setNotice(`Checklist finished and published as version ${version}.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to publish checklist.')
    }
  }

  async function generate(request: GenerationRequest) {
    const generated = await generateChecklist(request)
    const checklist = materializeGenerated(generated)
    setChecklists((current) => [checklist, ...current])
    chooseChecklist(checklist)
    setSelectedSectionId(checklist.sections[0]?.id || null)
    setSelectedItemId(checklist.sections[0]?.items[0]?.id || null)
    setNotice('AI draft generated with item settings. Review and save it before finishing.')
  }

  async function removeActive() {
    if (!active) return
    if (!confirm(`Delete “${active.name}”?`)) return
    try {
      await deleteChecklist(active.id)
      const remaining = checklists.filter((entry) => entry.id !== active.id)
      setChecklists(remaining)
      setActiveId(remaining[0]?.id || null)
      setSelectedSectionId(remaining[0]?.sections[0]?.id || null)
      setSelectedItemId(null)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to delete checklist.')
    }
  }

  function createCopy() {
    if (!active) return
    const copy = duplicateChecklist(active)
    setChecklists((current) => [copy, ...current])
    chooseChecklist(copy)
    setNotice('Draft copy created.')
  }

  if (loading) return <div className="center-screen"><LoaderCircle className="spin" /> Loading checklist engine…</div>

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><button className="icon-button mobile-only" onClick={() => setSidebarOpen(!sidebarOpen)}><Menu size={19} /></button><span className="brand-mark"><ClipboardList size={20} /></span><div><strong>InCheck 360</strong><span>AI Checklist Engine</span></div></div>
        <div className="top-actions">
          {!isSupabaseConfigured ? <span className="demo-pill"><Bot size={14} /> Local demo mode</span> : null}
          <button className="secondary" onClick={() => setShowPreview(true)} disabled={!active}><Eye size={16} /> Preview</button>
          <button className="secondary" onClick={save} disabled={!active || saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} Save</button>
          <button className="primary" onClick={publish} disabled={!active}><Send size={16} /> Finish</button>
          {supabase ? <button className="icon-button" title="Sign out" onClick={() => void supabase?.auth.signOut()}><LogOut size={17} /></button> : null}
        </div>
      </header>

      <div className="workspace">
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header"><div><span>CHECKLISTS</span><strong>All Checklists</strong></div><button className="icon-button mobile-only" onClick={() => setSidebarOpen(false)}><X size={18} /></button></div>
          <div className="sidebar-actions">
            <button className="ai-create" onClick={() => setShowAI(true)}><Sparkles size={17} /><span><strong>Create with AI</strong><small>Generate from a description or SOP</small></span></button>
            <button className="secondary wide" onClick={addBlank}><FilePlus2 size={16} /> Create Checklist</button>
          </div>
          <div className="checklist-list">
            {checklists.map((checklist) => (
              <button className={`checklist-row ${checklist.id === activeId ? 'active' : ''}`} key={checklist.id} onClick={() => chooseChecklist(checklist)}>
                <span className="list-icon"><ClipboardList size={17} /></span>
                <span className="list-copy"><strong>{checklist.name}</strong><small>{checklist.sections.reduce((sum, section) => sum + section.items.length, 0)} items · v{checklist.current_version}</small></span>
                <span className={`status-dot ${checklist.status}`} />
              </button>
            ))}
          </div>
          <div className="sidebar-footer"><span><CheckCircle2 size={14} /> Supabase-ready</span><small>{isSupabaseConfigured ? 'Cloud database connected' : 'Add .env to connect'}</small></div>
        </aside>

        <section className="main-area">
          {active ? (
            <>
              <div className="editor-meta">
                <div className="meta-copy">
                  <input className="checklist-name" value={active.name} onChange={(event) => updateActive((checklist) => ({ ...checklist, name: event.target.value }))} />
                  <textarea rows={1} value={active.description} onChange={(event) => updateActive((checklist) => ({ ...checklist, description: event.target.value }))} placeholder="Checklist description" />
                </div>
                <div className="meta-badges"><span className={`status-badge ${active.status}`}>{active.status.replace('_', ' ')}</span><span>Version {active.current_version || 'Draft'}</span>
                  <div className="dropdown"><button className="icon-button"><MoreVertical size={17} /></button><div className="dropdown-menu"><button onClick={createCopy}><Copy size={15} /> Duplicate</button><button onClick={() => updateActive((checklist) => ({ ...checklist, status: 'archived' }))}><Archive size={15} /> Archive</button><button className="danger" onClick={removeActive}><Trash2 size={15} /> Delete</button></div></div>
                </div>
              </div>

              <div className="builder-tabs">
                <button className={builderTab === 'items' ? 'active' : ''} onClick={() => setBuilderTab('items')}><ListChecks size={16} /> Items</button>
                <button className={builderTab === 'settings' ? 'active' : ''} onClick={() => setBuilderTab('settings')}><Settings2 size={16} /> Settings</button>
              </div>

              {builderTab === 'items' ? (
                <div className="builder-grid video-flow-grid">
                  <ChecklistCanvas
                    checklist={active}
                    selectedItemId={selectedItemId}
                    selectedSectionId={selectedSectionId}
                    onSelectItem={(sectionId, itemId) => { setSelectedSectionId(sectionId); setSelectedItemId(itemId) }}
                    onSelectSection={(sectionId) => { setSelectedSectionId(sectionId); setSelectedItemId(null) }}
                    onAddSection={addSection}
                    onOpenItemPicker={openItemPicker}
                    onAddItem={addItem}
                    onDeleteSection={deleteSection}
                    onDeleteItem={deleteItem}
                    onDuplicateItem={duplicateItem}
                    onMoveItem={moveItem}
                  />
                  <Inspector item={selectedItem} section={selectedSection} checklist={active} checklists={checklists} onChangeItem={updateSelectedItem} onChangeSection={updateSelectedSection} />
                </div>
              ) : (
                <div className="settings-layout"><ChecklistSettings checklist={active} onChange={(patch) => updateActive((checklist) => ({ ...checklist, ...patch }))} /></div>
              )}
            </>
          ) : (
            <div className="empty-workspace"><div className="empty-illustration"><Sparkles size={36} /></div><h2>Create your first checklist</h2><p>Start from a blank checklist or let AI generate an operational draft.</p><div><button className="primary" onClick={() => setShowAI(true)}><Sparkles size={17} /> Create with AI</button><button className="secondary" onClick={addBlank}><Plus size={17} /> Create Checklist</button></div></div>
          )}
        </section>
      </div>

      {notice ? <div className="toast" onClick={() => setNotice('')}>{notice}<ChevronDown size={15} /></div> : null}
      {showAI ? <AIWizard onClose={() => setShowAI(false)} onGenerate={generate} /> : null}
      {showPreview && active ? <PreviewModal checklist={active} onClose={() => setShowPreview(false)} /> : null}
      {showItemPicker ? <ItemTypeModal onClose={() => setShowItemPicker(false)} onSelect={(type) => addItem(type, pickerSectionId || undefined)} /> : null}
    </div>
  )
}
