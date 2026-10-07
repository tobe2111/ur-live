/**
 * 🎟️ **스캔받는 QR 은 한 곳에서 그린다** (2026-10-07 대표 *"QR 코드는 정말 중요해"*).
 *
 * ## 왜 생겼나
 * 대표가 안드로이드 폰으로 **노트북 화면의 이용권 QR** 을 찍었는데 안 읽혔다. 읽는 쪽
 * (`VoucherScanner`)도 고쳤지만, 파 보니 **그려 주는 쪽이 더 나빴다.** 레포 안에 QR 을 그리는
 * 자리가 **아홉 곳**인데 각자 다른 속성을 쓰고 있었고, 그중 **손님이 사장님에게 보여 주는 바로
 * 그 QR** 이 가장 불리한 조합이었다:
 *
 * ```
 * <QRCodeSVG value={url} size={160} level="M" includeMargin={false} />   ← 종전
 *   └ 감싼 div: bg-white dark:bg-[#11141C] p-2
 * ```
 *
 * 세 가지가 동시에 틀렸다:
 * 1. **`includeMargin={false}` — 조용영역(quiet zone)이 없다.** QR 표준은 심볼 둘레에 **4모듈**
 *    여백을 요구한다. 스캐너는 그 여백으로 심볼의 경계를 찾는다. 밖의 `p-2`(8px)는 160px/25모듈
 *    기준 **1.25모듈**뿐 — 표준의 3분의 1도 안 된다.
 * 2. **다크모드에서 QR 둘레가 검정이 된다**(`dark:bg-[#11141C]`). QR 모듈도 검정이니 파인더
 *    패턴의 경계가 배경에 녹는다. **대표는 노트북으로 봤다** — 거기가 다크면 그대로 터진다.
 *    QR 은 테마를 따르는 그림이 아니다. 흰 바탕 · 검정 모듈, 그것이 규격이다.
 * 3. **160px 는 스캔용으로 작다.** 노트북 화면에서 30cm 떨어져 찍으면 모듈 하나가 몇 픽셀이다.
 *
 * ⇒ 이 셋을 **부품 하나**로 고정한다. 손으로 속성을 다시 적을 자리를 없애는 것이 처방의 핵심이다
 *   (아홉 곳이 각자 적고 있었던 것이 이 사고의 근원이다).
 *
 * ## ⚠️ 이 부품이 **못** 하는 것
 * - 화면 밝기 — 웹에서 올릴 수 없다. 어두운 화면은 사장님이 올려 달라고 말해야 한다.
 * - 반사·모아레 — 유리 반사는 각도로만 피한다. 그래서 읽는 쪽에 **사진으로 읽기** 폴백이 있다.
 * - 장식용 QR(앱 다운로드·유어샵 링크)은 대상이 아니다. 저긴 스캔 실패가 손님을 세우지 않는다.
 */
import { lazy, Suspense } from 'react'

// 🟢 qrcode.react 는 lazy — 첫 페인트 번들에서 제외한다(레포 전역 규칙).
const QRCodeSVG = lazy(() => import('qrcode.react').then((m) => ({ default: m.QRCodeSVG })))

/** QR 표준이 요구하는 조용영역(모듈 수). 줄이면 스캐너가 심볼 경계를 못 찾는다. */
export const QUIET_ZONE_MODULES = 4

/** 스캔받는 QR 의 최소 변 길이(px). 이보다 작게 그리면 멀리서 모듈이 뭉개진다. */
export const SCANNABLE_QR_MIN_PX = 200

export default function ScannableQr({
  value,
  size = 216,
  className,
}: {
  value: string
  size?: number
  className?: string
}) {
  const px = Math.max(SCANNABLE_QR_MIN_PX, size)
  return (
    // 🏝️ light-island — 테마와 무관하게 늘 흰 바탕이다(위 머리말 2번). 안쪽 `dark:` 를 통째로 끈다.
    <div className={`light-island mx-auto w-fit bg-white rounded-xl p-3 ${className ?? ''}`}>
      <Suspense
        fallback={<div style={{ width: px, height: px }} className="light-island animate-pulse bg-gray-100 rounded" />}
      >
        <QRCodeSVG
          value={value}
          size={px}
          level="M"
          marginSize={QUIET_ZONE_MODULES}
          // ⚠️ 색 토큰을 쓰지 않는다 — 이 두 색은 디자인이 아니라 **QR 규격**이다(위 머리말 2번).
          //   CSS 키워드로 적어 "테마가 정하는 색이 아니다" 를 분명히 한다.
          fgColor="black"
          bgColor="white"
        />
      </Suspense>
    </div>
  )
}
