import { useEffect, useState } from 'react'
import api from '@/lib/api'

/**
 * 🏪 **"내 가게 주소"** — 운영자가 자기 링크를 알게 한다 (2026-08-12)
 *
 * 실측이었던 것: 운영자 화면 전체에 `mall_slug` 참조가 **0건**이었다. 상품을 올려도
 * `urdeal.kr/{슬러그}` 가 어디에도 안 보여, **카톡에 뿌릴 주소를 운영자가 모른다.**
 * 공구 서비스의 유통 경로가 카톡 공유 하나인데 그 주소를 화면이 안 알려 주고 있었다.
 *
 * 그리고 더 조용한 문제: 몰에 **연결되지 않은** 셀러의 상품은 `mallIdForSeller` 기본값으로
 * **본진 몰(id 1)에 들어간다.** 운영자는 등록에 성공했다고 믿는데 자기 가게엔 안 뜨고,
 * 화면 어디에도 이유가 없었다. ⇒ 미연결이면 **미연결이라고 말한다.**
 *
 * ⚠️ 조회 실패는 **미노출**(null) — 문의 안내로 대시보드를 시끄럽게 만들지 않는다.
 *   단, 미연결(`linked:false`)은 **조회가 성공한 사실**이므로 반드시 보여 준다(그게 이 컴포넌트의 요점).
 */
interface Pending { slug: string; name: string; created_at: string }
interface MallInfo { linked: boolean; slug: string | null; name: string | null; pending: Pending | null }

