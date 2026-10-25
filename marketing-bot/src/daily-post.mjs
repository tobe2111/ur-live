// 매일 게시: Threads 텍스트 1개 + Instagram 이미지 캡션 1개.
// 트랙 비율: data/mix-state.json(주간 자동조정, 범위 내) → 없으면 data/content-mix.json 고정 60/25/15.
import { pickTrackByWeights } from './attribution.mjs';
import { vetPost } from './vet.mjs';
import { pickLeastRecent, rotateImages, pickHook, pickFormat, recentOpeners } from './variety.mjs';
import { DRY, log, readJson, writeJson, claude, humanize, HUMAN_STYLE, threadsText, threadsPublish, igPublish, fbPagePost, utmLink, productImage, kstNow, PARTNER_FACTS , opsAlert } from './lib.mjs';
import { myRecentPosts, postedOn } from './live.mjs';

const schedule = readJson('data/schedule.json', {});
// 다양성(주제·훅·미디어 세트) 순환용 기록. 게시 여부 판정은 live(실물 조회)로만 하므로 posts.json 은 읽지 않는다.
const varietyLog = readJson('data/variety.json', []);
const mix = readJson('data/content-mix.json', { cycle: {}, tracks: {} });
const { products } = readJson('data/products.json', { products: [] });
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
// "오늘 올렸나"는 저장 파일이 아니라 Threads·인스타에 직접 묻는다(live.mjs 머리말 — 저장이 깨져도 안 겹친다).
// 페이스북은 인스타와 함께만 나가므로 인스타 판정을 따른다.
let live = [];
const postedToday = (platform) => postedOn(live, platform, today);
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
// 최근에 안 쓴 주제부터 (같은 트랙 기록 기준)
const topic = process.env.TOPIC || pickLeastRecent(topics, varietyLog.filter((p) => p.track === track), 'topic', (t) => t, dayIdx) || '';
// 오늘의 글 시작 방식·형식 (인스타 기록 기준으로 최근 쓴 훅은 피함)
const hook = pickHook(varietyLog.filter((p) => p.platform === 'instagram'), dayIdx);
const format = pickFormat(dayIdx);
// 링크 대상: 입점/크리에이터 페이지 (없으면 상품, 그것도 없으면 홈)
const target = { url: T.target || product?.url || 'https://urdeal.kr/' };
// 글 id: 하루 한 번이라 날짜로 충분하다(utm_content = <id>-<YYYYMMDD>). 종전엔 posts.json 개수로 매겼다.
const cid = (platform) => ({ threads: 'th', instagram: 'ig', facebook: 'fb' })[platform];

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

const SYSTEM = `너는 로컬 맛집·뷰티 이용권 서비스 '유어딜'(@urdeal_official)을 직접 운영하는 사람이다. 광고 카피가 아니라 사장님/크리에이터에게 직접 설명하듯 쓴다.
${TRACK_GUIDE}

${HUMAN_STYLE}

[확인된 사실 — 이 범위 밖의 조건·숫자는 쓰지 않는다]
${PARTNER_FACTS}

[오늘의 글 시작 방식] ${hook.guide}
[오늘의 분량·형식] ${format}

본문만 출력하고 따옴표, 머리말, 해시태그 설명 같은 메타 문장은 쓰지 않는다.`;

let igError = null;
let qualityError = null;
let threadsError = null;
// 같은 플랫폼 최근 글 10개 — 거의 같은 글 반복 방지
const recentTexts = (platform) => live.filter((p) => p.platform === platform && p.text).slice(-10).map((p) => p.text);

// 쓰기 → 검수 → (걸리면 문제를 알려 주고 한 번 다시 쓰기) → 그래도 걸리면 올리지 않는다
async function writeVetted(prompt, maxTokens, platform, info, kind) {
  const ctx = { facts: `${PARTNER_FACTS}\n${info}`, recent: recentTexts(platform) };
  const openers = recentOpeners(recentTexts(platform));
  if (openers.length) prompt += `\n\n최근 글들은 이렇게 시작했다. 이 문장들과 비슷하게 시작하지 말고, 같은 표현("제일 많이 묻는", "제일 먼저 걱정" 등)도 반복하지 마라:\n- ${openers.join('\n- ')}`;
  // 사람 말투로 다듬은 *최종본*을 검수한다 — 다듬기가 숫자·표현을 바꿀 수 있어서다
  let body = await humanize(await claude(SYSTEM, prompt, maxTokens), kind);
  if (DRY) return { body, problems: [] }; // DRY 샘플 응답은 검수 대상이 아니다
  let problems = vetPost(body, ctx);
  if (problems.length) {
    log(`${platform} 검수 걸림 → 다시 쓰기: ${problems.join(' / ')}`);
    body = await humanize(await claude(SYSTEM, `${prompt}\n\n방금 쓴 글이 아래 문제로 반려됐다. 고쳐서 다시 써라:\n- ${problems.join('\n- ')}`, maxTokens), kind);
    problems = vetPost(body, ctx);
  }
  return { body, problems };
}

