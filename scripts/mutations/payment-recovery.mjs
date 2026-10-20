/**
 * 🧬 주입 — 결제 복구 새로고침 예산 · 복귀 주소 라우트 (2026-09-13)
 *   대표 "결제의 다른 부분이 문제가 있는 건 없어?" 로 나온 두 가지를 지키는 시험이
 *   **실제로 실패할 수 있는지** 확인한다.
 */
export default [
  {
    name: '💸복구 자동 재시도가 예산을 다시 우회한다',
    file: 'index.html',
    find: `            setTimeout(function () { if (takeReloadBudget()) bustReload(); }, 30000);`,
    replace: `            setTimeout(bustReload, 30000);`,
    test: 'src/tests/unit/payment-recovery-budget-2026-09-13.test.ts',
    why:
      '라이브에서 실제로 이랬다 — /group-buy/confirm-payment 가 51초에 31번 다시 로드됐다. ' +
      '5분/8회 상한은 reloadOnce 안에만 있어서, 오버레이의 30초 자동 재시도가 통째로 지나갔다.',
  },
  {
    name: '💸복구 예산 상한이 느슨해진다',
    file: 'index.html',
    find: `            if (within && st.n >= 8) return 0; // 5분 내 8회 소진`,
    replace: `            if (within && st.n >= 800) return 0; // 5분 내 8회 소진`,
    test: 'src/tests/unit/payment-recovery-budget-2026-09-13.test.ts',
    why: '상한이 사실상 없어지면 폭주를 다시 막지 못한다. 숫자는 계약이다.',
  },
  {
    name: '💸복구 sessionStorage 막힌 환경에서 결제를 막는다',
    file: 'index.html',
    find: `          } catch (e) { return 1; }
        }
        function reloadOnce() {`,
    replace: `          } catch (e) { return 0; }
        }
        function reloadOnce() {`,
    test: 'src/tests/unit/payment-recovery-budget-2026-09-13.test.ts',
    why:
      'sessionStorage 가 막힌 브라우저(사파리 사생활 보호 등)에서 0 을 돌려주면 자동 복구가 ' +
      '아예 안 돈다 — 종전엔 돌았다. 복구를 고치려다 복구를 끄면 안 된다.',
  },
  {
    name: '💸복귀 가드가 라우트를 App.tsx 하나에서만 찾는다',
    file: 'scripts/check-payment-redirect-routes.mjs',
    find: `const routeFiles = walk(join(ROOT, 'src')).filter((f) => /\\.tsx$/.test(f) && readFileSync(f, 'utf8').includes('<Route path='))`,
    replace: `const routeFiles = [join(ROOT, 'src/App.tsx')]`,
    test: 'src/tests/unit/payment-redirect-routes-guard.test.ts',
    why:
      '첫 판이 정확히 이랬고 **거짓 빨간불**을 냈다 — 살아 있는 셀러 페이지 3개를 "라우트 없음"으로 ' +
      '신고했다(실제 라우트는 src/routes/seller.routes.tsx). 오탐도 결함이다.',
  },
  {
    name: '💸복귀 가드가 0건을 재고도 통과한다',
    file: 'scripts/check-payment-redirect-routes.mjs',
    find: `if (checked < MIN) {`,
    replace: `if (false) {`,
    test: 'src/tests/unit/payment-redirect-routes-guard.test.ts',
    why:
      '스캔이 깨져 목적지를 하나도 못 찾으면 "전부 정상"이 돼 버린다 — 이 레포가 반복해 당한 ' +
      '"실패할 수 없는 검사". 0건은 통과가 아니라 실패다.',
  },
]
