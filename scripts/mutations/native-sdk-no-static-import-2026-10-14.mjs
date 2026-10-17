export default [
  {
    name: '[native-sdk] 보상 광고 카드가 다시 @capacitor/core 를 정적으로 부른다',
    file: 'src/components/my-page/reward-ad-card.tsx',
    find: "import { isNativeShell } from '@/lib/native-platform'",
    replace: "import { isNativeShell } from '@/lib/native-platform'\nimport { Capacitor } from '@capacitor/core'\nvoid Capacitor",
    test: 'src/tests/unit/native-sdk-no-static-import-2026-10-14.test.ts',
    why: '웹 마이 첫 화면이 네이티브 SDK(capacitor 청크 5KB br)를 다시 받는다.',
  },
  {
    name: '[native-sdk] 블로그 공유가 @/lib/native 를 정적으로 부른다',
    file: 'src/pages/BlogDetailPage.tsx',
    find: "import KakaoShareButton from '@/components/KakaoShareButton'",
    replace: "import KakaoShareButton from '@/components/KakaoShareButton'\nimport { nativeShare } from '@/lib/native'\nvoid nativeShare",
    test: 'src/tests/unit/native-sdk-no-static-import-2026-10-14.test.ts',
    why: '블로그 상세 첫 화면이 capacitor 청크를 받는다.',
  },
]
