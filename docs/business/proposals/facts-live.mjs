// 📄 소개서 라이브 숫자 (2026-11-02 대표 "제안서는 계속 자동 업데이트가 안돼" → "가장 이상적으로")
//
// 덱의 숫자 중 **라이브에서 재는 것**(판매 중 이용권 · 실제 매장 · 카테고리 평균 판매가 · 셈법 예시 상품)은
// 손으로 적지 않는다. 빌드 전에 `node facts-live.mjs fetch` 가 서버(`/api/public/proposal-facts`)에서 받아
// `facts.live.json`(추적 안 함)에 쓰고, `deck-common.mjs` 가 그 파일을 FACTS 에 합친다.
//   정의 SSOT: src/shared/proposal-live-facts.ts (워커가 같은 파일로 계산한다)
//
// 🔴 파일이 없으면 **빌드가 멈춘다** — 옛 숫자로 조용히 뽑는 것이 이 파일이 막으려는 사고다.
//    (오프라인에서 모양만 보려면 `node facts-live.mjs sample` 이 2026-11-02 실측값으로 파일을 만든다 —
//     그렇게 만든 파일은 `source: 'sample'` 이라 워크플로가 업로드를 거부한다.)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
export const LIVE_FILE = path.join(DIR, 'facts.live.json');
export const FACTS_URL = process.env.PROPOSAL_FACTS_URL || 'https://urdeal.kr/api/public/proposal-facts';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 urdeal-deck-build';

const won = (n) => `${Math.round(n).toLocaleString('en-US')}원`;

/** 서버 응답(data) → 덱이 쓰는 FACTS 키. 순수 — 시험이 돌린다. */
export function formatLiveFacts(d, { feePct = 10 } = {}) {
  const need = (v, k) => {
    if (v == null || Number.isNaN(v)) throw new Error(`소개서 라이브 숫자에 ${k} 가 없다 — 서버 응답을 확인할 것`);
    return v;
  };
  const a = d.avg || {};
  const avgNums = { meal: need(a.meal, 'avg.meal'), beauty: need(a.beauty, 'avg.beauty'), stay: need(a.stay, 'avg.stay'), etc: need(a.etc, 'avg.etc') };
  const s = need(d.sample, 'sample');
  const fee = Math.round(s.price * feePct / 100);
  return {
    catalogMeasuredAt: need(d.measuredAt, 'measuredAt'),
    activeVouchers: String(need(d.activeVouchers, 'activeVouchers')),
    realStores: String(need(d.realStores, 'realStores')),
    avgMeal: won(avgNums.meal), avgStay: won(avgNums.stay), avgBeauty: won(avgNums.beauty), avgEtc: won(avgNums.etc),
    avgNums,
    sampleName: s.name, sampleOrig: won(s.orig), samplePrice: won(s.price),
    sampleFee: `−${won(fee)}`, sampleNet: won(s.price - fee),
    sampleOrigNum: s.orig, samplePriceNum: s.price,
  };
}

/** `facts.live.json` 을 읽는다. 없으면 멈춘다(옛 숫자로 조용히 뽑지 않는다). */
export function readLive() {
  if (!fs.existsSync(LIVE_FILE)) {
    throw new Error(`facts.live.json 이 없다 — 먼저 \`node ${path.relative(process.cwd(), path.join(DIR, 'facts-live.mjs'))} fetch\` (소개서 숫자는 라이브에서 읽는다)`);
  }
  return JSON.parse(fs.readFileSync(LIVE_FILE, 'utf8'));
}

/** 2026-11-02 실측 — 오프라인 미리보기 전용(`source: 'sample'` 은 업로드되지 않는다). */
export const SAMPLE_LIVE = {
  measuredAt: '2026-11-02', activeVouchers: 160, realStores: 2,
  avg: { meal: 33724, beauty: 42683, stay: 147800, etc: 38598 },
  sample: { id: 2915, name: '프리미엄 돈가스 1인 세트', orig: 14500, price: 7500 }, sampleMoved: false,
  flags: { brokerShareEnabled: false, payoutRequiresVoucherUse: true, feeChannelRatesEnabled: true },
  influencerPayoutMin: 100000,
};

async function main() {
  const cmd = process.argv[2];
  if (cmd === 'sample') {
    fs.writeFileSync(LIVE_FILE, JSON.stringify({ source: 'sample', fetchedAt: new Date().toISOString(), data: SAMPLE_LIVE }, null, 2) + '\n');
    console.log(`⚠️ 미리보기용 실측 사본(2026-11-02)을 썼다 — 업로드 금지: ${LIVE_FILE}`);
    return;
  }
  if (cmd !== 'fetch') {
    console.error('사용: node facts-live.mjs fetch   (또는 sample — 오프라인 미리보기)');
    process.exit(2);
  }
  const res = await fetch(FACTS_URL + `?t=${Date.now()}`, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success || !body.data) {
    console.error(`❌ 소개서 라이브 숫자를 못 받았다: HTTP ${res.status} · ${JSON.stringify(body)?.slice(0, 200)}`);
    process.exit(1);
  }
  formatLiveFacts(body.data); // 모양을 여기서 검사한다(빌드 도중 터지지 않게)
  fs.writeFileSync(LIVE_FILE, JSON.stringify({ source: FACTS_URL, fetchedAt: new Date().toISOString(), data: body.data }, null, 2) + '\n');
  const d = body.data;
  console.log(`✅ 라이브 숫자 ${d.measuredAt}: 판매 중 이용권 ${d.activeVouchers} · 실제 매장 ${d.realStores} · 식사 평균 ${d.avg.meal}원`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
