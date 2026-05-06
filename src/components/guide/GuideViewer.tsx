import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { ChevronDown, ChevronRight, Loader2, Pencil, Save, X, Trash2, Plus } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import DOMPurify from 'dompurify'

/**
 * 운영 가이드 공통 뷰어 — 어드민/셀러/에이전시 모두 사용
 *
 * - markdown 렌더러 내장 (간단한 버전: **bold**, ### h3, `code`, > blockquote, 리스트)
 * - editable=true 면 관리자 편집 UI 활성화
 */

interface GuideSection {
  id?: number
  guide_type: 'admin' | 'seller' | 'agency'
  section_key: string
  section_icon: string
  section_title: string
  section_order: number
  content_md: string
  updated_at?: string
}

interface Props {
  guideType: 'admin' | 'seller' | 'agency'
  /**
   * @deprecated 2026-04-30: api interceptor 가 path :type 으로 자동 token 결정.
   *   하위 호환을 위해 prop 은 유지하되 무시됨.
   */
  token?: string
  editable?: boolean
}

// 간단 markdown → HTML 변환 (안전하게 escape 먼저 적용)
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function renderMarkdown(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let inCode = false
  let inList = false
  let inTable = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Code fence
    if (line.startsWith('```')) {
      if (inCode) { out.push('</code></pre>'); inCode = false }
      else { out.push('<pre class="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs overflow-x-auto font-mono my-3"><code>'); inCode = true }
      continue
    }
    if (inCode) { out.push(escapeHtml(line) + '\n'); continue }

    // Table (only simple pipe tables)
    if (line.match(/^\|.*\|$/) && lines[i + 1]?.match(/^\|[\s\-:|]+\|$/)) {
      if (!inTable) {
        out.push('<table class="my-3 border-collapse text-xs"><thead>')
        const headers = line.split('|').slice(1, -1).map(c => c.trim())
        out.push('<tr>' + headers.map(h => `<th class="border border-gray-300 px-2 py-1 bg-gray-50">${applyInline(h)}</th>`).join('') + '</tr></thead><tbody>')
        inTable = true
        i++ // skip separator
        continue
      }
    }
    if (inTable) {
      if (line.match(/^\|.*\|$/)) {
        const cells = line.split('|').slice(1, -1).map(c => c.trim())
        out.push('<tr>' + cells.map(c => `<td class="border border-gray-200 px-2 py-1">${applyInline(c)}</td>`).join('') + '</tr>')
        continue
      } else {
        out.push('</tbody></table>')
        inTable = false
      }
    }

    // Blockquote
    if (line.startsWith('> ')) {
      out.push(`<blockquote class="border-l-4 border-amber-300 bg-amber-50 pl-3 py-2 my-2 text-sm text-amber-900">${applyInline(line.slice(2))}</blockquote>`)
      continue
    }

    // Headings
    if (line.startsWith('### ')) {
      if (inList) { out.push('</ul>'); inList = false }
      out.push(`<h3 class="text-sm font-bold text-gray-900 mt-4 mb-2">${applyInline(line.slice(4))}</h3>`)
      continue
    }
    if (line.startsWith('## ')) {
      if (inList) { out.push('</ul>'); inList = false }
      out.push(`<h2 class="text-base font-bold text-gray-900 mt-5 mb-2">${applyInline(line.slice(3))}</h2>`)
      continue
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      if (!inList || inList !== true) { out.push('<ol class="list-decimal pl-5 space-y-1 my-2">'); inList = true }
      out.push(`<li>${applyInline(line.replace(/^\d+\.\s/, ''))}</li>`)
      if (!/^\d+\.\s/.test(lines[i + 1] || '')) { out.push('</ol>'); inList = false }
      continue
    }

    // Unordered list
    if (line.startsWith('- ')) {
      if (!inList) { out.push('<ul class="list-disc pl-5 space-y-1 my-2">'); inList = true }
      out.push(`<li>${applyInline(line.slice(2))}</li>`)
      if (!lines[i + 1]?.startsWith('- ')) { out.push('</ul>'); inList = false }
      continue
    }

    // Empty line
    if (line.trim() === '') {
      if (inList) { out.push('</ul>'); inList = false }
      continue
    }

    // Paragraph
    out.push(`<p class="my-2">${applyInline(line)}</p>`)
  }

  if (inTable) out.push('</tbody></table>')
  if (inList) out.push('</ul>')
  if (inCode) out.push('</code></pre>')
  return out.join('\n')
}

