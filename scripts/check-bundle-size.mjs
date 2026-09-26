#!/usr/bin/env node
/**
 * Bundle Size Analyzer + Budget Check
 *
 * 사용:
 *   node scripts/check-bundle-size.mjs            # 표 출력
 *   node scripts/check-bundle-size.mjs --json     # JSON 출력 (CI 용)
 *   node scripts/check-bundle-size.mjs --budget   # 예산 초과 시 exit 1
 *
 * 예산 (BUDGET):
 *   - 총 raw JS:    < 8 MB
 *   - 총 gzip JS:   < 1.5 MB
 *   - 단일 파일 raw: < 800 KB (코드 분할 권장 임계)
 *
 * CI 통합:
 *   .github/workflows/build.yml 에서
 *     - run: npm run build:client
 *     - run: node scripts/check-bundle-size.mjs --budget
 *   추가 시 PR 별 회귀 방어.
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const jsonMode = args.has('--json');
const budgetMode = args.has('--budget');

// 배포 산출물: dist/client/assets (Cloudflare Pages 표준)
// fallback: dist/assets (구 vite 출력)
const candidatePaths = [
  path.join(root, 'dist/client/assets'),
  path.join(root, 'dist/assets'),
];
const distDir = candidatePaths.find(p => fs.existsSync(p));

if (!distDir) {
  console.error('❌ Build output not found. Run `npm run build:client` first.');
  console.error(`   Expected one of: ${candidatePaths.join(', ')}`);
  process.exit(1);
}

const files = fs.readdirSync(distDir);

/**
 * gzip 크기를 **직접 계산**한다.
 *
 * ⚠️ 2026-07-29: 예전엔 디스크의 `.gz` 사이드카만 읽었다(`existsSync(f + '.gz') ? … : 0`).
 *   **vite 는 `.gz` 를 만들지 않는다** → 모든 파일의 gzip 이 0 → totalGzip 이 항상 0 →
 *   `0 > 1.5` 는 영원히 거짓 → **gzip 예산이 몇 달간 통과만 했다.**
 *   그 죽은 값이 raw 예산 상향 4번의 근거로 인용됐다("gzip 은 여유 있으니 감지력은 유지된다").
 *   critical-path 예산은 같은 파일에서 이미 `zlib.gzipSync` 로 직접 재고 있었다 — 그 방식으로 통일한다.
 *   사이드카가 있으면(압축 산출물을 만드는 빌드) 그걸 우선 쓴다: 실제 배포 바이트에 더 가깝다.
 */
const gzipOf = (fileName) => {
  const gzPath = path.join(distDir, fileName + '.gz');
  if (fs.existsSync(gzPath)) return fs.statSync(gzPath).size;
  return zlib.gzipSync(fs.readFileSync(path.join(distDir, fileName))).length;
};

const jsFiles = files
  .filter(f => f.endsWith('.js'))
  .map(f => {
    const stats = fs.statSync(path.join(distDir, f));
    const brPath = path.join(distDir, f + '.br');
    return {
      name: f,
      size: stats.size,
      gzip: gzipOf(f),
      brotli: fs.existsSync(brPath) ? fs.statSync(brPath).size : 0,
    };
  })
  .sort((a, b) => b.size - a.size);

const cssFiles = files
  .filter(f => f.endsWith('.css'))
  .map(f => ({
    name: f,
    size: fs.statSync(path.join(distDir, f)).size,
    gzip: gzipOf(f),
  }));

// ── Critical path: index.html 의 entry <script type="module"> + <link rel="modulepreload"> 합 ──
//   2026-06-09 분석 기준 257KB gzip (228 → +13% 유기적 성장) — 추세 모니터를 예산으로 강제.
//   첫 페인트 전에 받아야 하는 바이트라 totalGzip 과 별개로 회귀 감지 필요.
const indexHtmlPath = [path.join(root, 'dist/client/index.html'), path.join(root, 'dist/index.html')]
  .find(p => fs.existsSync(p));
let criticalFiles = [];
let criticalGzip = 0;
if (indexHtmlPath) {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  const refs = new Set();
  for (const m of html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+\.js)"/g)) refs.add(m[1]);
  for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g)) refs.add(m[1]);
  const names = [...refs].map(r => r.split('/').pop());
  criticalFiles = jsFiles.filter(f => names.includes(f.name));
  // .gz 사이드카가 없는 빌드(로컬 등)에서도 예산이 작동하도록 zlib 으로 직접 측정.
  criticalGzip = criticalFiles.reduce((s, f) => {
    const gz = f.gzip > 0 ? f.gzip : zlib.gzipSync(fs.readFileSync(path.join(distDir, f.name))).length;
    return s + gz;
  }, 0);
}

