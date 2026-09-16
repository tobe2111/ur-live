/**
 * 📱 랜딩 공용 폰 프레임 — `/about` · `/creators`
 *
 * ■ 왜 별도 파일인가
 *   `/partners` 의 `partners/PartnerPhone.tsx` 와 같은 일을 한다. 두 벌로 나눈 이유는 하나뿐이다 —
 *   입점 랜딩은 이미 라이브에서 판정을 마친 화면이라(2026-09-16 E4), 형제 랜딩 두 장을 만들려고
 *   그 파일을 건드리지 않는다. 캡처 **파일**은 나누지 않는다(아래).
 *
 * ■ 캡처는 한 벌만 둔다
 *   `public/static/partners/` 가 세 랜딩이 함께 쓰는 폴더다. 폴더 이름은 입점 랜딩이 먼저 만들어서
 *   붙은 것이고 지금은 의미가 넓다. ⚠️ **사본을 새로 만들지 말 것** — 같은 화면이 랜딩마다 다른
 *   캡처가 되는 순간 어느 쪽이 지금 앱인지 알 수 없다.
 *
 * ■ 두 가지는 반드시 지킨다
 *   ① `/static/*` 밖에 두면 **라이브에서 404**다. `public/_routes.json` 이 `/*` 를 워커로 보내고
 *      명시 목록만 정적으로 빼는데, 워커는 `/assets/*` 만 서빙한다(PartnerPhone 주석의 실측).
 *   ② `aspectRatio` 를 박는다. 안 박으면 이미지 도착 전 높이가 0 이라 섹션이 밀렸다 튄다(CLS).
 */

/** 캡처 경로 SSOT. 파일 위치는 위 주석 참조. */
export const SHOT = (n: string) => `/static/partners/${n}.jpg`

export default function PhoneShot({
  src,
  alt,
  caption,
  className = '',
  priority,
}: {
  src: string
  alt: string
  /** 화면 아래 한 줄. **무엇을 렌더한 것인지** 정직하게 적는다(라이브 / 예시 데이터). */
  caption?: string
  className?: string
  /** 첫 화면의 폰만 즉시 로드. 아래쪽은 lazy — 랜딩 첫 페인트 비용을 늘리지 않는다. */
  priority?: boolean
}) {
  return (
    <figure className={`shrink-0 ${className}`}>
      <div className="rounded-2xl bg-gray-800 p-[7px] shadow-[0_18px_44px_rgb(0_0_0/0.28)]">
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
      {/* ⚠️ 캡션 색을 고정하지 않는다. 이 부품은 흰 바탕(`bg-warm`)과 잉크 색면(`ur-panel-ink`) **양쪽**에
          놓이는데, `text-gray-500` 을 박으면 잉크 위에서 2.5:1 로 잠긴다(다크 대비 가드가 잡는 그 클래스).
          부모 글자색을 물려받고 투명도로만 눌러 두 자리에서 같은 무게로 읽히게 한다. */}
      {caption ? (
        <figcaption className="mt-3 lg:mt-4 text-center text-[11.5px] lg:text-[12.5px] leading-snug opacity-60">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  )
}
