// 매일 게시: Threads 텍스트 1개 + Instagram 이미지 캡션 1개.
// 트랙 비율: data/mix-state.json(주간 자동조정, 범위 내) → 없으면 data/content-mix.json 고정 60/25/15.
import { pickTrackByWeights } from './attribution.mjs';
import { vetPost } from './vet.mjs';
import { pickLeastRecent, rotateImages, pickHook, pickFormat, recentOpeners } from './variety.mjs';
import { ROOT, DRY, log, readJson, writeJson, claude, humanize, HUMAN_STYLE, threadsText, threadsPublish, igPublish, igStory, fbPagePost, utmLink, productImage, kstNow, PARTNER_FACTS , opsAlert } from './lib.mjs';
import { myRecentPosts, postedOn } from './live.mjs';
import { pickSeries, seriesTopic, BRAND_WRITING, threadsTopicTag, ENCORE, SERIES, pickEncore } from './series.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { makeVisual, realStorePhotos, freshStorePhotos } from './visual.mjs';
import { nextFieldNote, closeFieldNote } from './field-notes.mjs';
import { ownerExamples, pickExamples, styleBlock } from './threads-style.mjs';

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
let topic = process.env.TOPIC || pickLeastRecent(topics, varietyLog.filter((p) => p.track === track), 'topic', (t) => t, dayIdx) || '';
// 시리즈 코너(series.mjs) — 현장 메모가 있으면 main() 에서 '현장노트'로 바꾼다
const trackHist = varietyLog.filter((p) => p.track === track);
const seriesState = readJson('data/series-state.json', null);
let series = pickSeries(track, trackHist, dayIdx, { weights: seriesState?.weights });
if (!process.env.TOPIC) topic = seriesTopic(series, topic, trackHist, dayIdx);
// 다시 보기(series.mjs ENCORE): 일요일(KST)에 반응 좋았던 글을 새 형식으로. 현장 메모가 있으면 main() 에서 취소된다.
const encoreDay = process.env.ENCORE === '1' || k.getUTCDay() === 0;
const usedEncore = new Set(varietyLog.map((p) => p.encore_of).filter(Boolean).map(String));
let encore = encoreDay && !process.env.TOPIC ? pickEncore(readJson('data/encore.json', null)?.candidates, track, usedEncore) : null;
if (encore) series = { ...ENCORE, photo: SERIES[encore.series]?.photo || ENCORE.photo };
let fieldNote = null;
// 오늘의 글 시작 방식·형식 (인스타 기록 기준으로 최근 쓴 훅은 피함)
const hook = pickHook(varietyLog.filter((p) => p.platform === 'instagram'), dayIdx);
const format = pickFormat(dayIdx);
// 링크 대상: 입점/크리에이터 페이지 (없으면 상품, 그것도 없으면 홈)
const target = { url: T.target || product?.url || 'https://urdeal.kr/' };
// 글 id: 하루 한 번이라 날짜로 충분하다(utm_content = <id>-<YYYYMMDD>). 종전엔 posts.json 개수로 매겼다.
const cid = (platform) => ({ threads: 'th', instagram: 'ig', facebook: 'fb' })[platform];

function trackGuide() { return {
  merchant: `오늘 독자는 ${T.audience}. 목적은 유어딜 입점을 고민하는 사장님이 "이건 나한테 손해 볼 게 없겠다"를 스스로 판단하게 돕는 고퀄리티 정보 글이다.
오늘 주제: ${topic}
- 사장님이 실제로 겪는 고민(광고비, 노쇼, 체험단, 수수료, 바쁜 시간)에서 시작해 유어딜 구조로 자연스럽게 연결한다.
- 아래 [확인된 사실]에 있는 조건만 쓴다. 매출 증가율, 성공 사례, 방문자 수, "업계 최저", 자동 승인/자동 송금, 트래픽 보장 같은 말은 절대 쓰지 않는다.
- 마지막에 CTA 한 줄: ${T.cta}`,
  creator: `오늘 독자는 ${T.audience}. 목적은 크리에이터가 유어딜 소개 파트너로 함께하고 싶게 만드는 정직한 안내 글이다.
오늘 주제: ${topic}
- 아래 [확인된 사실]에 있는 구조만 설명한다. 월 수익 예시, "누구나 쉽게 N만원" 같은 수익 약속 금지. 소개비율은 매장이 딜마다 정한다는 점을 정확히.
- 마지막에 CTA 한 줄: ${T.cta}`,
  consumer: `오늘은 소비자 딜 글: 아래 상품을 운영자 입장에서 소개한다(어떤 상황에 좋은지). 주어진 상품 정보 외 가격/할인율은 쓰지 않는다. 먹어본 척하지 않는다.`,
}[track]; }

