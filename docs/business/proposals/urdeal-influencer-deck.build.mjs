// 유어딜 인플루언서 제휴 소개서 (.pptx) 생성기 — v4 (2026-09-19). 16:9 · Pretendard · 라이브 캡처 · 예시 데이터 화면
// v4 (대표 확정 플로우 — docs/decisions/2026-09-19-broker-matching-flow.md): 매칭은 "제안·수락" 이 아니라 **매장 코드**로.
//   경로 A = 대행사(중개사)가 보낸 코드 링크 한 탭 → 가입 + 즉시 매칭(직접 온 사람은 마이페이지 코드 입력) → 마이페이지에 **매장 단위 고유 링크**
//   (복사·카톡 공유, 이용권이 바뀌어도 그대로). 경로 B = 중개사 계정으로 매장 등록 → 코드 자동 생성 + 중개사 몫 % · 소개비 % 를 그때 정함 →
//   사장님이 가입하며 코드를 입력해 주인(등록증 확인 그대로 · 첫 정산 전까지만) → 중개사 몫도 유어딜이 직접 송금(09-16 결재).
//   소개비 %는 협업 코드의 기본값(매장 등록 때 정한 상한 안) + 딜별 조정. 07 경로 A 재작업 완료(대표 "마지막에" 항목).
//   ✅ 코드는 같은 날 PR #1499 로 main 에 있다(승계 코드 · 협업 코드 · /i/join/:code · 매장 링크 · 딜 % 조정). 중개사 몫 송금만 게이트 OFF.
// v3 (대표 20장 전수 지시): 인플루언서는 **중개사 계정**으로 가입한다 → 유어딜 수수료는 직접 10% 가 아니라 **중개 5%** 흐름으로 구성.
//   영입 2%(직접 입점 1년) 규정은 **폐지** — 덱 전체에서 제거. 카드 수수료(2.75%)는 이 덱에서 말하지 않는다(대표: 굳이 나타내지 않아도 됨).
//   정산 시점은 "7일 뒤 확정" 이 아니라 **팔로워가 이용권을 사용한 뒤** 로 말한다(대표 지시). 원천징수 문단은 뺀다("차감 별도" 한 줄만).
//   화면: 유어샵 재캡처(사진 3장 전부 로드) · 이용권이 붙은 유어쇼츠(라이브 /videos) · 이용권 지갑·QR 사용 화면(예시 데이터) 신규.
//   경로/신청 장의 `urdeal.kr/creators/apply` 같은 날 링크는 전부 제거 — 연락처는 https:// 전체 주소 + 실제 하이퍼링크.
//   (07 경로 A 는 v4 에서 확정 플로우로 재작업했다.)
// v2 (2026-09-15): 참고 덱(히로인스) 장치 — PART 구분 장 3 + 우상단 라벨 · 플라이휠 · 페르소나 · 인출선 · 절차 3열 · 결론 바.
// 기획: docs/business/proposals/three-decks-plan-2026-09.md §3 · 사실 SSOT: 같은 문서 §0 + docs/design/actor-benefit-map.md
// 재생성: cd /tmp/deck && npm i pptxgenjs sharp react react-dom react-icons
//         SHOTS_DIR=<캡처 폴더> node urdeal-influencer-deck.build.mjs out.pptx
import path from 'node:path';
import { createDeck, C, W, H, M, FACTS, __dirname } from './deck-common.mjs';

const OUT = process.argv[2] || path.join(__dirname, 'urdeal-influencer-deck.pptx');
const SHOTS_DIR = process.env.SHOTS_DIR || path.join(__dirname, 'shots');
const SITE_URL = 'https://' + FACTS.site;
const KAKAO_URL = 'https://' + FACTS.kakaoChannel;

