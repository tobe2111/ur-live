import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { getSignupCampaign, CAMPAIGN_PLATFORMS, CAMPAIGN_CATEGORIES } from '@/shared/campaign-signup'

/**
 * 📣 캠페인 인플루언서 모집 신청 (/campaign/:code — 예: /campaign/bangbae).
 *   신청 = 유어딜 인플루언서 파트너 등록: 카카오 로그인(users 행) + 프로필 제출 → 완료 화면에서
 *   내 ref 링크 즉시 발급(users.id 기반 — 클릭은 inflow_clicks 에 캠페인 코드와 함께 적재).
 *   CreatorApplyPage 와 같은 라이트 고정 standalone → 루트 div 에 force-light-theme.
 *   캠페인 코드는 경로 파라미터 — 카카오 로그인 왕복(returnUrl 경로 보존)에서 안 잘린다.
 */
export default function CampaignApplyPage() {
  const { code } = useParams<{ code: string }>()
  const campaign = getSignupCampaign(code)
  const loggedIn = typeof window !== 'undefined' && !!localStorage.getItem('user_id')

  const [f, setF] = useState({ platform: 'instagram', account_url: '', category: '맛집', region: '', follower_size: '', collab_terms: '', contact: '' })
  const [privacyAgree, setPrivacyAgree] = useState(false)
  const [marketingAgree, setMarketingAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [refLink, setRefLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState('')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF(p => ({ ...p, [k]: e.target.value }))

  // 재방문 복원 — 이미 신청했으면 완료 화면(+ref 링크)으로 바로.
  useEffect(() => {
    if (!campaign || !loggedIn) return
    api.get(`/api/campaign/${campaign.code}/me`).then(r => {
      if (r.data?.success && r.data.data?.applied) { setDone(true); setRefLink(r.data.data.ref_link ?? null) }
    }).catch(() => { /* 미신청/비로그인 — 폼 그대로 */ })
  }, [campaign, loggedIn])

  const input = 'w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus:border-gray-900 focus:outline-none'
  const loginUrl = campaign ? `/login?returnUrl=${encodeURIComponent(`/campaign/${campaign.code}`)}` : '/login'

  async function submit() {
    setErr('')
    if (!/^https?:\/\/.{3,}/i.test(f.account_url.trim())) { setErr('활동 계정 주소(URL)를 정확히 입력해주세요.'); return }
    if (!privacyAgree) { setErr('개인정보 수집·이용에 동의해주세요.'); return }
    if (!marketingAgree) { setErr('캠페인 안내 수신에 동의해주세요.'); return }
    setBusy(true)
    try {
      const r = await api.post(`/api/campaign/${campaign!.code}/apply`, { ...f, privacy_agree: privacyAgree, marketing_agree: marketingAgree })
      if (r.data?.success) { setRefLink(r.data.data?.ref_link ?? null); setDone(true) }
      else setErr(r.data?.error || '신청에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } catch (e) {
      const ax = e as { response?: { status?: number; data?: { error?: string } } }
      if (ax.response?.status === 401) { window.location.href = loginUrl; return }
      setErr(ax.response?.data?.error || '신청에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally { setBusy(false) }
  }

  async function copyRefLink() {
    if (!refLink) return
    try { await navigator.clipboard.writeText(refLink); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* 클립보드 미지원 */ }
  }

  if (!campaign) {
    return (
      <div className="force-light-theme min-h-[100dvh] bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-3">🔍</div>
          <div className="text-lg font-semibold text-gray-900">진행 중인 캠페인이 아닙니다</div>
          <p className="mt-2 text-sm text-gray-600">링크를 다시 확인해주세요.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="force-light-theme min-h-[100dvh] bg-gray-50 py-10 px-4">
      <SEO title={`${campaign.title} - 유어딜`} description={campaign.subtitle} url={`/campaign/${campaign.code}`} />
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">{campaign.title}</h1>
          <p className="mt-2 text-sm text-gray-600">{campaign.subtitle}<br />신청과 동시에 유어딜 인플루언서 파트너로 등록됩니다.</p>
        </div>

        {done ? (
          <div className="rounded-xl border border-emerald-200 bg-white p-8 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <div className="text-lg font-semibold text-gray-900">신청이 완료되었습니다</div>
            <p className="mt-2 text-sm text-gray-600">
              선정 여부와 관계없이 <strong className="text-gray-900">유어딜 파트너로 등록</strong>되었으며,
              다음 캠페인 소식을 가장 먼저 안내드립니다.
            </p>
            {refLink && (
              <div className="mt-5 rounded-lg bg-gray-50 border border-gray-200 p-4 text-left">
                <div className="text-xs font-semibold text-gray-500 mb-1.5">내 추천 링크 (지금 바로 사용 가능)</div>
                <div className="text-sm text-gray-900 break-all">{refLink}</div>
                <button onClick={copyRefLink} className="mt-3 w-full py-2.5 rounded-lg bg-gray-900 text-white text-sm font-semibold">
                  {copied ? '복사됐어요 ✓' : '링크 복사'}
                </button>
                <p className="mt-2 text-xs text-gray-500">이 링크로 들어온 방문·구매가 내 성과로 집계됩니다. 콘텐츠·프로필에 붙여 활용해보세요.</p>
              </div>
            )}
          </div>
        ) : !loggedIn ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
            <div className="text-4xl mb-3">💬</div>
            <div className="text-base font-semibold text-gray-900">카카오 로그인 후 1분이면 신청 완료</div>
            <p className="mt-2 text-sm text-gray-600">신청하면 유어딜 계정과 내 추천 링크가 바로 만들어집니다.</p>
            <a href={loginUrl} className="mt-5 inline-block w-full py-3 rounded-lg bg-[#FEE500] text-[#3C1E1E] text-sm font-semibold">
              카카오로 시작하기
            </a>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">활동 계정 주소(URL) <span className="text-rose-500">*</span></label>
              <input value={f.account_url} onChange={set('account_url')} placeholder="https://instagram.com/..." className={input} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">플랫폼</label>
                <select value={f.platform} onChange={set('platform')} className={input}>{CAMPAIGN_PLATFORMS.map(p => <option key={p.v} value={p.v}>{p.label}</option>)}</select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">주요 분야</label>
                <select value={f.category} onChange={set('category')} className={input}>{CAMPAIGN_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">활동 지역</label>
                <input value={f.region} onChange={set('region')} placeholder="예: 서울 서초구·방배동" className={input} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">팔로워·구독자 수</label>
                <input value={f.follower_size} onChange={set('follower_size')} inputMode="numeric" placeholder="예: 12000" className={input} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">희망 협업 조건 <span className="text-gray-400 font-normal">(선택)</span></label>
              <textarea value={f.collab_terms} onChange={set('collab_terms')} rows={3} placeholder="예: 원고료 협의 / 체험 제공 시 가능 / 릴스 1건 기준 ..." className={input} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">연락처 <span className="text-gray-400 font-normal">(선택 — 카톡ID·인스타 DM 등)</span></label>
              <input value={f.contact} onChange={set('contact')} placeholder="@insta_id 또는 카톡ID" className={input} />
            </div>
            <div className="space-y-2 pt-1">
              <label className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={privacyAgree} onChange={e => setPrivacyAgree(e.target.checked)} className="mt-0.5" />
                <span><span className="font-medium text-gray-800">[필수]</span> 개인정보 수집·이용에 동의합니다. (수집 항목: 이름·연락처·활동 계정 정보 / 이용 목적: 캠페인 선정·운영 / 보유 기간: 동의 철회 시까지)</span>
              </label>
              <label className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={marketingAgree} onChange={e => setMarketingAgree(e.target.checked)} className="mt-0.5" />
                <span><span className="font-medium text-gray-800">[필수]</span> 캠페인 선정 결과 및 다음 캠페인·제휴 안내 수신에 동의합니다. (철회는 언제든 가능)</span>
              </label>
            </div>
            {err && <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{err}</div>}
            <button onClick={submit} disabled={busy} className="w-full py-3 rounded-lg bg-gray-900 text-white text-sm font-semibold disabled:opacity-50">
              {busy ? '접수 중…' : '신청하기'}
            </button>
            <p className="text-xs text-gray-400 text-center">선정 여부와 관계없이 파트너로 등록되며, 다음 캠페인을 우선 안내드립니다.</p>
          </div>
        )}
      </div>
    </div>
  )
}