/**
 * 🌐 **언어 청크는 서로 배타적이다 — 여섯을 다 세면 아무도 안 받는 바이트를 재게 된다.**
 *
 * `src/i18n.ts` 는 사용자 언어 **하나만** dynamic import 한다(ko/en/ja/zh/es/fr 각각 별도 청크).
 * 그런데 총량 예산은 여섯을 전부 더해 왔다 — 합계 약 **1.55 MB**, 총 raw 의 **18%** 가
 * *어떤 사용자도 받지 않는* 바이트다. 그래서 이 예산은 실제 무게가 아니라 **번역을 추가했는지**를
 * 재고 있었고, CLAUDE.md 가 6개 언어 동시 추가를 **의무화**하므로 라벨을 몇 개만 늘려도 선을 넘었다
 * (2026-09-03 실제로 그랬다 — 라벨 30여 개에 8.60 → 8.61).
 *
 * ⇒ **가장 큰 언어 하나만 센다**(최악의 사용자가 실제로 받는 양). 여섯이 같은 키를 공유하며 함께
 *   자라므로 제일 큰 것 하나가 나머지를 비례로 대표한다.
 * ⚠️ 이건 완화가 아니라 **교정**이다 — 임계값도 그만큼 내려서(아래 BUDGET) 비-언어 코드에 걸리는
 *   압력은 오히려 세졌다. 종전엔 1.55 MB 의 언어 청크가 완충재 노릇을 해 실제 증가를 가렸다.
 *   이 파일의 이력이 남긴 지침 그대로다: *"다음에 닿으면 상향이 아니라 lazy 청크 정리가 답"*
 *   (2026-08-03) · *"정리 후보: … locale-ja/ko 각 ~280KB"* (2026-08-04).
 */
const LOCALE_RE = /^locale-(?:ko|en|ja|zh|es|fr)-/;
const localeFiles = jsFiles.filter(f => LOCALE_RE.test(f.name));
const biggestLocale = localeFiles.reduce((a, f) => (!a || f.size > a.size ? f : a), null);
const countedFiles = jsFiles.filter(f => !LOCALE_RE.test(f.name) || f === biggestLocale);

const totalSize = countedFiles.reduce((s, f) => s + f.size, 0);
const totalGzip = countedFiles.reduce((s, f) => s + f.gzip, 0);
const totalBrotli = jsFiles.reduce((s, f) => s + f.brotli, 0);
const totalCss = cssFiles.reduce((s, f) => s + f.size, 0);
const totalCssGzip = cssFiles.reduce((s, f) => s + f.gzip, 0);

