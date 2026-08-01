import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { formatKSTShort } from '@/utils/date'

/**
 * 🕒 **자동 실행 내역** (2026-07-29 대표 지시 — "최신화 업데이트 내역 보이게 · 지금은 너무 복잡 ·
 *   모두 수집이 자동인지 확인 필요 · 한국 실시간 시간대로").
 *
 *   ## 왜 이 패널인가
 *   "수집이 자동으로 도는가"는 그동안 **화면에서 답할 수 없는 질문**이었다. 수집 진단 패널은 *마지막
 *   한 회차*의 숫자만 보여줘서, 어제부터 멈춘 레인과 방금 성공한 레인이 같은 모양으로 보였다.
 *   레인별 마지막 실행 시각·성패는 `ads:*` 하트비트에 이미 쌓이는데 이 화면이 안 읽고 있었다.
 *
 *   ⇒ 한 표로 답한다: **무엇이 · 언제(KST) · 성공했나.** 여기 이름이 있으면 그 작업은 자동이다
 *   (사람이 버튼을 눌러야 도는 것은 애초에 하트비트를 안 남긴다).
 *
 *   ## 판정 규칙(화면이 단정하지 않는 이유)
 *   레인마다 주기가 다르다 — 매시간짜리와 주 1회짜리를 같은 잣대로 '오래됨' 판정하면 정상인 것을
 *   빨갛게 칠한다. 그래서 서버가 `stale`(하루 넘게 기록 없음)로 표시한 것만 경고색을 쓰고,
 *   나머지는 시각만 보여준다. **판단은 사람이 한다.**
 *
 *   ⚠️ 시간은 전부 `formatKSTShort`(SSOT `utils/date.ts`) 경유 — 이 화면은 서버가 UTC 로 주는
 *   문자열(`'YYYY-MM-DD HH:MM:SS'`, Z 없음)을 받는데, 브라우저 `new Date()` 는 그걸 **로컬로 오해석**해
 *   9시간이 어긋난다(레포 전역 사고 클래스). 여기서 직접 파싱하지 말 것.
 */
interface Beat { name: string; ok: boolean; at: string | null; age_minutes: number | null; ms?: number | null }

/** 유어애즈 레인 이름 → 사람이 읽는 이름. 없으면 원 이름을 그대로 보여준다(새 레인이 조용히 숨지 않게). */
const LABEL: Record<string, string> = {
  'ads:collect': '인플루언서 수집(유튜브·네이버)',
  'ads:enrich-influencer-driver': '인플루언서 보강(블로거 측정·연락처)',
  'ads:maintenance?phase=reclassify': '정비 · 카테고리 재분류',
  'ads:maintenance?phase=reextract': '정비 · 연락처 재추출 + 지역 채우기',
  'ads:maintenance?phase=quality': '정비 · 점수/거부 표시',
  'ads:maintenance?phase=handle': '정비 · 블로그 핸들 복구',
  'ads:maintenance?phase=merge': '정비 · 중복 통합',
  'ads:maintenance?phase=selflink': '정비 · 자기링크 정리',
  'ads:maintenance?phase=cafemembers': '정비 · 카페 회원수 채우기',
  'ads:sheets-sync': '구글시트 미러',
  'ads:collect-company': '업체(파트너) 수집',
  'ads:collect-store-kakao': '매장 수집(카카오)',
  'ads:collect-localdata?mode=backfill': '매장 수집(공공데이터)',
  'ads:enrich-company': '업체 보강',
  'ads:enrich-prospects': '매장 보강',
}

/** 상대 시간 — "몇 시간 전"이 절대 시각보다 먼저 읽힌다(멈춤 판단의 핵심 정보라서). */
function ago(min: number | null): string {
  if (min == null) return '기록 없음'
  if (min < 1) return '방금'
  if (min < 60) return `${Math.floor(min)}분 전`
  if (min < 60 * 24) return `${Math.floor(min / 60)}시간 전`
  return `${Math.floor(min / 60 / 24)}일 전`
}

export default function AutoRunLog() {
  const [beats, setBeats] = useState<Beat[]>([])
  const [stale, setStale] = useState<string[]>([])
  const [neverFired, setNeverFired] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false) // 기본은 요약만 — 대표 "지금은 너무 복잡해"

  const load = useCallback(async () => {
    try {
      const r = await api.get('/api/admin/cron-heartbeats')
      const d = (r.data?.data || r.data) as { items?: Beat[]; stale?: string[]; never_fired?: string[] }
      setBeats((d.items || []).filter(b => b.name.startsWith('ads:')))
      setStale(d.stale || [])
      setNeverFired((d.never_fired || []).filter(n => n.startsWith('ads:')))
    } catch { /* 관측 패널 — 실패해도 페이지는 그대로 */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  if (loading) return null
  if (!beats.length) {
    return (
      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        자동 실행 기록이 없습니다 — 스케줄러가 한 번도 안 돌았거나 기록이 지워진 상태입니다.
      </div>
    )
  }

  const sorted = [...beats].sort((a, b) => (a.age_minutes ?? 1e9) - (b.age_minutes ?? 1e9))
  const failing = sorted.filter(b => !b.ok)
  const newest = sorted[0]

  return (
    <div className="mb-3 rounded-lg border border-gray-200 bg-white">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="text-sm font-medium text-gray-900">
          🕒 자동 실행 내역
          <span className="ml-2 font-normal text-gray-500">
            자동 {sorted.length}종 · 마지막 {ago(newest?.age_minutes ?? null)}
            {failing.length ? <span className="ml-2 text-amber-700">· 최근 실패 {failing.length}</span> : <span className="ml-2 text-emerald-700">· 전부 정상</span>}
          </span>
        </span>
        <span className="text-xs text-gray-400">{open ? '접기' : '자세히'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="mb-2 text-[11px] text-gray-400">
            시각은 한국시간(KST). 여기 이름이 있는 작업은 <b>자동</b>으로 돕니다 — 버튼을 눌러야 도는 것은 기록을 남기지 않습니다.
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-3 font-medium">작업</th>
                  <th className="py-2 pr-3 font-medium">마지막 실행</th>
                  <th className="py-2 pr-3 font-medium">경과</th>
                  <th className="py-2 font-medium">결과</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(b => {
                  const isStale = stale.includes(b.name)
                  return (
                    <tr key={b.name} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 pr-3 text-gray-900">{LABEL[b.name] || b.name.replace(/^ads:/, '')}</td>
                      <td className="py-2 pr-3 text-gray-600 tabular-nums">{formatKSTShort(b.at)}</td>
                      <td className={`py-2 pr-3 tabular-nums ${isStale ? 'text-amber-700 font-medium' : 'text-gray-500'}`}>{ago(b.age_minutes)}</td>
                      <td className="py-2">
                        {b.ok
                          ? <span className="rounded px-1.5 py-0.5 text-xs bg-emerald-50 text-emerald-700">성공</span>
                          : <span className="rounded px-1.5 py-0.5 text-xs bg-amber-50 text-amber-700">실패</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {neverFired.length ? (
            <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              켜져 있는데 <b>한 번도 안 돈</b> 작업 {neverFired.length}종: {neverFired.map(n => n.replace(/^ads:/, '')).join(' · ')}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
