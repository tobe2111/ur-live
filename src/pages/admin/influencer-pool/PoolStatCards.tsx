import { formatNumber } from '@/utils/format'

/**
 * 📊 **요약 카드 — 누르면 그 조건으로 목록이 걸린다** (2026-07-29 대표 요청).
 *
 *   그전엔 숫자를 보여주기만 했다. "이메일 2,607명"을 보고도 그 2,607명을 화면에서 고르려면
 *   아래 필터 상자를 따로 찾아 눌러야 했다 — **보는 자리와 고르는 자리가 떨어져** 있었다.
 *
 *   ⚠️ 필터 식은 서버 통계와 **리터럴까지 같아야 한다.** 카드 숫자와 목록 건수가 어긋나면 그 화면은
 *   통째로 신뢰를 잃는다('오늘 수집'은 KST 자정 기준 — 서버 `collectedToday` 와 통계의 `AS today` 가
 *   같은 식이어야 한다. 롤링 24h 로 바꾸면 두 값이 갈린다).
 *   ⚠️ 다시 누르면 해제(토글). '전체'만 예외로 세 조건을 한 번에 푼다.
 */
export interface PoolStatCardsProps {
  stats: { total?: number; youtube?: number; naver_blog?: number; naver_cafe?: number; with_email?: number; today?: number }
  platform: string
  setPlatform: (v: string) => void
  hasEmail: boolean
  setHasEmail: (v: boolean) => void
  collectedToday: boolean
  setCollectedToday: (v: boolean) => void
}

export default function PoolStatCards({
  stats, platform, setPlatform, hasEmail, setHasEmail, collectedToday, setCollectedToday,
}: PoolStatCardsProps) {
  const byPlatform = (p: string) => () => setPlatform(platform === p ? '' : p)
  const cards = [
    { label: '전체', value: stats.total, on: !platform && !hasEmail && !collectedToday, apply: () => { setPlatform(''); setHasEmail(false); setCollectedToday(false) } },
    { label: '유튜브', value: stats.youtube, on: platform === 'youtube', apply: byPlatform('youtube') },
    { label: '네이버블로그', value: stats.naver_blog, on: platform === 'naver_blog', apply: byPlatform('naver_blog') },
    { label: '🏘️ 커뮤니티(카페)', value: stats.naver_cafe, on: platform === 'naver_cafe', apply: byPlatform('naver_cafe') },
    { label: '이메일 보유', value: stats.with_email, on: hasEmail, apply: () => setHasEmail(!hasEmail) },
    { label: '오늘 수집', value: stats.today, on: collectedToday, apply: () => setCollectedToday(!collectedToday) },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
      {cards.map(c => (
        <button
          key={c.label}
          type="button"
          onClick={c.apply}
          aria-pressed={c.on}
          title={c.on ? '다시 누르면 해제' : '누르면 이 조건으로 목록을 겁니다'}
          className={`text-left rounded-lg border p-4 transition-colors ${c.on ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40'}`}
        >
          <div className={`text-xs ${c.on ? 'text-indigo-700' : 'text-gray-500'}`}>{c.label}</div>
          <div className={`text-2xl font-bold ${c.on ? 'text-indigo-700' : 'text-gray-900'}`}>{formatNumber(c.value)}</div>
        </button>
      ))}
    </div>
  )
}