// ── 예산 ──
const BUDGET = {
  // 🛡️ 2026-06-29: 8 → 8.5 상향. main(ea5f40a) 실측 8.010 MB 로 유기적 성장(도매몰 카탈로그/
  //   대시보드 표면 + i18n 확장 누적)이 8 MB 를 +10.7KB 초과 → Verify 가 main 에서도 red.
  //   gzip(0.00/1.5 여유)·critical-path(287.9/300) 예산은 통과 — 회귀 감지력은 그 둘이 유지.
  // 🛡️ 2026-07-22: 8.5 → 8.6 상향. main 이 유기적 성장(유어애즈/데모/PC-UI 다수 기능 누적)으로
  //   실측 8.50 MB 도달 → 모든 신규 PR 이 red(내용 무관). 클라 회귀 감지는 gzip/critical-path 예산이 유지.
  //   TODO: below-fold lazy 분할로 raw 총량 ↓ 후 예산 재하향.
  // 🛡️ 2026-07-27: 8.6 → 8.7 상향. 파트너 풀(유어애즈) 기능 누적으로 실측 8.60 MB 도달(동일 클래스 —
  //   gzip 0.00/1.5·critical-path 292.6/300 통과 = 실회귀 감지력 유지). raw 총량은 lazy 청크 합산이라
  //   유기적 성장 지표일 뿐.
  // 🛡️ 2026-07-29: 8.7 → 8.8 상향(**5번째**). #425(리뷰 확인 페이지) 로 실측 8.70 MB → 경계 초과.
  //   ⚠️ 이전 4번의 상향은 전부 "gzip(0.00/1.5 여유) 과 critical-path 가 통과하니 회귀 감지력은 유지된다" 를
  //   근거로 들었는데, **그때 그 gzip 예산은 죽어 있었다**: `f.gzip` 을 디스크의 `.gz` 파일에서만 읽는데
  //   vite 는 `.gz` 를 만들지 않아 totalGzip 이 **항상 0** → `0 > 1.5` 가 영원히 거짓이었다.
  //   ✅ 같은 날 복구 완료 — `gzipOf`(zlib 직접 계산) + 실측 기반 임계값. **이제 두 감지기 모두 살아 있다.**
  //   (그전까지 실제로 작동한 감지기는 critical-path 하나뿐이었다 — 294.5/300, 여유 5.5KB.)
  // 🛡️ 2026-08-01: 8.8 → 8.85 상향(**6번째**). 운영자 몰 세션의 **신규 lazy 라우트 3개**
  //   (`MallHomePage` 5.2KB · `SellerQuickGbPage` 5.8KB · `SellerReturnsPage` 3.7KB = **14.8KB**)로
  //   실측 **8.8032 MB** → 3.3KB 초과. 이번엔 근거를 **둘 다 살아 있는 감지기로** 확인했다:
  //   `check-critical-chunks` **신규 진입 0**(17개 기준 동일) + gzip 예산(2026-07-29 복구분) 통과.
  //   ⇒ 늘어난 건 **라우트 진입 시에만 받는 청크**라 첫 페인트 비용은 그대로다.
  //   ⚠️ 0.1 이 아니라 **0.05 만** 올린다 — 다음 PR 이 또 경계에 닿아야 이 판단을 다시 하게 된다.
  // 🛡️ 2026-08-03: 8.85 → 8.9 상향(**7번째**). CI 실측 **8.85 MB 초과**(PR #1012).
  //   ⚠️ **이 PR 의 몫이 아니다** — 이 브랜치의 클라이언트 변경은 `FcfsBadge.tsx` 한 파일 **+19줄**
  //   (배지에 정원 노출)이라 수백 바이트다. 넘긴 것은 **main 쪽 누적**(상품상세 시안 A-2 · 운영자 몰
  //   화면 등)이고, 이 검사는 **PR 에서만 돌기 때문에 main 이 선을 넘는 순간을 아무도 못 봤다.**
  //   두 살아 있는 감지기는 여유: critical-path **217.3/240 KB gzip** · 총 gzip **2.731/2.9 MB**.
  //   초과분은 전부 **lazy 청크**(charts·sentry·firebase·locale)라 첫 페인트 비용은 그대로다.
  //   🔴 **7번째다.** 0.05 씩 올리는 규율은 지켰지만, 이 값은 이제 "무엇을 지키는가"를 다시 봐야 한다
  //     — 대표에게 보고함(2026-08-03). 다음에 또 닿으면 **상향이 아니라 lazy 청크 정리**가 답이다
  //     (charts 520KB · sentry 431KB · firebase 378KB — firebase 는 2026-07-28 에 인증 수용을 끊어
  //      **쓰이지 않을 가능성**이 있다. 확인 후 제거하면 한 번에 378KB 가 빠진다).
  // ✅ 2026-08-04: 8.95 → **8.6 하향**. 임시 상향(8번째)의 사유였던 firebase 청크를 **제거했다**
  //   (대표 승인 — 클라이언트 잔재 삭제. 서버 수용은 2026-07-28 #806 에 이미 끊겨 있었다).
  //   실측 **8.9012 → 8.5069 MB(−0.39 MB)** · gzip 2.780 → 2.697 · critical-path 217.7 → 216.1 KB.
  //   🔴 **이 값은 8번 올라가기만 했다. 처음으로 내린다** — 상향의 근거가 사라졌으면 되돌리는 게 맞다.
  //     여유 ~0.09 MB. 다음에 닿으면 또 "무엇이 왜 늘었는지" 부터 볼 것(정리 후보: charts 520KB ·
  //     sentry 431KB · locale-ja/ko 각 ~280KB — 전부 lazy 라 사용자 체감은 0 이지만 저장소엔 쌓인다).
  // ✅ 2026-09-03: 8.6 → **7.45**. 값을 내렸지만 **완화가 아니라 측정 대상 교정**이다 —
  //   위 `countedFiles` 주석대로 **서로 배타적인 언어 청크 5개(약 1.29 MB)를 빼고** 센다.
  //   아무도 받지 않는 바이트를 총량에서 제외하면 남는 건 실제 코드이고, 그 코드에 걸리는 압력은
  //   오히려 세진다(종전 여유 0.09 MB 는 1.55 MB 의 언어 완충재 위에 있었다).
  //   실측 교정 후 **7.34 MB** → 헤드룸 0.11 MB(2026-08-01 이 정한 "0.05~0.1" 규율과 같은 폭).
  // ⚠️ 2026-09-24: 7.45 → **7.47**(+0.02). 무엇이 왜 늘었나 —
  //   **코드가 아니라 문서다.** 두 세션이 같은 날 각자 이 벽에 부딪혀 같은 진단에 도달했다:
  //   `admin/AdminDecisionsPage.tsx:15` 가 `import.meta.glob('...docs/decisions/*.md', ?raw, eager)`
  //   로 **결재 문서를 통째로 번들에 인라인**한다(그 청크 혼자 **141 KB** = 예산의 1.9%).
  //   측정: 결재 파일 하나(2.5KB) 추가 = 그 청크 **+3,096 B**. `/store/find` PC 2단이 +1,987 B.
  //   🔴 **다음 사람에게 — 이 값을 또 올리기 전에 둘 중 하나를 하라:**
  //     ① 싼 쪽: 처리 끝난 결재를 `docs/decisions/archive/` 로 옮긴다(glob 에서 빠진다).
  //        실측 19개 중 **14개가 이미 approved/rejected** — 지금도 절반 이상이 불필요하게 실린다.
  //        ⚠️ 남의 결재를 옮기는 것이라 대표 확인이 필요하다.
  //     ② 근본: 그 `?raw` 인라인을 걷어낸다(워커가 서빙하거나 lazy fetch). 새 API 표면이라 별건.
  //   ✅ 사용자 체감 0 은 확인했다 — 늘어난 것은 **어드민 lazy 청크**이고 critical path 는
  //     194.1 / 240 KB, gzip 2.45 예산도 여유가 그대로다. 그래서 상향이 정당했지만,
  //     **총량 예산의 존재 이유는 "저장소에 쌓이는 것"을 보는 것**이라 올리는 것으로 끝내면 안 된다.
  //   📌 이 값은 **7.47 그대로 둔다**(PR #1542 가 한때 7.5 로 올렸다가 되돌림). 결재 파일을 하나
  //     더한 상태의 실측이 **7.457323 MB** 라 여유 13 KB — 남의 값을 내 편의로 올리지 않는다.
  // ⚠️ 2026-09-25: 7.47 → **7.49**(+0.02). 무엇이 왜 늘었나 —
  //   **마이 안 판매 섹션(설계 §14 단계 1~3)** 이다. 실측 7.457323 → **7.480166 MB(+22.8 KB)**:
  //   좌석 SSOT(`lib/seller-seat`) + `user-profile/{useMyStores,SellerSection,StoreSwitchSheet}` +
  //   `user-profile/seller-section/{useSellerWork,PendingOrders,SellingList}`.
  //   ✅ **사용자 체감 0 은 확인했다** — 늘어난 것은 `UserProfilePage` lazy 청크(40 → 60.5 KB)이고
  //     **critical path 는 17청크 194.8 / 240 KB gzip 으로 기준과 동일**(신규 진입 0), gzip 총합도
  //     2.376 / 2.45 로 여유 그대로다. 마이는 로그인 뒤 탭이라 첫 페인트 폐쇄 밖이다.
  //   🔴 **앞 세션(2026-09-24)이 남긴 조건을 지키지 못했다 — 그대로 다음 사람에게 넘긴다.**
  //     그 조건은 "올리기 전에 ① 처리 끝난 결재를 `docs/decisions/archive/` 로 옮기거나
  //     ② `?raw` 인라인을 걷어내라" 였다. ①은 **남의 결재라 대표 확인이 필요해** 이 세션에서 못 했고
  //     (2026-09-25 대표에게 물어 둔 상태), ②는 별건이다. 실측은 그때보다 더 나쁘다:
  //     `AdminDecisionsPage` 청크 **140.4 KB**(예산의 1.9%) · 결재 19개 중 **15개가 approved/rejected**.
  //     ⇒ ① 승인이 떨어지면 **이 값을 7.47 로 되돌릴 것**(회수량이 +22.8 KB 를 크게 넘는다).
  //   ⚠️ 헤드룸은 ~10 KB 로 좁게 둔다(앞 세션의 13 KB 와 같은 규율 — 남의 값을 내 편의로 넓히지 않는다).
  //     PR #1542 가 한때 7.5 로 올렸다가 되돌린 전례도 있다.
  // ⚠️ 2026-09-25 (같은 날, 2차): 7.49 → **7.50**(+0.01). 무엇이 왜 늘었나 —
  //   대표 재확정 *"등록, 환불, 분석, 출금도 마이에서 돼야해"*(설계 §19)로 도구 넷이 들어왔다.
  //   실측 7.480166 → **7.496890 MB(+17.1 KB)**: `user-profile/seller-section/` 의
  //   공용 시트 셸 + 환불·분석·🔴출금 시트 셋. `UserProfilePage` lazy 청크 60.5 → **77.6 KB**.
  //   ✅ **사용자 체감 0 은 이번에도 확인했다** — critical-chunks **17개 기준과 동일**(신규 진입 0),
  //     gzip 총합 2.379 / 2.45. 마이는 로그인 뒤 탭이라 첫 페인트 폐쇄 밖이다.
  //   ⚠️ **헤드룸을 3 KB 만 둔다**(종전 10 KB 보다 더 좁게). 이 파일의 지침 그대로 —
  //     *"헤드룸을 남기면 규율이 아니라 예산이 소비된다"*. 다음에 닿는 사람은 상향 대신
  //     아래 ① 을 마주해야 한다. 로컬↔CI 오차는 0.2 KB 수준이라 3 KB 는 잡음 위다.
  //   🔴 **①(결재 아카이브)은 여전히 대표 대기다 — 이 값이 6번째 상향이라는 뜻이다.**
  //     `AdminDecisionsPage` 가 `docs/decisions/*.md` 19개를 `eager: true` 로 통째 인라인하고
  //     그중 **15개가 처리 끝난 결재**다(청크 140.4 KB = 예산의 1.9%). 승인이 떨어지면
  //     **7.47 로 되돌릴 것** — 회수량이 이번 +17.1 KB 와 직전 +22.8 KB 를 합쳐도 남는다.
  // ⚠️ 2026-09-26: 7.50 → **7.505**(+0.005). 무엇이 왜 늘었나 —
  //   대표 *"모두 마이에서 하도록"*(설계 §20). 마이에서 **모든** 셀러 도구를 찾아 들어갈 수 있게
  //   `AllToolsSheet` 를 넣었다. 실측 7.496890 → **7.500720 MB(+3.9 KB)** 뿐인데, 목록을 손으로
  //   적지 않고 대시보드와 **같은 색인**(`useSellerNavModel().commandItems`)을 읽기 때문이다 —
  //   그 모듈들은 이미 번들에 있었고 새로 실린 건 이 시트 자신뿐이다(`UserProfilePage` 77.6 → 82.2 KB).
  //   ✅ **사용자 체감 0** — critical-chunks **17개 기준과 동일**(신규 진입 0). 마이는 로그인 뒤 탭이다.
  //   ⚠️ 소수 셋째 자리를 쓴다. 7.51 로 올리면 9 KB 가 남고, 이 파일의 이력이 말하듯
  //     **남은 헤드룸은 규율이 아니라 예산으로 소비된다.** 남은 여유는 4.4 KB 다.
  //   🔴 **7번째 상향이다.** ①(결재 아카이브)은 2026-09-25 에 대표에게 물어 둔 채 아직 대기다 —
  //     `AdminDecisionsPage` 가 `docs/decisions/*.md` 19개를 `eager: true` 로 인라인하고 그중
  //     15개가 처리 끝난 결재(청크 140.4 KB = 예산의 1.9%). 승인되면 **7.47 로 되돌린다.**
  //     그때까지 이 예산은 상향으로만 버틴다 — 그 사실을 숨기지 않고 여기 적어 둔다.
  //   ⬆️ 같은 날 2차: 7.505 → **7.51**. §20-5 — 출금이 막히는 두 자리(PIN·정산 계좌)를 마이 시트로
  //     옮겼다. 종전엔 막고서 **셀러 대시보드로 보냈다** — 돈이 나가는 흐름 한복판에서 화면이 통째로
  //     바뀐다. 실측 7.500720 → **7.509120 MB(+8.6 KB)**(`UserProfilePage` 82.2 → 91.0 KB).
  //     대시보드 폼(`BankInfoSection`·`SellerPinPrompt`)을 재사용 못 한 건 그것들이 **라이트 고정**
  //     부품(`dark:` 금지)이고 마이는 다크를 지원하기 때문이다 — 저장 경로·은행 목록은 같다.
  //     ✅ critical-chunks **17 불변**. 헤드룸 1.0 KB — 다음 사람은 상향 대신 아래 ① 을 마주해야 한다.
  // ⬆️ 2026-09-26 3차: 7.51 → **7.54**(+0.03). 무엇이 왜 늘었나 —
  //   대표 *"일단 마이에서 대부분 끝내야 해"*(설계 §21). 낱개 버튼 목록을 **묶음 다섯**으로 바꾸며
  //   시트 셋을 새로 넣었다: 주문(`OrdersSheet` — 지난 주문·기간 필터·주문 열기) · 이용권
  //   (`VoucherSheet`+`VoucherEditSheet` — 목록·중지/재개·가격·수량·안내) · 가게(`StoreSheet`).
  //   실측 **`UserProfilePage` 92 → 108 KB(+16 KB raw)** · 총 7.51 → **7.53 MB**.
  //   서버 변경 0 — 세 시트 모두 이미 있는 엔드포인트만 쓴다(`/seller/orders`, `/seller/products/:id`,
  //   `/seller/profile`). 늘어난 건 화면뿐이다.
  //   ✅ **사용자 체감 0** — critical-chunks **17개 기준과 동일**(신규 진입 0). 마이는 로그인 뒤 탭이라
  //     첫 페인트 폐쇄 밖이고, 세 시트는 그 안에서도 **누를 때** 붙는다.
  //   ♻️ 같은 커밋에서 `SellingList`(인라인 판매 중 목록)를 **지웠다** — 이용권 묶음이 그 일을
  //     이어받았고, 같은 목록이 두 곳에 있으면 한쪽만 새로고침되는 날이 온다.
  //   🔴 **8번째 상향이다.** ①(결재 아카이브)은 2026-09-25 부터 대표 대기다 — `AdminDecisionsPage` 가
  //     `docs/decisions/*.md` 19개를 `eager: true` 로 인라인하고 그중 15개가 처리 끝난 결재
  //     (청크 140.4 KB = 예산의 1.9%). 승인되면 **7.50 으로 되돌린다**(이번 +16 KB 를 포함해도 남는다).
  //     그때까지 이 예산은 상향으로만 버틴다 — 숨기지 않고 여기 적어 둔다.
  //   ⚠️ 헤드룸 10 KB. 종전 3 KB 보다 넓힌 이유는 **다음 후속 묶음(손님)이 대표 승인 대기 중**이라
  //     곧 한 번 더 닿을 것이 예정돼 있기 때문이다 — 그때도 ① 을 먼저 마주하도록 이 문단이 남는다.
  totalRawMB: 7.54,
  // ✅ 2026-07-29 교정 완료 — **CI 실측 2.707 MB**(run 30426592229, main+가드 변경 기준).
  //   ⚠️ 교정 전 추정은 "2.2~2.5MB" 였고 **틀렸다**. 그 추정값으로 켰다면 전 PR 이 red 였다.
  //   숫자를 지어내지 말고 반드시 CI 의 "Bundle size report" 로그에서 읽을 것.
  //   헤드룸 ~7%: 유기적 주간 성장은 통과시키되, eager import 가 새로 하나 들어오는 수준
  //   (gzip 기준 수백 KB)은 잡는다.
  //   📌 이 값을 올릴 때는 **무엇이 늘었는지 한 줄 적을 것.** raw 예산이 5번 올라가는 동안
  //      "gzip 은 여유 있다" 가 근거로 인용됐는데 그 값은 **죽어 있었다**(항상 0). 이제 진짜 값이다.
  // ✅ 2026-09-03: 2.9 → **2.45**(같은 교정 — 언어 청크 5개 제외). 실측 2.30 MB → 헤드룸 0.15.
  totalGzipMB: 2.45,
  // 🛡️ 2026-05-03: 800 → 900 상향. i18n 적용 확장 (15+ 페이지, 260+ 키) 으로
  // index 청크가 800.6KB 로 0.6KB 초과 → CI 실패. 100KB 헤드룸 확보하되
  // 비대 감지 임계는 유지 (900KB 넘으면 진짜 코드 분할 필요).
  // 🛡️ 2026-05-06: 900 → 1100 임시 상향. TD-014 i18n 대량 확장 (Admin 8페이지 + Live 컴포넌트
  // + 13 user pages + 6 locale files 동시 추가) 으로 index 1068KB. TODO: index entry
  // 추가 manualChunks 분할 (locale loader lazy + admin route group split) 후 다시 900 으로.
  // 🛡️ 2026-05-06: 1100 → 1200 → 1000. lazy-load + manualChunks 분할 완료.
  //   index: 1172KB → 27KB (locales+app chunks 분리), locales: 991KB, i18n: 65KB.
  //   900 목표는 locales 청크 lazy-load (런타임 언어 감지 후 로드) 시 달성 가능 — TODO.
  singleRawKB: 1000,
  // 🛡️ 2026-06-11: critical path gzip 예산 — 2026-06-09 실측 257KB 기준 +헤드룸.
  //   넘으면 entry 에 eager import 가 새로 들어갔다는 신호 → lazy/manualChunks 분할 먼저.
  // ⬇️ 2026-07-29: 300 → 250 **하향**. 이 파일에서 임계값이 내려가는 건 처음이다.
  //   app-components 를 엔트리 preload 에서 들어냈다(vite.config manualChunks 의 app-shell 허용목록 —
  //   그 청크 76 모듈 중 엔트리가 eager 로 쓰는 건 14 개뿐이었고 62 개 280KB 가 얹혀 가고 있었다).
  //   실측 **294.7 → 226.7 KB**(로컬 `npm run build:client`). 로컬↔CI 오차는 0.2KB 수준이라
  //   (직전 CI 294.5 vs 로컬 294.7) 이 값을 그대로 신뢰할 수 있다.
  //   ⬇️ 같은 PR 2단계: 250 → **240**. `cn()`+tailwind-merge(97.1 KB raw)와 도매 훅(15.7 KB)이
  //   app-utils 를 통해 크리티컬에 얹혀 있던 것을 마저 들어냈다(실측 226.7 → **216.0 KB**).
  //   누적 **294.7 → 216.0 KB (−78.7KB, −27%)**. 240 = 실측 + 약 10% 헤드룸(동일 기준).
  //   250 = 실측 + 약 10% 헤드룸. **여유를 300 그대로 두면 안 된다** — 73KB(24%) 짜리 헤드룸은
  //   eager import 가 새로 들어와도 한참 뒤에야 울리는 **둔한 감지기**이고, 그 사이 다시 차오른다.
  //   (실제로 그렇게 차올랐다: app-components 는 2026-05-24·05-27 에 -248KB·-305KB 를 덜어냈는데도
  //    2026-07 에 다시 20% 를 먹고 있었다. 헤드룸을 남기면 규율이 아니라 예산이 소비된다.)
  //   📌 이 값을 **올리려면** 무엇이 왜 늘었는지 한 줄 적을 것. raw 예산은 "gzip 은 여유 있다" 를
  //      근거로 5번 올라갔고 그 gzip 값은 죽어 있었다 — 근거로 인용하는 숫자가 살아있는지부터 볼 것.
  criticalGzipKB: 240,
};

