/**
 * 🏪 **어드민 서비스 스코프 토글** — 화면이 *"지금 어느 서비스를 보는지"* 스스로 말한다.
 *   〔2026-08-16, 대표 *"모두 다 해줘"* — 2026-08-14 에 공구 화면에 인라인으로 넣었던 것을 추출〕
 *
 * 유어딜과 공구 서비스(운영자 몰)는 **같은 테이블·같은 카테고리**를 쓴다(코드가 둘 다
 * `group_buy_*` 라고 부른다). 그래서 어드민 목록·집계는 조건을 명시하지 않으면 **섞인다.**
 * 서버는 기본 `main`(본진)으로 답하고, 이 토글이 그 선택을 **URL 에** 적는다.
 *
 * 🔴 **URL 이 진실이다.** 컴포넌트 state 로 들고 있으면 새로고침·북마크·nav 딥링크
 *   (`/admin/group-buy?mall=all`)에서 선택이 사라져, 대표가 몰 화면을 열었는데 본진 숫자를
 *   보게 된다. 그 오독은 화면 어디에도 표시가 안 남는다.
 *
 * ⚠️ 쓸 때 **쿼리 키에 scope 를 반드시 넣을 것** — 안 넣으면 유어딜 목록과 몰 목록이 같은
 *   캐시를 공유해 섞임이 그대로 재발한다(서버만 고쳐서는 안 막힌다).
 */
import { useSearchParams } from 'react-router-dom'

export type AdminMallScope = 'main' | 'mall' | 'all'

/** `?mall=` 을 읽고 쓰는 훅. 기본값 `main` — 모르면 자기 것만 본다. */
export function useAdminMallScope(): {
  scope: AdminMallScope
  setScope: (v: AdminMallScope) => void
  /** API 로 넘길 params — `main` 이면 비운다(서버 기본값과 일치, URL 도 깨끗하게). */
  scopeParams: Record<string, string>
} {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get('mall')
  const scope: AdminMallScope = raw === 'mall' ? 'mall' : raw === 'all' ? 'all' : 'main'
  const setScope = (v: AdminMallScope) => {
    const next = new URLSearchParams(searchParams)
    if (v === 'main') next.delete('mall')
    else next.set('mall', v)
    setSearchParams(next, { replace: true })
  }
  return { scope, setScope, scopeParams: scope === 'main' ? {} : { mall: scope } }
}

const OPTIONS = [
  { k: 'main', label: '🎟️ 유어딜 본진', hint: '유어딜 소비자 서비스' },
  { k: 'mall', label: '🏪 공구 서비스', hint: '운영자 몰 (urdeal.kr/{슬러그})' },
  { k: 'all', label: '전체', hint: '섞어 보기 — 실적 해석 주의' },
] as const

export function AdminServiceScopeTabs({
  scope,
  setScope,
  /** '전체' 선택 시 아래 목록에서 무엇으로 구분하는지 안내(없으면 일반 문구). */
  mixedHint,
  className = '',
}: {
  scope: AdminMallScope
  setScope: (v: AdminMallScope) => void
  mixedHint?: string
  className?: string
}) {
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-2 ${className}`}>
      <span className="px-1 text-xs font-bold text-gray-500">서비스</span>
      {OPTIONS.map((o) => (
        <button
          key={o.k}
          type="button"
          onClick={() => setScope(o.k)}
          title={o.hint}
          aria-pressed={scope === o.k}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
            scope === o.k ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {o.label}
        </button>
      ))}
      {scope === 'all' && (
        <span className="ml-auto text-[11px] font-semibold text-amber-700">
          {mixedHint ?? '두 서비스가 섞여 있습니다 — 실적으로 읽지 마세요'}
        </span>
      )}
    </div>
  )
}
