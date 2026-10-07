/**
 * 🧬 주입 — **스캔받는 QR 의 규격** (2026-10-07)
 *
 * ⚠️ 이 묶음은 대표가 겪은 "안 읽힌다" 의 *원인* 이 아니라 **여유**를 지킨다(카메라 쪽은
 *   `scan-camera-engine.mjs`). 되돌리면 좋은 카메라로는 읽히고 웹 스트림으로는 안 읽히는,
 *   **기기에 따라 갈리는** 상태로 돌아간다 — 재현이 안 되니 아무도 결함으로 신고하지 않는다.
 */
const QR = 'src/components/voucher/ScannableQr.tsx'
const MODAL = 'src/pages/my-vouchers/QRModal.tsx'
const DEV = 'src/pages/seller-scan/ScanDeviceManager.tsx'
const T = 'src/tests/unit/scannable-qr-2026-10-07.test.ts'

export default [
  {
    name: 'QR규격 — 조용영역을 없앤다 (종전 동작)',
    file: QR,
    find: '          marginSize={QUIET_ZONE_MODULES}',
    replace: '          includeMargin={false}',
    test: T,
    why:
      '정확히 종전 코드다. QR 표준은 심볼 둘레 **4모듈** 여백을 요구하고, 스캐너는 그 여백으로 ' +
      '심볼 경계를 찾는다. 밖의 패딩 8px 는 1.25모듈뿐 — 표준의 3분의 1도 안 된다.',
  },
  {
    name: 'QR규격 — 조용영역을 1모듈로 줄인다',
    file: QR,
    find: 'export const QUIET_ZONE_MODULES = 4',
    replace: 'export const QUIET_ZONE_MODULES = 1',
    test: T,
    why:
      '"여백이 있으니 됐다" 로 보이지만 규격은 4다. 1모듈이면 화면 촬영처럼 경계가 뭉개지는 ' +
      '조건에서 파인더 패턴을 못 찾는다 — 종전과 거의 같은 상태다.',
  },
  {
    name: 'QR규격 — 다크에서 QR 둘레를 검정으로 만든다',
    file: QR,
    find: "    <div className={`light-island mx-auto w-fit bg-white rounded-xl p-3 ${className ?? ''}`}>",
    replace: "    <div className={`mx-auto w-fit bg-white dark:bg-[#11141C] rounded-xl p-3 ${className ?? ''}`}>",
    test: T,
    why:
      '종전 조합이다. QR 모듈도 검정이니 둘레가 검정이면 파인더 패턴 경계가 배경에 녹는다. ' +
      '**대표는 노트북으로 봤다** — 거기가 다크면 그대로 터진다. QR 은 테마를 따르는 그림이 아니다.',
  },
  {
    name: 'QR규격 — 모듈 색을 테마 기본값에 맡긴다',
    file: QR,
    find: '          fgColor="#000000"\n          bgColor="#ffffff"',
    replace: '          /* (색은 기본값) */',
    test: T,
    why:
      '기본값이 흰/검정이라 "같다" 로 보이지만, 색을 명시하지 않으면 다음 사람이 ' +
      '`currentColor`·토큰으로 바꿔 넣는 길이 열린다. QR 의 두 색은 **규격**이고 디자인이 아니다.',
  },
  {
    name: 'QR규격 — 최소 크기 바닥을 없앤다',
    file: QR,
    find: '  const px = Math.max(SCANNABLE_QR_MIN_PX, size)',
    replace: '  const px = size',
    test: T,
    why:
      '호출부가 작게 넘기면 그대로 작아진다 — 종전 `QRModal` 이 160px, `ScanDeviceManager` 가 ' +
      '132px 였다. 멀리서 찍으면 모듈 하나가 몇 픽셀이 되어 디코딩이 실패한다.',
  },
  {
    name: 'QR규격 — 지갑이 QR 을 손으로 다시 그린다',
    file: MODAL,
    find: '                <ScannableQr value={qrUrl} />',
    replace: '                <div className="mx-auto bg-white dark:bg-[#11141C] p-2 rounded"><QRCodeSVG value={qrUrl} size={160} level="M" includeMargin={false} /></div>',
    test: T,
    why:
      '정확히 종전 코드다. 그리고 이 복제가 이 사고의 근원이다 — 레포에 QR 을 그리는 자리가 ' +
      '**아홉 곳**이고 각자 속성을 적고 있어서, 가장 중요한 한 곳이 가장 불리한 조합이었다.',
  },
  {
    name: 'QR규격 — 직원 기기 QR 도 따로 그린다',
    file: DEV,
    find: '          <ScannableQr value={issued.link} />',
    replace: '          <div className="bg-white p-3 rounded-xl"><QRCodeSVG value={issued.link} size={132} /></div>',
    test: T,
    why: '이것도 **다른 기기가 찍는** QR 이다. 두 곳이 같은 부품을 봐야 규격이 한 벌로 남는다.',
  },
]