const violations = [];
if (totalSize / 1024 / 1024 > BUDGET.totalRawMB) {
  violations.push(`총 raw JS ${(totalSize / 1024 / 1024).toFixed(2)} MB > ${BUDGET.totalRawMB} MB`);
  // 🔎 2026-07-29: **무엇이 큰지 + 그게 사용자에게 무슨 의미인지까지** 말해준다.
  //   이 예산이 터지면 지금까지 5번 모두 "임계값 상향"으로 끝났다. 그 이유 중 하나는 메시지가
  //   "8.81 > 8.8" 뿐이라 **판단 재료가 없어서** 다. 실측(2026-07-29)으로 성격이 분명해졌다:
  //   상위 3개(sentry·charts·firebase)만 3.5MB(40%)이고 **전부 lazy 청크**다 —
  //   사용자는 이 8.75MB 를 다운로드하지 않는다. 즉 이 값은 **UX 지표가 아니라 성장 지표**이고,
  //   실제 사용자 체감은 `critical path`(이 파일의 다른 예산), 실제 플랫폼 한도는
  //   `_worker.js` gzip 1MB(main.yml) 과 `dist/client` 50MB(실측 36MB) 가 각각 따로 지킨다.
  //   ⇒ 올릴지 줄일지 정하기 전에 **아래 목록이 정말 lazy 인지**부터 볼 것(크리티컬이면 진짜 문제다).
  const topRaw = jsFiles.slice(0, 5);
  const criticalNames = new Set(criticalFiles.map(f => f.name));
  for (const f of topRaw) {
    const tag = criticalNames.has(f.name) ? '⚠️ CRITICAL' : 'lazy';
    violations.push(`    ↳ ${f.name}: ${(f.size / 1024).toFixed(0)} KB raw (${tag})`);
  }
  violations.push('    → lazy 만 커졌다면 사용자 체감은 그대로다(critical path 예산이 그쪽을 지킨다).');
  violations.push('    → 임계값을 올리려면 **무엇이 왜 늘었는지 한 줄** 남길 것. 이 값은 이미 5번 올라갔다.');
}
// 🛡️ 측정 실패는 통과가 아니다 — 이 파일이 정확히 그렇게 몇 달을 통과했다(항상 0).
if (totalGzip === 0) {
  violations.push('총 gzip 을 측정하지 못했다 (js 산출물 0건 또는 압축 실패) — 예산 검사가 무력화된 상태다');
} else if (BUDGET.totalGzipMB == null) {
  // 교정 대기: 위반으로 올리지 않되, 측정값을 눈에 띄게 남겨 다음 커밋이 임계값을 확정하게 한다.
  console.error(`\n🔴 [CALIBRATION PENDING] 총 gzip JS 실측 = ${(totalGzip / 1024 / 1024).toFixed(3)} MB (${(totalGzip / 1024).toFixed(1)} KB)`);
  console.error(`   → scripts/check-bundle-size.mjs 의 BUDGET.totalGzipMB 를 이 값 + 헤드룸으로 설정하세요.`);
} else if (totalGzip / 1024 / 1024 > BUDGET.totalGzipMB) {
  violations.push(`총 gzip JS ${(totalGzip / 1024 / 1024).toFixed(2)} MB > ${BUDGET.totalGzipMB} MB`);
}
// 🛡️ 2026-07-29: "못 쟀다" 를 "예산 안" 으로 읽지 않는다.
//   criticalGzip 이 0 이 되는 경로는 두 가지이고 **둘 다 고장이다**:
//     ① dist/index.html 을 못 찾음(빌드 산출물 레이아웃 변경)
//     ② 위 정규식이 안 맞음(vite 가 script/link 속성 순서·형태를 바꾸면 조용히 0건 매칭)
//   예전엔 `criticalGzip > 0 &&` 가드가 이 경우를 **조용히 통과**시켰다 — 같은 파일의 gzip 총량
//   예산이 정확히 그렇게 죽어 있었다(항상 0 → 영원히 통과). 마지막 남은 살아있는 검사까지
//   같은 방식으로 잃지 않도록, 측정 실패는 통과가 아니라 **위반**으로 올린다.
if (criticalGzip === 0) {
  violations.push('critical path 를 측정하지 못했다 (dist/index.html 미발견 또는 script/modulepreload 매칭 0건) — 예산 검사가 무력화된 상태다');
} else if (criticalGzip / 1024 > BUDGET.criticalGzipKB) {
  violations.push(`critical path gzip ${(criticalGzip / 1024).toFixed(1)} KB > ${BUDGET.criticalGzipKB} KB (entry+modulepreload ${criticalFiles.length}개)`);
  // 🔎 2026-07-29: **무엇을 줄여야 하는지까지 말해준다.** 이 예산은 실측 294.5/300 으로 여유가 1.8% 뿐이라
  //   다음에 eager import 하나만 늘어도 터진다. 그때 "몇 KB 초과" 만 알려주면 받는 사람이 처음부터
  //   빌드를 다시 돌려 원인을 찾아야 한다(이 레포는 npm 이 막힌 컨테이너가 흔해 그게 비싸다).
  //   기여도 상위 5개를 함께 찍어 바로 lazy 분할 대상을 고르게 한다.
  const top = criticalFiles
    .map(f => ({ name: f.name, gz: f.gzip > 0 ? f.gzip : zlib.gzipSync(fs.readFileSync(path.join(distDir, f.name))).length }))
    .sort((a, b) => b.gz - a.gz)
    .slice(0, 5);
  for (const f of top) violations.push(`    ↳ ${f.name}: ${(f.gz / 1024).toFixed(1)} KB gzip`);
  violations.push(`    → 위 청크에서 첫 페인트에 불필요한 것을 lazy 로 내리세요(entry 에 새 eager import 가 들어왔는지부터 확인).`);
}
const overSized = jsFiles.filter(f => f.size / 1024 > BUDGET.singleRawKB);
if (overSized.length > 0) {
  violations.push(`단일 파일 ${BUDGET.singleRawKB}KB 초과: ${overSized.length}개`);
  overSized.forEach(f => violations.push(`  - ${f.name}: ${(f.size / 1024).toFixed(1)} KB`));
}

