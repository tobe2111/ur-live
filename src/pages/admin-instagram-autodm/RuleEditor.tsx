/**
 * 💬 인스타 자동 DM — 규칙 작성/수정 폼.
 * ⚠️ 라이트 대시보드(AdminLayout) — dark: variant 금지.
 */
import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Loader2, Save, X, Images } from 'lucide-react'
import { apiError, type AutoDmRule, type IgMedia } from './types'

const field = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900'

export default function RuleEditor({ rule, connected, onClose, onSaved }: {
  rule: AutoDmRule | null; connected: boolean; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: rule?.name || '',
    keywords: rule?.keywords || '',
    match_mode: rule?.match_mode || 'contains',
    media_id: rule?.media_id || '',
    dm_text: rule?.dm_text || '{username}님, 댓글 감사해요!\n말씀하신 링크 보내드려요.',
    link_url: rule?.link_url || '',
    public_reply: rule?.public_reply || 'DM 보내드렸어요! 확인해 주세요!\n방금 DM 드렸어요!\nDM 확인 부탁드려요!',
    is_active: rule ? rule.is_active === 1 : true,
  })
  const [saving, setSaving] = useState(false)
  const [media, setMedia] = useState<IgMedia[] | null>(null)
  const [mediaLoading, setMediaLoading] = useState(false)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const loadMedia = async () => {
    setMediaLoading(true)
    try {
      const { data } = await api.get('/api/admin/instagram-autodm/media')
      setMedia(data?.data || [])
    } catch (e) { toast.error(apiError(e, '게시물을 불러오지 못했습니다')) } finally { setMediaLoading(false) }
  }

  const save = async () => {
    setSaving(true)
    try {
      if (rule) await api.put(`/api/admin/instagram-autodm/rules/${rule.id}`, form)
      else await api.post('/api/admin/instagram-autodm/rules', form)
      toast.success('규칙을 저장했습니다')
      onSaved()
    } catch (e) { toast.error(apiError(e, '저장하지 못했습니다')) } finally { setSaving(false) }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{rule ? '규칙 수정' : '새 규칙'}</h3>
        <button onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="닫기"><X className="h-4 w-4" /></button>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">이름 (나만 보는 메모)</span>
          <input className={field} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="예: 10월 이용권 이벤트" maxLength={60} />
        </label>

        <div>
          <span className="mb-1 block text-sm font-medium text-gray-700">키워드</span>
          <input className={field} value={form.keywords} onChange={(e) => set('keywords', e.target.value)} placeholder="링크, 정보, 신청" maxLength={300} />
          <div className="mt-2 flex gap-3 text-sm text-gray-600">
            <label className="flex items-center gap-1">
              <input type="radio" checked={form.match_mode === 'contains'} onChange={() => set('match_mode', 'contains')} /> 댓글에 포함되면
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={form.match_mode === 'exact'} onChange={() => set('match_mode', 'exact')} /> 댓글이 키워드와 똑같을 때만
            </label>
          </div>
          <p className="mt-1 text-xs text-gray-400">쉼표로 여러 개. 띄어쓰기·기호·이모지는 무시합니다("링크!!" = "링크").</p>
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium text-gray-700">적용 게시물</span>
          <div className="flex gap-2">
            <input className={field} value={form.media_id} onChange={(e) => set('media_id', e.target.value.replace(/\D/g, ''))} placeholder="비우면 모든 게시물" />
            <Button variant="outline" onClick={loadMedia} disabled={!connected || mediaLoading}>
              {mediaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Images className="h-4 w-4" />}
            </Button>
          </div>
          {media && (
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {media.map((m) => (
                <button
                  key={m.id} onClick={() => set('media_id', m.id)} title={m.caption || m.id}
                  className={`aspect-square overflow-hidden rounded-lg border-2 ${form.media_id === m.id ? 'border-brand' : 'border-transparent'}`}
                >
                  {(m.thumbnail_url || m.media_url)
                    ? <img src={m.thumbnail_url || m.media_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    : <span className="text-xs text-gray-400">{m.media_type}</span>}
                </button>
              ))}
              {media.length === 0 && <p className="col-span-full text-sm text-gray-400">게시물이 없습니다.</p>}
            </div>
          )}
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">DM 내용</span>
          <textarea className={`${field} h-28`} value={form.dm_text} onChange={(e) => set('dm_text', e.target.value)} maxLength={900} />
          <span className="text-xs text-gray-400">{'{username}'} 은 댓글 단 사람의 아이디로 바뀝니다.</span>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">링크 (DM 맨 끝에 붙음)</span>
          <input className={field} value={form.link_url} onChange={(e) => set('link_url', e.target.value)} placeholder="https://urdeal.kr/..." maxLength={500} />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">댓글 공개 답글 (선택)</span>
          <textarea className={`${field} h-20`} value={form.public_reply} onChange={(e) => set('public_reply', e.target.value)} maxLength={1000} />
          <span className="text-xs text-gray-400">한 줄에 하나씩. 여러 줄이면 무작위로 골라 답합니다 — 같은 답글 반복은 인스타가 스팸으로 봅니다. 비우면 답글 안 함.</span>
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} /> 이 규칙 사용
        </label>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} 저장
          </Button>
        </div>
      </div>
    </div>
  )
}
