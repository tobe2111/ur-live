/**
 * 🧬 주입 — **사장님 문자 → 한 번 눌러 그 화면** (2026-10-10)
 *
 * 되돌리면 전부 조용하다: 문자는 가고 링크도 열린다. 다만 셀러 비밀번호 로그인 벽에 떨어지거나
 * (카카오로만 가입한 사장님은 비밀번호가 없다) 엉뚱한 매장·시각을 보여 준다.
 */
const T = 'src/tests/unit/store-deep-link-2026-10-10.test.tsx'
export default [
  {
    name: '문자링크 — 좌석을 안 잡고 바로 화면으로 보낸다',
    file: 'src/pages/StoreGoPage.tsx',
    find: '      if (ok) navigate(path, { replace: true })\n      else setFailed(true)',
    replace: '      navigate(path, { replace: true })',
    test: T,
    why: '좌석 없이 /seller/* 로 가면 ProtectedRoute 가 셀러 로그인으로 튕긴다 — 고치려던 바로 그 벽.',
  },
  {
    name: '문자링크 — 판매 알림이 매장 번호를 안 넘긴다(버튼 링크)',
    file: 'src/features/group-buy/api/seller-sale-notify.ts',
    find: "      sellerId: sale.sellerId,\n    })\n  } catch",
    replace: "    })\n  } catch",
    test: T,
    why: '2026-10-12 링크가 알림톡 버튼으로 옮겨갔다 — 매장 번호가 없으면 버튼(s=#{매장번호})을 못 만들어 판매 알림이 아예 안 나간다.',
  },
  {
    name: '문자링크 — 모르는 화면 이름을 그대로 경로로 쓴다',
    file: 'src/shared/store-deep-link.ts',
    find: '    path: isStoreGoTarget(to) ? STORE_GO_TARGETS[to] : STORE_GO_TARGETS.home,',
    replace: '    path: to || STORE_GO_TARGETS.home,',
    test: T,
    why: '링크의 to= 가 임의 경로가 되면 문자 하나로 아무 화면(외부 포함)으로 보낼 수 있다.',
  },
  {
    name: '문자링크 — 사용 시각을 UTC 로 찍는다',
    file: 'src/features/group-buy/api/helpers.ts',
    find: "    const ts = data.usedAt ? new Date(data.usedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' }) : ''\n    const message = `[유어딜] ✅ 이용권 사용 처리됨",
    replace: "    const ts = data.usedAt ? new Date(data.usedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''\n    const message = `[유어딜] ✅ 이용권 사용 처리됨",
    test: T,
    why: '워커 런타임은 UTC — 사장님 문자에 9시간 이른 시각이 찍힌다(에러 0).',
  },
]