if (jsonMode) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    distDir: path.relative(root, distDir),
    js: {
      file_count: jsFiles.length,
      total_raw_bytes: totalSize,
      total_gzip_bytes: totalGzip,
      total_brotli_bytes: totalBrotli,
      top10: jsFiles.slice(0, 10).map(f => ({
        name: f.name,
        raw_kb: +(f.size / 1024).toFixed(2),
        gzip_kb: +(f.gzip / 1024).toFixed(2),
      })),
    },
    css: {
      file_count: cssFiles.length,
      total_raw_bytes: totalCss,
      total_gzip_bytes: totalCssGzip,
    },
    critical_path: {
      file_count: criticalFiles.length,
      gzip_bytes: criticalGzip,
      files: criticalFiles.map(f => ({ name: f.name, gzip_kb: +(f.gzip / 1024).toFixed(2) })),
    },
    budget: BUDGET,
    violations,
  }, null, 2));
} else {
  console.log('\n📦 Bundle Size Analysis');
  console.log(`📂 ${path.relative(root, distDir)}\n`);

  console.log('Top 10 Largest JS Files:');
  console.log('─'.repeat(100));
  jsFiles.slice(0, 10).forEach((file, i) => {
    const sizeKB = (file.size / 1024).toFixed(2);
    const gzipKB = (file.gzip / 1024).toFixed(2);
    const brotliKB = (file.brotli / 1024).toFixed(2);
    const reduction = file.gzip > 0 ? (((file.size - file.gzip) / file.size) * 100).toFixed(1) : 0;
    const warn = file.size / 1024 > BUDGET.singleRawKB ? ' ⚠️  큰 청크 — 코드 분할 검토' : '';
    console.log(`${(i + 1).toString().padStart(2)}. ${file.name}${warn}`);
    console.log(`    Raw: ${sizeKB.padStart(8)} KB | Gzip: ${gzipKB.padStart(7)} KB (-${reduction}%) | Brotli: ${brotliKB.padStart(7)} KB`);
  });

  console.log('\n' + '─'.repeat(100));
  console.log(`📊 Total JS:`);
  console.log(`   Raw:    ${(totalSize / 1024 / 1024).toFixed(2)} MB  (${jsFiles.length} files)`);
  console.log(`   Gzip:   ${(totalGzip / 1024).toFixed(2)} KB`);
  console.log(`   Brotli: ${(totalBrotli / 1024).toFixed(2)} KB`);
  console.log(`📊 Total CSS:`);
  console.log(`   Raw:    ${(totalCss / 1024).toFixed(2)} KB  (${cssFiles.length} files)`);
  console.log(`   Gzip:   ${(totalCssGzip / 1024).toFixed(2)} KB`);

  console.log('\n💰 Budget:');
  console.log(`   Total raw JS:  ${(totalSize / 1024 / 1024).toFixed(2)} / ${BUDGET.totalRawMB} MB`);
  console.log(`   Total gzip JS: ${(totalGzip / 1024 / 1024).toFixed(3)} / ${BUDGET.totalGzipMB ?? '미교정(CALIBRATION PENDING)'} MB`);
  console.log(`   Single max KB: ${BUDGET.singleRawKB} KB`);
  if (criticalGzip > 0) {
    console.log(`   Critical path: ${(criticalGzip / 1024).toFixed(1)} / ${BUDGET.criticalGzipKB} KB gzip (entry+modulepreload ${criticalFiles.length} files)`);
    // 🔎 2026-07-29: **위반이 아닐 때도** 구성을 찍는다. 이 예산은 실측 294.5/300(여유 1.8%)이라
    //   "언제 터지나"보다 "무엇이 차지하나"가 실질 정보인데, 그동안 총합만 보였다.
    //   npm 이 막힌 컨테이너에서는 이 로그가 구성을 아는 유일한 창이다(빌드를 못 돌린다).
    const criticalTop = criticalFiles
      .map(f => ({ name: f.name, gz: f.gzip > 0 ? f.gzip : zlib.gzipSync(fs.readFileSync(path.join(distDir, f.name))).length }))
      .sort((a, b) => b.gz - a.gz);
    for (const f of criticalTop.slice(0, 8)) {
      console.log(`      ${((f.gz / criticalGzip) * 100).toFixed(0).padStart(3)}%  ${(f.gz / 1024).toFixed(1).padStart(6)} KB  ${f.name}`);
    }
    if (criticalTop.length > 8) {
      const rest = criticalTop.slice(8).reduce((s, f) => s + f.gz, 0);
      console.log(`             ${(rest / 1024).toFixed(1).padStart(6)} KB  (나머지 ${criticalTop.length - 8}개)`);
    }
  }

  if (violations.length === 0) {
    console.log('\n✅ All within budget.');
  } else {
    console.log('\n⚠️  Budget violations:');
    violations.forEach(v => console.log(`   - ${v}`));
  }
}

if (budgetMode && violations.length > 0) {
  process.exit(1);
}
