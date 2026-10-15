// 매일 게시: Threads 텍스트 1개 + Instagram 이미지 캡션 1개. 70% 유용/공감, 30% 딜 홍보.
import { DRY, log, readJson, writeJson, claude, threads, insta, utmLink, productImage, kstNow, IG_USER_ID, THREADS_USER_ID } from './lib.mjs';

const schedule = readJson('data/schedule.json', {});
const { products } = readJson('data/products.json', { products: [] });
const posts = readJson('data/posts.json', []);
const now = new Date();
const k = kstNow(now);
const today = k.toISOString().slice(0, 10);
const dayIdx = Math.floor(now.getTime() / 86400e3);

// 오늘 게시할 슬롯 결정 (워크플로가 모든 슬롯 시각에 깨우고, 여기서 오늘 슬롯만 통과)
function todaysSlot(platform) {
  const slots = schedule.slots_kst || ['09:00'];
  if (today > (schedule.rotation_until || '') && schedule.best?.[platform]) return schedule.best[platform];
  return slots[dayIdx % slots.length];
}
const nowHour = k.getUTCHours();
const force = process.env.FORCE === '1' || process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';
const due = (platform) => {
  if (force) return true;
  const slotHour = Number(todaysSlot(platform).split(':')[0]);
  return Math.abs(nowHour - slotHour) <= 1; // cron 지연 허용
};
const postedToday = (platform) => posts.some((p) => p.platform === platform && p.date_kst === today && !p.skipped);

const isPromo = dayIdx % 10 < 3; // 10일 중 3일 = 30% 홍보
const product = products[dayIdx % Math.max(products.length, 1)];
const n = (platform) => String(posts.filter((p) => p.platform === platform).length + 1).padStart(3, '0');

const SYSTEM = `너는 로컬 맛집 이용권 딜 서비스 '유어딜'(@urdeal_official)을 직접 운영하는 사람이다. 1인칭 운영자 목소리로, 담백하고 자연스러운 한국어 반말 섞인 존댓말 톤으로 쓴다.
${isPromo ? '오늘은 홍보 글: 아래 상품을 운영자 입장에서 솔직하게 소개한다(왜 골랐는지, 어떤 상황에 좋은지).' : '오늘은 유용/공감 글: 외식, 동네 맛집 고르는 팁, 혼밥/모임 메뉴 고민, 작은 가게 운영 비하인드 등. 상품 홍보는 마지막 한 줄 이하로 아주 가볍게만 하거나 생략.'}
본문만 출력하고 따옴표, 머리말, 해시태그 설명 같은 메타 문장은 쓰지 않는다.`;

async function main() {
  if (!product) { log('상품 없음, 종료'); return; }
  const info = `상품: ${product.name} (${product.url})`;

  // ---- Threads ----
  if (due('threads') && !postedToday('threads')) {
    const cid = `th-${n('threads')}`;
    const link = utmLink(product, 'threads', isPromo ? 'todaydeal' : 'daily', cid, now);
    const body = await claude(SYSTEM, `${info}\nThreads 글 1개를 400자 이내로 써줘. 링크는 내가 끝에 붙일게.`, 600);
    const text = `${body.slice(0, 430)}\n\n${link}`.slice(0, 500);
    log('Threads 본문:\n' + text);
    const c = await threads('POST', `${THREADS_USER_ID}/threads`, { media_type: 'TEXT', text });
    const r = await threads('POST', `${THREADS_USER_ID}/threads_publish`, { creation_id: c.id });
    posts.push({ platform: 'threads', id: r.id, content_id: cid, promo: isPromo, product_id: product.id, posted_at: now.toISOString(), date_kst: today, slot_kst: todaysSlot('threads'), link, dry: DRY || undefined });
  } else log('Threads: 지금은 게시 슬롯 아님 또는 이미 게시함');

  // ---- Instagram (이미지 필수) ----
  if (due('instagram') && !postedToday('instagram')) {
    const cid = `ig-${n('instagram')}`;
    const link = utmLink(product, 'instagram', isPromo ? 'todaydeal' : 'daily', cid, now);
    const image = await productImage(product);
    if (!image) {
      log(`Instagram: ${product.name} 이미지 URL 없음 → 건너뜀`);
      posts.push({ platform: 'instagram', skipped: 'no_image', product_id: product.id, posted_at: now.toISOString(), date_kst: today });
    } else {
      const body = await claude(SYSTEM, `${info}\n인스타그램 캡션 1개(600자 이내, 해시태그 3~5개 끝에). 본문 링크는 클릭이 안 되니 '프로필 링크에서 확인' 식으로 안내.`, 800);
      log('IG 캡션:\n' + body + `\n(프로필 링크에 걸 UTM: ${link})`);
      const c = await insta('POST', `${IG_USER_ID}/media`, { image_url: image, caption: body.slice(0, 2100) });
      const r = await insta('POST', `${IG_USER_ID}/media_publish`, { creation_id: c.id });
      posts.push({ platform: 'instagram', id: r.id, content_id: cid, promo: isPromo, product_id: product.id, posted_at: now.toISOString(), date_kst: today, slot_kst: todaysSlot('instagram'), bio_link: link, dry: DRY || undefined });
    }
  } else log('Instagram: 지금은 게시 슬롯 아님 또는 이미 게시함');

  if (!DRY) writeJson('data/posts.json', posts);
  else log('DRY: posts.json 미기록', JSON.stringify(posts.slice(-2)).slice(0, 300));
}
main().catch((e) => { console.error(e.message); process.exit(1); });