const runLog = [];
async function main() {
  // 조회가 실패하면 여기서 멈춘다 — "안 올렸다"로 보고 올리면 같은 글이 두 번 나간다
  live = await myRecentPosts({ days: 14 });
  log(`실물 조회: 최근 14일 Threads ${live.filter((p) => p.platform === 'threads').length} · 인스타 ${live.filter((p) => p.platform === 'instagram').length} (오늘 ${today}: Threads ${postedToday('threads') ? '게시됨' : '없음'} · 인스타 ${postedToday('instagram') ? '게시됨' : '없음'})`);
  if (isPromo && !product) { log('상품 없음, 종료'); return; }
  log(`event=${process.env.GITHUB_EVENT_NAME || 'local'} DRY=${DRY} force=${force} KST=${today} ${kstHM} slot(threads)=${todaysSlot('threads')} slot(ig)=${todaysSlot('instagram')}`);
  log(`오늘 트랙: ${track}${topic ? ` / 주제: ${topic.slice(0, 40)}` : ''}`);
  const info = isPromo ? `상품: ${product.name} (${product.url})` : `링크 대상: ${target.url}`;

  // ---- Threads ----
  if (due('threads') && !postedToday('threads')) {
    const id = cid('threads');
    const link = utmLink(isPromo ? product : target, 'threads', T.campaign || track, id, now);
    const len = ['150~200자', '250~300자', '350~400자'][dayIdx % 3];
    const { body, problems } = await writeVetted(`${info}\nThreads 글 1개를 ${len} 정도로 써줘. 링크는 내가 끝에 붙일게.`, 600, 'threads', info, 'Threads 글');
    if (problems.length) {
      qualityError = qualityError || new Error(`Threads 검수 실패: ${problems.join(' / ')}`);
      console.log(`::error title=Threads 검수 실패 — 게시 안 함::${problems.join(' / ')}`);
      log('반려된 본문:\n' + body);
      runLog.push({ platform: 'threads', skipped: 'quality_failed', problems, track, posted_at: now.toISOString(), date_kst: today });
    } else {
    const text = threadsText(body, link);
    log('Threads 본문:\n' + text);
    let r;
    try {
      r = await threadsPublish({ media_type: 'TEXT', text });
    } catch (e) {
      // Threads 실패가 Instagram 게시까지 막지 않도록 기록만 하고 계속 진행
      threadsError = e;
      console.log(`::error title=Threads 게시 실패::${e.message.slice(0, 300)}`);
      runLog.push({ platform: 'threads', skipped: 'error', error: e.message.slice(0, 300), track, posted_at: now.toISOString(), date_kst: today });
    }
    if (r) runLog.push({ platform: 'threads', id: r.id, content_id: id, track, promo: isPromo, product_id: isPromo ? product.id : undefined, posted_at: now.toISOString(), date_kst: today, slot_kst: todaysSlot('threads'), link, text: body, dry: DRY || undefined });
    }
  } else log(`Threads: 건너뜀 — ${skipReason('threads')}`);

  // ---- Instagram (이미지 필수) ----
  if (due('instagram') && !postedToday('instagram')) {
    const id = cid('instagram');
    const link = utmLink(isPromo ? product : target, 'instagram', T.campaign || track, id, now);
    // 미디어 결정: tracks.<t>.media 배열(캐러셀 images / Reels video_url, 날짜별 순환) → image_url → og:image → 상품 이미지
    const mediaList = (T.media || []).filter((m) => m && (m.video_url || m.images?.length));
    // 같은 세트 반복 방지: 가장 오래 안 쓴 세트를 고르고, 다시 쓰는 세트는 표지(첫 장)를 바꾼다
    const igHist = varietyLog.filter((p) => p.platform === 'instagram');
    const mediaKey = (m) => m.set || m.video_url || m.images[0];
    let media = process.env.MEDIA_IDX ? mediaList[Number(process.env.MEDIA_IDX) % mediaList.length] : pickLeastRecent(mediaList, igHist, 'media_set', mediaKey, dayIdx);
    if (media) {
      const usedTimes = igHist.filter((p) => !p.skipped && p.media_set === mediaKey(media)).length;
      media = { ...media, set: mediaKey(media), images: media.images ? rotateImages(media.images, usedTimes) : media.images };
    }
    const imgs = [].concat(T.image_url || []).filter(Boolean); // 문자열 또는 배열(날짜별 순환)
    const single = media ? null : (imgs.length ? pickLeastRecent(imgs, igHist, 'media_set', (u) => u, dayIdx) : null) || (!isPromo && await productImage(target)) || (product && await productImage(product));
    if (!media && single) media = { images: [single], set: single };
    const image = media?.video_url || media?.images?.[0];
    if (!image) {
      log(`Instagram: ${track} 이미지 URL 없음 → 건너뜀`);
      runLog.push({ platform: 'instagram', skipped: 'no_image', track, product_id: product?.id, posted_at: now.toISOString(), date_kst: today });
    } else {
      const { body, problems } = await writeVetted(`${info}\n인스타그램 캡션 1개(600자 이내, 해시태그 2~4개만 끝에). 본문 링크는 클릭이 안 되니 '프로필 링크에서 확인' 식으로 안내.`, 800, 'instagram', info, '인스타그램 캡션');
      if (problems.length) {
        qualityError = qualityError || new Error(`Instagram 검수 실패: ${problems.join(' / ')}`);
        console.log(`::error title=Instagram 검수 실패 — 게시 안 함::${problems.join(' / ')}`);
        log('반려된 캡션:\n' + body);
        runLog.push({ platform: 'instagram', skipped: 'quality_failed', problems, track, posted_at: now.toISOString(), date_kst: today });
      } else {
      log('IG 캡션:\n' + body + `\n(프로필 링크에 걸 UTM: ${link})`);
      const kind = media.video_url ? `Reels ${media.video_url}` : `${media.images.length}장 ${media.images.length > 1 ? '캐러셀' : '이미지'}`;
      log(`IG 미디어: ${kind}`);
      let r;
      try { r = await igPublish(media, body.slice(0, 2100)); }
      catch (e) {
        // 실패해도 Threads 기록은 남기고(중복 게시 방지) 마지막에 run 을 실패시킴
        igError = e;
        console.log(`::error title=Instagram 게시 실패::${e.message}`);
        runLog.push({ platform: 'instagram', skipped: 'error', error: e.message.slice(0, 300), track, posted_at: now.toISOString(), date_kst: today });
      }
      if (r) {
      runLog.push({ platform: 'instagram', id: r.id, media_type: r.media_type, media_set: media.set, hook: hook.id, topic: topic || undefined, content_id: id, track, promo: isPromo, product_id: isPromo ? product.id : undefined, posted_at: now.toISOString(), date_kst: today, slot_kst: todaysSlot('instagram'), bio_link: link, text: body, dry: DRY || undefined });
      // ---- Facebook 페이지 (IG 게시 시 같은 미디어/캡션 + 링크; 멀티포토·영상 실패 시 단일 이미지) ----
      const fcid = cid('facebook');
      const flink = utmLink(isPromo ? product : target, 'facebook', T.campaign || track, fcid, now);
      try {
        const f = await fbPagePost(body.slice(0, 2100), flink, { ...media, fallback_image: imgs[0] });
        if (!f) log('Facebook: META_FB_PAGE_TOKEN 없음 → 건너뜀');
        else runLog.push({ platform: 'facebook', id: f.post_id || f.id, content_id: fcid, track, promo: isPromo, product_id: isPromo ? product.id : undefined, posted_at: now.toISOString(), date_kst: today, slot_kst: todaysSlot('instagram'), link: flink, dry: DRY || undefined });
      } catch (e) { log(`Facebook 게시 실패: ${e.message}`); }
      }
      }
    }
  } else log(`Instagram: 건너뜀 — ${skipReason('instagram')}`);

  // 기록은 marketing-data 브랜치의 data/posts.json 에 남긴다(주간 리뷰가 트랙·슬롯을 복원하는 로그).
  // ⚠️ 중복 판정에는 쓰지 않는다 — 다음 회차는 Threads·인스타에 직접 물어 판정한다(저장 실패와 무관).
  log('이번 회차 결과:', JSON.stringify(runLog.map(({ text, ...r }) => r)));
  if (!DRY && runLog.length) writeJson('data/posts.json', [...readJson('data/posts.json', []), ...runLog].slice(-300));
  if (!DRY && runLog.length) writeJson('data/variety.json', [...varietyLog, ...runLog.map(({ platform, track, topic, hook, media_set, skipped, date_kst }) => ({ platform, track, topic, hook, media_set, skipped, date_kst }))].slice(-300));
  if (threadsError) throw new Error(`Threads 게시 실패: ${threadsError.message}`);
  if (igError) throw new Error(`Instagram 게시 실패: ${igError.message}`);
  if (qualityError) throw qualityError; // 기록은 저장했다. 다음 회차가 같은 날 다시 시도한다(skipped 는 미게시로 센다)
}
main().catch(async (e) => { console.log(`::error::${e.message}`); console.error(e.message); await opsAlert('마케팅 봇 SNS 게시 실패', e.message); process.exit(1); });