import { referenceStyleBlock } from './style.mjs';

function systemPrompt() { return `너는 로컬 맛집·뷰티 이용권 서비스 '유어딜'(@urdeal_official)의 공식 계정 에디터다. 네이버플러스스토어·토스플레이스·NOL 같은 큰 브랜드 계정처럼 짧고 선명하게 쓴다.
${trackGuide()}

[오늘의 시리즈] ${series.name} — ${series.guide}
${fieldNote ? `\n[현장 메모 — 대표가 보낸 실제 일. 이 내용만 쓴다]\n${fieldNote.text}\n` : ''}${encore ? `\n[반응 좋았던 글 — 메시지만 가져오고 문장은 전부 새로 쓴다]\n${encore.text}\n` : ''}
${BRAND_WRITING}

${referenceStyleBlock()}

${HUMAN_STYLE}

[확인된 사실 — 이 범위 밖의 조건·숫자는 쓰지 않는다]
${PARTNER_FACTS}

[오늘의 글 시작 방식] ${hook.guide}
[오늘의 분량·형식] ${format}

본문만 출력하고 따옴표, 머리말, 해시태그 설명 같은 메타 문장은 쓰지 않는다.`; }

let igError = null;
let qualityError = null;
let threadsError = null;
// 같은 플랫폼 최근 글 10개 — 거의 같은 글 반복 방지
const recentTexts = (platform) => live.filter((p) => p.platform === platform && p.text).slice(-10).map((p) => p.text);

