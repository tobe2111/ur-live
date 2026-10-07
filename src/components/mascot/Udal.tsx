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
import curious from '@/assets/mascot/udal-curious.webp'
import wink from '@/assets/mascot/udal-wink.webp'
import poseStand from '@/assets/mascot/udal-pose-stand.webp'
import poseStamp from '@/assets/mascot/udal-pose-stamp.webp'
import poseWallet from '@/assets/mascot/udal-pose-wallet.webp'
import poseHighfive from '@/assets/mascot/udal-pose-highfive.webp'
import poseCable from '@/assets/mascot/udal-pose-cable.webp'
import poseEmptyWallet from '@/assets/mascot/udal-pose-empty-wallet.webp'
import poseQr from '@/assets/mascot/udal-pose-qr.webp'

/** 화면이 고르는 것은 상황이다. 그림은 아래 표가 정한다. */
export type UdalMood =
  | 'hello' // 기본 · 환영 (가입 환영 · 검색어 입력 전)
  | 'done' // 이용권 사용 완료 (도장)
  | 'paid' // 결제 완료 · 지갑 (이용권 더미 위 지갑)
  | 'yay' // 신남 · 혜택 발견
  | 'lost' // 길 잃음 (404)
  | 'notFound' // 찾는 게 없음 (검색 0건 · 지도 0건)
  | 'empty' // 아직 아무것도 없음 (빈 지갑 · 찜 0개)
  | 'oops' // 오류 · 연결 실패 (빠진 케이블)
  | 'tip' // 팁 · 안내
  | 'showQr' // 이용권 사용 화면 — 직원에게 QR 보여주기

/**
 * 🦦 2026-10-07 (대표 "남은 것들 모두 해줘" — 확정 시안 10곳): 표정 얼굴(흉상) → 시안의 **포즈 그림**(전신)으로.
 *   원본은 대표 시안 아티팩트(유어딜 마스코트 시안 · Pages 보드)에 올라간 누끼 그림이다.
 *   `bust` 는 가슴께에서 잘린 얼굴 그림이라 아래 끝을 바탕으로 녹인다(전신 포즈는 녹이지 않는다).
 *   원본 해상도가 200px 남짓이라 **화면에선 가로 128px 이하로 쓴다**(2배 화면에서 흐려지지 않는 한계).
 */
interface Art { src: string; w: number; h: number; bust?: boolean }
const ART: Record<UdalMood, Art> = {
  hello: { src: poseStand, w: 332, h: 487 },
  done: { src: poseStamp, w: 214, h: 222 },
  paid: { src: poseWallet, w: 175, h: 239 },
  yay: { src: poseHighfive, w: 204, h: 229 },
  lost: { src: poseCable, w: 256, h: 230 },
  notFound: { src: curious, w: 359, h: 394, bust: true },
  empty: { src: poseEmptyWallet, w: 184, h: 233 },
  oops: { src: poseCable, w: 256, h: 230 },
  tip: { src: wink, w: 359, h: 394, bust: true },
  showQr: { src: poseQr, w: 189, h: 238 },
}

/** 흉상 그림의 아래 끝을 바탕으로 녹이는 마스크. */
const BUST_FADE = 'linear-gradient(to bottom, black 86%, transparent)'

export function udalSrc(mood: UdalMood): string {
  return ART[mood].src
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
  const art = ART[mood]
  const mask = art.bust ? { WebkitMaskImage: BUST_FADE, maskImage: BUST_FADE } : {}
  return (
    <img
      src={art.src}
      alt=""
      aria-hidden="true"
      draggable={false}
      width={size}
      height={Math.round((size * art.h) / art.w)}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      data-udal={mood}
      className={`select-none pointer-events-none ${motion ? 'ur-udal-bob' : ''} ${className}`}
      style={{ width: size, height: 'auto', ...mask }}
    />
  )
}
