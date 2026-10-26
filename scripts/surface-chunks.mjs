/**
 * 🧩 손님 페이지의 lazy 코드를 **쓰는 페이지끼리** 묶는다 (2026-10-13 — 대표 *"아직 대기업 수준은 아니잖아"*).
 *
 * 실측(번들러 모듈→청크 그래프, brotli): 첫 화면 다음에 받는 것이 이용권 상세 **120KB / 16파일**, 상품 128 · 유어샵 118 ·
 * 교환권 111 · 지도 126 이었다. 그중 `app-components`(34KB)는 상세가 243KB raw 중 **21KB** 만 쓰고 `app-home`·
 * `app-constants`·`app-utils-deferred`·`lucide` 도 같은 모양이었다 — 봉투 안에 쓰는 게 하나만 있어도 봉투째 받는다.
 * 봉투 규칙은 **첫 화면(엔트리)** 바이트를 줄이려고 만든 것이라 그 목적엔 맞지만, 첫 화면이 안 쓰는 모듈까지 같은
 * 봉투에 두면 페이지끼리 서로 안 쓰는 코드를 실어 나른다.
 *
 * 규칙(`vite.config.ts` 의 manualChunks 가 종전 이름을 정한 **뒤에** 이 함수를 거친다):
 *   ① 엔트리 정적 폐쇄 **안** → 종전 이름 그대로(첫 화면 청크·개수 불변 — critical-chunks 가 지킨다)
 *   ② 손님 페이지(ROUTES)가 정적으로 닿는 모듈 → `lz-<그 모듈을 쓰는 페이지들>`
 *      · 페이지 COMMON_MIN 곳 이상이 쓰면 `lz-common` 하나로(조합이 폭발하지 않게)
 *      · 묶음이 MIN_GROUP 바이트 미만이면 `lz-common` 으로(파일 하나 값을 못 한다)
 *      · 페이지 파일 자체는 건드리지 않는다(매니페스트·route-chunk-map 이 그 청크를 찾는다)
 *   ③ 손님 페이지가 안 닿는 모듈(대시보드) → 종전 이름 그대로
 * 대상은 src 모듈 · lucide 아이콘 파일 · 이름 규칙이 없는 라이브러리. 이름 규칙이 있는 라이브러리(react·embla·결제 SDK)는 그대로.
 *
 * 왜 Rollup 기본 분할(이름 안 주기)이 아닌가 — 실측: 표면당 30파일 이상으로 쪼개져 작은 파일의 압축 손실이
 * 이득을 깎았고, **이름 있는 봉투가 이름 없는 의존을 흡수**해(Rollup 동작) 홈이 셀러 대시보드 봉투 30KB 를 끌고 왔다.
 * ⚠️ 이 판정은 import 그래프를 따라가므로 배럴(re-export 모음)을 거치면 실제보다 넓게 잡힌다 — lucide 는 그래서
 *   `lucide-deep-imports.mjs` 가 아이콘 파일 직접 import 로 바꿔 준다(안 그러면 모든 아이콘이 첫 화면 소속).
 */
import path from 'node:path'

const norm = (p) => p.replace(/\\/g, '/')

/** `app-utils-deferred` 는 **첫 화면 밖이라고 손으로 고른** 봉투다 — 배럴(`hooks/queries/index.ts`)이 그 안의
 *  `useMyData` 를 다시 내보내 그래프상 첫 화면 소속처럼 보였고, 상세가 그 59KB(raw) 봉투를 통째로 끌고 왔다(실측 7.9KB br).
 *  이 봉투는 엔트리 판정을 건너뛴다(정말 엔트리가 쓰면 critical-chunks 가 잡는다). */
const NEVER_ENTRY = new Set(['app-utils-deferred'])

/** 📌 vite 규칙 이름을 그대로 쓰는 작은 공용 모듈(2026-10-25). 첫 화면 청크(app-layout 등)가 이름으로 묶어 둔 부품이
 *  쓰는데 엔트리 정적 폐쇄 밖이라, lazy 사용자가 하나 생기면 페이지 봉투로 끌려가 **첫 화면 청크가 하나 늘었다**
 *  (`category-palette` 328B — 생활 견적 카드가 lazy 로 쓰자 `lz-homeL-homePcL` 이 크리티컬 패스에 진입). */
