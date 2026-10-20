// 매일 게시: Threads 텍스트 1개 + Instagram 이미지 캡션 1개.
// 트랙 비율: data/mix-state.json(주간 자동조정, 범위 내) → 없으면 data/content-mix.json 고정 60/25/15.
import { pickTrackByWeights } from './attribution.mjs';
import { DRY, log, readJson, writeJson, claude, threads, igPublish, fbPagePost, utmLink, productImage, kstNow, THREADS_USER_ID, PARTNER_FACTS } from './lib.mjs';

const schedule = readJson('data/schedule.json', {});
const mix = readJson('data/content-mix.json', { cycle: {}, tracks: {} });
const { products } = readJson('data/products.json', { products: [] });
const posts = readJson('data/posts.json', []);
const now = new Date();
const k = kstNow(now);
const today = k.toISOString().slice(0, 10);
// KST 날짜 기준 일 인덱스 (UTC 기준이면 KST 09:00에 슬롯/트랙이 바뀜)
const dayIdx = Math.floor(k.getTime() / 86400e3);

// 오늘 게시할 슬롯 결정 (워크플로가 모든 슬롯 시각에 깨우고, 여기서 오늘 슬롯만 통과)
function todaysSlot(platform) {
  const slots = schedule.slots_kst || ['09:00'];
  if (today > (schedule.rotation_until || '') && schedule.best?.[platform]) return schedule.best[platform];
  return slots[dayIdx % slots.length];
}
const nowMin = k.getUTCHours() * 60 + k.getUTCMinutes();
const force = process.env.FORCE === '1' || process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';
// GitHub schedule 은 수 시간씩 지연되므로 정확한 시각 일치 대신 "오늘 슬롯 시각이 지났고 아직 미게시"면 게시
const due = (platform) => {
  if (force) return true;
  const [h, m] = todaysSlot(platform).split(':').map(Number);
  return nowMin >= h * 60 + (m || 0);
};
const postedToday = (platform) => posts.some((p) => p.platform === platform && p.date_kst === today && !p.skipped);
const kstHM = `${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`;
const skipReason = (platform) => postedToday(platform) ? `오늘(${today}) 이미 게시함` : `오늘 슬롯 ${todaysSlot(platform)} KST 전 (현재 ${kstHM} KST)`;

// 20일 주기에서 오늘의 트랙 결정 (기본 12:5:3 = 60/25/15)
export function pickTrack(idx, cycle = mix.cycle) {
  const order = [['merchant', cycle.merchant ?? 12], ['creator', cycle.creator ?? 5], ['consumer', cycle.consumer ?? 3]];
  const total = order.reduce((a, [, w]) => a + w, 0);
  let r = idx % total;
  for (const [name, w] of order) { if (r < w) return name; r -= w; }
  return 'merchant';
}
// 주간 리뷰가 조정한 가중치(data/mix-state.json)가 있으면 그걸로, 없으면 고정 20일 주기
const mixState = readJson('data/mix-state.json', null);
const track = process.env.TRACK || (mixState?.weights ? pickTrackByWeights(dayIdx, mixState.weights) : pickTrack(dayIdx));
const T = mix.tracks?.[track] || {};
const isPromo = track === 'consumer';
const product = products[dayIdx % Math.max(products.length, 1)];
const topics = T.topics || [];
const topic = topics.length ? topics[dayIdx % topics.length] : '';
// 링크 대상: 입점/크리에이터 페이지 (없으면 상품, 그것도 없으면 홈)
const target = { url: T.target || product?.url || 'https://urdeal.kr/' };
const n = (platform) => String(posts.filter((p) => p.platform === platform).length + 1).padStart(3, '0');