(async () => {
  const d = await createDeck({
    title: '유어딜 인플루언서 제휴 소개서', footer: '유어딜 인플루언서 제휴 소개', shotsDir: SHOTS_DIR,
    shotKeys: ['home', 'detail', 'voucher-wallet', 'voucher-qr', 'ushop', 'shorts', 'influencer-settlement'],
    icons: ['FiLink', 'FiPackage', 'FiTruck', 'FiHeadphones', 'FiSend', 'FiInbox', 'FiGift', 'FiEdit3', 'FiUserPlus', 'FiBriefcase',
      ['SiNaver', '03C75A'], ['SiYoutube', 'FF0000'], ['SiInstagram', 'E4405F']],
  });
  const { pres, ic, T, chrome, title, lead, card, iconCircle, numBadge, hr, label, phone, kv, customerSteps, cover, chip, qa3, section, takeaway, flywheel, personas, callouts, procedureColumns } = d;

  // ───────── 00 로고 표지 ─────────
  {
    const s = pres.addSlide();
    cover(s, { deckName: '인플루언서 제휴 소개서', sub: '체험단의 시대는 끝. 제품 공동구매처럼, 맛집, 숙소권, 네일샵 이용권을 공동구매하는 시대입니다.', dark: true });
  }

  // ───────── 01 표지 ─────────
  {
    const s = pres.addSlide();
    chrome(s, { dark: true });
    T(s, '나의 팔로워들에게\n할인된 이용권을\n제공하세요.', { x: M, y: 1.35, w: 7.4, h: 2.7, fontSize: 46, bold: true, color: C.darkText, lineSpacingMultiple: 1.05, charSpacing: -1.5, valign: 'top' });
    T(s, '동네에서 진짜 쓰는 이용권을 팔로워에게 건넵니다. 매장이 정한 소개비 %가 내 링크로 팔린 건마다 쌓입니다. 재고도 배송도 응대도 내 몫이 아닙니다.',
      { x: M, y: 4.2, w: 7.0, h: 0.9, fontSize: 13.5, color: C.darkMuted, lineSpacingMultiple: 1.5, valign: 'top' });
    const stats = [['매장이 정한 %', '이용권 판매 소개비.\n판매가 기준, 협업 코드에 실린 값'], [FACTS.feeBrokered, '유어딜 수수료.\n중개사 계정으로 등록한 매장 기준'], ['0원', '가입비, 이용료,\n내가 내는 비용']];
    stats.forEach(([n, l], i) => {
      const x = M + i * 2.45;
      T(s, n, { x, y: 5.15, w: 2.4, h: 0.6, fontSize: i === 0 ? 24 : 36, bold: true, color: C.darkText, charSpacing: -1.2, valign: 'middle' });
      T(s, l, { x, y: 5.8, w: 2.35, h: 0.6, fontSize: 10, color: C.darkMuted, lineSpacingMultiple: 1.35, valign: 'top' });
    });
    const px = 9.3, py = 1.1, ph = 5.7;
    phone(s, 'shorts', px, py, ph, { dark: true });
    chip(s, px - 0.55, py + ph * 0.77, '영상 아래에서 바로 결제, 매칭된 매장이면 소개비');
    s.addNotes('딜 소개비: 매장 제안 %, 상한 없음, 매장 부담(actor-benefit-map Q2-1). 유어딜 5%: 중개(brokered) 채널 fee-resolver.ts. 영입 2% 는 2026-09-19 대표 지시로 폐지 — 덱에서 제거. 화면: 유어쇼츠 /videos?v=jHPacJoCEt8 (라이브, 이용권 붙은 영상 · 재생 자리는 이 환경에서 유튜브가 막혀 어둡게 대체).');
  }

  // ───────── PART 1 구분 장 ─────────
  {
    const s = pres.addSlide();
    section(s, { n: 1, name: '유어딜로 수익 창출 방법', sub: '제품 공동구매만? 이젠 맛집, 숙박권, 네일샵 이용권 공동구매. 이용권 판매 당 나도 수익을 얻으세요.', items: ['이용권, 유어샵, 내 링크', '팔로워가 이용권을 구매하기까지', '이런 채널에 맞습니다'] });
  }

  // ───────── 02 이게 뭔가 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '제품 공동구매만? 이젠 맛집, 숙박권, 네일샵 이용권 공동구매!', { w: 8.4, size: 25 });
    lead(s, '유어딜은 식당, 카페, 뷰티, 숙박 이용권을 온라인 할인가로 파는 로컬 커머스입니다.\n손님은 미리 사고, 가게에 가서 QR 로 씁니다. 택배가 오가지 않으니 품절도 오배송도 반품도 없습니다.', { y: 2.15, h: 0.85, w: 8.2 });
    const items = [
      ['FiTag', '이용권', '식사, 뷰티, 숙박, 액티비티. 할인가와 유효기간은 매장이 정합니다. 유효기간이 지나도 안 쓴 이용권은 유어딜이 손님에게 100% 환불합니다.'],
      ['FiHome', '가입하면 누구나 유어샵', '나의 수익이 될 이용권들 모음집 링크, 즉 나의 이용권 쇼핑몰 링크가 생깁니다. 프로필 링크에 해당 링크만 걸고 유입시키세요.'],
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
    title(s, '팔로워가 이용권을 구매하기까지');
    lead(s, '이용권 결제 후 사용까지에 대한 프로세스입니다.', { y: 2.0, h: 0.4 });
    customerSteps(s, { y: 3.1, h: 3.1, keys: ['home', 'detail', 'voucher-wallet', 'voucher-qr'], caps: ['찾기: 홈에서 동네 이용권', '결제: 정가와 할인가를 함께', '발급: 결제 즉시 내 이용권 지갑', '사용: 매장에서 QR 제시'] });
    s.addNotes('캡처 4장: home / detail (라이브) · voucher-wallet / voucher-qr (/my-vouchers, 예시 데이터로 렌더한 실제 화면). 2026-09-19: 4번째가 유어샵이던 것을 실제 QR 사용 화면으로 교체(대표 지적).');
  }

  // ───────── 03-2 이런 채널에 맞습니다 (페르소나 + 말풍선) ─────────
  {
    const s = pres.addSlide();
    chrome(s, { dark: true });
    title(s, '이런 채널에 맞습니다. 팔로워 수보다 동네와 주제가 먼저입니다.', { dark: true });
    lead(s, '조회수와 좋아요는 세지 않고 결제만 셉니다. 그래서 큰 채널보다 지역과 카테고리가 뚜렷한 채널이 잘 맞습니다.', { y: 2.0, h: 0.4, dark: true });
    personas(s, [
      ['FiEdit3', '동네 맛집 블로거', '"음식, 이용권 체험만 하고 수익 창출을 하기 어려워요."', ['글 안 링크로 팔린 건마다 소개비. 글은 유효기간 내내 팝니다', '팔로워 하한 없음. 지역과 메뉴가 뚜렷할수록 맞습니다']],
      ['FiVideo', '지역 유튜버 · 쇼츠', '"우리 팔로워들에게 혜택을 많이 주고 싶어요."', ['설명란 링크 하나로 할인 이용권 여러 개를 함께 건넵니다', '영상이 내려가도 유어샵에서는 계속 팔립니다']],
      ['FiCamera', '팔로워가 적은 인스타', '"천 명도 안 되는데 될까요?"', ['됩니다. 동네 손님 열 명이 결제하면 그게 소개비입니다', '프로필 링크는 유어샵 하나면 됩니다']],
      ['FiMapPin', '아는 사장님이 있는 사람', '"단골 가게 사장님을 소개해 드릴 수 있어요."', ['중개사 계정으로 매장을 등록하면 유어딜 수수료는 ' + FACTS.feeBrokered + ' 입니다', '중개사 몫 %와 인플루언서 상한 %는 등록 때 정하고, 사장님은 매장 코드로 가입해 주인이 됩니다']],
    ], { y: 2.6, rowH: 0.92, gap: 0.14 });
    s.addNotes('09-15 참고 덱 "이런 브랜드에게 추천합니다" 장치. 사실: 결제 기준 커미션(order-commissions.ts) · 팔로워 하한 없음 · 중개 채널 5%(fee-resolver.ts store_channel=brokered). 영입 2% 문구 제거(09-19).');
  }

  // ───────── PART 2 구분 장 ─────────
  {
    const s = pres.addSlide();
    section(s, { n: 2, name: '유어딜 정산 프로세스', sub: '손님이 낸 돈이 갈리는 그림, 내 몫이 붙는 자리, 실제 이용권으로 넣은 계산, 그리고 왜 쌓이는지.', items: ['돈의 흐름', '수익 두 갈래', '계산해 보면', '쌓이는 플라이휠'] });
  }

  // ───────── 04 돈의 흐름 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '손님이 낸 돈은 이렇게 갈립니다. 내 몫은 사장님 몫 안에서 나옵니다.');
    lead(s, '사장님과 대행사에게 보여드리는 그림과 같은 그림입니다. 숫자를 숨기지 않습니다.', { y: 2.0, h: 0.4 });
    const bw = 2.2, gap = 0.5, by = 2.6, bh = 0.78;
    const nodes = [['손님', '이용권 결제', C.surface], ['유어딜', FACTS.feeBrokered, C.ink], ['사장님', '나머지 95%', C.tint], ['나', '판매가 × 소개비 %', C.brand]];
    nodes.forEach(([h, sub, fill], i) => {
      const x = M + i * (bw + gap);
      const dk = fill === C.ink || fill === C.brand;
      card(s, x, by, bw, bh, { fill });
      T(s, h, { x, y: by + 0.1, w: bw, h: 0.32, fontSize: 14, bold: true, color: dk ? 'FFFFFF' : (i === 2 ? C.brand : C.ink), align: 'center', charSpacing: -0.3 });
      T(s, sub, { x, y: by + 0.42, w: bw, h: 0.26, fontSize: 10, color: fill === C.ink ? C.brand : dk ? 'CFE0FD' : C.inkSoft, align: 'center', bold: dk });
      if (i < 3) s.addImage({ data: ic.FiArrowGray, x: x + bw + 0.13, y: by + bh / 2 - 0.12, w: 0.24, h: 0.24 });
    });
    const drop = (i, big, small, { hi = false } = {}) => {
      const x = M + i * (bw + gap);
      s.addShape(pres.shapes.LINE, { x: x + bw / 2, y: by + bh, w: 0, h: 0.32, line: { color: C.gray, width: 0.75, endArrowType: 'triangle' } });
      if (hi) card(s, x - 0.12, by + bh + 0.34, bw + 0.24, 1.52, { fill: C.tint });
      T(s, big, { x, y: by + bh + 0.42, w: bw, h: 0.34, fontSize: 15, bold: true, color: hi ? C.brand : C.ink, align: 'center', charSpacing: -0.5 });
      T(s, small, { x: x - 0.1, y: by + bh + 0.78, w: bw + 0.2, h: 1.0, fontSize: 9.5, color: hi ? C.ink : C.inkSoft, align: 'center', lineSpacingMultiple: 1.35, valign: 'top' });
    };
    drop(1, FACTS.feeBrokered, '중개사 계정으로 등록한 매장.\n사장님이 직접 등록한 매장은 ' + FACTS.feeDirect + '.\n팔린 만큼만, 가입비와 월 이용료 없음');
    drop(2, '95%', '사장님 몫.\n소개비는 이 안에서 냅니다.\n미리 나가는 광고비가 없습니다');
    drop(3, '소개비 %', '협업 코드에 실린 비율.\n내 매장 링크로 팔린 건마다,\n유어딜이 대신 정산', { hi: true });
    const cy2 = 5.35, cw2 = (W - 2 * M - 0.3) / 2, ch2 = 1.15;
    [['소개비는 매장이 냅니다', '플랫폼이 정한 고정 요율이 아닙니다. 협업 코드에 실린 비율이 그대로 적립되고, 매장과 조정하면 이후 판매분부터 바뀝니다. 유어딜이 중간에서 깎지 않습니다.'],
     ['정산은 유어딜이 합니다', '매장에 돈을 달라고 할 일이 없습니다. 팔로워가 이용권을 쓰면 내 정산 화면에 확정 금액이 쌓이고, 유어딜이 등록 계좌로 보냅니다.']].forEach(([h, p], i) => {
      const x = M + i * (cw2 + 0.3);
      card(s, x, cy2, cw2, ch2);
      T(s, h, { x: x + 0.25, y: cy2 + 0.14, w: cw2 - 0.5, h: 0.28, fontSize: 11.5, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: x + 0.25, y: cy2 + 0.44, w: cw2 - 0.5, h: 0.7, fontSize: 9.5, color: C.inkSoft, lineSpacingMultiple: 1.35, valign: 'top' });
    });
    s.addNotes('직접 10% / 중개 5%: fee-resolver.ts. 카드 수수료(약 2.75%)는 이 덱에서 말하지 않는다(09-19 대표). 소개비 %: 협업 코드 기본값(store-codes.ts) + 딜별 조정(collab-codes.ts PATCH), 상한 = influencer_pct_cap — PR #1499. 영입 2% 제거(09-19).');
  }

  // ───────── 05 수익 두 갈래 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '수익은 두 갈래입니다. 둘 다 내 링크로 팔린 뒤에만 붙습니다.');
    const cw = (W - 2 * M - 0.35) / 2, cy = 2.15, ch = 3.05;
    const cols = [
      ['FiPercent', '매칭된 매장의 이용권 소개비', '결제 금액 × 협업 코드의 %',
        '대행사(중개사)가 보낸 링크를 탭하면 가입과 동시에 매장과 매칭됩니다. 마이페이지에 생기는 매장 링크로 팔린 건마다 코드에 실린 소개비 %가 쌓입니다. %는 매장과 조정할 수 있고, 유어딜이 떼지 않습니다. 이용권이 바뀌어도 링크는 그대로입니다.',
        [['재원', '사장님 몫 안에서', 0], ['비율', '코드 기본 %, 딜마다 조정 가능', 1], ['매칭', '링크 한 탭, 또는 코드 입력', 2]]],
      ['FiBriefcase', '내가 섭외한 매장의 이용권', '그 매장 판매가 × 등록 때 정한 중개사 몫 %',
        '중개사 계정으로 아는 가게를 등록하면 매장 코드가 생기고, 그때 중개사 몫 %와 인플루언서 상한 %를 정합니다. 사장님은 그 코드로 가입해 주인이 되고 나는 운영자로 남습니다. 팔린 건마다 중개사 몫이 쌓여 유어딜이 직접 보냅니다.',
        [['유어딜 수수료', FACTS.feeBrokered + ' (직접 등록은 ' + FACTS.feeDirect + ')', 0], ['중개사 몫', '등록 때 정한 %, 유어딜이 송금', 1], ['등록', '셀러 대시보드 중개사 계정', 2]]],
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
    T(s, '매장과 매출을 함께 높여갑니다', { x: M + 0.3, y: 5.6, w: W - 2 * M - 0.6, h: 0.3, fontSize: 12.5, bold: true, color: C.ink, charSpacing: -0.3 });
    T(s, '나의 팔로워들이 매장 사장님들에게 수익을 가져다줄 수 있도록 힘써주세요. 팔린 만큼 사장님도 나도 버는 구조라, 실적이 보이는 사람에게 대행사는 다음 매장의 링크를 먼저 보냅니다.',
      { x: M + 0.3, y: 5.92, w: W - 2 * M - 0.6, h: 0.65, fontSize: 10.5, color: C.ink, lineSpacingMultiple: 1.4, valign: 'top' });
    s.addNotes('09-19 확정 플로우 — PR #1499 구현: 협업 코드(기본 % · 승인 옵션) → /i/join/:code 또는 마이페이지 입력 → seller_influencer_deals 활성 · 매장 링크 /s/{id}?ref= · 두 요율(broker_share_pct · influencer_pct_cap)은 매장 등록 때 · 중개사 몫 적립 broker-share.ts 는 게이트 broker_share_enabled OFF(S-BROKER 뒤 대표가 켠다). 영입 2% 열은 09-19 폐지.');
  }

  // ───────── 06 계산해 보면 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '인플루언서가 영향력으로 유어딜에서 수익을 얻을 때', { size: 25 });
    card(s, M, 2.15, 5.9, 4.65);
    const x = M + 0.35, w = 5.2;
    label(s, '가정: 치즈돈가스 2인 세트 이용권을 한 달에 42건 팔았다', x, 2.35, w);
    const yEnd = kv(s, [
      ['이용권 판매가 (정가 25,000원의 34% 할인)', '16,500원', 0], ['42건 판매 금액', '693,000원', 0, true],
      ['협업 코드의 소개비 12%', '× 12%', 1, true],
      ['내 수익', '83,160원', 2],
    ], x, 2.7, w, { rowH: 0.43 });
    card(s, x, yEnd + 0.2, w, 1.15, { fill: C.tint });
    T(s, '83,160원', { x: x + 0.3, y: yEnd + 0.32, w: w - 0.6, h: 0.5, fontSize: 26, bold: true, color: C.brand, charSpacing: -1 });
    T(s, '이 달 내 소개비. 내가 낸 돈은 0원이고, 재고와 배송과 응대도 없습니다.', { x: x + 0.3, y: yEnd + 0.84, w: w - 0.6, h: 0.4, fontSize: 10.5, color: C.ink, valign: 'top' });
    T(s, '원천징수 차감 별도', { x, y: 6.45, w, h: 0.25, fontSize: 9, color: C.gray });
    const pts = [
      ['FiXCircle', '내가 내는 돈이 없다', '가입비도 이용료도 없습니다. 소개비는 매장이 내고 유어딜이 대신 정산합니다. 내 지출이 생기는 지점이 없습니다.'],
      ['FiPackage', '재고, 배송, 반품 응대가 없다', '이용권은 매장에서 쓰는 권리라 택배가 오가지 않습니다. 공동구매를 열었다가 품절 문의를 혼자 받는 일이 생기지 않습니다.'],
      ['FiHome', '마감기한 없이 매장 이용권 판매하기', '내 이용권 쇼핑몰 링크인 유어샵을 통해 끊임없이 수익을 창출하세요. 캠페인이 끝나도 담아 둔 이용권은 그대로 팔립니다.'],
      ['FiRefreshCcw', '환불 걱정 0%', '환불이나 취소된 주문의 소개비는 자동으로 정리됩니다. 그래서 팔로워가 이용권을 사용한 뒤 정산됩니다.'],
    ];
    let py = 2.2;
    pts.forEach(([i, h, p]) => {
      iconCircle(s, i, 7.05, py, 0.44);
      T(s, h, { x: 7.7, y: py, w: W - M - 7.7, h: 0.32, fontSize: 13.5, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: 7.7, y: py + 0.36, w: W - M - 7.7, h: 0.75, fontSize: 11, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
      py += 1.18;
    });
    s.addNotes('상품 2888 실측 16,500원. 16,500×42=693,000 · ×12%=83,160. 원천징수(tax-withholding.ts 3.3/8.8)는 "차감 별도" 한 줄만(09-19 대표). ⚠️ 코드의 인플루언서 소개비 확정은 available_at=결제+7일(helpers.ts) — 덱은 대표 지시대로 "이용권 사용 뒤" 로 말한다. 코드와 문구가 다르므로 대표 확인 필요.');
  }

  // ───────── 06-2 쌓이는 플라이휠 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '영향력과 수익을 끊임없이 키워가는 구조', { w: 8 });
    lead(s, '한 바퀴가 돌 때마다 내 유어샵에 이용권과 실적이 남고, 다음 매장의 링크가 더 쉽게 옵니다.', { y: 2.0, h: 0.4, w: 7.5 });
    flywheel(s, 4.35, 4.55, 1.62, [
      ['이용권을 소개', '유어샵·콘텐츠에 링크'],
      ['손님이 결제', '내 링크로 자동 귀속'],
      ['매장에서 사용', 'QR 한 번, 노쇼는 환불'],
      ['소개비 확정', '사용 뒤, 유어딜이 지급'],
      ['다음 매장 링크', '실적이 보이는 사람에게'],
    ], { center: '쌓이는\n플라이휠', centerSub: '유어샵에 남는다' });
    const rx = 8.35, rw = W - M - rx;
    const why = [
      ['FiHome', '유어샵이 남습니다', '캠페인이 끝나도 담아 둔 이용권과 링크는 그대로입니다. 매번 새로 시작하지 않습니다.'],
      ['FiBarChart2', '실적이 보입니다', '마이페이지에 매장별 주문과 확정 금액이 쌓입니다. 실적이 보이는 사람에게 대행사는 다음 매장의 링크를 먼저 보냅니다.'],
      ['FiTrendingUp', '매장이 늘수록 커집니다', '링크로 매칭된 매장과 내가 섭외한 매장이 늘수록 이용권이 늘고, 유어샵 진열대가 넓어집니다. 매장 하나가 바퀴 하나를 더 만듭니다.'],
    ];
    let wy = 2.75;
    why.forEach(([i, h, p]) => {
      iconCircle(s, i, rx, wy, 0.44);
      T(s, h, { x: rx + 0.62, y: wy, w: rw - 0.62, h: 0.32, fontSize: 13.5, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: rx + 0.62, y: wy + 0.35, w: rw - 0.62, h: 0.85, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
      wy += 1.32;
    });
    s.addNotes('09-15 참고 덱 "콘텐츠 기반 바이럴 루프" 장치. 각 노드는 현행 기능: 링크 귀속(affiliate) · QR 사용(group-buy-voucher) · 만료 환불(auto-settlement) · 지급(influencer-payout) · 소개자 프로필 공개(/influencer/settlement). "돌수록 커진다"는 구조 설명이지 성과 약속이 아니다. 영입 2% 문구 제거(09-19).');
  }

  // ───────── PART 3 구분 장 ─────────
  {
    const s = pres.addSlide();
    section(s, { n: 3, name: '유어딜 정산 프로세스', sub: '링크로 시작하는 길과 매장을 섭외하는 길, 링크를 두는 자리, 정산 시점, 자주 묻는 질문.', items: ['경로 A · 링크로 시작한다', '경로 B · 매장을 섭외한다', '유어샵과 유어쇼츠, SNS 별 홍보', '정산', '시작하기'] });
  }

  // ───────── 07 경로 A (v4: 코드 링크 한 탭) ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '경로 A. 링크 한 번이면 시작됩니다.', { w: 8.4 });
    lead(s, '대행사나 중개사가 매장 코드가 담긴 링크를 보냅니다. 탭하면 가입이 되고, 가입과 동시에 그 매장과 매칭됩니다. 따로 신청하거나 코드를 옮겨 적을 일이 없습니다.', { y: 2.0, h: 0.65, w: 8.2 });
    const steps = [
      ['링크를 탭한다', '대행사(중개사)가 보낸 링크 하나입니다. 카카오 로그인으로 가입이 끝나고, 그 순간 그 매장과 매칭됩니다. 직접 찾아온 사람은 마이페이지에서 매장 코드를 입력하면 같은 자리로 들어옵니다.'],
      ['매장 단위 링크가 생긴다', '마이페이지에 그 매장의 고유 링크가 생깁니다. 복사 버튼과 카톡 공유 버튼이 붙어 있고, 매장이 이용권을 바꿔도 링크는 그대로입니다.'],
      ['콘텐츠에 링크를 건다', '스토리, 릴스, 카톡, 유튜브 더보기, 블로그 어디든 됩니다. 유어샵에 담아 두면 콘텐츠가 내려가도 판매는 이어집니다.'],
      ['적립을 확인한다', '마이페이지에서 매장별 주문과 대기, 확정 금액을 봅니다. 소개비 %는 코드에 실려 있고, 매장과 조정하면 이후 판매분부터 바뀝니다.'],
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
    // 오른쪽: 탭 한 번에 되는 세 가지 (화면은 코드가 열린 뒤에 캡처한다)
    const cx = 9.55, cw = W - M - cx, cy = 2.0, ch = 4.75;
    card(s, cx, cy, cw, ch, { fill: C.tint });
    label(s, '탭 한 번에 되는 세 가지', cx + 0.3, cy + 0.22, cw - 0.6, { color: C.brand });
    const three = [
      ['가입', '카카오 로그인 한 번. 셀러 대시보드 계정이 따로 필요 없습니다.'],
      ['매칭', '링크 안의 코드로 그 매장과 연결됩니다. 승인 조건이 없는 코드면 그 자리에서 활성입니다.'],
      ['매장 링크', '마이페이지에 그 매장의 고유 링크. 복사, 카톡 공유, 이용권이 바뀌어도 그대로.'],
    ];
    let ty = cy + 0.62;
    three.forEach(([h, p], i) => {
      numBadge(s, i + 1, cx + 0.3, ty, 0.34);
      T(s, h, { x: cx + 0.75, y: ty, w: cw - 1.0, h: 0.3, fontSize: 12.5, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: cx + 0.75, y: ty + 0.3, w: cw - 1.0, h: 0.75, fontSize: 9.8, color: C.ink, lineSpacingMultiple: 1.35, valign: 'top' });
      ty += 1.18;
    });
    hr(s, cx + 0.3, cy + ch - 0.63, cw - 0.6);
    T(s, '코드는 매장당 하나. 코드를 만든 대행사가 아니라 입력하는 사람이 연결됩니다.', { x: cx + 0.3, y: cy + ch - 0.57, w: cw - 0.6, h: 0.5, fontSize: 9, color: C.inkSoft, lineSpacingMultiple: 1.35, valign: 'top' });
    s.addNotes('09-19 대표 확정 플로우 7·8·9 단계 — PR #1499 구현: /i/join/:code(미리보기 → 카카오 로그인 → 자동 입력) · /influencer/settlement 코드 입력(DealsAndCodesSection) · 매장 링크 /s/{id}?ref=(7일 귀속) + 복사·공유. 이 장은 아직 카드 — 배포 후 /i/join 과 마이페이지를 캡처해 교체할 것.');
  }

  // ───────── 08 경로 B ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '경로 B. 아는 가게를 섭외합니다. 중개사 계정이면 유어딜은 ' + FACTS.feeBrokered + '.', { size: 25 });
    lead(s, '사장님을 설득하는 일이 아니라, 열어 두면 손해 볼 게 없다는 것을 알려 드리는 일에 가깝습니다. 내 계정에서 매장을 등록하면 매장 코드가 생기고, 사장님은 그 코드로 가입해 주인이 됩니다.', { y: 2.0, h: 0.6 });
    const flow = ['매장을 고른다', '중개사 계정으로 등록한다\n(코드 자동 생성)', '사장님께 코드를 드린다', '이용권을 올리고 내 링크로 판다'];
    const bw = 1.85, gap = 0.28, by = 2.85;
    flow.forEach((h, i) => {
      const x = M + i * (bw + gap);
      numBadge(s, i + 1, x, by, 0.38);
      T(s, h, { x, y: by + 0.5, w: bw, h: 0.6, fontSize: 12, bold: true, color: C.ink, charSpacing: -0.3, lineSpacingMultiple: 1.2, valign: 'top' });
      if (i < 3) s.addImage({ data: ic.FiArrowGray, x: x + bw + 0.02, y: by + 0.07, w: 0.24, h: 0.24 });
    });
    T(s, '셀러 대시보드의 매장 등록에서 "중개·대행사에요" 를 고르면 매장 코드가 자동으로 생기고, 중개사 몫 %와 인플루언서 상한 %를 함께 정합니다. 사장님이 가입하며 그 코드를 넣으면 매장 주인이 되고, 나는 운영자로 남습니다. 등록증 확인은 그대로입니다.', { x: M, y: by + 1.15, w: 8.2, h: 0.5, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.4, valign: 'top' });
    // 사장님께 하는 말
    const qx = M, qy = 4.55, qw = 8.2, qh = 2.2;
    card(s, qx, qy, qw, qh);
    label(s, '사장님께 이렇게 말하면 됩니다', qx + 0.3, qy + 0.2, qw - 0.6);
    const quotes = [
      ['가입비도 월 이용료도 없어요.', '팔린 만큼만 유어딜 수수료 ' + FACTS.feeBrokered + '가 나갑니다.'],
      ['새 배달앱이 아니에요.', '온라인에서 할인가로 미리 팔고, 손님은 가게에 와서 QR 로 씁니다.'],
      ['제 몫과 소개비는 등록할 때 정해요.', '사장님 몫 95% 안에서. 유어딜이 각자에게 보냅니다.'],
      ['안 쓴 이용권은 유어딜이 환불해요.', '노쇼로 손해 보는 구조가 아닙니다.'],
    ];
    quotes.forEach(([b, r], i) => {
      const y = qy + 0.55 + i * 0.4;
      T(s, [{ text: b + ' ', options: { bold: true, color: C.ink } }, { text: r, options: { color: C.inkSoft } }], { x: qx + 0.3, y, w: qw - 0.6, h: 0.36, fontSize: 11, valign: 'middle' });
    });
    // 조건 카드
    const cx = 9.3, cw = W - M - cx;
    card(s, cx, 2.85, cw, 3.9, { fill: C.tint });
    T(s, '중개사 계정으로 등록하면', { x: cx + 0.3, y: 3.05, w: cw - 0.6, h: 0.3, fontSize: 12.5, bold: true, color: C.brand, charSpacing: -0.3 });
    const conds = [
      ['유어딜 ' + FACTS.feeBrokered, '사장님이 직접 등록하면 ' + FACTS.feeDirect + ', 중개사 계정으로 등록하면 ' + FACTS.feeBrokered + '. 사장님 몫은 95%입니다.'],
      ['두 %는 등록할 때', '중개사 몫 %와 인플루언서 상한 %를 등록하며 정합니다. 개별 소개비는 협업 코드로.'],
      ['코드는 사장님이 입력', '사장님이 가입하며 코드를 넣어야 주인이 됩니다. 첫 정산 전까지만. 판매는 그 전에도 됩니다.'],
      ['가기 전에 확인', '사업자등록이 있는지, 손님이 방문해 쓰는 업종인지, 할인가에 팔아도 남는 메뉴가 있는지.'],
    ];
    let cyy = 3.45;
    conds.forEach(([h, p]) => {
      T(s, h, { x: cx + 0.3, y: cyy, w: cw - 0.6, h: 0.26, fontSize: 11, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: cx + 0.3, y: cyy + 0.27, w: cw - 0.6, h: 0.52, fontSize: 9.5, color: C.ink, lineSpacingMultiple: 1.35, valign: 'top' });
      cyy += 0.82;
    });
    s.addNotes('09-19 대표 확정 플로우 2·4·5 단계 — PR #1499 구현: StoreRegisterModal 두 요율(중개사 몫 0~50 · 인플루언서 상한 0~50 · 합 ≤ 90) + owner_claim 코드 자동 발급 · /store/find?code= 로 사장님이 찾아 신청(등록증·어드민 승인 그대로) · 대행사 = operator.');
  }

  // ───────── 09 유어샵과 유어쇼츠 (두 화면 + 인출선) ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '링크는 두 곳에 남습니다. 내 유어샵과 유어쇼츠.', { size: 25 });
    const ph = 4.6, py = 1.95;
    const p1x = 4.05, p2x = 7.0;
    const p1w = phone(s, 'ushop', p1x, py, ph, { caption: '유어샵 (라이브 화면)' });
    const p2w = phone(s, 'shorts', p2x, py, ph, { caption: '유어쇼츠 (라이브 · 이용권이 붙은 영상)' });
    // 왼쪽: 유어샵 인출선 (목록은 폰 왼쪽, 선은 목록 오른쪽 끝에서 화면으로)
    callouts(s, [
      { label: '프로필 링크는 유어샵 하나', sub: '스토리, 더보기, 블로그 어디든 이 링크만 겁니다', tx: 0.5, ty: 0.09 },
      { label: '담은 이용권이 카드로 진열', sub: '이용권 상세의 담기 버튼 한 번. 순서는 바꿀 수 있습니다', tx: 0.5, ty: 0.48 },
      { label: '콘텐츠가 내려가도 여기서 팝니다', sub: '유효기간 동안 계속. 매칭된 매장의 이용권은 소개비가 붙습니다', tx: 0.5, ty: 0.8 },
    ], { phoneX: p1x, phoneY: py, phoneW: p1w, phoneH: ph, listX: M, listW: p1x - M - 0.25, listY: 2.2, gap: 1.45, side: 'left' });
    // 오른쪽: 유어쇼츠 인출선 (목록은 폰 오른쪽, 오른 정렬)
    const rx = p2x + p2w + 0.25;
    callouts(s, [
      { label: '세로 영상에 이용권이 붙습니다', sub: '유어딜 홈과 이용권 상세에 실리는 유어쇼츠', tx: 0.5, ty: 0.32 },
      { label: '영상 아래 구매 바에서 바로 결제', sub: '매장, 이용권, 정가와 할인가가 함께 보입니다', tx: 0.45, ty: 0.93 },
      { label: '매칭된 매장이면 여기서도 소개비', sub: '영상 자체에 대한 몫은 없고, 그 이용권의 매장과 매칭돼 있을 때 붙습니다', tx: 0.86, ty: 0.93 },
    ], { phoneX: p2x, phoneY: py, phoneW: p2w, phoneH: ph, listX: rx, listW: W - M - rx, listY: 2.2, gap: 1.45, side: 'right' });
    s.addNotes('유어샵: CuratorPage /u/:handle (핀). 유어쇼츠: /videos?v=jHPacJoCEt8 (urshorts.routes — 이용권 붙은 라이브 영상 · 크리에이터 몫 0). 인출선 좌표는 ushop.jpg(프로필 9% · 첫 카드 48% · 아래 카드 80%) · shorts.jpg(구매 바 93%) 실측. 09-19: 두 화면 나란히 + 주소 문자열(urdeal.kr/u/…) 제거(대표).');
  }

  // ───────── 09-2 각 SNS 별 이용권 홍보 방법 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '각 SNS 별 이용권 홍보 방법', { size: 25 });
    lead(s, '어느 채널이든 결제로 이어진 것만 소개비로 잡힙니다. 조회수와 좋아요는 세지 않습니다. 그래서 팔로워가 적어도 동네 손님이 사면 돈이 됩니다.', { y: 1.95, h: 0.62 });
    const chans = [
      ['SiNaver', 'E6F8EE', '네이버 블로그', '"동네 + 메뉴" 검색에 오래 남는 글', ['글 본문과 마지막에 이용권 링크를 둡니다', '가게 이름과 메뉴를 제목에 넣습니다', '한 번 쓴 글이 유효기간 동안 계속 팝니다']],
      ['SiYoutube', 'FFE9E9', '유튜브 · 쇼츠', '먹는 장면으로 설득하는 영상', ['설명란과 고정 댓글에 링크를 둡니다', '쇼츠는 매장 근처 시청자에게 짧게 닿습니다', '영상 하나에 이용권 여러 개를 함께 소개합니다']],
      ['SiInstagram', 'FDE7EE', '인스타그램 · 릴스', '동네 감성과 단골 손님', ['프로필 링크를 내 유어샵으로 둡니다', '릴스와 스토리에서 이용권을 바로 안내합니다', '팔로워가 적어도 동네 손님이면 결제가 납니다']],
      ['FiVideo', C.brandSoft, '유어쇼츠', '이용권 페이지 안의 세로 영상', ['유어딜 홈과 이용권 상세에 영상이 실립니다', '영상 아래 구매 버튼으로 바로 결제합니다', '매칭된 매장이면 외부 채널 없이도 소개비가 붙습니다']],
    ];
    const cw = (W - 2 * M - 0.75) / 4, cy = 2.7, ch = 4.0;
    chans.forEach(([i, fill, h, sub, items], k) => {
      const x = M + k * (cw + 0.25);
      card(s, x, cy, cw, ch);
      iconCircle(s, i, x + 0.28, cy + 0.28, 0.5, { fill });
      T(s, h, { x: x + 0.28, y: cy + 0.92, w: cw - 0.5, h: 0.32, fontSize: 13.5, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, sub, { x: x + 0.28, y: cy + 1.24, w: cw - 0.5, h: 0.3, fontSize: 10, color: C.brand, bold: true });
      qa3(s, x + 0.28, cy + 1.62, cw - 0.5, '이렇게 씁니다', items, { rowH: 0.6 });
    });
    s.addNotes('로고: react-icons/si (SiNaver 03C75A · SiYoutube FF0000 · SiInstagram E4405F) — 각 브랜드 고유색. 유어쇼츠는 서비스 아이콘. 전용 링크: influencer-deals 수락 시 발급. 채널별 안내는 사용법이지 성과 약속이 아니다.');
  }

  // ───────── 10 정산은 언제 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '유어딜 정산 프로세스');
    lead(s, '귀속부터 송금까지 유어딜이 처리합니다. 화면에서 대기, 확정, 지급을 그대로 봅니다.', { y: 2.0, h: 0.4 });
    const steps = [
      ['매장 링크로 귀속', '내 매장 링크로 들어온 주문에 자동으로 연결됩니다. 이용권이 바뀌어도 링크는 그대로라 다시 받을 일이 없습니다.'],
      ['이용권 사용 후 확정', '팔로워가 매장에서 이용권을 쓰면 지급 가능 상태가 됩니다. 환불된 건은 그 건만 정리됩니다.'],
      [FACTS.influencerPayoutDay + ' 집계', '지급 가능 금액을 모아 정산 대기로 올립니다. 화면에서 바로 보입니다.'],
      ['유어딜이 확인 후 지급', '현금은 ' + FACTS.influencerPayoutMin + '부터 등록 계좌로(원천징수 차감 별도). 딜로 받으면 하한 없이 유어딜 잔액으로.'],
    ];
    const bw = 1.95, gap = 0.28, by = 2.85;
    steps.forEach(([h, p], i) => {
      const x = M + i * (bw + gap);
      numBadge(s, i + 1, x, by, 0.4);
      T(s, h, { x, y: by + 0.55, w: bw, h: 0.6, fontSize: 12.5, bold: true, color: C.ink, charSpacing: -0.3, lineSpacingMultiple: 1.2, valign: 'top' });
      T(s, p, { x, y: by + 1.15, w: bw, h: 1.3, fontSize: 10, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
      if (i < 3) s.addImage({ data: ic.FiArrowGray, x: x + bw + 0.02, y: by + 0.08, w: 0.24, h: 0.24 });
    });
    takeaway(s, [
      { text: '매장에 돈을 달라고 할 일이 없습니다. ', options: { bold: true, color: C.ink } },
      { text: '귀속부터 송금까지 유어딜이 하고, ' + FACTS.influencerPayoutMin + '에 못 미치면 다음 달로 이월됩니다.', options: { color: C.inkSoft } },
    ], { y: 5.75, w: 8.6, h: 0.6, size: 11.5 });
    phone(s, 'influencer-settlement', 10.0, 1.05, 5.35, { caption: '마이페이지 정산 화면 (예시 데이터)' });
    s.addNotes('influencer-payout.ts: 매월 1일 18시 KST 집계, 현금 최소 influencer_payout_min(기본 100,000), 딜 수령은 하한 없음, 실제 지급은 어드민 /admin/influencer-payouts (사람). ⚠️ 확정 시점: 코드는 결제+7일(available_at) — 대표 지시(09-19)로 "이용권 사용 후" 라고 적었다. 원천징수 문단은 뺐다(대표).');
  }

  // ───────── 11 이젠 체험단이 아닌 유어딜인 이유 + FAQ ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '이젠 체험단이 아닌 유어딜인 이유');
    lead(s, '체험단은 한 번 받고 끝나지만, 유어딜은 내 유어샵과 매장 링크가 남고 매칭된 매장이 계속 쌓입니다. 자주 묻는 질문에 먼저 답해 두었습니다.', { y: 2.0, h: 0.6 });
    const faq = [
      ['팔로워가 적어도 되나요?', '하한이 없습니다. 오히려 지역과 카테고리가 뚜렷한 채널이 동네 이용권과 잘 맞습니다.'],
      ['비용이 드나요?', '가입비도 이용료도 없습니다. 소개비는 매장이 내고, 유어딜이 대신 정산합니다.'],
      ['콘텐츠 형식이 정해져 있나요?', '자유입니다. 스토리, 릴스, 블로그 글, 유어쇼츠 어디든 매장 링크 하나면 됩니다.'],
      ['소개비가 안 붙는 이용권도 있나요?', '있습니다. 매칭되지 않은 매장의 이용권은 담아 둘 수는 있지만 소개비가 0 입니다.'],
      ['광고 표시를 해야 하나요?', '네. 소개비를 받는 콘텐츠에는 "광고" 처럼 경제적 대가를 받았다는 표시가 법으로 필요합니다. 표시 없이 올린 콘텐츠의 책임은 유어딜이 대신 질 수 없습니다.'],
      ['매칭은 어떻게 되나요?', '대행사(중개사)가 보낸 링크를 탭하면 가입과 동시에 매칭됩니다. 직접 왔다면 마이페이지에서 매장 코드를 입력하면 됩니다. 아는 가게가 있으면 중개사 계정으로 직접 등록해도 됩니다.'],
    ];
    const cw = (W - 2 * M - 0.5) / 3, ch = 1.75;
    faq.forEach(([q, a], i) => {
      const x = M + (i % 3) * (cw + 0.25), y = 2.8 + Math.floor(i / 3) * (ch + 0.25);
      card(s, x, y, cw, ch);
      T(s, q, { x: x + 0.3, y: y + 0.24, w: cw - 0.6, h: 0.3, fontSize: 12.5, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, a, { x: x + 0.3, y: y + 0.62, w: cw - 0.6, h: 1.05, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
    });
    s.addNotes('09-14: 정직 고지 블록 제거(대표). FAQ 6 개를 크게. 09-19: 제목·"영입비" 문구 교체.');
  }

  // ───────── 11-2 두 경로와 정산, 한 장에 (절차 3열) ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '두 경로와 정산을 한 장에 놓았습니다. 어느 열이든 내가 내는 돈은 없습니다.', { size: 25 });
    lead(s, '경로 A 와 B 는 링크를 거는 순간부터 같은 길로 합쳐지고, 정산은 유어딜이 합니다.', { y: 2.0, h: 0.4 });
    procedureColumns(s, [
      { title: '경로 A · 링크로 시작한다', hi: true, steps: ['대행사(중개사)가 보낸 코드 링크를 탭', '카카오 로그인으로 가입, 그 순간 매칭', '(직접 왔다면 마이페이지에서 코드 입력)', '마이페이지에 매장 단위 링크 생성', '콘텐츠와 유어샵에 링크 (복사·카톡 공유)', '마이페이지에서 주문·확정 확인'], note: '소개비 %는 코드의 값, 딜마다 조정 가능' },
      { title: '경로 B · 매장을 섭외한다', steps: ['아는 사장님 가게를 고른다', '중개사 계정으로 등록 (유어딜 ' + FACTS.feeBrokered + ') → 매장 코드 자동 생성', '중개사 몫 %와 인플루언서 상한 %를 그때 정한다', '사장님이 가입하며 코드 입력 → 매장 주인', '이용권을 올리고 내 링크로 판다', '마이페이지·대시보드에서 확인'], note: '중개사 몫도 유어딜이 직접 보냅니다' },
      { title: '정산 · 유어딜이 한다', steps: ['매장 링크로 들어온 주문에 자동 귀속', '이용권 사용 후 확정 (환불 건은 그 건만 정리)', FACTS.influencerPayoutDay + ' 지급 가능 금액 집계', '현금은 ' + FACTS.influencerPayoutMin + '부터 등록 계좌로', '딜로 받으면 하한 없이 잔액으로', '못 미치면 다음 달로 이월'], note: '매장에 돈을 달라고 할 일이 없습니다' },
    ], { y: 2.55, h: 4.2 });
    s.addNotes('09-15 참고 덱 "광고 집행 절차" 장치. 09-19 v4: 두 경로를 대표 확정 플로우(코드 링크 · 매장 코드 · 두 요율)로 — PR #1499 구현. 사실: influencer-payout.ts(매월 1일 · 10만원 · 딜 하한 없음 · 이월).')
  }

  // ───────── 12 시작하기 + 연락처 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '매장 사장님의 매출과 인플루언서님의 수익을 함께 올려갑니다.');
    lead(s, '링크 한 번으로 시작하고, 매장이 늘수록 링크가 늘어납니다. 내가 내는 돈은 없습니다.', { y: 2.0, h: 0.4, w: 7.6 });
    const x = M, w = 7.6;
    const steps = [['링크 또는 코드', '대행사가 보낸 링크를 탭하거나, 마이페이지에서 매장 코드를 입력합니다. 가입과 매칭이 한 번에 됩니다.'], ['매장 섭외', '아는 가게가 있으면 중개사 계정으로 등록합니다. 코드가 생기고, 사장님은 그 코드로 가입해 주인이 됩니다.'], ['공유와 정산', '매장 링크를 걸고, 적립과 정산은 마이페이지에서 확인합니다.']];
    steps.forEach(([h, p], i) => {
      const y = 2.75 + i * 0.72;
      numBadge(s, i + 1, x, y, 0.36);
      T(s, h, { x: x + 0.5, y: y - 0.02, w: 2.2, h: 0.4, fontSize: 12.5, bold: true, color: C.ink, valign: 'middle', charSpacing: -0.3 });
      T(s, p, { x: x + 2.7, y: y - 0.02, w: w - 2.7, h: 0.4, fontSize: 10.5, color: C.inkSoft, valign: 'middle' });
    });
    // 연락처 카드 — 전체 주소 + 실제 하이퍼링크(PDF 에서도 눌린다)
    const cx = M, cw = 4.6, cy = 5.05, ch = 1.75;
    card(s, cx, cy, cw, ch, { fill: C.ink });
    const contacts = [['FiGlobeW', SITE_URL, '유어딜', SITE_URL], ['FiMessageW', KAKAO_URL, '카카오톡 채널 상담', KAKAO_URL], ['FiMailW', FACTS.contactEmail, '제휴 문의', 'mailto:' + FACTS.contactEmail]];
    let ky = cy + 0.22;
    contacts.forEach(([i, v, l, url]) => {
      s.addImage({ data: ic[i], x: cx + 0.3, y: ky + 0.06, w: 0.22, h: 0.22 });
      T(s, v, { x: cx + 0.65, y: ky, w: cw - 0.9, h: 0.3, fontSize: 12, bold: true, color: C.darkText, charSpacing: -0.3, hyperlink: { url, tooltip: l } });
      T(s, l, { x: cx + 0.65, y: ky + 0.27, w: cw - 0.9, h: 0.2, fontSize: 8.5, color: C.darkMuted });
      ky += 0.5;
    });
    T(s, FACTS.biz, { x: cx + cw + 0.3, y: cy + ch - 0.3, w: 3.2, h: 0.26, fontSize: 9, color: C.gray });
    phone(s, 'ushop', 9.7, 1.05, 5.35, { caption: '가입하면 생기는 내 유어샵 (라이브 화면)' });
    s.addNotes('09-19: creators/apply 문자열과 신청 폼 캡처 제거(대표 — "링크 이상한 형태로 남기지 마"). 연락처는 https:// 전체 주소 + hyperlink. 가입 화면 캡처는 자격 선택 UI 가 생긴 뒤에 다시 찍는다(현재 /seller/register/supplier 는 사업자 정보 폼).');
  }

  await pres.writeFile({ fileName: OUT });
  console.log('wrote', OUT, '(20 slides)');
})();