const PINNED = [/\/src\/shared\/category-palette\./]

/** 🔒 라이브러리 전용 봉투 — 앱 코드 몇 줄을 **일부러** 라이브러리 옆에 둔 봉투다(`vite.config.ts` 의 `/src/` 규칙).
 *  묶음기가 그 앱 코드를 페이지 봉투로 빼면, 그 봉투가 라이브러리를 **정적으로** 끌고 와 모든 페이지가 받는다
 *  (2026-10-13 실측: `src/lib/sentry-sdk` 가 lz-common 으로 가서 sentry 가 전 화면 미리받기에 들어갔다).
 *  ⚠️ vite 에 "앱 코드 → 라이브러리 봉투" 규칙을 새로 만들면 여기 이름을 추가할 것 — 시험이 대조한다.
 *
 *  🩸 2026-10-14 — `app-ui-utils` 가 빠져 있었다. 2026-07-29 에 `cn()`(src/lib/utils) + tailwind-merge(raw 102KB)를
 *   전용 봉투로 뺐는데(vite 규칙 '/src/lib/utils' → app-ui-utils), 이 묶음기(10-13)가 그 앱 코드를 **목록 안에서 유일하게
 *   정적으로 쓰는 지도** 봉투로 옮겼다 → tailwind-merge 가 따라갔고, `cn()` 을 쓰는 화면 ~190개(마이·어드민·장바구니·결제…)가
 *   **지도 페이지 코드 전부**(lz-map 24.9KB br)를 받았다(`check-surface-budgets` dash:* 실측). 에러는 0 이었다.
 *
 *  🔀 2026-10-18 — `app-cross`: 라이브러리 봉투는 아니지만 같은 이유로 고정한다. 화면 밖 공용 묶음(app-components)과
 *   손님 페이지가 함께 쓰는 작은 유틸 묶음이다(vite.config.ts CROSS_MODULES). 묶음기가 페이지 묶음으로 옮기면
 *   app-components 가 그 페이지 묶음을 통째로 끌고 온다 — 그걸 막으려고 만든 봉투다. */
export const LIBRARY_ENVELOPES = new Set(['sentry', 'capacitor', 'tosspayments', 'app-kakao-sdk', 'charts', 'codes', 'app-ui-utils', 'app-cross', 'app-map-row', 'app-region-grid', 'app-owner-kit', 'app-owner-ui', 'app-life-biz', 'app-subpage', 'app-life-subcat'])

/** 🔔 **누를 때만 받는 봉투** — 묶음기가 페이지 봉투로 옮기지 않는다(2026-10-18).
 *  알림 시트는 `lazy()` 인데 거의 모든 화면이 그 훅(`useNotificationSheet`)을 갖고 있어 묶음기가 `lz-common` 에 넣었다.
 *  `lz-common` 은 대부분의 첫 화면이 받으므로 **lazy 경계가 무의미**해지고, 시트가 끌고 오는 패널·아이콘 봉투까지
 *  폰 첫 화면에 실렸다(실측). 이름을 지키면 벨을 누를 때만 받는다. */
export const LAZY_ENVELOPES = new Set(['app-notification-panel', 'app-owner-sheet', 'app-life-banner'])

/** 🖥️ 엔트리가 **동적으로** 부르지만 첫 렌더 전에 기다려 받는 모듈 — 엔트리 폐쇄로 센다(2026-10-18).
 *  PC 상단 네비는 폰 첫 방문에서 빼려고 동적 import 로 바꿨다(`ConsumerTopChrome`). 그 모듈 자신은 vite 규칙의 이름
 *  (`app-desktop-chrome`)으로 떨어져 나가고, **그것이 끌고 오던 공용 모듈은 종전 봉투에 그대로 둔다** — 안 그러면 auth·쿼리 훅
 *  같은 공용 모듈이 페이지 봉투로 흩어지며 청크 순환이 줄줄이 생겼다(실측 셋: app-utils↔lz-common · lz-common↔lz-boot-homeL-mapL ·
 *  lz-common↔lz-map). 폰이 덜 받는 것은 네비 모듈 넷(raw ~33KB)뿐이고 나머지 배치는 종전과 같다. */
