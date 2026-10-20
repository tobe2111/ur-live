// 매주: 인플루언서 후보 + DM 초안을 GitHub 이슈로만 작성. 절대 아무것도 발송하지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readJson, claude, createIssue, PARTNER_FACTS, PARTNER_LINKS , opsAlert } from './lib.mjs';

const { products } = readJson('data/products.json', { products: [] });
let candidates = '';
try { candidates = fs.readFileSync(path.join(ROOT, 'data/influencer-candidates.md'), 'utf8').slice(0, 6000); } catch {}

async function main() {
  const out = await claude(
    `너는 유어딜 운영자를 돕는다. 인플루언서 협업 후보 숏리스트(최대 5명)와 각 후보용 DM 초안을 한국어 마크다운으로 작성한다. 초안은 사장님이 직접 검토 후 수동 발송한다. 협찬임을 명확히 밝히고(광고 표기 안내 포함), 가짜 후기 요청 금지, 유어딜이 금전 광고비를 제안하지 않는다. 핵심 제안은 유어딜 소개 파트너 등록(${PARTNER_LINKS.creator}, 신청 ${PARTNER_LINKS.creatorApply})이며 아래 사실 범위만 설명하고 수익 금액은 약속하지 않는다. 링크는 utm_medium=influencer, utm_content=<계정명> 규칙을 따른다.\n\n[확인된 사실]\n${PARTNER_FACTS} 후보 자료가 없으면 어떤 유형의 계정을 찾아야 하는지 기준만 제시하고 계정명을 지어내지 마라.`,
    `상품: ${products.map((p) => `${p.name} ${p.url}`).join(', ')}\n\n후보 자료:\n${candidates || '(없음)'}`, 2000);
  await createIssue(`[인플루언서 후보·DM 초안] ${new Date().toISOString().slice(0, 10)}`,
    `> 이 이슈는 초안입니다. 봇은 DM 을 보내지 않습니다. 사장님이 검토 후 직접 보내세요.\n\n${out}`, ['marketing-influencer']);
}
main().catch(async (e) => { console.error(e.message); await opsAlert('마케팅 봇 인플루언서 초안 실패', e.message); process.exit(1); });