const TRACK_GUIDE = {
  merchant: `오늘 독자는 ${T.audience}. 목적은 유어딜 입점을 고민하는 사장님이 "이건 나한테 손해 볼 게 없겠다"를 스스로 판단하게 돕는 고퀄리티 정보 글이다.
오늘 주제: ${topic}
- 사장님이 실제로 겪는 고민(광고비, 노쇼, 체험단, 수수료, 바쁜 시간)에서 시작해 유어딜 구조로 자연스럽게 연결한다.
- 아래 [확인된 사실]에 있는 조건만 쓴다. 매출 증가율, 성공 사례, 방문자 수, "업계 최저", 자동 승인/자동 송금, 트래픽 보장 같은 말은 절대 쓰지 않는다.
- 마지막에 CTA 한 줄: ${T.cta}`,
  creator: `오늘 독자는 ${T.audience}. 목적은 크리에이터가 유어딜 소개 파트너로 함께하고 싶게 만드는 정직한 안내 글이다.
오늘 주제: ${topic}
- 아래 [확인된 사실]에 있는 구조만 설명한다. 월 수익 예시, "누구나 쉽게 N만원" 같은 수익 약속 금지. 소개비율은 매장이 딜마다 정한다는 점을 정확히.
- 마지막에 CTA 한 줄: ${T.cta}`,
  consumer: `오늘은 소비자 딜 글: 아래 상품을 운영자 입장에서 솔직하게 소개한다(왜 골랐는지, 어떤 상황에 좋은지). 주어진 상품 정보 외 가격/할인율은 쓰지 않는다.`,
}[track];

const SYSTEM = `너는 로컬 맛집·뷰티 이용권 서비스 '유어딜'(@urdeal_official)을 직접 운영하는 사람이다. 1인칭 운영자 목소리로, 담백하고 자연스러운 존댓말로 쓴다. 광고 카피 말투(느낌표 남발, "지금 바로!", "놓치지 마세요") 대신 사장님/크리에이터에게 직접 설명하듯 쓴다.
${TRACK_GUIDE}

[확인된 사실 — 이 범위 밖의 조건·숫자는 쓰지 않는다]
${PARTNER_FACTS}

본문만 출력하고 따옴표, 머리말, 해시태그 설명 같은 메타 문장은 쓰지 않는다.`;