export default function MyMallAddress() {
  const [info, setInfo] = useState<MallInfo | null>(null)
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState<{ open: boolean; slug: string; name: string; busy: boolean; err: string }>(
    { open: false, slug: '', name: '', busy: false, err: '' },
  )
  const [check, setCheck] = useState<{ slug: string; available: boolean; reason: string | null } | null>(null)

  /**
   * 🔴 **승인은 다른 사람이 다른 화면에서 한다** — 그래서 이 화면은 스스로 다시 물어야 한다.
   *   안 그러면 승인이 끝났는데도 운영자 화면엔 "심사 중"이 남고, 새로고침해야 주소가 나타난다
   *   (그 사이에 운영자는 "안 됐나 보다" 라고 판단한다).
   * ⇒ **탭으로 돌아올 때**(가장 흔한 순간) + 심사 중일 때만 60초 간격. 연결된 뒤엔 폴링하지 않는다.
   */
  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setInterval> | null = null

    const load = () => api.get('/api/seller/gb/mall')
      .then((r) => {
        if (!alive || !r.data?.success) return
        const next: MallInfo = {
          linked: !!r.data.linked, slug: r.data.slug ?? null,
          name: r.data.name ?? null, pending: r.data.pending ?? null,
        }
        setInfo(next)
        if (next.linked && timer) { clearInterval(timer); timer = null }   // 열렸으면 그만 묻는다
      })
      .catch(() => { /* 조회 실패 = 미노출 */ })

    const onFocus = () => { if (document.visibilityState === 'visible') load() }
    load()
    timer = setInterval(() => { if (!info?.linked) load() }, 60_000)
    document.addEventListener('visibilitychange', onFocus)
    return () => { alive = false; if (timer) clearInterval(timer); document.removeEventListener('visibilitychange', onFocus) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 주소 실시간 확인 — 판정은 서버(신청·승인과 같은 SSOT)가 한다. 여기서 따로 판정하지 않는다. */
  useEffect(() => {
    const slug = form.slug.trim().toLowerCase()
    if (!form.open || slug.length < 3) { setCheck(null); return }
    let alive = true
    const t = setTimeout(() => {
      api.get(`/api/seller/gb/mall/slug-check?slug=${encodeURIComponent(slug)}`)
        .then((r) => { if (alive && r.data?.success) setCheck({ slug, available: !!r.data.available, reason: r.data.reason ?? null }) })
        .catch(() => { if (alive) setCheck(null) })   // 확인 실패는 침묵 — 제출이 최종 판정이다
    }, 350)
    return () => { alive = false; clearTimeout(t) }
  }, [form.slug, form.open])

  if (!info) return null

  if (!info.linked) {
    // 심사 중이면 신청 폼을 다시 보여 주지 않는다 — 중복 신청은 서버가 막지만 화면이 먼저 말해야 한다.
    if (info.pending) {
      return (
        <div className="mb-4 rounded-[14px] bg-[#EEF4FF] border border-[#CBDAF5] px-4 py-[15px]">
          <p className="text-[13.5px] font-extrabold text-[#2B5099] tracking-[-0.03em]">가게 개설 심사 중이에요</p>
          <p className="mt-1 text-[12.5px] text-[#2B5099] leading-relaxed">
            신청하신 주소 <strong>urdeal.kr/{info.pending.slug}</strong> · 이름 {info.pending.name}
            <br />승인되면 이 자리에 내 가게 주소가 나타납니다.
          </p>
        </div>
      )
    }
    const submit = async () => {
      setForm((f) => ({ ...f, busy: true, err: '' }))
      try {
        await api.post('/api/seller/gb/mall/apply', { slug: form.slug.trim().toLowerCase(), name: form.name.trim() })
        setInfo({ linked: false, slug: null, name: null, pending: { slug: form.slug.trim().toLowerCase(), name: form.name.trim(), created_at: '' } })
      } catch (e) {
        const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        setForm((f) => ({ ...f, busy: false, err: msg || '신청에 실패했어요. 잠시 후 다시 시도해주세요.' }))
      }
    }
    return (
      <div className="mb-4 rounded-[14px] bg-[#FFF7E8] border border-[#F0DCB4] px-4 py-[15px]">
        <p className="text-[13.5px] font-extrabold text-[#8A6320] tracking-[-0.03em]">아직 내 가게가 연결되지 않았어요</p>
        <p className="mt-1 text-[12.5px] text-[#8A6320] leading-relaxed">
          지금 등록하면 상품이 <strong>유어딜 본점</strong>에 올라가고 내 가게 페이지엔 안 보입니다.
        </p>
        {!form.open ? (
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, open: true }))}
            className="mt-2.5 rounded-lg bg-[#8A6320] px-3.5 py-2 text-[12.5px] font-bold text-white"
          >
            내 가게 열기 신청
          </button>
        ) : (
          <div className="mt-3 space-y-2">
            <label className="block">
              <span className="text-[11.5px] font-bold text-[#8A6320]">가게 주소 (urdeal.kr/○○○)</span>
              <input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="bangbae-mart"
                className="mt-1 w-full rounded-lg border border-[#E3D3B4] bg-white px-3 py-2 text-[13.5px] text-gray-900"
              />
              {check && check.slug === form.slug.trim().toLowerCase() && (
                <p className={`mt-1 text-[11.5px] font-semibold ${check.available ? 'text-[#1E7A4B]' : 'text-[#B3352B]'}`}>
                  {check.available ? `urdeal.kr/${check.slug} · 쓸 수 있어요` : check.reason}
                </p>
              )}
            </label>
            <label className="block">
              <span className="text-[11.5px] font-bold text-[#8A6320]">가게 이름</span>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="방배마트"
                className="mt-1 w-full rounded-lg border border-[#E3D3B4] bg-white px-3 py-2 text-[13.5px] text-gray-900"
              />
            </label>
            {form.err && <p className="text-[12px] font-semibold text-[#B3352B]">{form.err}</p>}
            <button
              type="button"
              disabled={form.busy || !form.slug.trim() || !form.name.trim()}
              onClick={submit}
              className="w-full rounded-lg bg-[#8A6320] py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
            >
              {form.busy ? '신청 중…' : '신청하기'}
            </button>
            <p className="text-[11.5px] text-[#8A6320] leading-relaxed">
              주소는 한 번 정하면 바꾸기 어려워요. 영문 소문자·숫자·하이픈 3~30자.
            </p>
          </div>
        )}
      </div>
    )
  }

  const url = `urdeal.kr/${info.slug}`
  return (
    <div className="mb-4 rounded-[14px] bg-white border border-[#EDE9EB] px-4 py-[15px]">
      <p className="text-[12px] font-bold text-[#776F74] tracking-[-0.02em]">내 가게 주소</p>
      <div className="mt-1.5 flex items-center gap-2">
        <a
          href={`https://${url}`}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 flex-1 truncate text-[15px] font-extrabold text-[#1A1719] tracking-[-0.03em] underline decoration-[#DDD6D9] underline-offset-4"
        >
          {url}
        </a>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(`https://${url}`).then(
              () => { setCopied(true); setTimeout(() => setCopied(false), 1800) },
              () => { /* 클립보드 거부 — 주소는 위에 그대로 보인다 */ },
            )
          }}
          className="shrink-0 rounded-lg border border-[#EDE9EB] px-3 py-2 text-[12px] font-bold text-[#4A4448] hover:bg-[#FAF8F9] transition-colors"
        >
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
      <p className="mt-1.5 text-[12px] text-[#776F74] leading-relaxed">이 주소를 카톡·문자로 보내면 손님이 바로 들어옵니다.</p>
    </div>
  )
}