function applyInline(s: string): string {
  let r = escapeHtml(s)
  // **bold**
  r = r.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
  // `code`
  r = r.replace(/`([^`]+)`/g, '<code class="bg-gray-100 text-gray-900 px-1 py-0.5 rounded text-[11px] font-mono">$1</code>')
  return r
}

export default function GuideViewer({ guideType, editable = false }: Props) {
  const { t } = useTranslation()
  const [sections, setSections] = useState<GuideSection[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<GuideSection>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guideType])

  async function load() {
    setLoading(true)
    try {
      // 🛡️ 2026-04-30: api interceptor 가 path 의 :type 으로 자동 token 결정.
      //   명시 헤더 제거 — interceptor 401 흐름과 일관성 유지.
      const res = await api.get(`/api/guides/${guideType}`)
      if (res.data?.success) {
        setSections(res.data.data || [])
        if (res.data.data?.length > 0 && !expanded) {
          setExpanded(res.data.data[0].section_key)
        }
      }
    } catch {
      toast.error('가이드를 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }

  function startEdit(s: GuideSection) {
    setEditingKey(s.section_key)
    setEditForm({
      section_title: s.section_title,
      section_icon: s.section_icon,
      section_order: s.section_order,
      content_md: s.content_md,
    })
  }

  async function saveSection(sectionKey: string) {
    setSaving(true)
    try {
      await api.patch(`/api/guides/${guideType}/${sectionKey}`, editForm)
      toast.success('저장되었습니다')
      setEditingKey(null)
      setEditForm({})
      load()
    } catch {
      toast.error('저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  async function deleteSection(sectionKey: string) {
    if (!confirm('이 섹션을 삭제하시겠습니까?')) return
    try {
      await api.delete(`/api/guides/${guideType}/${sectionKey}`)
      toast.success('삭제되었습니다')
      load()
    } catch {
      toast.error('삭제에 실패했습니다')
    }
  }

  async function addSection() {
    const key = prompt('새 섹션 키 (영문 소문자, 예: my-section)')
    if (!key) return
    setEditingKey(key)
    setEditForm({
      section_title: '새 섹션',
      section_icon: '📄',
      section_order: 999,
      content_md: '### 제목\n\n내용을 여기에 작성하세요.',
    })
    setExpanded(key)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {editable && (
        <button
          onClick={addSection}
          className="w-full py-2 bg-blue-50 border-2 border-dashed border-blue-200 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-100 flex items-center justify-center gap-1.5">
          <Plus className="w-4 h-4" /> 새 섹션 추가
        </button>
      )}

      {/* 미저장 새 섹션 */}
      {editable && editingKey && !sections.find(s => s.section_key === editingKey) && (
        <div className="bg-white rounded-xl border-2 border-blue-300 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editForm.section_icon || ''}
              onChange={e => setEditForm(f => ({ ...f, section_icon: e.target.value }))}
              placeholder="🔖"
              className="w-12 px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 text-center"
            />
            <input
              type="text"
              value={editForm.section_title || ''}
              onChange={e => setEditForm(f => ({ ...f, section_title: e.target.value }))}
              placeholder={t('guide.sectionTitlePlaceholder', { defaultValue: '섹션 제목' })}
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm font-bold text-gray-900"
            />
            <input
              type="number"
              value={editForm.section_order || 0}
              onChange={e => setEditForm(f => ({ ...f, section_order: Number(e.target.value) }))}
              placeholder={t('guide.orderPlaceholder', { defaultValue: '순서' })}
              className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900"
            />
          </div>
          <textarea
            value={editForm.content_md || ''}
            onChange={e => setEditForm(f => ({ ...f, content_md: e.target.value }))}
            rows={12}
            className="w-full px-3 py-2 border border-gray-300 rounded text-xs font-mono text-gray-900 resize-y"
          />
          <div className="flex gap-2">
            <button onClick={() => saveSection(editingKey)} disabled={saving}
              className="flex-1 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5">
              <Save className="w-4 h-4" /> {saving ? '저장 중...' : '저장'}
            </button>
            <button onClick={() => { setEditingKey(null); setEditForm({}) }}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {sections.map(s => {
        const isEditing = editingKey === s.section_key
        const isExpanded = expanded === s.section_key

        return (
          <section key={s.section_key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setExpanded(isExpanded ? null : s.section_key)}
                className="flex-1 flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50"
              >
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span>{s.section_icon}</span>{s.section_title}
                </h2>
                {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
              </button>
              {editable && !isEditing && (
                <div className="flex items-center gap-1 pr-3">
                  <button onClick={() => startEdit(s)} title={t('guide.editBtn', { defaultValue: '편집' })}
                    className="p-2 text-gray-400 hover:text-blue-600">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteSection(s.section_key)} title={t('guide.deleteBtn', { defaultValue: '삭제' })}
                    className="p-2 text-gray-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {isExpanded && (
              <div className="px-5 pb-5 pt-1 border-t border-gray-100">
                {isEditing ? (
                  <div className="space-y-3 pt-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editForm.section_icon || ''}
                        onChange={e => setEditForm(f => ({ ...f, section_icon: e.target.value }))}
                        className="w-12 px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 text-center"
                      />
                      <input
                        type="text"
                        value={editForm.section_title || ''}
                        onChange={e => setEditForm(f => ({ ...f, section_title: e.target.value }))}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm font-bold text-gray-900"
                      />
                      <input
                        type="number"
                        value={editForm.section_order || 0}
                        onChange={e => setEditForm(f => ({ ...f, section_order: Number(e.target.value) }))}
                        className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900"
                      />
                    </div>
                    <textarea
                      value={editForm.content_md || ''}
                      onChange={e => setEditForm(f => ({ ...f, content_md: e.target.value }))}
                      rows={16}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-xs font-mono text-gray-900 resize-y"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => saveSection(s.section_key)} disabled={saving}
                        className="flex-1 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5">
                        <Save className="w-4 h-4" /> {saving ? '저장 중...' : '저장'}
                      </button>
                      <button onClick={() => { setEditingKey(null); setEditForm({}) }}
                        className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-500">
                      지원 문법: <code>**bold**</code>, <code>`code`</code>, <code>### 제목</code>, <code>&gt; 인용</code>, 리스트(<code>-</code> 또는 <code>1.</code>), 코드블록(```), 표
                    </p>
                  </div>
                ) : (
                  <div
                    className="text-sm text-gray-700 leading-relaxed"
                    // eslint-disable-next-line react/no-danger
                    // 🛡️ 2026-05-01: DOMPurify sanitize — admin/seller 가 markdown 에 악성 태그
                    //   삽입할 수 있는 XSS 위험 차단. renderMarkdown 출력에 추가 layer.
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMarkdown(s.content_md), {
                      ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'span', 'div', 'hr'],
                      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel'],
                      ALLOW_DATA_ATTR: false,
                    }) }}
                  />
                )}
                {s.updated_at && (
                  <p className="text-[10px] text-gray-400 mt-3 pt-2 border-t border-gray-100">
                    최종 수정: {new Date(s.updated_at).toLocaleString('ko-KR')}
                  </p>
                )}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
