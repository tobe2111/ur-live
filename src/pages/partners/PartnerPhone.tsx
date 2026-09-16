/**
 * 🏪 입점 랜딩 전용 폰 프레임 — 대표 확정 "안 B"(2026-09-16 *"안 B로 하는데"*).
 *
 * ■ 왜 폰 프레임인가
 *   대표: *"시안을 제대로 받아야겠는데, 지금 디자인이라곤 뭐가 없네."* 맞는 지적이었다 —
 *   이전 판은 **사진이 한 장도 없었다**(실측: `main img` 0개). 사장님이 "무엇을 파는 건지" 를
 *   글로 읽어야 했다. 대표 승인 덱(`phone-frame.mjs`)은 같은 캡처를 폰 프레임에 넣어 쓰는데
 *   랜딩만 그걸 한 장도 안 썼다.
 *
 * ■ 캡처의 출처
 *   `docs/business/proposals/shots/*.jpg` — 덱이 쓰는 **라이브 화면** 캡처(430×930).
 *   `public/static/partners/` 로 복사해 서빙한다.
 *   🩸 **`/partners/<n>.jpg` 에 두면 라이브에서 404 다**(2026-09-16 실측). `public/_routes.json` 이
 *      `/*` 를 전부 워커로 보내고 **명시 목록만** 정적으로 빼는데, 워커는 `/assets/*` 만 서빙한다.
 *      ⚠️ `/partners/*` 를 exclude 에 새로 넣는 건 위험하다 — 그 파일 주석이 경고하는 #598 클래스로
 *         랜딩 경로 자체를 정적 404 로 삼킬 수 있다. 이미 검증된 `/static/*` 제외를 쓴다.
 *
 * ■ 비율을 왜 고정하나
 *   캡처가 430×930 이라 `aspectRatio` 를 박아 둔다. 안 박으면 이미지가 도착하기 전 높이가 0 이라
 *   **섹션이 통째로 밀렸다가 튄다**(CLS). 랜딩 첫 화면에서 그 점프는 곧 이탈이다.
 */

/** 캡처 경로 SSOT. 파일은 `public/static/partners/` 에 있다(위 주석의 404 사고 참조). */
export const SHOT = (n: string) => `/static/partners/${n}.jpg`

export default function PartnerPhone({
  src,
  alt,
  className = '',
  priority,
}: {
  src: string
  alt: string
  className?: string
  /** 첫 화면(히어로)의 폰만 즉시 로드한다. 아래쪽은 lazy — 랜딩 첫 페인트 비용을 늘리지 않는다. */
  priority?: boolean
}) {
  return (
    <div className={`relative shrink-0 rounded-2xl bg-gray-800 p-[7px] shadow-[0_18px_44px_rgb(0_0_0/0.28)] ${className}`}>
      <img
        src={src}
        alt={alt}
        width={430}
        height={930}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className="block w-full rounded-xl bg-white object-cover object-top"
        style={{ aspectRatio: '430 / 930' }}
      />
    </div>
  )
}
