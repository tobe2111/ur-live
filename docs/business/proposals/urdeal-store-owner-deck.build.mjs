// 유어딜 매장 사장님 소개서 (.pptx) 생성기 — v1 (2026-09-13). 16:9 · Pretendard · 라이브 캡처 · 셀러 화면(예시 데이터)
// 기획: docs/business/proposals/three-decks-plan-2026-09.md §2 · 사실 SSOT: 같은 문서 §0 + docs/design/actor-benefit-map.md
// 재생성: cd /tmp/deck && npm i pptxgenjs sharp react react-dom react-icons
//         SHOTS_DIR=<캡처 폴더> node urdeal-store-owner-deck.build.mjs out.pptx
import path from 'node:path';
import { createDeck, C, W, H, M, FACTS, __dirname } from './deck-common.mjs';

const OUT = process.argv[2] || path.join(__dirname, 'urdeal-store-owner-deck.pptx');
const SHOTS_DIR = process.env.SHOTS_DIR || path.join(__dirname, 'shots');

(async () => {
  const d = await createDeck({
    title: '유어딜 매장 사장님 안내서', footer: '유어딜 매장 사장님 안내', shotsDir: SHOTS_DIR,
    shotKeys: ['home', 'detail', 'use', 'shop', 'store-new', 'store-new-channel', 'seller-stores', 'seller-settlements', 'seller-influencers', 'seller-operators'],
  });
  const { pres, ic, T, chrome, title, lead, card, iconCircle, numBadge, hr, label, phone, kv, customerSteps, honesty } = d;

  // ───────── 01 표지 ─────────
  {
    const s = pres.addSlide();
    chrome(s, { dark: true });
    T(s, '팔린 만큼만\n냅니다.', { x: M, y: 1.45, w: 7.4, h: 2.2, fontSize: 50, bold: true, color: C.darkText, lineSpacingMultiple: 1.05, charSpacing: -1.5, valign: 'top' });
    T(s, '가입비도 월비도 광고비도 없습니다. 손님이 온라인에서 할인가로 미리 사고, 가게에 와서 QR 로 씁니다. 사장님은 팔린 이용권에만 수수료를 냅니다.',
      { x: M, y: 3.85, w: 7.0, h: 0.95, fontSize: 13.5, color: C.darkMuted, lineSpacingMultiple: 1.5, valign: 'top' });
    const stats = [[FACTS.feeDirect, '수수료. 직접 등록 기준,\n중개 경유는 ' + FACTS.feeBrokered], ['0원', '가입비, 월 이용료,\n선불 광고비'], ['10분', '매장 등록. 카카오맵에서\n내 가게 찾기부터']];
    stats.forEach(([n, l], i) => {
      const x = M + i * 2.45;
      T(s, n, { x, y: 5.0, w: 2.3, h: 0.7, fontSize: 36, bold: true, color: C.darkText, charSpacing: -1.2 });
      T(s, l, { x, y: 5.72, w: 2.3, h: 0.6, fontSize: 10, color: C.darkMuted, lineSpacingMultiple: 1.35, valign: 'top' });
    });
    phone(s, 'home', 9.3, 1.1, 5.7, { dark: true });
    T(s, '매장 사장님 안내 · ' + FACTS.liveMeasuredAt, { x: M, y: 0.98, w: 6, h: 0.25, fontSize: 10, color: C.darkMuted, charSpacing: 0.5 });
    s.addNotes('표지 숫자: 직접 입점 10% / 중개 5% (fee-resolver.ts, 09-07 대표 확정). 0원: 가입비·월비·광고비 없음. 10분: 등록 마법사 4단계 + 이용권 1개.');
  }

  // ───────── 02 이게 뭔가요 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '배달앱이 아닙니다. 손님이 가게에 옵니다.');
    lead(s, '유어딜은 동네 가게의 이용권을 온라인에서 할인가로 미리 파는 곳입니다. 배송도 배달도 없습니다. 손님은 결제한 이용권을 들고 가게에 와서 QR 로 씁니다.', { h: 0.85, w: 8.2 });
    const items = [
      ['FiTag', '이용권', '식사, 뷰티, 숙박, 액티비티. 메뉴 하나든 세트든 사장님이 정한 할인가로 올립니다.'],
      ['FiCreditCard', '온라인에서 미리 팝니다', '손님은 홈과 지도, 검색에서 찾아 토스로 결제합니다. 결제 즉시 이용권이 손님 폰에 발급됩니다.'],
      ['FiMapPin', '가게에 와서 씁니다', '직원이 손님 QR 을 찍거나, 손님이 매장 확인코드를 입력하면 사용 처리됩니다. 택배도 반품도 없습니다.'],
      ['FiClock', '사용한 것만 정산됩니다', '손님이 실제로 쓴 이용권만 매주 정산 대상이 됩니다. 노쇼로 손해 보는 구조가 아닙니다.'],
    ];
    let y = 3.05;
    items.forEach(([i, h, p]) => {
      iconCircle(s, i, M, y, 0.46);
      T(s, h, { x: M + 0.65, y, w: 7.0, h: 0.32, fontSize: 14, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: M + 0.65, y: y + 0.35, w: 7.0, h: 0.6, fontSize: 11, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
      y += 0.98;
    });
    phone(s, 'detail', 9.4, 1.2, 5.5, { caption: '이용권 상세 (라이브 화면)' });
    s.addNotes('제품 정의: urdeal-platform-model.md §1. 사용 처리: redemption-settings.ts (직원 QR 항상 · 셀프는 매장 확인코드 6자리). 정산: payouts-generate.ts (used 만).');
  }

  // ───────── 03 손님 4단계 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '손님이 겪는 순서는 네 화면이 전부입니다.');
    lead(s, '오늘 urdeal.kr 에서 그대로 캡처한 화면입니다. 앱 설치나 회원가입을 강요하는 구간은 없습니다.', { y: 2.0, h: 0.4 });
    customerSteps(s, { y: 3.1, h: 3.1 });
    s.addNotes('캡처 4장: home / detail / use / shop. 가격은 매장이 정한 실제 판매가이며 캡처 시점 값.');
  }

  // ───────── 04 돈의 흐름 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '손님이 낸 돈은 이렇게 갈립니다. 유어딜은 10%에서 끝납니다.');
    lead(s, '숨은 비용이 있으면 여기서 보여야 합니다. 없습니다.', { y: 2.0, h: 0.4 });
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
    const drop = (i, big, small) => {
      const x = M + i * (bw + gap);
      s.addShape(pres.shapes.LINE, { x: x + bw / 2, y: by + bh, w: 0, h: 0.32, line: { color: C.gray, width: 0.75, endArrowType: 'triangle' } });
      T(s, big, { x, y: by + bh + 0.38, w: bw, h: 0.34, fontSize: 15, bold: true, color: C.ink, align: 'center', charSpacing: -0.5 });
      T(s, small, { x: x - 0.15, y: by + bh + 0.72, w: bw + 0.3, h: 0.62, fontSize: 9.5, color: C.inkSoft, align: 'center', lineSpacingMultiple: 1.35, valign: 'top' });
    };
    drop(1, '약 2.75%', '카드 결제 수수료.\n유어딜이 자기 몫 안에서 냅니다.\n카드사 정책에 따라 바뀔 수 있습니다');
    drop(2, FACTS.feeDirect, '직접 등록한 매장.\n대행사를 통해 등록하면 ' + FACTS.feeBrokered);
    {
      const x = M + 3 * (bw + gap);
      s.addShape(pres.shapes.LINE, { x: x + bw / 2, y: by + bh, w: 0, h: 0.32, line: { color: C.gray, width: 0.75, endArrowType: 'triangle' } });
      const cy = by + bh + 0.36, cw = W - M - x, ch = 1.62;
      card(s, x, cy, cw, ch, { fill: C.tint });
      T(s, '사장님 몫 90%', { x: x + 0.25, y: cy + 0.14, w: cw - 0.5, h: 0.3, fontSize: 13, bold: true, color: C.brand, charSpacing: -0.3 });
      T(s, '여기서 더 나가는 것은 사장님이 직접 정한 것뿐입니다. 소개해 준 사람에게 줄 소개비 %, 대행사에 맡겼다면 그 보수. 둘 다 안 정하면 0 입니다.', { x: x + 0.25, y: cy + 0.46, w: cw - 0.5, h: 1.1, fontSize: 9.5, color: C.ink, lineSpacingMultiple: 1.4, valign: 'top' });
    }
    const cy2 = 5.38, cw2 = (8.3 - 0.3) / 2, ch2 = 1.1;
    [['흔한 오해', '"수수료 말고도 카드비, 정산 수수료, 입점비가 따로 붙을 것이다."', C.surface],
     ['실제', '카드비는 유어딜이 자기 몫에서 냅니다. 정산 수수료, 입점비, 월비, 광고비는 없습니다. 사장님이 내는 것은 팔린 이용권의 10% 하나입니다.', C.surface]].forEach(([h, p, f], i) => {
      const x = M + i * (cw2 + 0.3);
      card(s, x, cy2, cw2, ch2, { fill: f });
      T(s, h, { x: x + 0.25, y: cy2 + 0.14, w: cw2 - 0.5, h: 0.28, fontSize: 11.5, bold: true, color: i ? C.brand : C.ink, charSpacing: -0.3 });
      T(s, p, { x: x + 0.25, y: cy2 + 0.44, w: cw2 - 0.5, h: 0.68, fontSize: 9.5, color: C.inkSoft, lineSpacingMultiple: 1.35, valign: 'top' });
    });
    T(s, '안 팔리면 0원입니다. 수수료는 손님이 결제한 이용권에만 붙습니다.', { x: M, y: 6.56, w: W - 2 * M, h: 0.26, fontSize: 10.5, color: C.ink, bold: true });
    s.addNotes('직접 10% / 중개 5%: fee-resolver.ts + 09-07 대표 확정. 카드 수수료 약 2.75%: commission-budget.ts DEFAULT_PG_RESERVE_PCT (변동 가능 — 대표 09-13). 소개비·대행사 보수는 매장 몫 안에서 매장이 정함(store-operator-model.md §7).');
  }

  // ───────── 05 사장님 셈법 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '이용권 한 장이 팔리면 사장님께 얼마가 남는지, 실제 상품으로 계산했습니다.', { size: 25 });
    card(s, M, 2.15, 5.9, 4.65);
    const x = M + 0.35, w = 5.2;
    label(s, '지금 유어딜에서 팔리고 있는 이용권 (치즈돈가스 2인 세트)', x, 2.35, w);
    const yEnd = kv(s, [
      ['정가', '25,000원', 0], ['이용권 판매가 (34% 할인, 사장님이 정한 값)', '16,500원', 0, true],
      ['유어딜 10%', '1,650원', 0], ['카드 수수료', '0원 (유어딜 부담)', 0, true],
      ['사장님 계좌에 들어오는 돈', '14,850원', 2], ['재료비 35% 가정', '5,775원', 0, true], ['남는 돈', '9,075원', 2],
    ], x, 2.7, w, { rowH: 0.43 });
    T(s, '광고 없이 온 새 손님 한 명당 9,075원이 남습니다. 안 팔리면 0원이고, 수수료는 팔린 뒤에만 나갑니다. 재료비 35%는 가정이니 사장님 숫자로 바꿔 보세요.', { x, y: yEnd + 0.12, w, h: 0.7, fontSize: 11, color: C.ink, lineSpacingMultiple: 1.4, valign: 'top' });
    const pts = [
      ['FiXCircle', '선지출 광고비 0', '배너, 검색 광고, 체험단처럼 미리 내는 돈이 없습니다. 팔린 만큼만 나갑니다.'],
      ['FiTag', '할인율과 유효기간은 사장님이', '남는 메뉴만 올리고, 할인율도 수량도 유효기간도 직접 정합니다. 손해 보는 구조를 만들 수 없습니다.'],
      ['FiClock', '정산은 손님이 쓴 뒤 매주', '손님이 매장에서 QR 을 찍은 이용권만 주 단위로 계좌에 들어옵니다.'],
      ['FiRefreshCcw', '안 쓴 이용권은 유어딜이 환불', '유효기간이 지나도 안 쓴 이용권은 유어딜이 손님에게 100% 환불합니다. 사장님이 처리할 일이 없습니다.'],
    ];
    let py = 2.2;
    pts.forEach(([i, h, p]) => {
      iconCircle(s, i, 7.05, py, 0.44);
      T(s, h, { x: 7.7, y: py, w: W - M - 7.7, h: 0.32, fontSize: 13.5, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: 7.7, y: py + 0.36, w: W - M - 7.7, h: 0.75, fontSize: 11, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
      py += 1.18;
    });
    s.addNotes('상품 2888 (홍대돈까스, 라이브 유일의 실제 매장 이용권) 09-13 실측: 정가 25,000 / 판매가 16,500. 재료비 35% 는 가정. 환불: auto-settlement.ts handleExpiredVoucherRefunds (만료 시 100%).');
  }

  // ───────── 06 등록 4단계 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '등록은 질문 네 개입니다. 10분이면 첫 이용권까지 올라갑니다.');
    lead(s, '카카오 로그인 뒤 urdeal.kr/store/new 에서 시작합니다. 포스 연동도, 단말기도, 직원 교육도 필요 없습니다.', { y: 2.0, h: 0.6, w: 6.0 });
    const steps = [
      ['내 매장을 찾아주세요', '카카오맵에서 검색하면 주소와 전화번호가 자동으로 채워집니다.'],
      ['담당자 전화번호', '승인, 사용 문의, 정산 확인 때 연락드릴 번호입니다.'],
      ['이 매장, 누가 운영하나요?', '"내 가게에요" 또는 "중개·대행사에요". 이 선택이 수수료(10% / 5%)를 정합니다.'],
      ['사업자등록증을 올려주세요', '사진 한 장이면 됩니다. 유어딜 담당자가 직접 확인하고 승인합니다.'],
    ];
    let y = 2.9;
    steps.forEach(([h, p], i) => {
      numBadge(s, i + 1, M, y + 0.02, 0.38);
      T(s, h, { x: M + 0.55, y, w: 5.2, h: 0.32, fontSize: 13.5, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: M + 0.55, y: y + 0.34, w: 5.2, h: 0.55, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.4, valign: 'top' });
      y += 0.8;
    });
    T(s, '승인이 나면 이용권 등록으로 이어집니다. 메뉴 이름, 정가, 판매가, 수량, 유효기간을 넣으면 판매가 시작됩니다. 사업자번호는 나중에 넣어도 됩니다.', { x: M, y: y - 0.05, w: 5.9, h: 0.65, fontSize: 10.5, color: C.ink, lineSpacingMultiple: 1.4, valign: 'top' });
    const ph = 4.55;
    const pw = phone(s, 'store-new', 7.15, 1.95, ph, { caption: '1단계: 카카오맵에서 내 가게 찾기' });
    phone(s, 'store-new-channel', 7.15 + pw + 0.55, 1.95, ph, { caption: '3단계: 누가 운영하나요' });
    s.addNotes('StoreRegisterModal.tsx 4단계(09-07 마법사). 승인은 사람이 한다(seller-stores.routes.ts:401 자동 승인 없음). 사업자번호 선택. 채널 선택이 수수료를 정함.');
  }

  // ───────── 07 그 다음 할 일 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '그 다음 할 일은 셋입니다. 다 합쳐 일주일에 10분입니다.', { w: 8.3, size: 25 });
    const items = [
      ['FiSmartphone', '손님 QR 을 찍는다', '손님이 폰을 내밀면 매장 폰으로 QR 을 찍습니다. 스캔이 어려우면 매장 확인코드 6자리를 알려 주면 손님이 직접 입력합니다. 집에서 미리 쓸 수 없게 코드는 매장에서만 알려 줍니다.'],
      ['FiBarChart2', '정산을 확인한다', '오늘 팔린 것, 사용된 것, 정산 예정 금액이 매장 관리 화면에 그대로 보입니다. 물어볼 일이 없습니다.'],
      ['FiMessageCircle', '후기에 답한다', '손님이 남긴 후기에 답글을 달면 다음 손님이 봅니다. 첫 후기를 남긴 손님에게는 유어딜이 ' + FACTS.reviewBonus + '을 드립니다.'],
    ];
    let y = 2.25;
    items.forEach(([i, h, p]) => {
      iconCircle(s, i, M, y, 0.5);
      T(s, h, { x: M + 0.7, y, w: 6.6, h: 0.34, fontSize: 15, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: M + 0.7, y: y + 0.4, w: 6.6, h: 0.95, fontSize: 11, color: C.inkSoft, lineSpacingMultiple: 1.45, valign: 'top' });
      y += 1.32;
    });
    T(s, '이용권을 바꾸고 싶으면 가격, 수량, 유효기간을 언제든 고칩니다. 잠시 쉬고 싶으면 판매를 멈추면 됩니다. 계약 기간이 없습니다.', { x: M, y: y - 0.05, w: 7.6, h: 0.6, fontSize: 10.5, color: C.ink, lineSpacingMultiple: 1.4, valign: 'top' });
    phone(s, 'seller-stores', 9.35, 1.2, 5.5, { caption: '매장 관리 (예시 데이터로 렌더한 실제 화면)' });
    s.addNotes('사용 처리: group-buy-voucher.routes.ts /:code/use-by-seller(직원 QR) · /:code/use(확인코드). 리뷰 보너스 1,000딜 유어딜 부담: review-bonus-funding.ts.');
  }

  // ───────── 08 사고가 나면 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '사고가 나도 사장님 손에서 처리할 일이 없게 만들었습니다.');
    const cw = (W - 2 * M - 0.3) / 2, ch = 1.95;
    const cases = [
      ['FiXCircle', '손님이 안 왔다 (노쇼)', '사용한 이용권만 정산되므로 사장님 손실은 0 입니다. 재료를 미리 준비할 필요도 없습니다. 이용권은 예약이 아니라 결제된 권리라, 손님이 오는 날 그때 준비하면 됩니다.'],
      ['FiRefreshCcw', '유효기간이 지났다', '유효기간은 사장님이 정합니다. 지나면 미사용분은 유어딜이 손님에게 100% 자동 환불합니다. 사장님 계좌를 건드리지 않고, 사장님이 연락할 일도 없습니다.'],
      ['FiShield', '환불을 요구한다', '결제와 환불은 유어딜과 토스가 처리합니다. 손님은 유어딜 고객센터로 오고, 사장님은 그 사이에 서지 않습니다. 이미 사용한 이용권은 환불되지 않습니다.'],
      ['FiLock', '이용권을 두 번 쓰려 한다', 'QR 은 한 번 찍히면 즉시 사용 완료가 됩니다. 확인코드는 매장에서만 알려 주므로 집에서 미리 처리할 수 없습니다. 같은 코드가 두 번 통과하지 않습니다.'],
    ];
    cases.forEach(([i, h, p], k) => {
      const x = M + (k % 2) * (cw + 0.3), y = 2.2 + Math.floor(k / 2) * (ch + 0.25);
      card(s, x, y, cw, ch);
      iconCircle(s, i, x + 0.3, y + 0.3, 0.46);
      T(s, h, { x: x + 0.95, y: y + 0.34, w: cw - 1.2, h: 0.34, fontSize: 14, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: x + 0.3, y: y + 0.9, w: cw - 0.6, h: ch - 1.0, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.45, valign: 'top' });
    });
    s.addNotes('만료 자동 환불: auto-settlement.ts handleExpiredVoucherRefunds (100%, 카드는 토스 취소). QR CAS: group-buy-voucher.routes.ts. 확인코드는 매장만(RedeemHowTo.tsx 문구와 동일).');
  }

  // ───────── 09 돈은 언제 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '돈은 손님이 쓴 뒤 매주 들어옵니다.');
    lead(s, '결제됐다고 바로 정산되지 않습니다. 손님이 가게에서 실제로 쓴 이용권만 정산 대상이 됩니다. 그래서 노쇼가 손실이 되지 않습니다.', { y: 2.0, h: 0.6 });
    const steps = [
      ['손님이 매장에서 사용', 'QR 스캔 또는 확인코드 입력. 이 순간 정산 대상이 됩니다.'],
      ['매주 월요일 정산 집계', '지난주 사용분을 모아 정산 내역을 만듭니다. 매장 관리 화면에 바로 보입니다.'],
      ['유어딜이 확인', '금액이 맞는지 사람이 확인합니다. 최소 정산 금액은 ' + FACTS.minPayout + '이고, 못 미치면 다음 주로 이월됩니다.'],
      ['등록한 계좌로 입금', '수수료를 뺀 금액이 그대로 들어옵니다. 별도 정산 수수료는 없습니다.'],
    ];
    const bw = 1.95, gap = 0.28, by = 3.05;
    steps.forEach(([h, p], i) => {
      const x = M + i * (bw + gap);
      numBadge(s, i + 1, x, by, 0.4);
      T(s, h, { x, y: by + 0.55, w: bw, h: 0.6, fontSize: 12.5, bold: true, color: C.ink, charSpacing: -0.3, lineSpacingMultiple: 1.2, valign: 'top' });
      T(s, p, { x, y: by + 1.15, w: bw, h: 1.3, fontSize: 10, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
      if (i < 3) s.addImage({ data: ic.FiArrowGray, x: x + bw + 0.02, y: by + 0.08, w: 0.24, h: 0.24 });
    });
    card(s, M, 5.65, 8.6, 1.05, { fill: C.tint });
    T(s, '정산 계좌는 사장님만 바꿀 수 있습니다', { x: M + 0.3, y: 5.8, w: 8.0, h: 0.3, fontSize: 12, bold: true, color: C.ink, charSpacing: -0.3 });
    T(s, '운영을 누구에게 맡겨도 계좌 변경은 사장님 본인만 할 수 있고, 변경할 때는 확인 절차를 한 번 더 거칩니다.', { x: M + 0.3, y: 6.12, w: 8.0, h: 0.5, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.4, valign: 'top' });
    phone(s, 'seller-settlements', 10.0, 1.2, 5.5, { caption: '정산 화면 (예시 데이터)' });
    s.addNotes('payouts-generate.ts: 매주 월요일 cron, 최소 10,000원, 승인·송금은 어드민(사람). 계좌 변경 owner 전용 + PIN(seller-profile.routes.ts).');
  }

  // ───────── 10 손님을 더 부르는 두 가지 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '손님을 더 부르는 두 가지. 하나는 사장님이 고르고, 하나는 자동입니다.', { w: 9.3, size: 25 });
    const cw = 5.6;
    // ① 소개비
    card(s, M, 2.2, cw, 4.55);
    label(s, '사장님이 고르는 것', M + 0.3, 2.4, cw - 0.6);
    T(s, '소개해 줄 사람에게 소개비 %를 정해 제안합니다', { x: M + 0.3, y: 2.7, w: cw - 0.6, h: 0.6, fontSize: 14.5, bold: true, color: C.ink, charSpacing: -0.4, lineSpacingMultiple: 1.2, valign: 'top' });
    T(s, '동네 맛집, 뷰티, 여행을 다루는 분들이 유어딜에 ' + FACTS.influencerDb + ' 모여 있고, 그중 ' + FACTS.influencerReachable + '에게 바로 제안을 보낼 수 있습니다. 사장님이 "이 이용권 팔아 주면 몇 %" 를 적어 제안하고, 그 사람이 수락하면 그 링크로 팔린 건에만 소개비가 나갑니다.',
      { x: M + 0.3, y: 3.35, w: cw - 0.6, h: 1.55, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.45, valign: 'top' });
    kv(s, [['소개비 %', '사장님이 정함', 1], ['재원', '사장님 몫 90% 안에서', 0], ['안 팔리면', '0원', 2]], M + 0.3, 5.0, cw - 0.6, { rowH: 0.42 });
    T(s, '제안하지 않으면 아무것도 나가지 않습니다.', { x: M + 0.3, y: 6.3, w: cw - 0.6, h: 0.3, fontSize: 10.5, bold: true, color: C.ink });
    // ② 자동 노출
    const x2 = M + cw + 0.35, cw2 = 3.25;
    card(s, x2, 2.2, cw2, 4.55);
    label(s, '자동으로 되는 것', x2 + 0.3, 2.4, cw2 - 0.6);
    T(s, '등록하면 네 곳에 바로 뜹니다', { x: x2 + 0.3, y: 2.7, w: cw2 - 0.6, h: 0.6, fontSize: 14.5, bold: true, color: C.ink, charSpacing: -0.4, lineSpacingMultiple: 1.2, valign: 'top' });
    const auto = [['FiHome', '홈 인기 이용권과 카테고리'], ['FiMapPin', '지도의 내 주변 이용권'], ['FiSearch', '검색과 카카오톡 공유 카드'], ['FiVideo', '유어쇼츠 (영상 아래 구매 버튼)']];
    let ay = 3.4;
    auto.forEach(([i, t]) => {
      iconCircle(s, i, x2 + 0.3, ay, 0.4);
      T(s, t, { x: x2 + 0.85, y: ay + 0.02, w: cw2 - 1.1, h: 0.36, fontSize: 11, color: C.ink, valign: 'middle', lineSpacingMultiple: 1.2 });
      ay += 0.62;
    });
    T(s, '첫 후기를 남긴 손님에게 유어딜이 ' + FACTS.reviewBonus + '을 드립니다. 사장님 부담 없이 후기가 쌓입니다.', { x: x2 + 0.3, y: 5.95, w: cw2 - 0.6, h: 0.7, fontSize: 10, color: C.inkSoft, lineSpacingMultiple: 1.4, valign: 'top' });
    phone(s, 'seller-influencers', 10.0, 1.05, 5.35, { caption: '소개 파트너 찾기 (예시 데이터)' });
    s.addNotes('인플루언서 DB 201,471 / 연락 가능 46,220 (09-13 /api/admin/ads/influencer-pool/stats). 딜 커미션은 매장 제안 %·매장 부담·상한 없음(Q2-1). 리뷰 보너스 1,000딜 유어딜 부담(게이트 OFF). 유어쇼츠 라이브(홈 레일).');
  }

  // ───────── 11 바쁘면 맡기세요 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '바쁘면 맡기셔도 됩니다. 단, 통장은 아무도 못 건드립니다.');
    lead(s, '대행사나 직원에게 운영을 맡길 수 있습니다. 매장 관리 화면에서 그 사람의 유어딜 계정을 추가하면 끝이고, 언제든 회수할 수 있습니다.', { y: 2.0, h: 0.6, w: 8.4 });
    const tx = M, tw = 7.6;
    const rows = [
      ['이용권 등록과 가격, 수량 변경', '가능'], ['주문 확인과 손님 QR 사용 처리', '가능'], ['소개 파트너에게 제안', '가능'], ['운영 시작 이후 매출 보기', '가능'],
      ['정산 계좌 변경', '차단'], ['사업자 정보 수정', '차단'], ['다른 운영자 추가와 회수', '차단'], ['매장 탈퇴', '차단'],
    ];
    label(s, '맡긴 사람이 할 수 있는 일 / 없는 일', tx, 2.8, tw);
    hr(s, tx, 3.1, tw);
    rows.forEach(([k, v], i) => {
      const y = 3.16 + i * 0.37;
      const ok = v === '가능';
      T(s, k, { x: tx, y, w: tw - 1.2, h: 0.34, fontSize: 11, color: C.ink, valign: 'middle' });
      s.addImage({ data: ok ? ic.FiCheck : ic.FiXCircle, x: tx + tw - 1.1, y: y + 0.07, w: 0.2, h: 0.2 });
      T(s, v, { x: tx + tw - 0.85, y, w: 0.85, h: 0.34, fontSize: 11, bold: true, color: ok ? C.brand : C.ink, valign: 'middle' });
      hr(s, tx, y + 0.34, tw);
    });
    T(s, '맡긴 사람에게는 계좌 끝 4자리와 등록번호 끝 4자리, 대표자명 첫 글자만 보입니다. 회수하면 그 사람이 등록한 이용권과 주문 기록은 매장에 그대로 남습니다. 대행사를 통해 등록한 매장의 수수료는 ' + FACTS.feeBrokered + '입니다.',
      { x: tx, y: 6.2, w: tw, h: 0.6, fontSize: 10, color: C.inkSoft, lineSpacingMultiple: 1.4, valign: 'top' });
    phone(s, 'seller-operators', 9.7, 1.2, 5.5, { caption: '운영자 관리 (예시 데이터)' });
    s.addNotes('seller-operators.ts · store-operator-model.md §7.7: 계좌 변경·사업자정보·탈퇴·운영자 관리 403, 마스킹, 정산 내역은 합류 이후분만. 중개 경유 5%.');
  }

  // ───────── 12 정직하게 + 시작하기 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '지금 시작하면 그 동네의 첫 매장입니다.');
    honesty(s, { y: 2.15, w: 7.6, h: 1.75 });
    const x = M, w = 7.6;
    label(s, '시작하는 방법', x, 4.15, w);
    const steps = [['카카오 로그인', 'urdeal.kr 에서 카카오로 로그인합니다. 별도 가입이 없습니다.'], ['매장 등록 (10분)', 'urdeal.kr/store/new 에서 질문 네 개에 답합니다.'], ['첫 이용권 올리기', '승인 문자를 받으면 메뉴 하나를 올립니다. 그날부터 팔립니다.']];
    steps.forEach(([h, p], i) => {
      const y = 4.5 + i * 0.68;
      numBadge(s, i + 1, x, y, 0.36);
      T(s, h, { x: x + 0.5, y: y - 0.02, w: 2.6, h: 0.4, fontSize: 12.5, bold: true, color: C.ink, valign: 'middle', charSpacing: -0.3 });
      T(s, p, { x: x + 3.1, y: y - 0.02, w: w - 3.1, h: 0.4, fontSize: 10.5, color: C.inkSoft, valign: 'middle' });
    });
    // 연락처 카드
    const cx = 9.0, cw = W - M - cx, cy = 2.15, ch = 4.4;
    card(s, cx, cy, cw, ch, { fill: C.ink });
    T(s, '문의', { x: cx + 0.35, y: cy + 0.3, w: cw - 0.7, h: 0.3, fontSize: 11, bold: true, color: C.darkMuted, charSpacing: 1.2 });
    const contacts = [['FiGlobeW', 'urdeal.kr/store/new', '매장 등록'], ['FiMessageW', FACTS.kakaoChannel, '카카오톡 채널 상담'], ['FiMailW', FACTS.contactEmail, '이메일']];
    let ky = cy + 0.8;
    contacts.forEach(([i, v, l]) => {
      s.addImage({ data: ic[i], x: cx + 0.35, y: ky + 0.04, w: 0.26, h: 0.26 });
      T(s, v, { x: cx + 0.75, y: ky, w: cw - 1.1, h: 0.34, fontSize: 13, bold: true, color: C.darkText, charSpacing: -0.3 });
      T(s, l, { x: cx + 0.75, y: ky + 0.34, w: cw - 1.1, h: 0.26, fontSize: 9.5, color: C.darkMuted });
      ky += 0.85;
    });
    T(s, FACTS.biz, { x: cx + 0.35, y: cy + ch - 0.55, w: cw - 0.7, h: 0.3, fontSize: 9, color: C.darkMuted });
    s.addNotes('정직 고지: 09-13 실측(활성 337, 실제 매장 1). 연락처는 대표 지정값. 등록 링크 /store/new (ProtectedRoute requireUser).');
  }

  await pres.writeFile({ fileName: OUT });
  console.log('wrote', OUT, '(12 slides)');
})();
