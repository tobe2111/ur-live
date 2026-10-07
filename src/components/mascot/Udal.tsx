/**
 * 🦦 유달이(가칭) — 유어딜 마스코트를 화면에 그리는 **유일한 자리** (2026-10-07 대표 *"유달이 서비스 화면에 넣는 개발 시작해줘"*).
 *
 * 캐릭터 SSOT: `docs/design/urdeal-mascot-otter-2026-10.md` (표정 시트 확정본 · 사용 자리 · 안 쓰는 자리).
 * 이미지 원본: `docs/design/assets/mascot/otter-face-*.png` → 같은 캔버스(359×394)로 맞춰
 * `src/assets/mascot/udal-*.webp` 로 변환했다. 캔버스를 맞춘 이유는 **표정만 바꿨는데 얼굴 위치가
 * 튀지 않게** 하려는 것이다(원본은 장마다 크기가 몇 px 씩 달랐다).
 *
 * 🔑 화면이 표정을 고르지 않고 **뜻**을 고른다 — `mood` 는 상황 이름이고 표정은 이 표가 정한다.
 *    그래야 "오류 화면 유달이" 가 화면마다 다른 얼굴이 되지 않는다(아이콘·버튼 색이 그렇게 갈렸었다).
 *
 * ⛔ 쓰지 않는 자리(문서 그대로): 결제 위젯 안 · 가격·할인율 옆 · 목록 카드마다 · 환불·사용 불가 안내 ·
 *    셀러 대시보드·어드민·도매몰. 한 화면에 한 마리.
 */
import neutral from '@/assets/mascot/udal-neutral.webp'
import happy from '@/assets/mascot/udal-happy.webp'
import excited from '@/assets/mascot/udal-excited.webp'
import surprised from '@/assets/mascot/udal-surprised.webp'
import curious from '@/assets/mascot/udal-curious.webp'
import sleepy from '@/assets/mascot/udal-sleepy.webp'
import sorry from '@/assets/mascot/udal-sorry.webp'
import wink from '@/assets/mascot/udal-wink.webp'

/** 화면이 고르는 것은 상황이다. 표정은 아래 표가 정한다. */
export type UdalMood =
  | 'hello' // 기본 · 환영
  | 'done' // 완료 · 감사 (사용 완료 등)
  | 'yay' // 신남 · 혜택 발견
  | 'lost' // 길 잃음 (404)
  | 'notFound' // 찾는 게 없음 (검색 0건)
  | 'empty' // 아직 아무것도 없음 (빈 목록)
  | 'oops' // 오류 · 연결 실패
  | 'tip' // 팁 · 안내

const FACE: Record<UdalMood, string> = {
  hello: neutral,
  done: happy,
  yay: excited,
  lost: surprised,
  notFound: curious,
  empty: sleepy,
  oops: sorry,
  tip: wink,
}

/** 원본 캔버스 비율(359×394) — width/height 를 같이 줘야 로딩 중 자리가 밀리지 않는다. */
const RATIO = 394 / 359

export function udalSrc(mood: UdalMood): string {
  return FACE[mood]
}

interface UdalProps {
  mood: UdalMood
  /** 가로 px. 세로는 비율로 정한다. */
  size?: number
  /** 둥실 움직임. 사용자가 움직임 줄이기를 켜면 CSS 가 끈다. */
  motion?: boolean
  /** 첫 화면에 바로 보이는 자리면 true — 지연 로딩을 끈다. */
  priority?: boolean
  className?: string
}

/**
 * 장식 이미지다 — 옆 문장이 이미 뜻을 말하므로 스크린리더에는 읽히지 않게 한다(`alt=""`).
 */
export default function Udal({ mood, size = 120, motion = false, priority = false, className = '' }: UdalProps) {
  return (
    <img
      src={FACE[mood]}
      alt=""
      aria-hidden="true"
      draggable={false}
      width={size}
      height={Math.round(size * RATIO)}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      data-udal={mood}
      className={`select-none pointer-events-none ${motion ? 'ur-udal-bob' : ''} ${className}`}
      // 원본이 가슴께에서 잘린 흉상이라 아래 끝이 칼선으로 보인다 → 아래 14% 만 바탕으로 녹인다.
      style={{
        width: size,
        height: 'auto',
        WebkitMaskImage: 'linear-gradient(to bottom, #000 86%, transparent)',
        maskImage: 'linear-gradient(to bottom, #000 86%, transparent)',
      }}
    />
  )
}
