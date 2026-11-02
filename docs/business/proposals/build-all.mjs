// 📄 소개서 다섯 개를 한 번에 — 라이브 숫자로 만들고, PDF 로 바꾸고, 기록(manifest.json)을 남긴다 (2026-11-02)
//
// 대표 "제안서는 계속 자동 업데이트가 안돼" → "응 진행해줘. 가장 이상적으로."
// 워크플로 `.github/workflows/proposals.yml` 이 매일 + 소개서 원본이 바뀔 때 돌린다. 손으로도:
//   node facts-live.mjs fetch && node build-all.mjs
//
// 하는 일
//   1. 덱 다섯 개를 out/ 에 만든다(숫자는 facts.live.json — deck-common.mjs 가 합친다)
//   2. LibreOffice 로 PDF 를 만들고 쪽수를 센다 — 어드민 화면이 적어 둔 장수와 다르면 **실패**
//   3. "덱이 말하는 것 ↔ 지금 설정" 을 대조한다(CLAIMS). 어긋나면 **경고**로 manifest 에 남기고 어드민이 빨갛게 보여 준다.
//      ⚠️ 문장(설명)을 자동으로 고치지는 않는다 — 대외 문서의 말은 대표가 정한다. 대신 *어긋났다는 사실*은 숨기지 않는다.
//   4. out/manifest.json — 언제 · 어느 커밋 · 어떤 숫자로 만들었는지 + 경고
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readLive } from './facts-live.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '../../..');
const OUT = path.join(DIR, 'out');

export const DECKS = [
  'urdeal-store-owner-deck',
  'urdeal-store-owner-deck-detail',
  'urdeal-merchant-association-deck',
  'urdeal-influencer-deck',
  'urdeal-agency-proposal',
];

/**
 * 덱 문장이 기대는 설정. `holds(facts)` 가 거짓이면 그 덱들이 지금 사실과 다른 말을 하고 있다.
 * 새 약속을 덱에 쓰면 여기에 한 줄 더한다(그래야 스위치가 꺼졌을 때 누가 알려 준다).
 */
export const CLAIMS = [
  {
    id: 'broker-share-payout',
    decks: ['urdeal-agency-proposal', 'urdeal-influencer-deck', 'urdeal-merchant-association-deck'],
    says: '귀사(중개) 몫을 유어딜이 직접 보낸다',
    // 옛 경로(broker_share — 2026-10-13 결재로 OFF) 또는 새 경로(agency_share_payout — 2026-11-01, 기본 OFF) 중 하나라도 켜져야 참.
    holds: (f) => f.flags?.brokerShareEnabled === true || f.flags?.agencySharePayoutEnabled === true,
    setting: 'broker_share_enabled · agency_share_payout_enabled',
  },
  {
    id: 'payout-after-use',
    decks: ['urdeal-influencer-deck', 'urdeal-agency-proposal'],
    says: '정산(지급)은 이용권을 사용한 뒤에 확정된다',
    holds: (f) => f.flags?.payoutRequiresVoucherUse === true,
    setting: 'payout_requires_voucher_use',
  },
  {
    id: 'two-fee-rates',
    decks: DECKS,
    says: '직접 입점 10% / 중개 5% 두 요율',
    holds: (f) => f.flags?.feeChannelRatesEnabled === true,
    setting: 'fee_channel_rates_enabled',
  },
  {
    id: 'sample-still-selling',
    decks: ['urdeal-store-owner-deck', 'urdeal-store-owner-deck-detail', 'urdeal-merchant-association-deck'],
    says: '셈법 예시가 "지금 팔리는 실제 상품" 이다',
    holds: (f) => f.sample != null && f.sampleMoved !== true,
    setting: `예시 상품(앵커 id) — src/shared/proposal-live-facts.ts`,
  },
];

/** 순수 — 경고 목록. 시험이 돌린다. */
export function claimWarnings(facts) {
  return CLAIMS.filter((c) => !c.holds(facts)).map((c) => ({
    id: c.id,
    decks: c.decks,
    message: `덱이 "${c.says}" 라고 말하는데 지금 설정(${c.setting})은 그렇지 않다 — 문장을 고치거나 설정을 확인할 것`,
  }));
}

/** 어드민 화면이 적어 둔 장수 — 화면과 PDF 가 갈리면 실패한다(종전 시험 R5 와 같은 대조). */
export function expectedSlides(pageSource) {
  const out = {};
  for (const m of pageSource.matchAll(/url:\s*'\/static\/proposals\/([a-z0-9-]+)\.pdf'[\s\S]{0,600}?slides:\s*(\d+)/g)) out[m[1]] = Number(m[2]);
  return out;
}

/** PDF 쪽수 — 바깥 도구 없이 바이트에서 센다(`/Type /Pages` 는 페이지 트리라 뺀다). */
export function pdfPageCount(buf) {
  return (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
}

function git(args) {
  try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return ''; }
}

async function main() {
  const live = readLive();
  if (live.source === 'sample' && process.env.CI) {
    console.error('❌ facts.live.json 이 미리보기 사본이다(source: sample) — CI 에서는 라이브 숫자로만 만든다.');
    process.exit(1);
  }
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const expected = expectedSlides(fs.readFileSync(path.join(ROOT, 'src/pages/admin/AdminProposalsPage.tsx'), 'utf8'));
  const decks = [];
  const failures = [];
  for (const name of DECKS) {
    const pptx = path.join(OUT, `${name}.pptx`);
    const pdf = path.join(OUT, `${name}.pdf`);
    execFileSync('node', [path.join(DIR, `${name}.build.mjs`), pptx], { cwd: DIR, stdio: 'inherit' });
    execFileSync('python3', [path.join(DIR, 'export-pptx-to-pdf.py'), pptx, pdf], { cwd: DIR, stdio: 'inherit', timeout: 300_000 });
    const pages = pdfPageCount(fs.readFileSync(pdf));
    if (expected[name] == null) failures.push(`${name}: 어드민 화면(AdminProposalsPage)에 이 덱이 없다`);
    else if (pages !== expected[name]) failures.push(`${name}: PDF ${pages}쪽 ≠ 화면 표기 ${expected[name]}장`);
    decks.push({ name, pdf: `${name}.pdf`, pptx: `${name}.pptx`, pages, pdfBytes: fs.statSync(pdf).size });
  }
  if (failures.length) {
    console.error('❌ 쪽수가 어드민 화면 표기와 다르다:\n   · ' + failures.join('\n   · '));
    process.exit(1);
  }
  const warnings = claimWarnings(live.data);
  const now = new Date();
  const manifest = {
    builtAt: now.toISOString(),
    commit: process.env.GITHUB_SHA || git(['rev-parse', 'HEAD']),
    factsSource: live.source,
    factsFetchedAt: live.fetchedAt,
    facts: live.data,
    decks,
    warnings,
  };
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`✅ 덱 ${decks.length}개 · 숫자 기준 ${live.data.measuredAt} · 경고 ${warnings.length}건`);
  for (const w of warnings) console.log(`   ⚠️ ${w.message} (${w.decks.join(', ')})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
