/**
 * 🚀 하드로드·탭 이동의 "페이지 로딩 중" 단계 제거 (2026-10-15 대표 "가장 이상적이고 영구적으로") — 주입 매니페스트.
 * 가드: src/tests/unit/boot-page-2026-10-15.test.tsx
 *
 * 이 결함들은 **빌드도 화면도 안 깨뜨린다** — 로딩 화면이 0.35~0.5초 더 떴다가 같은 화면이 나올 뿐이다.
 * 그래서 누구도 신고하지 않는다(홈 카드의 '폴백 없이 즉시' 주석이 실제론 안 지켜진 채 몇 달 갔다).
 */
const TEST = 'src/tests/unit/boot-page-2026-10-15.test.tsx'

export default [
  {
    name: '🚀 lazyPage 가 준비된 모듈을 무시하고 늘 lazy 로 그린다',
    file: 'src/lib/boot-page.tsx',
    find: 'return ready ? createElement(Ready(), props) : createElement(LazyAny, props)',
    replace: 'return createElement(LazyAny, props)',
    test: TEST,
    why: '받아 둔 모듈이 있어도 한 번 멈춘다 — 폴백을 그리고 React 의 0.5초 공개 지연을 탄다.',
  },
  {
    name: '🚀 부팅 대기에 상한이 없다 — 청크가 늦으면 앱이 안 뜬다',
    file: 'src/lib/boot-page.tsx',
    find: 'return await Promise.race([Promise.all(list.map((l) => l())).then(() => true), timeout])',
    replace: 'return await Promise.all(list.map((l) => l())).then(() => true)',
    test: TEST,
    why: '미리받기가 빗나가거나 회선이 끊기면 첫 렌더가 무한정 밀린다(종전엔 그래도 로더→페이지로 떴다).',
  },
  {
    name: '🚀 부팅 대기가 실패를 던진다 — 청크 404 면 앱이 안 뜬다',
    file: 'src/lib/boot-page.tsx',
    find: '  } catch {\n    return false\n  } finally {',
    replace: '  } catch (e) {\n    throw e\n  } finally {',
    test: TEST,
    why: '배포 직후 옛 청크 404 는 흔하다 — 그건 종전 자가복구(chunk-error)가 맡아야지 부팅이 멎으면 안 된다.',
  },
  {
    name: '🚀 main.tsx 가 페이지 준비를 기다리지 않는다',
    file: 'src/main.tsx',
    find: '      await preloadBootPage(bootSurface())\n',
    replace: '      void preloadBootPage(bootSurface())\n',
    test: TEST,
    why: '첫 렌더가 준비 전에 돌아 lazy 가 멈추고 폴백 단계가 그대로 남는다.',
  },
  {
    name: '🚀 상세 표면 부팅 로더가 빠진다',
    file: 'src/App.tsx',
    find: "registerBootPage('gbDetail', GroupBuyDetailPage.load); ",
    replace: '',
    test: TEST,
    why: '이용권 상세 하드로드에서만 "페이지 로딩 중" 단계가 되살아난다.',
  },
  {
    name: '🚀 홈 카드가 상세 코드를 import() 로 직접 받는다',
    file: 'src/pages/main-home/GroupBuyFeedCard.tsx',
    find: "loadRoute('gbDetail').catch(() => { _detailChunkPrefetched = false })",
    replace: "import('@/pages/GroupBuyDetailPage').catch(() => { _detailChunkPrefetched = false })",
    test: TEST,
    why: '코드는 받지만 상세가 "준비됨" 이 안 돼 누를 때마다 로딩 화면이 0.35초 뜬다(라이브 실측).',
  },
  {
    name: '🚀 하단 탭이 존재하지 않는 미리받기 이름을 부른다',
    file: 'src/components/main/BottomNav.tsx',
    find: "prefetch: () => loadRoute('vouchers') }",
    replace: "prefetch: () => loadRoute('voucherz') }",
    test: TEST,
    why: '등록 안 된 이름은 조용히 아무것도 안 받는다 — 탭을 눌러도 미리받기가 0 인데 에러가 없다.',
  },
  {
    name: '🚀 사업자 유어샵 래퍼가 둘이 된다',
    file: 'src/routes/seller.routes.tsx',
    find: "import { SellerPublicPage } from '@/pages/seller-public/lazy-seller-public'\n",
    replace: "import { lazy as lazySP } from 'react'\nconst SellerPublicPage = Object.assign(lazySP(() => import('@/pages/SellerPublicPage')), { load: () => import('@/pages/SellerPublicPage') })\n",
    test: TEST,
    why: '한쪽(/u/:handle)이 받아 둔 모듈을 다른 쪽(/profile)이 몰라 로딩 화면을 다시 띄운다.',
  },
  {
    name: '🚀 워커가 표면 판정을 다시 손으로 쓴다(두 벌)',
    file: 'src/worker/index.ts',
    find: "const chunkSurface = routeSurface(url.pathname, isMobileUserAgent(c.req.header('user-agent')), authed);",
    replace: "const chunkSurface = /^\\/(?:pass|group-buy)\\/\\d+/.test(url.pathname) ? 'gbDetail' : routeSurface(url.pathname, isMobileUserAgent(c.req.header('user-agent')), authed);",
    test: TEST,
    why: '앱 부팅과 워커가 다른 판정을 쓰면 미리받기는 맞는데 부팅 준비는 빗나가는 날이 온다(에러 0).',
  },
  {
    name: '🚀 표면 판정에서 한 표면이 빠진다(생성기 표와 어긋남)',
    file: 'src/shared/route-surface.ts',
    find: "  if (p === '/faq') return 'faq'\n",
    replace: '',
    test: 'scripts/check-loader-continuity.mjs',
    why: 'FAQ 하드로드가 청크 병렬화도 부팅 준비도 못 받는다 — 에러 없이 로더만 길어진다.',
  },
]
