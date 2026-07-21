import { useState } from 'react'
import api from '@/lib/api'
import { SEO } from '@/components/SEO'

/**
 * 📥 유어딜 제휴 크리에이터 모집 (공개 신청 페이지, /creators).
 *   인플루언서가 스스로 신청 → 공용 풀에 인바운드로 저장. 신청 = 사전 수신동의(자유 연락 가능).
 *   라이트 고정 standalone → 루트 div 에 force-light-theme (다크 전역규칙 무력화).
 */
const PLATFORMS = [
  { v: 'youtube', label: '유튜브' }, { v: 'instagram', label: '인스타그램' }, { v: 'naver_blog', label: '네이버 블로그' },
  { v: 'tistory', label: '티스토리' }, { v: 'tiktok', label: '틱톡' }, { v: 'etc', label: '기타' },
]
const CATEGORIES = ['맛집', '카페', '뷰티', '네일', '숙소', '패션', '여행', '육아', '기타']

export default function CreatorApplyPage() {
  const [f, setF] = useState({ name: '', platform: 'youtube', url: '', category: '맛집', email: '', contact: '', message: '' })
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF(p => ({ ...p, [k]: e.target.value }))

  async function submit() {
    setErr('')
    if (!agree) { setErr('제휴 제안 수신에 동의해주세요.'); return }
    setBusy(true)
    try {
      const r = await api.post('/api/creator-apply', { ...f, agree })
      if (r.data?.success) setDone(true)
      else setErr(r.data?.error || '신청에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } }
      setErr(ax.response?.data?.error || '신청에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally { setBusy(false) }
  }

  const input = 'w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus:border-gray-900 focus:outline-none'

  return (
    <div className="force-light-theme min-h-[100dvh] bg-gray-50 py-10 px-4">
      <SEO title="유어딜 제휴 크리에이터 모집 - 유어딜" description="동네 맛집·카페·뷰티·숙소 딜을 소개할 크리에이터를 찾습니다. 지금 제휴 신청하세요." url="/creators/apply" />
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">유어딜 제휴 크리에이터 모집</h1>
          <p className="mt-2 text-sm text-gray-600">동네 맛집·카페·뷰티·네일·숙소 딜을 소개할 크리에이터를 찾습니다.<br />신청해주시면 제휴 담당자가 검토 후 연락드립니다.</p>
        </div>

        {done ? (
          <div className="rounded-xl border border-emerald-200 bg-white p-8 text-center">
            <div className="text-4xl mb-3">✅</div>
            <div className="text-lg font-semibold text-gray-900">신청이 접수되었습니다</div>
            <p className="mt-2 text-sm text-gray-600">검토 후 제휴 담당자가 입력해주신 연락처로 연락드립니다. 감사합니다.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이름 · 채널명 <span className="text-rose-500">*</span></label>
              <input value={f.name} onChange={set('name')} placeholder="예: 방배동 미식가" className={input} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">플랫폼</label>
                <select value={f.platform} onChange={set('platform')} className={input}>{PLATFORMS.map(p => <option key={p.v} value={p.v}>{p.label}</option>)}</select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">주요 분야</label>
                <select value={f.category} onChange={set('category')} className={input}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">채널 주소(URL) <span className="text-rose-500">*</span></label>
              <input value={f.url} onChange={set('url')} placeholder="https://..." className={input} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <input value={f.email} onChange={set('email')} placeholder="business@example.com" className={input} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">기타 연락처 <span className="text-gray-400 font-normal">(인스타 DM·카톡 등)</span></label>
              <input value={f.contact} onChange={set('contact')} placeholder="@insta_id 또는 카톡ID" className={input} />
            </div>
            <p className="text-xs text-gray-400 -mt-2">※ 이메일 또는 연락처 중 하나는 꼭 입력해주세요.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">하고 싶은 말 <span className="text-gray-400 font-normal">(선택)</span></label>
              <textarea value={f.message} onChange={set('message')} rows={3} placeholder="구독자 규모, 활동 지역, 협업 희망사항 등" className={input} />
            </div>
            <label className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-0.5" />
              <span>유어딜의 제휴 제안 및 관련 안내 수신에 동의합니다. (동의 철회는 언제든 가능)</span>
            </label>
            {err && <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{err}</div>}
            <button onClick={submit} disabled={busy} className="w-full py-3 rounded-lg bg-gray-900 text-white text-sm font-semibold disabled:opacity-50">
              {busy ? '접수 중…' : '제휴 신청하기'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
