/**
 * 🧬 주입 — 없는 앱의 스토어 배지 (2026-09-28).
 * 각 항목은 "되돌리면 소비자에게 없는 앱을 있다고 말한다" 형태다.
 * ⚠️ 셋 다 **에러가 안 나는** 회귀라 사람이 못 잡는다 — 그래서 가드가 필요하다.
 */
const TEST = 'src/tests/unit/no-app-store-badges-2026-09-28.test.ts'

export default [
  {
    name: 'app-badges: /introduce 에 애플 스토어 링크를 되살린다',
    file: 'src/pages/IntroducePage.tsx',
    find: '              바로 시작하기 <ChevronRight className="w-4 h-4" />',
    replace: '              <a href="https://apps.apple.com/kr/app/x/id6745051422">App Store</a> <ChevronRight className="w-4 h-4" />',
    test: TEST,
    why: '실재하지 않는 앱의 스토어 주소 — 누르면 “앱을 찾을 수 없음” 으로 떨어지는데 에러는 안 난다.',
  },
  {
    name: 'app-badges: PC 홈 배너에 “다운로드하기” 문구를 되살린다',
    file: 'src/pages/pc-home/PcHomeAppBand.tsx',
    find: '설치 없이 폰에서 바로 열려요',
    replace: '지금 바로 다운로드하기',
    test: TEST,
    why: '받을 게 없는데 받으라고 한다 — 원래 배지는 href="#" 라 눌러도 아무 일이 없었다.',
  },
  {
    name: 'app-badges: PC 홈 배너 QR 을 정적 import 로 되돌린다',
    file: 'src/pages/pc-home/PcHomeAppBand.tsx',
    find: "const QRCodeSVG = lazy(() => import('qrcode.react').then(m => ({ default: m.QRCodeSVG })))",
    replace: "import { QRCodeSVG } from 'qrcode.react'",
    test: TEST,
    why: '정적 import 면 codes 청크가 PC 홈 첫 페인트 폐쇄로 딸려온다(2026-07-13 에 고친 회귀).',
  },
  {
    name: 'app-badges: 네비 모달에 Google Play 배지를 되살린다',
    file: 'src/components/main/AppDownloadModal.tsx',
    find: '            QR 코드를 스캔하면<br />폰에서 바로 이어서 볼 수 있어요',
    replace: '            <a href="https://urdeal.kr">Google Play</a>',
    test: TEST,
    why: '링크는 동작하지만 스토어 로고·라벨이 없는 앱을 있다고 말한다.',
  },
]