let igError = null;
async function main() {
  if (isPromo && !product) { log('상품 없음, 종료'); return; }
  log(`event=${process.env.GITHUB_EVENT_NAME || 'local'} DRY=${DRY} force=${force} KST=${today} ${kstHM} slot(threads)=${todaysSlot('threads')} slot(ig)=${todaysSlot('instagram')}`);
  log(`오늘 트랙: ${track}${topic ? ` / 주제: ${topic.slice(0, 40)}` : ''}`);
  const info = isPromo ? `상품: ${product.name} (${product.url})` : `링크 대상: ${target.url}`;

  // ---- Threads ----
  if (due('threads') && !postedToday('threads')) {
    const cid = `th-${n('threads')}`;
    const link = utmLink(isPromo ? product : target, 'threads', T.campaign || track, cid, now);
    const body = await claude(SYSTEM, `${info}\nThreads 글 1개를 400자 이내로 써줘. 링크는 내가 끝에 붙일게.`, 600);
    const text = `${body.slice(0, 430)}\n\n${link}`.slice(0, 500);
    log('Threads 본문:\n' + text);
    const c = await threads('POST', `${THREADS_USER_ID}/threads`, { media_type: 'TEXT', text });
    const r = await threads('POST', `${THREADS_USER_ID}/threads_publish`, { creation_id: c.id });
    posts.push({ platform: 'threads', id: r.id, content_id: cid, track, promo: isPromo, product_id: isPromo ? product.id : undefined, posted_at: now.toISOString(), date_kst: today, slot_kst: todaysSlot('threads'), link, dry: DRY || undefined });
  } else log(`Threads: 건너뜀 — ${skipReason('threads')}`);

  // ---- Instagram (이미지 필수) ----
  if (due('instagram') && !postedToday('instagram')) {
    const cid = `ig-${n('instagram')}`;
    const link = utmLink(isPromo ? product : target, 'instagram', T.campaign || track, cid, now);
    // 미디어 결정: tracks.<t>.media 배열(캐러셀 images / Reels video_url, 날짜별 순환) → image_url → og:image → 상품 이미지
    const mediaList = (T.media || []).filter((m) => m && (m.video_url || m.images?.length));
    let media = mediaList.length ? mediaList[(process.env.MEDIA_IDX ? Number(process.env.MEDIA_IDX) : dayIdx) % mediaList.length] : null;
    const imgs = [].concat(T.image_url || []).filter(Boolean); // 문자열 또는 배열(날짜별 순환)
    const single = media ? null : (imgs.length ? imgs[dayIdx % imgs.length] : null) || (!isPromo && await productImage(target)) || (product && await productImage(product));
    if (!media && single) media = { images: [single] };
    const image = media?.video_url || media?.images?.[0];
    if (!image) {
      log(`Instagram: ${track} 이미지 URL 없음 → 건너뜀`);
      posts.push({ platform: 'instagram', skipped: 'no_image', track, product_id: product?.id, posted_at: now.toISOString(), date_kst: today });
    } else {
      const body = await claude(SYSTEM, `${info}\n인스타그램 캡션 1개(600자 이내, 해시태그 3~5개 끝에). 본문 링크는 클릭이 안 되니 '프로필 링크에서 확인' 식으로 안내.`, 800);
      log('IG 캡션:\n' + body + `\n(프로필 링크에 걸 UTM: ${link})`);
      const kind = media.video_url ? `Reels ${media.video_url}` : `${media.images.length}장 ${media.images.length > 1 ? '캐러셀' : '이미지'}`;
      log(`IG 미디어: ${kind}`);
      let r;
      try { r = await igPublish(media, body.slice(0, 2100)); }
      catch (e) {
        // 실패해도 Threads 기록은 남기고(중복 게시 방지) 마지막에 run 을 실패시킴
        igError = e;
        console.log(`::error title=Instagram 게시 실패::${e.message}`);
        posts.push({ platform: 'instagram', skipped: 'error', error: e.message.slice(0, 300), track, posted_at: now.toISOString(), date_kst: today });
      }
      if (r) {
      posts.push({ platform: 'instagram', id: r.id, media_type: r.media_type, media_set: media.set, content_id: cid, track, promo: isPromo, product_id: isPromo ? product.id : undefined, posted_at: now.toISOString(), date_kst: today, slot_kst: todaysSlot('instagram'), bio_link: link, dry: DRY || undefined });
      // ---- Facebook 페이지 (IG 게시 시 같은 미디어/캡션 + 링크; 멀티포토·영상 실패 시 단일 이미지) ----
      const fcid = `fb-${n('facebook')}`;
      const flink = utmLink(isPromo ? product : target, 'facebook', T.campaign || track, fcid, now);
      try {
        const f = await fbPagePost(body.slice(0, 2100), flink, { ...media, fallback_image: imgs[0] });
        if (!f) log('Facebook: META_FB_PAGE_TOKEN 없음 → 건너뜀');
        else posts.push({ platform: 'facebook', id: f.post_id || f.id, content_id: fcid, track, promo: isPromo, product_id: isPromo ? product.id : undefined, posted_at: now.toISOString(), date_kst: today, slot_kst: todaysSlot('instagram'), link: flink, dry: DRY || undefined });
      } catch (e) { log(`Facebook 게시 실패: ${e.message}`); }
      }
    }
  } else log(`Instagram: 건너뜀 — ${skipReason('instagram')}`);

  if (!DRY) writeJson('data/posts.json', posts);
  else log('DRY: posts.json 미기록', JSON.stringify(posts.slice(-2)).slice(0, 300));
  if (igError) throw new Error(`Instagram 게시 실패: ${igError.message}`);
}
main().catch((e) => { console.log(`::error::${e.message}`); console.error(e.message); process.exit(1); });
