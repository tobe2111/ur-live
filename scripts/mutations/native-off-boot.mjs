/** 📱 Capacitor 를 첫 부팅에서 뺀다 (2026-10-12) — 가드: src/tests/unit/native-platform-off-boot-2026-10-12.test.ts */
const TEST = 'src/tests/unit/native-platform-off-boot-2026-10-12.test.ts'
export default [
  {
    name: '📱 lib/native.ts 가 다시 app-utils 로 섞인다',
    file: 'vite.config.ts',
    find: "          if (id.includes('/src/lib/native.ts')) return 'capacitor'\n",
    replace: '',
    test: TEST,
    why: 'app-utils 가 capacitor 청크를 정적으로 끌어와 모든 첫 방문이 웹에선 쓸 일 없는 SDK 를 받는다.',
  },
  {
    name: '📱 main.tsx 가 다시 lib/native 를 정적으로 부른다',
    file: 'src/main.tsx',
    find: "import { isNativeShell } from '@/lib/native-platform'",
    replace: "import { isNativeShell } from '@/lib/native-platform'\nimport { initNativeFeatures } from '@/lib/native'",
    test: TEST,
    why: '엔트리 그래프에 capacitor 가 다시 들어온다.',
  },
  {
    name: '📱 안드로이드 껍데기를 웹으로 오판한다',
    file: 'src/lib/native-platform.ts',
    find: "  if (w.androidBridge) return 'android'\n",
    replace: '',
    test: TEST,
    why: '앱에서 네이티브 기능(스플래시·푸시·뒤로가기)이 조용히 꺼진다.',
  },
]
