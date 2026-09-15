// 유어딜 인플루언서 제휴 소개서 (.pptx) 생성기 — v2 (2026-09-15). 16:9 · Pretendard · 라이브 캡처 · 예시 데이터 화면
// v2: 참고 덱(히로인스) 장치 — PART 구분 장 3 + 우상단 라벨 · 플라이휠 · "이런 채널에 맞습니다" 페르소나 · 유어샵 화면 인출선 · 두 경로+정산 절차 3열 · 하단 결론 바. 14 → 20장.
// 기획: docs/business/proposals/three-decks-plan-2026-09.md §3 · 사실 SSOT: 같은 문서 §0 + docs/design/actor-benefit-map.md
// 기존 9장 HTML(public/static/proposals/influencer-proposal.html)을 대체한다. 정산 문구는 influencer-payout.ts 실값.
// 재생성: cd /tmp/deck && npm i pptxgenjs sharp react react-dom react-icons
//         SHOTS_DIR=<캡처 폴더> node urdeal-influencer-deck.build.mjs out.pptx
import path from 'node:path';
import { createDeck, C, W, H, M, FACTS, __dirname } from './deck-common.mjs';

const OUT = process.argv[2] || path.join(__dirname, 'urdeal-influencer-deck.pptx');
const SHOTS_DIR = process.env.SHOTS_DIR || path.join(__dirname, 'shots');

