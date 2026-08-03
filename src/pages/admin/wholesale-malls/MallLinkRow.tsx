/**
 * 🔗 **이 몰의 손님 링크** 〔2026-08-03 대표 "매장 링크를 어드민에서도 볼 수 있게"〕
 *
 * 몰을 만들어도 **어디로 가면 되는지가 화면에 없었다.** slug 는 모노 글씨로 적혀 있을 뿐이라
 * 대표가 주소를 직접 조립해야 했고, 안 열려도 **왜 안 열리는지 알 방법이 없었다.**
 *
 * ## 🔴 "열린다"의 판정은 **서버와 같은 세 조건**이다
 *
 * 워커의 `pickConsumerMall`(`worker/utils/mall-consumer.ts`)이 fail-closed 로 셋을 본다:
 * **슬러그 문법·예약어** · **`active=1`** · **`consumer_path=1`**. 여기서 같은 셋을 그대로 비춘다 —
 * 하나라도 어긋나면 링크 대신 **"왜 안 열리는지"** 를 적는다. 추측하게 두지 않는다.
 * 두 판정이 갈리면 `mall-link-open-state.test.ts` 가 빨강을 낸다.
 *
 * ⚠️ **이 배지가 초록이어도 "지금 당장" 열린다는 뜻은 아니다** — 워커의 몰 조회 캐시(TTL 60초)가
 *   비워지기 전까지는 방금 만든 몰이 404 일 수 있다. 그래서 문구를 "열립니다"가 아니라
 *   **"공개 상태"** 로 쓴다(캐시 안내는 아래 힌트 줄).
 *
 * 라이트 고정 테마(대시보드 — `dark:` 없음).
 */
import { useState } from 'react'
import { ExternalLink, Copy, Check, AlertTriangle } from 'lucide-react'
import { isMallSlugCandidate } from '@/shared/mall/resolve'

/** 소비자 정본 도메인. 구 도메인은 전 경로 301 이라 여기 쓰지 않는다. */
const CONSUMER_ORIGIN = 'https://urdeal.kr'

export interface MallOpenState { open: boolean; reason?: string }

/**
 * 이 몰이 `urdeal.kr/{슬러그}` 로 **열리는 상태인가** — `pickConsumerMall` 과 같은 세 조건.
 * 순수 함수(테스트가 이 판정을 서버 판정과 대조한다).
 */
export function mallOpenState(m: { slug: string; active?: number | null; consumer_path?: number | null }): MallOpenState {
  if (!isMallSlugCandidate(m.slug)) {
    return { open: false, reason: '슬러그가 경로 규칙 밖이에요 (영소문자·숫자·하이픈 3~30자, 예약어 불가)' }
  }
  if (Number(m.active ?? 1) !== 1) return { open: false, reason: '비활성 몰이에요 — 활성화하면 열려요' }
  if (Number(m.consumer_path ?? 0) !== 1) return { open: false, reason: "'소비자 공개' 가 꺼져 있어요 — 수정에서 켜세요" }
  return { open: true }
}

export function mallConsumerUrl(slug: string): string {
  return `${CONSUMER_ORIGIN}/${String(slug ?? '').trim()}`
}

export default function MallLinkRow({ slug, active, consumer_path }: { slug: string; active?: number | null; consumer_path?: number | null }) {
  const [copied, setCopied] = useState(false)
  const state = mallOpenState({ slug, active, consumer_path })
  const url = mallConsumerUrl(slug)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* 클립보드 권한 없음 — 주소는 화면에 그대로 보이니 수동 복사 가능 */ }
  }

  if (!state.open) {
    return (
      <div className="mt-1.5 flex items-start gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-[1px] text-amber-500" />
        <div className="min-w-0">
          <span className="text-[11.5px] font-semibold text-amber-700">손님 링크가 아직 안 열려요</span>
          <span className="text-[11.5px] text-gray-500"> — {state.reason}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[12px] font-semibold text-gray-900 hover:underline break-all">
        {url.replace('https://', '')}
        <ExternalLink className="w-3 h-3 shrink-0 text-gray-400" />
      </a>
      <button onClick={copy} title="링크 복사"
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-gray-200 text-[11px] text-gray-600 hover:bg-gray-50 shrink-0">
        {copied ? <><Check className="w-3 h-3 text-emerald-600" /> 복사됨</> : <><Copy className="w-3 h-3" /> 복사</>}
      </button>
      {/* ⚠️ 방금 만든 몰은 워커 캐시(60초)가 돌기 전까지 404 일 수 있다 — 그 사실을 여기서 미리 말해 준다. */}
      <span className="text-[10.5px] text-gray-400">만든 직후엔 1분쯤 뒤에 열려요</span>
    </div>
  )
}