export const ENTRY_DYNAMIC = [/\/src\/components\/main\/DesktopTopNav\.tsx$/, /\/src\/routes\/seller\.routes\.tsx$/] // 셀러 표도 같은 이유(App.tsx lazy — 표 자신만 app-routes-seller 로)

export function createSurfaceChunker({ routes, root, commonMin = 4, minGroupBytes = 2000 }) {
  /** 이 모듈을 import 하는 쪽이 전부 node_modules 인가 — 앱 코드가 직접 쓰지 않는 라이브러리 내부 의존. */
  function libraryOnly(id, meta) {
    const importers = meta.getModuleInfo(id)?.importers ?? []
    return importers.length > 0 && importers.every((m) => norm(m).includes('/node_modules/'))
  }
  let entry = null
  let surfaceOf = null

  function inEntry(id, meta) {
    if (!entry) {
      entry = new Set()
      const stack = [...meta.getModuleIds()].filter((m) => meta.getModuleInfo(m)?.isEntry)
      while (stack.length) {
        const m = stack.pop()
        if (entry.has(m)) continue
        entry.add(m)
        const info = meta.getModuleInfo(m)
        for (const x of info?.importedIds ?? []) stack.push(x)
        for (const d of info?.dynamicallyImportedIds ?? []) if (ENTRY_DYNAMIC.some((re) => re.test(norm(d)))) stack.push(d)
      }
    }
    return entry.has(id)
  }

  function surfaceName(id, meta) {
    if (!surfaceOf) {
      const labels = new Map()
      const roots = new Set()
      const all = [...meta.getModuleIds()]
      for (const [surface, files] of Object.entries(routes)) {
        files.forEach((file, i) => {
          const label = files.length > 1 ? `${surface}${i + 1}` : surface
          const target = norm(path.resolve(root, file))
          const stack = all.filter((m) => norm(m) === target)
          stack.forEach((m) => roots.add(m))
          const seen = new Set()
          while (stack.length) {
            const m = stack.pop()
            if (seen.has(m)) continue
            seen.add(m)
            if (!labels.has(m)) labels.set(m, new Set())
            labels.get(m).add(label)
            for (const x of meta.getModuleInfo(m)?.importedIds ?? []) stack.push(x)
          }
        })
      }
      // 🩸 2026-10-13 (유어샵 실측): 엔트리가 **나중에 동적으로** 부르는 모듈(웹 바이탈 보고 등)이 상세 페이지와
      //   같은 봉투에 들어가, 유어샵이 그 보고 하나 때문에 상세 화면 코드 18KB(br)를 받았다. 엔트리 쪽 동적 import 는
      //   페이지 표면과 별개의 '사용자'로 센다(`boot`) — 그러면 그 모듈은 상세 전용 봉투에서 떨어져 나온다.
      //   페이지 진입점(`src/pages/`)으로 가는 동적 import 는 라우트 lazy 라 제외한다.
      const boot = new Set()
      {
        const stack = []
        for (const m of all) {
          if (!inEntry(m, meta)) continue
          for (const d of meta.getModuleInfo(m)?.dynamicallyImportedIds ?? []) if (!norm(d).includes('/src/pages/')) stack.push(d)
        }
        while (stack.length) {
          const m = stack.pop()
          if (boot.has(m) || inEntry(m, meta)) continue
          boot.add(m)
          for (const x of meta.getModuleInfo(m)?.importedIds ?? []) stack.push(x)
        }
      }
      // 🩸 2026-10-13: 페이지가 **나중에(lazy)** 부르는 부품(상세의 리뷰·미니 지도)은 정적 폐쇄 밖이라 라벨이 없어서,
      //   그 부품을 **정적으로** 쓰는 다른 페이지의 봉투에 섞였다 — 상세가 리뷰 하나 때문에 상품 페이지 봉투(lz-product)를,
      //   미니 지도 때문에 지도 봉투(lz-map)를 통째로 받았다(브라우저 렌더 실측). 페이지의 lazy 사용을 `<표면>L` 로 센다.
      //   정적으로 이미 쓰는 모듈엔 L 을 붙이지 않는다(붙이면 그 페이지의 첫 화면 봉투가 쪼개진다).
      //   최상위 페이지 컴포넌트(`src/pages/XxxPage.tsx`)로 가는 동적 import 는 라우트 lazy·카드 prefetch 라 따라가지 않는다.
      const TOP_PAGE = /\/src\/pages\/[^/]+Page\.tsx$/
      const staticOf = new Map([...labels].map(([m, set]) => [m, new Set(set)]))
      for (const [surface, files] of Object.entries(routes)) {
        files.forEach((file, i) => {
          const label = files.length > 1 ? `${surface}${i + 1}` : surface
          const stack = []
          for (const [m, set] of staticOf) {
            if (!set.has(label)) continue
            for (const d of meta.getModuleInfo(m)?.dynamicallyImportedIds ?? []) if (!TOP_PAGE.test(norm(d))) stack.push(d)
          }
          const seen = new Set()
          while (stack.length) {
            const m = stack.pop()
            if (seen.has(m) || inEntry(m, meta) || TOP_PAGE.test(norm(m))) continue
            seen.add(m)
            if (!staticOf.get(m)?.has(label)) {
              if (!labels.has(m)) labels.set(m, new Set())
              labels.get(m).add(label + 'L')
            }
            const info = meta.getModuleInfo(m)
            for (const x of [...(info?.importedIds ?? []), ...(info?.dynamicallyImportedIds ?? [])]) stack.push(x)
          }
        })
      }
      for (const [m, set] of labels) if (boot.has(m)) set.add('boot')
      const group = new Map()
      const bytes = new Map()
      for (const [m, set] of labels) {
        if (roots.has(m)) continue
        const users = new Set([...set].filter((l) => l !== 'boot').map((l) => l.replace(/L$/, ''))).size
        const g = users >= commonMin ? 'lz-common' : 'lz-' + [...set].sort().join('-')
        group.set(m, g)
        bytes.set(g, (bytes.get(g) ?? 0) + (meta.getModuleInfo(m)?.code?.length ?? 0))
      }
      surfaceOf = new Map([...group].map(([m, g]) => [m, (bytes.get(g) ?? 0) < minGroupBytes ? 'lz-common' : g]))
    }
    return surfaceOf.get(id) ?? null
  }

  /** manualChunks 가 정한 이름(name)을 받아 최종 이름을 돌려준다. */
  return function gate(id, name, meta) {
    const groupable = norm(id).includes('/src/') || /\/lucide-react\/dist\/esm\/icons\//.test(norm(id)) || name === undefined
    if (!groupable || LIBRARY_ENVELOPES.has(name) || LAZY_ENVELOPES.has(name)) return name
    // 🔁 이름 없는 라이브러리가 **라이브러리만** 쓰는 의존이면 건드리지 않는다(2026-10-13 실측 사고).
    //   `@stripe/react-stripe-js` 가 쓰는 `prop-types` 를 페이지 봉투(lz-…)로 빼자, `stripe` 봉투는 lz 를,
    //   lz 는 그 안의 앱 코드 때문에 `stripe` 를 import 하는 **청크 순환**이 생겼다 — ESM 은 순환에서 한쪽을
    //   먼저 평가하므로 `stripe` 가 아직 초기화 안 된 prop-types 를 읽어 결제 화면 전체가 오류 화면이 됐다
    //   ("Cannot access 't' before initialization"). 빌드·시험은 초록이고 그 화면을 연 사람만 안다.
    //   ⇒ 그런 의존은 Rollup 이 쓰는 쪽 라이브러리 곁에 두게 맡긴다. 순환은 check-chunk-cycles 가 잡는다.
    if (name === undefined && !norm(id).includes('/src/') && libraryOnly(id, meta)) return name
    if (!NEVER_ENTRY.has(name) && inEntry(id, meta)) return name
    if (PINNED.some((re) => re.test(norm(id)))) return name
    return surfaceName(id, meta) ?? name
  }
}