(async () => {
  const d = await createDeck({
    title: '유어딜 인플루언서 제휴 소개서', footer: '유어딜 인플루언서 제휴 소개', shotsDir: SHOTS_DIR,
    shotKeys: ['home', 'detail', 'use', 'shop', 'ushop', 'influencer-offer', 'influencer-settlement', 'creators-apply'],
    icons: ['FiLink', 'FiPackage', 'FiTruck', 'FiHeadphones', 'FiSend', 'FiInbox', 'FiGift', 'FiEdit3'],
  });
  const { pres, ic, T, chrome, title, lead, card, iconCircle, numBadge, hr, label, phone, kv, customerSteps, honesty, cover, chip, qa3, section, takeaway, flywheel, personas, callouts, procedureColumns } = d;

  // ───────── 00 로고 표지 ─────────
  {
    const s = pres.addSlide();
    cover(s, { deckName: '인플루언서 제휴 소개서', sub: '팔로워에게 광고를 파는 대신, 동네에서 진짜 쓰는 이용권을 건넵니다. 링크 하나로 소개비, 데려온 매장에서 ' + FACTS.introTerm + '간 ' + FACTS.introPct + '.', dark: true });
  }

  // ───────── 01 표지 ─────────
  {
    const s = pres.addSlide();
    chrome(s, { dark: true });
    T(s, '팔로워에게\n광고를 팔지\n않습니다.', { x: M, y: 1.35, w: 7.4, h: 2.7, fontSize: 46, bold: true, color: C.darkText, lineSpacingMultiple: 1.05, charSpacing: -1.5, valign: 'top' });
    T(s, '동네에서 진짜 쓰는 이용권을 건넵니다. 매장이 소개비 %를 정해 제안하고, 나는 링크 하나를 겁니다. 재고도 배송도 응대도 내 몫이 아닙니다.',
      { x: M, y: 4.2, w: 7.0, h: 0.9, fontSize: 13.5, color: C.darkMuted, lineSpacingMultiple: 1.5, valign: 'top' });
    const stats = [['매장이 정한 %', '딜 소개비. 판매가 기준,\n매장이 딜마다 제안'], [FACTS.introPct, '내가 데려온 매장 매출의\n' + FACTS.introTerm + '간, 직접 입점만'], ['0원', '가입비, 이용료,\n내가 내는 비용']];
    stats.forEach(([n, l], i) => {
      const x = M + i * 2.45;
      T(s, n, { x, y: 5.15, w: 2.4, h: 0.6, fontSize: i === 0 ? 24 : 36, bold: true, color: C.darkText, charSpacing: -1.2, valign: 'middle' });
      T(s, l, { x, y: 5.8, w: 2.35, h: 0.6, fontSize: 10, color: C.darkMuted, lineSpacingMultiple: 1.35, valign: 'top' });
    });
    phone(s, 'ushop', 9.3, 1.1, 5.7, { dark: true });
    s.addNotes('딜 소개비: 매장 제안 %, 상한 없음, 매장 부담(actor-benefit-map Q2-1). 영입 2%: influencer-store-intro-commission.ts (직접 입점만, 1년, 유어딜 몫). 비용 0.');
  }

  // ───────── PART 1 구분 장 ─────────
  {
    const s = pres.addSlide();
    section(s, { n: 1, name: '이게 무엇이고, 나는 무엇을 하나', sub: '배송되는 물건이 아니라 동네에서 바로 쓰는 권리를 팝니다. 내가 하는 일은 링크 하나입니다.', items: ['이용권, 유어샵, 내 링크', '팔로워가 겪는 네 화면', '이런 채널에 맞습니다'] });
  }

  // ───────── 02 이게 뭔가 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '배송되는 물건이 아니라, 동네에서 바로 쓰는 권리를 팝니다.');
    lead(s, '유어딜은 식당, 카페, 뷰티, 숙박 이용권을 온라인 할인가로 파는 로컬 커머스입니다. 손님은 미리 사고, 가게에 가서 QR 로 씁니다. 택배가 오가지 않으니 품절도 오배송도 반품도 없습니다.', { h: 0.85, w: 8.2 });
    const items = [
      ['FiTag', '이용권', '식사, 뷰티, 숙박, 액티비티. 할인가와 유효기간은 매장이 정합니다. 유효기간이 지나도 안 쓴 이용권은 유어딜이 손님에게 100% 환불합니다.'],
      ['FiHome', '가입하면 누구나 유어샵', 'urdeal.kr/u/내주소 하나가 생깁니다. 담아 둔 이용권이 한 곳에 진열되는 내 페이지라, 프로필 링크는 이것만 걸면 됩니다.'],
      ['FiLink', '내가 하는 일은 링크 하나', '스토리, 릴스, 카톡, 더보기, 블로그 어디든 됩니다. 귀속은 링크로 자동 추적되니 쿠폰 코드를 불러 줄 일이 없습니다.'],
      ['FiShield', '결제, 발급, 정산, 세금은 유어딜', '토스 결제, 이용권 발급, 매장 QR 확인, 원천징수까지 유어딜이 합니다. 매장에 돈을 달라고 할 일이 없습니다.'],
    ];
    let y = 3.05;
    items.forEach(([i, h, p]) => {
      iconCircle(s, i, M, y, 0.46);
      T(s, h, { x: M + 0.65, y, w: 7.0, h: 0.32, fontSize: 14, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: M + 0.65, y: y + 0.35, w: 7.0, h: 0.6, fontSize: 11, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
      y += 0.98;
    });
    phone(s, 'detail', 9.4, 1.2, 5.5, { caption: '이용권 상세 (라이브 화면)' });
    s.addNotes('유어샵 자동 생성: KakaoAuthService.upsertUser (가입 시 handle 발급). 만료 환불: auto-settlement.ts handleExpiredVoucherRefunds. 귀속: affiliate 링크 추적.');
  }

  // ───────── 03 손님 4단계 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '팔로워가 겪는 순서는 네 화면이 전부입니다.');
    lead(s, '오늘 urdeal.kr 에서 그대로 캡처한 화면입니다. 앱을 새로 깔거나 가입을 강요하는 구간은 없습니다. 가격은 매장이 정한 실제 판매가입니다.', { y: 2.0, h: 0.4 });
    customerSteps(s, { y: 3.1, h: 3.1 });
    s.addNotes('캡처 4장: home / detail / use / shop. 사장님 덱 3장과 같은 블록(customerSteps).');
  }

  // ───────── 03-2 이런 채널에 맞습니다 (페르소나 + 말풍선) ─────────
  {
    const s = pres.addSlide();
    chrome(s, { dark: true });
    title(s, '이런 채널에 맞습니다. 팔로워 수보다 동네와 주제가 먼저입니다.', { dark: true });
    lead(s, '조회수와 좋아요는 세지 않고 결제만 셉니다. 그래서 큰 채널보다 지역과 카테고리가 뚜렷한 채널이 잘 맞습니다.', { y: 2.0, h: 0.4, dark: true });
    personas(s, [
      ['FiEdit3', '동네 맛집 블로거', '"검색은 되는데 돈이 된 적은 없어요."', ['글 안 링크로 팔린 건마다 소개비. 글은 유효기간 내내 팝니다', '팔로워 하한 없음. 지역과 메뉴가 뚜렷할수록 맞습니다']],
      ['FiVideo', '지역 유튜버 · 쇼츠', '"협찬은 한 번 받으면 끝이잖아요."', ['설명란 링크 하나로 이용권 여러 개를 함께 소개합니다', '영상이 내려가도 유어샵에서는 계속 팔립니다']],
      ['FiCamera', '팔로워가 적은 인스타', '"천 명도 안 되는데 될까요?"', ['됩니다. 동네 손님 열 명이 결제하면 그게 소개비입니다', '프로필 링크는 유어샵 주소 하나면 됩니다']],
      ['FiMapPin', '아는 사장님이 있는 사람', '"단골 가게 사장님을 소개해 드릴 수 있어요."', ['초대 링크로 직접 입점하면 그 매장 매출의 ' + FACTS.introPct + '가 ' + FACTS.introTerm + '간', '내가 공유하지 않아도, 다른 사람 링크로 팔려도 쌓입니다']],
    ], { y: 2.6, rowH: 0.92, gap: 0.14 });
    s.addNotes('09-15 참고 덱 "이런 브랜드에게 추천합니다" 장치. 사실: 결제 기준 커미션(order-commissions.ts) · 팔로워 하한 없음(creator-apply) · 영입 2% 1년 직접 입점(influencer-store-intro-commission.ts).');
  }

  // ───────── PART 2 구분 장 ─────────
  {
    const s = pres.addSlide();
    section(s, { n: 2, name: '돈은 어디서 나와 어디로 가나', sub: '손님이 낸 돈이 갈리는 그림, 두 갈래 수익, 실제 이용권으로 넣은 계산, 그리고 왜 쌓이는지.', items: ['돈의 흐름', '수익 두 갈래', '계산해 보면', '쌓이는 플라이휠'] });
  }

  // ───────── 04 돈의 흐름 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '손님이 낸 돈은 이렇게 갈립니다. 내 몫이 붙는 자리는 두 곳입니다.');
    lead(s, '사장님과 대행사에게 보여드리는 그림과 같은 그림입니다. 숫자를 숨기지 않습니다.', { y: 2.0, h: 0.4 });
    const bw = 2.2, gap = 0.5, by = 2.6, bh = 0.78;
    const nodes = [['손님', '이용권 결제', C.surface], ['카드사', '결제 처리', C.surface], ['유어딜', FACTS.feeDirect, C.ink], ['사장님', '나머지 90%', C.tint]];
    nodes.forEach(([h, sub, fill], i) => {
      const x = M + i * (bw + gap);
      const dk = fill === C.ink;
      card(s, x, by, bw, bh, { fill });
      T(s, h, { x, y: by + 0.1, w: bw, h: 0.32, fontSize: 14, bold: true, color: dk ? C.darkText : (i === 3 ? C.brand : C.ink), align: 'center', charSpacing: -0.3 });
      T(s, sub, { x, y: by + 0.42, w: bw, h: 0.26, fontSize: 10, color: dk ? C.brand : C.inkSoft, align: 'center', bold: dk });
      if (i < 3) s.addImage({ data: ic.FiArrowGray, x: x + bw + 0.13, y: by + bh / 2 - 0.12, w: 0.24, h: 0.24 });
    });
    const drop = (i, big, small, { hi = false } = {}) => {
      const x = M + i * (bw + gap);
      s.addShape(pres.shapes.LINE, { x: x + bw / 2, y: by + bh, w: 0, h: 0.32, line: { color: C.gray, width: 0.75, endArrowType: 'triangle' } });
      if (hi) card(s, x - 0.12, by + bh + 0.34, bw + 0.24, 1.52, { fill: C.tint });
      T(s, big, { x, y: by + bh + 0.42, w: bw, h: 0.34, fontSize: 15, bold: true, color: hi ? C.brand : C.ink, align: 'center', charSpacing: -0.5 });
      T(s, small, { x: x - 0.1, y: by + bh + 0.78, w: bw + 0.2, h: 1.0, fontSize: 9.5, color: hi ? C.ink : C.inkSoft, align: 'center', lineSpacingMultiple: 1.35, valign: 'top' });
    };
    drop(1, '약 2.75%', '카드 결제 수수료.\n유어딜이 자기 몫 안에서 냅니다.\n카드사 정책에 따라 바뀔 수 있습니다');
    drop(2, '영입 ' + FACTS.introPct, '내가 데려온 매장이면\n유어딜 몫 안에서 나에게.\n직접 입점 매장만, ' + FACTS.introTerm, { hi: true });
    drop(3, '딜 소개비 %', '매장이 나에게 제안한 %.\n사장님 몫 90% 안에서,\n내 링크로 팔린 건에만', { hi: true });
    const cy2 = 5.35, cw2 = (W - 2 * M - 0.3) / 2, ch2 = 1.15;
    [['딜 소개비는 매장이 냅니다', '플랫폼이 정한 고정 요율이 아닙니다. 매장이 딜마다 제안한 비율이 그대로 적립되고, 유어딜이 중간에서 깎지 않습니다. 매장이 제안하지 않은 이용권에는 소개비가 없습니다.'],
     ['영입 ' + FACTS.introPct + '는 유어딜이 냅니다', '내 소개로 직접 입점한 매장의 매출에서 ' + FACTS.introTerm + '간 유어딜 몫 ' + FACTS.feeDirect + ' 안에서 드립니다. 사장님 몫에서 떼지 않으니 사장님께 부담을 지우지 않습니다.']].forEach(([h, p], i) => {
      const x = M + i * (cw2 + 0.3);
      card(s, x, cy2, cw2, ch2);
      T(s, h, { x: x + 0.25, y: cy2 + 0.14, w: cw2 - 0.5, h: 0.28, fontSize: 11.5, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: x + 0.25, y: cy2 + 0.44, w: cw2 - 0.5, h: 0.7, fontSize: 9.5, color: C.inkSoft, lineSpacingMultiple: 1.35, valign: 'top' });
    });
    s.addNotes('직접 10% / 중개 5%: fee-resolver.ts. 카드 수수료 약 2.75%: DEFAULT_PG_RESERVE_PCT (변동 가능). 딜 소개비: 매장 부담(store-operator-model §7). 영입 2%: 플랫폼 10% 안에서(09-07 Q4-2 확정, 예산 아비터).');
  }

  // ───────── 05 수익 두 갈래 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '수익은 두 갈래입니다. 둘 다 내 링크로 팔린 뒤에만 붙습니다.');
    const cw = (W - 2 * M - 0.35) / 2, cy = 2.15, ch = 3.05;
    const cols = [
      ['FiPercent', '주문마다 붙는 딜 소개비', '결제 금액 × 매장이 제안한 %',
        '매장이 "이 이용권 팔아 주면 몇 %" 를 적어 제안합니다. 수락하면 그 자리에서 내 전용 링크가 나오고, 그 링크로 팔린 건마다 그 %가 쌓입니다. 상한이 없고, 유어딜이 중간에서 떼지 않습니다. 제안에 콘텐츠 조건이나 기간이 붙으면 그 조건을 지킨 건에만 붙습니다.',
        [['재원', '사장님 몫 안에서', 0], ['비율', '매장이 딜마다 제안', 1], ['상한', '없음', 2]]],
      ['FiTrendingUp', FACTS.introTerm + '간 붙는 영입 소개비', '그 매장 매출 × ' + FACTS.introPct,
        '내 초대 링크로 사장님이 직접 입점하면, 그 매장의 모든 이용권 매출에서 ' + FACTS.introPct + '가 ' + FACTS.introTerm + '간 나에게 옵니다. 내가 그 딜을 다시 공유하지 않아도, 다른 사람 링크로 팔려도 쌓입니다. 매장이 주인을 바꿔도 유지됩니다.',
        [['재원', '유어딜 몫 ' + FACTS.feeDirect + ' 안에서', 0], ['조건', '직접 입점 매장만', 1], ['기간', '입점일부터 ' + FACTS.introTerm, 2]]],
    ];
    cols.forEach(([i, h, f, p, rows], k) => {
      const x = M + k * (cw + 0.35);
      card(s, x, cy, cw, ch);
      iconCircle(s, i, x + 0.3, cy + 0.3, 0.46);
      T(s, h, { x: x + 0.95, y: cy + 0.3, w: cw - 1.2, h: 0.3, fontSize: 14.5, bold: true, color: C.ink, charSpacing: -0.4 });
      T(s, f, { x: x + 0.95, y: cy + 0.6, w: cw - 1.2, h: 0.26, fontSize: 11, bold: true, color: C.brand });
      T(s, p, { x: x + 0.3, y: cy + 1.02, w: cw - 0.6, h: 0.95, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
      kv(s, rows, x + 0.3, cy + 1.95, cw - 0.6, { rowH: 0.34 });
    });
    card(s, M, 5.45, W - 2 * M, 1.15, { fill: C.tint });
    T(s, '모든 이용권에 소개비가 붙는 것은 아닙니다', { x: M + 0.3, y: 5.6, w: W - 2 * M - 0.6, h: 0.3, fontSize: 12.5, bold: true, color: C.ink, charSpacing: -0.3 });
    T(s, '유어샵에 담는 것은 누구나 할 수 있지만, 소개비는 매장과 맺은 딜이 있을 때만 붙습니다. 딜 없이 담아 둔 이용권이 팔리면 0원입니다. 사이트의 소개자 페이지에도 같은 문장이 적혀 있습니다.',
      { x: M + 0.3, y: 5.92, w: W - 2 * M - 0.6, h: 0.65, fontSize: 10.5, color: C.ink, lineSpacingMultiple: 1.4, valign: 'top' });
    s.addNotes('딜 소개비: influencer-deals(매장 제안 %, 상한 없음). 영입: influencer-store-intro-commission.ts (store_channel=direct 만, referral_bonus_until 1년, 주인 바뀌어도 유지 09-07). "딜 있을 때만": /influencer 랜딩 고지 + affiliate_program_enabled OFF.');
  }

  // ───────── 06 계산해 보면 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '계산해 보면 이렇습니다. 지금 팔리는 실제 이용권으로 넣었습니다.', { size: 25 });
    card(s, M, 2.15, 5.9, 4.65);
    const x = M + 0.35, w = 5.2;
    label(s, '가정: 치즈돈가스 2인 세트 이용권을 한 달에 42건 팔았다', x, 2.35, w);
    const yEnd = kv(s, [
      ['이용권 판매가 (정가 25,000원의 34% 할인)', '16,500원', 0], ['42건 판매 금액', '693,000원', 0, true],
      ['매장이 제안한 소개비 12% (가정)', '83,160원', 1], ['기타소득 원천징수 8.8% (비사업자)', '7,318원 차감', 0, true],
      ['통장에 들어오는 돈', '75,842원', 2],
      ['내가 데려온 매장이라면 영입 ' + FACTS.introPct + ' 추가', '13,860원', 2],
    ], x, 2.7, w, { rowH: 0.43 });
    T(s, '소개비 12%와 42건은 가정입니다. 실제 비율은 딜마다 매장이 제시하고, 판매 건수는 내 채널이 정합니다. 사업자라면 원천징수는 3.3%입니다.', { x, y: yEnd + 0.12, w, h: 0.7, fontSize: 11, color: C.ink, lineSpacingMultiple: 1.4, valign: 'top' });
    const pts = [
      ['FiXCircle', '내가 내는 돈이 없다', '가입비도 이용료도 없습니다. 소개비는 매장이, 영입비는 유어딜이 냅니다. 내 지출이 생기는 지점이 없습니다.'],
      ['FiPackage', '재고, 배송, 반품 응대가 없다', '이용권은 매장에서 쓰는 권리라 택배가 오가지 않습니다. 공동구매를 열었다가 품절 문의를 혼자 받는 일이 생기지 않습니다.'],
      ['FiHome', '캠페인이 끝나도 내 주소가 남는다', '유어샵과 거기 담아 둔 이용권은 그대로 남습니다. 매번 새 링크로 시작하는 대신 한 주소에 쌓입니다.'],
      ['FiRefreshCcw', '환불되면 그 건만 회수된다', '환불이나 취소된 주문의 소개비는 자동으로 회수됩니다. 그래서 확정까지 ' + FACTS.clawbackWindow + '을 기다립니다.'],
    ];
    let py = 2.2;
    pts.forEach(([i, h, p]) => {
      iconCircle(s, i, 7.05, py, 0.44);
      T(s, h, { x: 7.7, y: py, w: W - M - 7.7, h: 0.32, fontSize: 13.5, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: 7.7, y: py + 0.36, w: W - M - 7.7, h: 0.75, fontSize: 11, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
      py += 1.18;
    });
    s.addNotes('상품 2888 실측 16,500원. 16,500×42=693,000 · ×12%=83,160 · ×8.8%=7,318(내림) · 75,842. 영입 2%: 693,000×2%=13,860. 원천징수 SSOT tax-withholding.ts (3.3/8.8). 회수: clawback (T+7).');
  }

  // ───────── 06-2 쌓이는 플라이휠 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '협찬은 한 번으로 끝나지만, 이 바퀴는 돌수록 커집니다.', { w: 8 });
    lead(s, '한 바퀴가 돌 때마다 내 유어샵에 이용권과 실적이 남고, 다음 제안이 더 쉽게 옵니다.', { y: 2.0, h: 0.4, w: 7.5 });
    flywheel(s, 4.35, 4.55, 1.62, [
      ['이용권을 소개', '유어샵·콘텐츠에 링크'],
      ['손님이 결제', '내 링크로 자동 귀속'],
      ['매장에서 사용', 'QR 한 번, 노쇼는 환불'],
      ['소개비 확정', FACTS.clawbackWindow + ' 뒤, 유어딜이 지급'],
      ['매장이 다시 제안', '실적이 보이는 사람에게'],
    ], { center: '쌓이는\n플라이휠', centerSub: '유어샵에 남는다' });
    const rx = 8.35, rw = W - M - rx;
    const why = [
      ['FiHome', '유어샵이 남습니다', '캠페인이 끝나도 담아 둔 이용권과 링크는 그대로입니다. 매번 새로 시작하지 않습니다.'],
      ['FiBarChart2', '실적이 보입니다', '내 정산 화면에 딜별 주문과 확정 금액이 쌓입니다. 매장은 공개된 소개자 프로필과 실적을 보고 제안합니다.'],
      ['FiTrendingUp', '매장이 늘수록 커집니다', '내가 데려온 직접 입점 매장은 ' + FACTS.introTerm + '간 ' + FACTS.introPct + '가 따로 붙습니다. 매장 하나가 바퀴 하나를 더 만듭니다.'],
    ];
    let wy = 2.75;
    why.forEach(([i, h, p]) => {
      iconCircle(s, i, rx, wy, 0.44);
      T(s, h, { x: rx + 0.62, y: wy, w: rw - 0.62, h: 0.32, fontSize: 13.5, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: rx + 0.62, y: wy + 0.35, w: rw - 0.62, h: 0.85, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
      wy += 1.32;
    });
    s.addNotes('09-15 참고 덱 "콘텐츠 기반 바이럴 루프" 장치. 각 노드는 현행 기능: 링크 귀속(affiliate) · QR 사용(group-buy-voucher) · 만료 환불(auto-settlement) · T+7 확정 지급(influencer-payout) · 소개자 프로필 공개(/influencer/settlement). "돌수록 커진다"는 구조 설명이지 성과 약속이 아니다.');
  }

  // ───────── PART 3 구분 장 ─────────
  {
    const s = pres.addSlide();
    section(s, { n: 3, name: '어떻게 시작하고, 언제 받나', sub: '제안을 받는 길과 매장을 데려오는 길, 링크를 두는 자리, 정산 시점, 자주 묻는 질문, 신청.', items: ['경로 A · 제안을 받는다', '경로 B · 매장을 데려온다', '유어샵과 채널별 자리', '정산과 원천징수', '신청'] });
  }

  // ───────── 07 경로 A ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '경로 A. 제안을 받고, 공유합니다.', { w: 8.4 });
    lead(s, '매장 섭외가 필요 없습니다. 신청해 두면 조건을 담은 제안이 오고, 수락하면 그 자리에서 팔 수 있습니다. 수락하기 전까지 아무 의무도 생기지 않습니다.', { y: 2.0, h: 0.65, w: 8.2 });
    const steps = [
      ['신청서를 남기고, 프로필을 공개한다', 'urdeal.kr/creators/apply 에 채널과 활동 지역을 적고, 카카오 로그인 뒤 내 정산 화면에서 소개자 프로필을 "공개"로 켭니다. 매장은 공개된 프로필을 보고 제안을 보냅니다. 팔로워 수 하한은 없습니다.'],
      ['제안을 보고 수락한다', '매장이 이용권과 소개비 %, 촬영 지원 여부를 담아 보냅니다. 수락하는 순간 조건이 발효되고 내 전용 링크가 발급됩니다.'],
      ['콘텐츠에 링크를 건다', '스토리, 릴스, 카톡, 유튜브 더보기, 블로그 어디든 됩니다. 유어샵에 담아 두면 콘텐츠가 내려가도 판매는 이어집니다.'],
      ['성과와 정산을 확인한다', '내 정산 화면에서 딜별 주문과 대기, 확정 금액을 봅니다. 매장에 판매량을 물어볼 일이 없습니다.'],
    ];
    let y = 2.95;
    steps.forEach(([h, p], i) => {
      numBadge(s, i + 1, M, y + 0.02, 0.38);
      T(s, h, { x: M + 0.55, y, w: 7.6, h: 0.32, fontSize: 13.5, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: M + 0.55, y: y + 0.34, w: 7.6, h: 0.55, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.4, valign: 'top' });
      y += 0.86;
    });
    takeaway(s, [
      { text: '내가 하지 않아도 되는 일: ', options: { color: C.inkSoft } },
      { text: '가격 협상, 재고, 배송, 결제, 환불 응대, 세금계산서, 쿠폰 코드 확인.', options: { bold: true, color: C.ink } },
    ], { y: y + 0.02, w: 8.2, h: 0.5, size: 11 });
    phone(s, 'influencer-offer', 9.7, 1.05, 5.35, { caption: '매장이 보낸 제안 (예시 데이터로 렌더한 실제 화면)' });
    chip(s, 9.7 - 0.5, 1.05 + 2.35, '소개비 %와 촬영 지원이 먼저 보입니다');
    s.addNotes('CreatorApplyPage(/creators/apply → /api/creator-apply). 제안 수락: /i/offer/:token (InfluencerOfferAcceptPage) → tracking_url 발급. 정산 화면: /influencer/settlement.');
  }

  // ───────── 08 경로 B ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '경로 B. 내가 아는 가게를 데려옵니다. 영입 ' + FACTS.introPct + '가 붙는 유일한 경로입니다.', { size: 25 });
    lead(s, '사장님을 설득하는 일이 아니라, 열어 두면 손해 볼 게 없다는 것을 알려 드리는 일에 가깝습니다. 내 정산 화면의 매장 초대 링크를 보내면 됩니다.', { y: 2.0, h: 0.6 });
    const flow = ['매장을 고른다', '초대 링크를 보낸다', '사장님이 직접 입점한다', '제안이 오면 수락한다'];
    const bw = 1.85, gap = 0.28, by = 2.85;
    flow.forEach((h, i) => {
      const x = M + i * (bw + gap);
      numBadge(s, i + 1, x, by, 0.38);
      T(s, h, { x, y: by + 0.5, w: bw, h: 0.6, fontSize: 12, bold: true, color: C.ink, charSpacing: -0.3, lineSpacingMultiple: 1.2, valign: 'top' });
      if (i < 3) s.addImage({ data: ic.FiArrowGray, x: x + bw + 0.02, y: by + 0.07, w: 0.24, h: 0.24 });
    });
    T(s, '4번부터는 경로 A 와 같습니다. 입점은 카카오 로그인과 사업자 확인이 필요해 사장님이 직접 합니다. 10분이면 끝납니다.', { x: M, y: by + 1.15, w: 8.2, h: 0.5, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.4, valign: 'top' });
    // 사장님께 하는 말
    const qx = M, qy = 4.55, qw = 8.2, qh = 2.2;
    card(s, qx, qy, qw, qh);
    label(s, '사장님께 이렇게 말하면 됩니다', qx + 0.3, qy + 0.2, qw - 0.6);
    const quotes = [
      ['가입비도 월 이용료도 없어요.', '팔린 만큼만 수수료가 나갑니다.'],
      ['새 배달앱이 아니에요.', '온라인에서 할인가로 미리 팔고, 손님은 가게에 와서 QR 로 씁니다.'],
      ['소개비는 사장님이 정하세요.', '미리 나가는 광고비가 없습니다.'],
      ['안 쓴 이용권은 유어딜이 환불해요.', '노쇼로 손해 보는 구조가 아닙니다.'],
    ];
    quotes.forEach(([b, r], i) => {
      const y = qy + 0.55 + i * 0.4;
      T(s, [{ text: b + ' ', options: { bold: true, color: C.ink } }, { text: r, options: { color: C.inkSoft } }], { x: qx + 0.3, y, w: qw - 0.6, h: 0.36, fontSize: 11, valign: 'middle' });
    });
    // 조건 카드
    const cx = 9.3, cw = W - M - cx;
    card(s, cx, 2.85, cw, 3.9, { fill: C.tint });
    T(s, FACTS.introPct + '가 붙는 조건', { x: cx + 0.3, y: 3.05, w: cw - 0.6, h: 0.3, fontSize: 12.5, bold: true, color: C.brand, charSpacing: -0.3 });
    const conds = [
      ['직접 입점', '사장님이 "내 가게에요" 로 등록한 매장만. 대행사를 통해 등록한 매장은 대상이 아닙니다.'],
      [FACTS.introTerm, '입점일부터 ' + FACTS.introTerm + '. 매장이 주인을 바꿔도 유지됩니다.'],
      ['유어딜 몫에서', '사장님 몫에서 떼지 않습니다. 사장님께 부담이 없다고 말씀드려도 됩니다.'],
      ['가기 전에 확인', '사업자등록이 있는지, 손님이 방문해 쓰는 업종인지, 할인가에 팔아도 남는 메뉴가 있는지.'],
    ];
    let cyy = 3.45;
    conds.forEach(([h, p]) => {
      T(s, h, { x: cx + 0.3, y: cyy, w: cw - 0.6, h: 0.26, fontSize: 11, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: cx + 0.3, y: cyy + 0.27, w: cw - 0.6, h: 0.52, fontSize: 9.5, color: C.ink, lineSpacingMultiple: 1.35, valign: 'top' });
      cyy += 0.82;
    });
    s.addNotes('초대 링크: /influencer/settlement 의 /store/new?ref=<id>. 직접 입점 조건: store_channel=direct (08-31 확정, 미지정=미지급). 1년: referral_bonus_until. 주인 변경 유지: 09-07 store-handover 결정.');
  }

  // ───────── 09 유어샵과 유어쇼츠 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '링크는 두 곳에 남습니다.\n내 유어샵과 유어쇼츠.', { w: 5.8, size: 25 });
    const cw = 5.2;
    card(s, M, 2.15, cw, 4.6);
    iconCircle(s, 'FiHome', M + 0.3, 2.45, 0.46);
    T(s, '유어샵 urdeal.kr/u/내주소', { x: M + 0.95, y: 2.5, w: cw - 1.2, h: 0.34, fontSize: 14.5, bold: true, color: C.ink, charSpacing: -0.4 });
    T(s, '가입하면 자동으로 생기는 내 페이지입니다. 이용권을 담아 두면 한 곳에 진열되고, 프로필 링크는 이 주소 하나면 됩니다. 콘텐츠가 내려가도 여기서는 계속 팔립니다.', { x: M + 0.3, y: 3.05, w: cw - 0.6, h: 1.0, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
    kv(s, [['담기', '누구나, 어떤 이용권이든', 0], ['소개비', '매장과 딜이 있는 것만', 1], ['카톡 공유', '미리보기 카드 자동', 0]], M + 0.3, 4.15, cw - 0.6, { rowH: 0.38 });
    iconCircle(s, 'FiVideo', M + 0.3, 5.45, 0.46);
    T(s, '유어쇼츠', { x: M + 0.95, y: 5.5, w: cw - 1.2, h: 0.34, fontSize: 14.5, bold: true, color: C.ink, charSpacing: -0.4 });
    T(s, '세로 영상 아래 구매 버튼이 붙는 자리입니다. 영상 자체에 대한 몫은 없고, 그 이용권에 매장과 맺은 딜이 있을 때 소개비가 붙습니다.', { x: M + 0.3, y: 5.9, w: cw - 0.6, h: 0.75, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.4, valign: 'top' });
    const ux = 6.7, uy = 1.1, uh = 5.5;
    const uw = phone(s, 'ushop', ux, uy, uh, { caption: '유어샵 (라이브 화면)' });
    // 오른쪽: 화면 인출선(참고 덱 셀러 어드민 장치) — 담는 방법 3단계를 화면의 자리에 직접 잇는다
    callouts(s, [
      { label: '프로필 링크는 이 주소 하나', sub: 'urdeal.kr/u/내주소. 스토리, 더보기, 블로그 어디든 이것만 겁니다', tx: 0.55, ty: 0.08 },
      { label: '담은 이용권이 카드로 진열', sub: '이용권 상세의 담기 버튼 한 번. 순서는 바꿀 수 있습니다', tx: 0.5, ty: 0.48 },
      { label: '콘텐츠가 내려가도 여기서 팝니다', sub: '유효기간 동안 계속. 딜이 있는 이용권은 소개비가 붙습니다', tx: 0.5, ty: 0.8 },
    ], { phoneX: ux, phoneY: uy, phoneW: uw, phoneH: uh, listX: ux + uw + 0.55, listW: W - M - (ux + uw + 0.55), listY: 1.6, gap: 1.75, side: 'left' });
    s.addNotes('유어샵: CuratorPage /u/:handle (핀). 유어쇼츠: /videos (urshorts.routes, 크리에이터 몫 0 — 09-08 동의 게이트 폐기). 담기 보상 0 (affiliate_program_enabled OFF). 인출선 좌표는 ushop.jpg 실측(프로필 8% · 첫 카드 48% · 아래 카드 80%).');
  }

  // ───────── 09-2 채널별로 링크를 어디에 두나 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '내 채널이 무엇이든, 링크를 둘 자리는 정해져 있습니다.', { size: 25 });
    lead(s, '어느 채널이든 결제로 이어진 것만 소개비로 잡힙니다. 조회수와 좋아요는 세지 않습니다. 그래서 팔로워가 적어도 동네 손님이 사면 돈이 됩니다.', { y: 1.95, h: 0.62 });
    const chans = [
      ['FiSearch', '네이버 블로그', '"동네 + 메뉴" 검색에 오래 남는 글', ['글 본문과 마지막에 이용권 링크를 둡니다', '가게 이름과 메뉴를 제목에 넣습니다', '한 번 쓴 글이 유효기간 동안 계속 팝니다']],
      ['FiVideo', '유튜브 · 쇼츠', '먹는 장면으로 설득하는 영상', ['설명란과 고정 댓글에 링크를 둡니다', '쇼츠는 매장 근처 시청자에게 짧게 닿습니다', '영상 하나에 이용권 여러 개를 함께 소개합니다']],
      ['FiCamera', '인스타그램 · 릴스', '동네 감성과 단골 손님', ['프로필 링크를 내 유어샵 주소로 둡니다', '릴스와 스토리에서 이용권을 바로 안내합니다', '팔로워가 적어도 동네 손님이면 결제가 납니다']],
      ['FiSmartphone', '유어쇼츠', '이용권 페이지 안의 세로 영상', ['유어딜 홈과 이용권 상세에 영상이 실립니다', '영상 아래 구매 버튼으로 바로 결제합니다', '외부 채널 없이도 딜이 있으면 소개비가 붙습니다']],
    ];
    const cw = (W - 2 * M - 0.75) / 4, cy = 2.7, ch = 4.0;
    chans.forEach(([i, h, sub, items], k) => {
      const x = M + k * (cw + 0.25);
      card(s, x, cy, cw, ch);
      iconCircle(s, i, x + 0.28, cy + 0.28, 0.46);
      T(s, h, { x: x + 0.28, y: cy + 0.88, w: cw - 0.5, h: 0.32, fontSize: 13.5, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, sub, { x: x + 0.28, y: cy + 1.2, w: cw - 0.5, h: 0.3, fontSize: 10, color: C.brand, bold: true });
      qa3(s, x + 0.28, cy + 1.58, cw - 0.5, '이렇게 씁니다', items, { rowH: 0.6 });
    });
    s.addNotes('전용 링크: influencer-deals 수락 시 발급. 유어샵 /u/:handle. 유어쇼츠 /videos + 상세 ProductShortsField. 결제 기준 커미션: order-commissions.ts. 채널별 안내는 사용법이지 성과 약속이 아니다.');
  }

  // ───────── 10 정산은 언제 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '정산은 이렇게 됩니다. 매장에 돈을 달라고 할 일이 없습니다.');
    lead(s, '귀속부터 송금까지 유어딜이 처리합니다. 화면에서 대기, 확정, 지급을 그대로 봅니다.', { y: 2.0, h: 0.4 });
    const steps = [
      ['링크로 귀속', '내 링크로 들어온 주문에 자동으로 연결됩니다. 코드를 확인할 일이 없습니다.'],
      [FACTS.clawbackWindow + ' 뒤 확정', '환불 가능 기간이 지나면 지급 가능 상태가 됩니다. 환불된 건은 그 건만 회수됩니다.'],
      [FACTS.influencerPayoutDay + ' 집계', '지급 가능 금액을 모아 정산 대기로 올립니다. 화면에서 바로 보입니다.'],
      ['유어딜이 확인 후 지급', '현금은 ' + FACTS.influencerPayoutMin + '부터, 원천징수를 뗀 뒤 등록 계좌로. 딜로 받으면 하한 없이 유어딜 잔액으로.'],
    ];
    const bw = 1.95, gap = 0.28, by = 2.85;
    steps.forEach(([h, p], i) => {
      const x = M + i * (bw + gap);
      numBadge(s, i + 1, x, by, 0.4);
      T(s, h, { x, y: by + 0.55, w: bw, h: 0.6, fontSize: 12.5, bold: true, color: C.ink, charSpacing: -0.3, lineSpacingMultiple: 1.2, valign: 'top' });
      T(s, p, { x, y: by + 1.15, w: bw, h: 1.3, fontSize: 10, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
      if (i < 3) s.addImage({ data: ic.FiArrowGray, x: x + bw + 0.02, y: by + 0.08, w: 0.24, h: 0.24 });
    });
    card(s, M, 5.4, 8.6, 1.35, { fill: C.tint });
    T(s, '원천징수는 법대로, 대신 계산은 유어딜이', { x: M + 0.3, y: 5.55, w: 8.0, h: 0.3, fontSize: 12, bold: true, color: C.ink, charSpacing: -0.3 });
    T(s, '사업자는 사업소득 3.3%, 비사업자는 기타소득 8.8%를 떼고 보냅니다. 8.8%는 이듬해 5월 종합소득세 신고에서 정산되며 돌려받을 수 있습니다. ' + FACTS.influencerPayoutMin + '에 못 미치면 다음 달로 이월되고 사라지지 않습니다. 계좌와 사업자번호는 내 정산 화면에서 직접 넣습니다.', { x: M + 0.3, y: 5.87, w: 8.0, h: 0.8, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.4, valign: 'top' });
    phone(s, 'influencer-settlement', 10.0, 1.05, 5.35, { caption: '내 정산 화면 (예시 데이터)' });
    s.addNotes('influencer-payout.ts: T+7 available, 매월 1일 18시 KST 집계, 현금 최소 influencer_payout_min(기본 100,000), 딜 수령은 하한 없음, 실제 지급은 어드민 /admin/influencer-payouts (사람). 원천징수 WITHHOLDING_RATES 3.3/8.8.');
  }

  // ───────── 11 정직하게 + FAQ ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '협찬은 한 번 받고 끝나지만, 이 구조는 남습니다.');
    lead(s, '캠페인이 끝나도 내 유어샵과 링크는 그대로 남고, 매장과 맺은 딜은 계속 쌓입니다. 자주 묻는 질문에 먼저 답해 두었습니다.', { y: 2.0, h: 0.6 });
    const faq = [
      ['팔로워가 적어도 되나요?', '하한이 없습니다. 오히려 지역과 카테고리가 뚜렷한 채널이 동네 이용권과 잘 맞습니다.'],
      ['비용이 드나요?', '가입비도 이용료도 없습니다. 소개비는 매장이, 영입비는 유어딜이 냅니다.'],
      ['콘텐츠 형식이 정해져 있나요?', '자유입니다. 제안에 조건이 붙어 있으면 그 조건을 지켜야 그 소개비가 발효됩니다.'],
      ['소개비가 안 붙는 이용권도 있나요?', '있습니다. 매장과 맺은 딜이 없는 이용권은 담아 둘 수는 있지만 소개비가 0 입니다.'],
      ['광고 표시를 해야 하나요?', '네. 소개비를 받는 콘텐츠에는 "광고" 처럼 경제적 대가를 받았다는 표시가 법으로 필요합니다. 표시 없이 올린 콘텐츠의 책임은 유어딜이 대신 질 수 없습니다.'],
      ['제안은 어떻게 오나요?', '신청서는 유어딜 담당자가 보고, 매장은 내가 공개해 둔 소개자 프로필을 보고 직접 보냅니다. 둘 다 해 두는 것이 빠릅니다.'],
    ];
    const cw = (W - 2 * M - 0.5) / 3, ch = 1.75;
    faq.forEach(([q, a], i) => {
      const x = M + (i % 3) * (cw + 0.25), y = 2.8 + Math.floor(i / 3) * (ch + 0.25);
      card(s, x, y, cw, ch);
      T(s, q, { x: x + 0.3, y: y + 0.24, w: cw - 0.6, h: 0.3, fontSize: 12.5, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, a, { x: x + 0.3, y: y + 0.62, w: cw - 0.6, h: 1.05, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
    });
    s.addNotes('09-14: 정직 고지 블록 제거(대표 — 사장님 덱과 같은 판단). FAQ 6 개를 크게.');
  }

  // ───────── 11-2 두 경로와 정산, 한 장에 (절차 3열) ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '두 경로와 정산을 한 장에 놓았습니다. 어느 열이든 내가 내는 돈은 없습니다.', { size: 25 });
    lead(s, '경로 A 와 B 는 4번부터 같은 길로 합쳐지고, 정산은 유어딜이 합니다.', { y: 2.0, h: 0.4 });
    procedureColumns(s, [
      { title: '경로 A · 제안을 받는다', hi: true, steps: ['urdeal.kr/creators/apply 에 신청 (3분)', '카카오 로그인 뒤 소개자 프로필 공개', '매장 제안 수신 (소개비 %, 촬영 지원)', '수락하면 전용 링크 발급', '콘텐츠와 유어샵에 링크', '정산 화면에서 주문·확정 확인'], note: '수락 전까지 아무 의무도 없습니다' },
      { title: '경로 B · 매장을 데려온다', steps: ['아는 사장님 가게를 고른다', '정산 화면의 매장 초대 링크를 보낸다', '사장님이 본인 카카오로 직접 입점 (10분)', '그 매장 매출의 ' + FACTS.introPct + '가 ' + FACTS.introTerm + '간 나에게', '매장 제안이 오면 경로 A 와 같다', '정산 화면에서 영입분 확인'], note: '직접 입점 매장만. 유어딜 몫에서 냅니다' },
      { title: '정산 · 유어딜이 한다', steps: ['링크로 들어온 주문에 자동 귀속', FACTS.clawbackWindow + ' 뒤 확정 (환불 건은 그 건만 회수)', FACTS.influencerPayoutDay + ' 지급 가능 금액 집계', '현금은 ' + FACTS.influencerPayoutMin + '부터, 원천징수 뒤 송금', '딜로 받으면 하한 없이 잔액으로', '못 미치면 다음 달로 이월'], note: '매장에 돈을 달라고 할 일이 없습니다' },
    ], { y: 2.55, h: 4.2 });
    s.addNotes('09-15 참고 덱 "광고 집행 절차" 장치. 사실: creator-apply · /i/offer/:token 수락 · /store/new?ref= 초대 · influencer-payout.ts(T+7 · 매월 1일 · 10만원 · 딜 하한 없음 · 이월).');
  }

  // ───────── 12 신청 + 연락처 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '지금 하실 일은 신청서를 남기는 것, 그것뿐입니다.');
    lead(s, '수락하기 전까지 아무 의무도 생기지 않습니다. 조건을 보고 마음에 들지 않으면 수락하지 않으면 됩니다.', { y: 2.0, h: 0.4, w: 7.6 });
    const x = M, w = 7.6;
    const steps = [['신청 (3분)', 'urdeal.kr/creators/apply 에 신청하고, 로그인 뒤 내 정산 화면에서 소개자 프로필을 공개합니다.'], ['제안 수신', '조건이 맞는 매장의 제안을 받습니다. 수락 여부는 매번 내가 정합니다.'], ['공유와 정산', '링크를 걸고, 성과와 정산은 내 정산 화면에서 확인합니다.']];
    steps.forEach(([h, p], i) => {
      const y = 2.75 + i * 0.72;
      numBadge(s, i + 1, x, y, 0.36);
      T(s, h, { x: x + 0.5, y: y - 0.02, w: 2.2, h: 0.4, fontSize: 12.5, bold: true, color: C.ink, valign: 'middle', charSpacing: -0.3 });
      T(s, p, { x: x + 2.7, y: y - 0.02, w: w - 2.7, h: 0.4, fontSize: 10.5, color: C.inkSoft, valign: 'middle' });
    });
    // 연락처 카드
    const cx = M, cw = 4.6, cy = 5.05, ch = 1.75;
    card(s, cx, cy, cw, ch, { fill: C.ink });
    const contacts = [['FiGlobeW', 'urdeal.kr/creators/apply', '신청'], ['FiMessageW', FACTS.kakaoChannel, '카카오톡 채널 상담'], ['FiMailW', FACTS.contactEmail, '제휴 문의']];
    let ky = cy + 0.22;
    contacts.forEach(([i, v, l]) => {
      s.addImage({ data: ic[i], x: cx + 0.3, y: ky + 0.06, w: 0.22, h: 0.22 });
      T(s, v, { x: cx + 0.65, y: ky, w: cw - 0.9, h: 0.3, fontSize: 12, bold: true, color: C.darkText, charSpacing: -0.3 });
      T(s, l, { x: cx + 0.65, y: ky + 0.27, w: cw - 0.9, h: 0.2, fontSize: 8.5, color: C.darkMuted });
      ky += 0.5;
    });
    T(s, FACTS.biz, { x: cx + cw + 0.3, y: cy + ch - 0.3, w: 3.2, h: 0.26, fontSize: 9, color: C.gray });
    phone(s, 'creators-apply', 9.7, 1.05, 5.35, { caption: '신청 폼 (라이브 화면)' });
    s.addNotes('신청: /creators/apply → /api/creator-apply. 연락처는 대표 지정값(사장님 덱과 동일).');
  }

  await pres.writeFile({ fileName: OUT });
  console.log('wrote', OUT, '(20 slides)');
})();