// 쓰기 → 검수 → (걸리면 문제를 알려 주고 한 번 다시 쓰기) → 그래도 걸리면 올리지 않는다
const factsFor = (info) => `${PARTNER_FACTS}\n${info}${fieldNote ? `\n현장 메모: ${fieldNote.text}` : ''}`;
// 길이 상한(링크·해시태그 뺀 본문). 2026-11-09 대표 "길게 쓴다고 다가 아니야" — 넘으면 다시 쓰고, 그래도 넘으면 안 올린다.
const LIMITS = {
  instagram: { minLen: 60, maxPlain: 230, maxParas: 3 },
  threads: { minLen: 30, maxPlain: 150, maxParas: 2 },
  'threads-reply': { minLen: 20, maxPlain: 100, maxParas: 1 },
};
async function writeVetted(prompt, maxTokens, platform, info, kind, limitKey = platform) {
  const SYSTEM = systemPrompt();
  const ctx = { facts: factsFor(info), recent: [...recentTexts(platform), ...(encore ? [encore.text] : []), ...(platform === 'threads' ? threadsExamples : [])], fieldNote: !!fieldNote, ...LIMITS[limitKey] };
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
let threadsExamples = [];
let gen = null;
const cardKey = `${today}-${track}`;
// 릴스는 월·수·금(KST) — 주 3회. 나머지 날은 캐러셀. REEL=1 이면 오늘 강제.
const reelDay = process.env.REEL === '1' || [1, 3, 5].includes(k.getUTCDay());
// 실제 입점 매장 사진: 사장님·손님 글에만(크리에이터 글은 사람 사진이 맞다). 최근 인스타 4회에 쓴 사진은 뺀다.
let storeCache = null;
async function storePhotosToday() {
  if (!['merchant', 'consumer'].includes(track) || DRY) return [];
  if (!storeCache) {
    const recent = varietyLog.filter((p) => p.photo).slice(-4).map((p) => p.photo);
    storeCache = freshStorePhotos(await realStorePhotos(products), recent);
    log(`실제 매장 사진 후보 ${storeCache.length}장`);
  }
  return storeCache;
}
async function main() {
  // 조회가 실패하면 여기서 멈춘다 — "안 올렸다"로 보고 올리면 같은 글이 두 번 나간다
  live = await myRecentPosts({ days: 14 });
  log(`실물 조회: 최근 14일 Threads ${live.filter((p) => p.platform === 'threads').length} · 인스타 ${live.filter((p) => p.platform === 'instagram').length} (오늘 ${today}: Threads ${postedToday('threads') ? '게시됨' : '없음'} · 인스타 ${postedToday('instagram') ? '게시됨' : '없음'})`);
  if (isPromo && !product) { log('상품 없음, 종료'); return; }
  // 대표 현장 메모가 있으면 그게 오늘 글감이다(field-notes.mjs)
  if (!DRY && !process.env.TOPIC) fieldNote = await nextFieldNote();
  if (fieldNote) { encore = null; series = pickSeries(track, trackHist, dayIdx, { fieldNote: true }); topic = fieldNote.text.slice(0, 80); log(`현장 메모 #${fieldNote.number} 사용 (사진 ${fieldNote.photos.length}장)`); }
  log(`오늘 시리즈: ${series.name}${encore ? ` (원글 ${encore.platform} ${encore.id}, 평균의 ${encore.ratio}배)` : ''}`);
  log(`event=${process.env.GITHUB_EVENT_NAME || 'local'} DRY=${DRY} force=${force} KST=${today} ${kstHM} slot(threads)=${todaysSlot('threads')} slot(ig)=${todaysSlot('instagram')}`);
  log(`오늘 트랙: ${track}${topic ? ` / 주제: ${topic.slice(0, 40)}` : ''}`);
  const info = isPromo ? `상품: ${product.name} (${product.url})` : `링크 대상: ${target.url}`;

  // ---- Instagram (이미지 필수) ----
  if (due('instagram') && !postedToday('instagram')) {
    const id = cid('instagram');
    const link = utmLink(isPromo ? product : target, 'instagram', T.campaign || track, id, now);
    // 캡션을 먼저 쓴다 — 이미지 문구는 캡션에서 뽑는다(같은 메시지)
    const capPrompt = `${info}\n인스타그램 캡션 1개. 첫 줄은 핵심 메시지 한 문장, 이어서 2~3줄, 마지막 줄은 정보형 안내('프로필 링크에서 확인' 식 — 본문 링크는 클릭이 안 된다). 끝에 해시태그 2~3개만. 해시태그 빼고 200자 이내 — 짧을수록 좋다.`;
    const cap = await writeVetted(capPrompt, 800, 'instagram', info, '인스타그램 캡션');
    // 게시할 때마다 새 이미지(visual.mjs) — 실패하면 아래 종전 카드 세트로 물러선다
    gen = cap.problems.length ? null : await makeVisual({
      claudeFn: claude, caption: cap.body, facts: factsFor(info), series, key: cardKey,
      notePhotos: fieldNote?.photos || [], productPhoto: isPromo ? await productImage(product) : null, storePhotos: await storePhotosToday(), fieldNote: !!fieldNote,
      reel: reelDay || !!encore, // 다시 보기는 원글과 다른 형식(릴스)으로
    });
    // 미디어 결정: tracks.<t>.media 배열(캐러셀 images / Reels video_url, 날짜별 순환) → image_url → og:image → 상품 이미지
    // product_id 가 붙은 세트(손님 딜 카드)는 오늘 고른 상품과 같을 때만 — 다른 가게 카드가 나가지 않게
    const mediaList = (T.media || []).filter((m) => m && (m.video_url || m.images?.length) && (m.product_id == null || m.product_id === product?.id));
    // 같은 세트 반복 방지: 가장 오래 안 쓴 세트를 고르고, 다시 쓰는 세트는 표지(첫 장)를 바꾼다
    const igHist = varietyLog.filter((p) => p.platform === 'instagram');
    const mediaKey = (m) => m.set || m.video_url || m.images[0];
    let media = gen ? null : process.env.MEDIA_IDX ? mediaList[Number(process.env.MEDIA_IDX) % mediaList.length] : pickLeastRecent(mediaList, igHist, 'media_set', mediaKey, dayIdx);
    if (media) {
      const usedTimes = igHist.filter((p) => !p.skipped && p.media_set === mediaKey(media)).length;
      media = { ...media, set: mediaKey(media), images: media.images ? rotateImages(media.images, usedTimes) : media.images };
    }
    const imgs = [].concat(T.image_url || []).filter(Boolean); // 문자열 또는 배열(날짜별 순환)
    if (gen) media = gen.video_url ? { video_url: gen.video_url, cover_url: gen.cover_url, set: gen.set } : { images: gen.images, set: gen.set };
    const single = media ? null : (imgs.length ? pickLeastRecent(imgs, igHist, 'media_set', (u) => u, dayIdx) : null) || (!isPromo && await productImage(target)) || (product && await productImage(product));
    if (!media && single) media = { images: [single], set: single };
    const image = media?.video_url || media?.images?.[0];
    if (!image) {
      log(`Instagram: ${track} 이미지 URL 없음 → 건너뜀`);
      runLog.push({ platform: 'instagram', skipped: 'no_image', track, product_id: product?.id, posted_at: now.toISOString(), date_kst: today });
    } else {
      const { body, problems } = cap;
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
      try { try { r = await igPublish(media, body.slice(0, 2100)); }
      catch (e0) {
        // 릴스가 실패하면 같은 장을 캐러셀로 다시 올린다(하루 게시를 놓치지 않게)
        if (!media.video_url || !gen?.images?.length) throw e0;
        log(`릴스 게시 실패 → 캐러셀로 다시: ${e0.message.slice(0, 200)}`);
        media = { images: gen.images, set: gen.set };
        r = await igPublish(media, body.slice(0, 2100));
      }
      } catch (e) {
        // 실패해도 Threads 기록은 남기고(중복 게시 방지) 마지막에 run 을 실패시킴
        igError = e;
        console.log(`::error title=Instagram 게시 실패::${e.message}`);
        runLog.push({ platform: 'instagram', skipped: 'error', error: e.message.slice(0, 300), track, posted_at: now.toISOString(), date_kst: today });
      }
      if (r) {
      runLog.push({ platform: 'instagram', id: r.id, encore_of: encore?.id, media_type: r.media_type, media_set: media.set, series: series.id, field_note: fieldNote?.number, generated: gen ? { source: gen.source, credit: gen.credit, title: gen.title, photo_url: gen.photo_url, reel: !!media.video_url } : undefined, hook: hook.id, topic: topic || undefined, content_id: id, track, promo: isPromo, product_id: isPromo ? product.id : undefined, posted_at: now.toISOString(), date_kst: today, slot_kst: todaysSlot('instagram'), bio_link: link, text: body, dry: DRY || undefined });
      // ---- Facebook 페이지 — 2026-11-09 대표 "페이스북 페이지에는 올리지 않아도 돼. 인스타랑 스레드만" → 기본 끔.
      //      다시 켜려면 워크플로 env 에 FB_POST_ENABLED=1.
      if (process.env.FB_POST_ENABLED === '1') {
      // ---- Facebook 페이지 (IG 게시 시 같은 미디어/캡션 + 링크; 멀티포토·영상 실패 시 단일 이미지) ----
      const fcid = cid('facebook');
      const flink = utmLink(isPromo ? product : target, 'facebook', T.campaign || track, fcid, now);
      try {
        const f = await fbPagePost(body.slice(0, 2100), flink, { ...media, fallback_image: imgs[0] });
        if (!f) log('Facebook: META_FB_PAGE_TOKEN 없음 → 건너뜀');
        else runLog.push({ platform: 'facebook', id: f.post_id || f.id, content_id: fcid, track, promo: isPromo, product_id: isPromo ? product.id : undefined, posted_at: now.toISOString(), date_kst: today, slot_kst: todaysSlot('instagram'), link: flink, dry: DRY || undefined });
      } catch (e) { log(`Facebook 게시 실패: ${e.message}`); }
      } else log('Facebook: 꺼짐(대표 지시 2026-11-09) → 건너뜀');
      // 스토리: 같은 표지를 세로로(팔로워 화면 위쪽에 한 번 더 뜬다). 실패해도 게시는 끝난 것이라 기록만.
      if (gen?.story_url) {
        try { const st = await igStory(gen.story_url); log(`IG 스토리 게시: ${st.id}`); runLog.push({ platform: 'instagram_story', id: st.id, track, series: series.id, posted_at: now.toISOString(), date_kst: today, dry: DRY || undefined }); }
        catch (e) { log(`IG 스토리 실패(게시는 정상): ${e.message.slice(0, 200)}`); }
      }
      if (fieldNote) await closeFieldNote(fieldNote, [r.id ? `인스타 게시 id ${r.id}` : ''].filter(Boolean));
      }
      }
    }
  } else log(`Instagram: 건너뜀 — ${skipReason('instagram')}`);

  // 오늘 표지(인스타용으로 만든 것)를 스레드에도 쓴다. 인스타가 오늘 이미 나갔으면 남아 있는 표지 파일을,
  // 그것도 없으면 스레드 글로 표지를 새로 만든다.
  async function threadsImage(body) {
    if (gen?.images?.[0]) return gen.images[0];
    if (fs.existsSync(path.join(ROOT, 'data', 'cards', cardKey, 'slide-1.jpg')) && process.env.GITHUB_REPOSITORY) {
      return `https://raw.githubusercontent.com/${process.env.GITHUB_REPOSITORY}/marketing-data/marketing-bot/data/cards/${cardKey}/slide-1.jpg`;
    }
    const g = await makeVisual({ claudeFn: claude, caption: body, facts: factsFor(info), series, key: `${cardKey}-th`,
      notePhotos: fieldNote?.photos || [], productPhoto: isPromo ? await productImage(product) : null, storePhotos: await storePhotosToday(), fieldNote: !!fieldNote });
    return g?.images?.[0] || null;
  }

  // ---- Threads ----
  if (due('threads') && !postedToday('threads')) {
    const id = cid('threads');
    const link = utmLink(isPromo ? product : target, 'threads', T.campaign || track, id, now);
    const len = ['한 문장, 60자 안팎', '1~2문장, 90자 안팎', '2~3문장, 130자 안팎'][dayIdx % 3];
    // 말투 참고(threads-style.mjs): 대표가 고른 스레드 인기글 + 우리 스레드 인기글
    threadsExamples = pickExamples(await ownerExamples(), readJson('data/encore.json', null)?.threads_top || [], 3, dayIdx);
    log(`스레드 말투 참고 예시 ${threadsExamples.length}개`);
    const { body, problems } = await writeVetted(`${info}\nThreads 글 1개를 ${len}로 써줘. 첫 문장이 곧 핵심. 해시태그 없이. 링크는 내가 끝에 붙일게.${styleBlock(threadsExamples)}`, 600, 'threads', info, 'Threads 글');
    if (problems.length) {
      qualityError = qualityError || new Error(`Threads 검수 실패: ${problems.join(' / ')}`);
      console.log(`::error title=Threads 검수 실패 — 게시 안 함::${problems.join(' / ')}`);
      log('반려된 본문:\n' + body);
      runLog.push({ platform: 'threads', skipped: 'quality_failed', problems, track, posted_at: now.toISOString(), date_kst: today });
    } else {
    const text = threadsText(body, link);
    log('Threads 본문:\n' + text);
    // 표지 이미지를 함께 올린다(글만 있는 것보다 피드에서 눈에 띈다). 실패하면 글만.
    const image_url = await threadsImage(body);
    log(`Threads 이미지: ${image_url || '없음 — 글만'}`);
    // 주제 태그(series.mjs THREADS_TOPICS) — 태그가 거부되면 태그 없이 한 번 더
    const topic_tag = threadsTopicTag(track, dayIdx);
    log(`Threads 주제 태그: ${topic_tag}`);
    const publishTagged = async (p) => {
      try { return await threadsPublish({ ...p, topic_tag }); }
      catch (e) { if (!/topic_tag|Invalid parameter|\(#100\)/i.test(e.message)) throw e; log(`주제 태그 거부 → 태그 없이: ${e.message.slice(0, 200)}`); return threadsPublish(p); }
    };
    let r;
    try {
      if (image_url) {
        try { r = await publishTagged({ media_type: 'IMAGE', image_url, text }); }
        catch (e) { log(`Threads 이미지 게시 실패 → 글만: ${e.message.slice(0, 200)}`); }
      }
      r = r || await publishTagged({ media_type: 'TEXT', text });
    } catch (e) {
      // Threads 실패가 Instagram 게시까지 막지 않도록 기록만 하고 계속 진행
      threadsError = e;
      console.log(`::error title=Threads 게시 실패::${e.message.slice(0, 300)}`);
      runLog.push({ platform: 'threads', skipped: 'error', error: e.message.slice(0, 300), track, posted_at: now.toISOString(), date_kst: today });
    }
    // 이어 쓰기: 첫 글에 정보 한 줄을 답글로 단다(스레드는 이어진 글이 더 퍼진다). 검수에 걸리거나 실패하면 생략.
    let reply_id;
    if (r) {
      try {
        const fu = await writeVetted(`${info}\n방금 올린 스레드 글:\n${body}\n\n이 글에 내가 직접 이어 다는 답글 1개를 1~2문장, 90자 안팎으로 써줘. 본문에 없는 정보 하나만 [확인된 사실] 범위에서 보탠다. 본문을 되풀이하지 않는다. 링크·해시태그·질문 없이.`, 300, 'threads', info, 'Threads 이어 쓰기', 'threads-reply');
        if (fu.problems.length) log(`Threads 이어 쓰기 검수 걸림 → 생략: ${fu.problems.join(' / ')}`);
        else { reply_id = (await threadsPublish({ media_type: 'TEXT', text: fu.body.trim().slice(0, 480), reply_to_id: r.id }))?.id; log(`Threads 이어 쓰기 게시: ${reply_id}\n${fu.body}`); }
      } catch (e) { log(`Threads 이어 쓰기 실패(본글은 정상): ${e.message.slice(0, 200)}`); }
    }
    if (r) runLog.push({ platform: 'threads', id: r.id, reply_id, topic_tag, encore_of: encore?.id, content_id: id, image: image_url && !/TEXT/.test(r.media_type || '') ? image_url : undefined, track, series: series.id, field_note: fieldNote?.number, promo: isPromo, product_id: isPromo ? product.id : undefined, posted_at: now.toISOString(), date_kst: today, slot_kst: todaysSlot('threads'), link, text: body, dry: DRY || undefined });
    }
  } else log(`Threads: 건너뜀 — ${skipReason('threads')}`);


  // 기록은 marketing-data 브랜치의 data/posts.json 에 남긴다(주간 리뷰가 트랙·슬롯을 복원하는 로그).
  // ⚠️ 중복 판정에는 쓰지 않는다 — 다음 회차는 Threads·인스타에 직접 물어 판정한다(저장 실패와 무관).
  log('이번 회차 결과:', JSON.stringify(runLog.map(({ text, ...r }) => r)));
  if (!DRY && runLog.length) writeJson('data/posts.json', [...readJson('data/posts.json', []), ...runLog].slice(-300));
  if (!DRY && runLog.length) writeJson('data/variety.json', [...varietyLog, ...runLog.map(({ id, platform, track, topic, hook, media_set, series, skipped, date_kst, generated, encore_of }) => ({ id, platform, track, topic, hook, media_set, series, skipped, date_kst, photo: generated?.photo_url, encore_of }))].slice(-300));
  if (threadsError) throw new Error(`Threads 게시 실패: ${threadsError.message}`);
  if (igError) throw new Error(`Instagram 게시 실패: ${igError.message}`);
  if (qualityError) throw qualityError; // 기록은 저장했다. 다음 회차가 같은 날 다시 시도한다(skipped 는 미게시로 센다)
}
main().catch(async (e) => { console.log(`::error::${e.message}`); console.error(e.message); await opsAlert('마케팅 봇 SNS 게시 실패', e.message); process.exit(1); });
