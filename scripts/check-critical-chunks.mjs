#!/usr/bin/env node
/**
 * critical path 청크 구성 동결 (래칫)
 *
 * ## 왜 있나 — 총합 예산은 **후행** 감지기다
 *
 * `check-bundle-size.mjs` 의 critical path 예산은 **총합이 임계값을 넘어야** 울린다.
 * 그래서 "청크 하나가 통째로 크리티컬 패스에 새로 들어왔다" 같은 **구조 변화**는
 * 예산에 여유가 있는 동안 조용히 지나가고, 나중에 무관한 PR 이 총합에 걸려 막힌다.
 * 이 레포에서 실제로 **세 번 반복**된 패턴이다:
 *   - 2026-05-24 app-components 에서 live/streaming 분리 (−248KB)
 *   - 2026-05-27 seller/cart/search/… 추가 분리 (−305KB)
 *   - 2026-07-29 그런데도 app-components 가 다시 20% (58.8KB) 를 먹고 있었다
 *     → 76 모듈 중 엔트리가 eager 로 쓰는 건 14 개뿐, 62 개(280KB)가 얹혀 가고 있었다.
 *
 * 이 가드는 **총합이 아니라 구성**을 본다: index.html 의
 * entry `<script type="module">` + `<link rel="modulepreload">` 에 등장하는 **청크 이름 집합**을
 * 동결하고, **새 이름이 들어오면 실패**한다. 그러면 "무엇이 크리티컬로 새로 들어왔는지"를
 * 바이트가 아니라 **이름으로** 즉시 알 수 있다(예산이 터지기 한참 전에).
 *
 * ## 판정
 *   - 새 청크 등장  → ❌ 위반 (eager import 가 청크를 끌고 들어왔다)
 *   - 청크 사라짐   → ✅ 개선. 실패시키지 않고 rebaseline 을 안내한다(줄이는 건 언제나 OK).
 *   - 측정 0건      → ❌ 위반. **"못 쟀다"를 "예산 안"으로 읽지 않는다** —
 *                      같은 레포의 gzip 예산이 정확히 그렇게 몇 달을 통과했다(항상 0).
 *
 * ## 사용
 *   node scripts/check-critical-chunks.mjs              # 검사 (빌드 산출물 필요)
 *   node scripts/check-critical-chunks.mjs --rebaseline # 현재 구성을 새 기준으로 동결
 *
 * ⚠️ 반드시 **빌드 후** 실행. 빌드 산출물이 없으면 검사할 수 없으므로 명시적으로 SKIP 을
 *    출력하고 exit 0 한다(조용한 통과가 아니라 눈에 보이는 통지 — 이 가드의 상주 실행
 *    지점은 `verify.yml` 의 build 직후라 거기선 항상 실측된다).
 *
 * ## 이 가드가 못 잡는 것
 *   - 이미 크리티컬인 청크가 **내부에서 커지는 것**(이름은 그대로) → 그건 총합 예산의 몫이다.
 *     둘은 짝이다: 이 가드는 *구성 변화*, check-bundle-size 는 *총량*.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const rebaseline = process.argv.includes('--rebaseline');

const indexHtmlPath = [
  path.join(root, 'dist/client/index.html'),
  path.join(root, 'dist/index.html'),
].find(p => fs.existsSync(p));

if (!indexHtmlPath) {
  console.log('⏭️  critical-chunks: SKIP — 빌드 산출물 없음 (npm run build:client 후 실행).');
  console.log('   (상주 실행 지점은 verify.yml 의 build 직후 — 거기선 항상 실측된다.)');
  process.exit(0);
}

const html = fs.readFileSync(indexHtmlPath, 'utf8');

// entry script + modulepreload — check-bundle-size.mjs 와 **같은 정의**를 쓴다.
//   (두 가드가 서로 다른 집합을 보면 한쪽이 초록인데 다른 쪽이 빨강인 혼란이 생긴다.)
const refs = new Set();
for (const m of html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+\.js)"/g)) refs.add(m[1]);
for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g)) refs.add(m[1]);

// 파일명에서 vite 해시를 떼어 청크 '이름' 으로. 예: app-shell-XiMXWTsJ.js → app-shell
const chunkName = (file) => file.split('/').pop().replace(/-[A-Za-z0-9_-]{8}\.js$/, '').replace(/\.js$/, '');
const found = [...new Set([...refs].map(chunkName))].sort();

if (found.length === 0) {
  console.error('❌ critical-chunks: index.html 에서 entry/modulepreload 를 하나도 못 찾았다.');
  console.error('   빌드 산출물 레이아웃이 바뀌었거나 vite 가 script/link 형태를 바꾼 것이다.');
  console.error('   → 이 가드가 무력화된 상태다. 정규식을 고칠 것(측정 실패는 통과가 아니다).');
  process.exit(1);
}

const baselinePath = path.join(__dirname, 'critical-chunks-baseline.json');

if (rebaseline) {
  const prev = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')) : {};
  fs.writeFileSync(baselinePath, JSON.stringify({
    _comment: prev._comment ?? 'index.html 의 entry/modulepreload 에 등장해도 되는 청크 이름(해시 제외).',
    _measured: `rebaselined · ${found.length} chunks`,
    chunks: found,
  }, null, 2) + '\n');
  console.log(`✅ critical-chunks: 기준 갱신 — ${found.length}개\n   ${found.join(', ')}`);
  console.log('   ⚠️ _measured 에 "언제/무엇 때문에" 를 한 줄 적어 두면 다음 세션이 판단할 수 있다.');
  process.exit(0);
}

if (!fs.existsSync(baselinePath)) {
  console.error('❌ critical-chunks: baseline 파일이 없다 → node scripts/check-critical-chunks.mjs --rebaseline');
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8')).chunks ?? [];
const allowed = new Set(baseline);
const added = found.filter(c => !allowed.has(c));
const removed = baseline.filter(c => !found.includes(c));

if (removed.length > 0) {
  // 줄어든 건 개선이다 — 실패시키지 않는다.
  console.log(`ℹ️  critical-chunks: 크리티컬에서 빠진 청크 ${removed.length}개 — ${removed.join(', ')}`);
  console.log('   개선이다. 기준을 조이려면: node scripts/check-critical-chunks.mjs --rebaseline');
}

if (added.length > 0) {
  console.error(`\n❌ critical-chunks: 크리티컬 패스에 새 청크 ${added.length}개 진입`);
  for (const c of added) console.error(`   + ${c}`);
  console.error('\n   원인은 대개 **엔트리(main.tsx/App.tsx)에 새로 생긴 정적 import** 다.');
  console.error('   그 import 가 청크 하나를 통째로 첫 페인트로 끌고 온다 — 총합 예산이 울리기 전에 잡는 게 이 가드의 목적.');
  console.error('   조치 ① 정말 첫 페인트에 필요한가? 아니면 lazy(dynamic import)로 내릴 것.');
  console.error('        ② 필요한 일부만 쓰는 거라면 vite.config manualChunks 에서 그 부분만 분리(app-shell 허용목록 참고).');
  console.error('        ③ 의도적으로 늘리는 것이라면 --rebaseline 후 _measured 에 이유를 남길 것.');
  process.exit(1);
}

console.log(`✅ critical-chunks: ${found.length}개 — 기준과 동일 (신규 진입 0)`);
