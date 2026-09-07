// 유어딜 대행사 제휴 제안서 (.pptx) 생성기
// 사실 출처: docs/business/urdeal-business-plan.md C-2 · docs/design/store-operator-model.md §7 ·
//            docs/design/urdeal-platform-model.md §2·§5 · 라이브 실측 2026-09-07
import pptxgen from 'pptxgenjs';
import sharp from 'sharp';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Fi from 'react-icons/fi';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OUT = process.argv[2] || path.join(__dirname, 'urdeal-agency-proposal.pptx');

// ── 브랜드 토큰 (src/index.css SSOT, 2026-09-02 코레일톡 시안) ──
const C = {
  brand: '1C69EF',
  brandSoft: 'E4EDFD',
  bg: 'F8F7FC',
  surface: 'FFFFFF',
  ink: '16181C',
  inkSoft: '6E6B68',
  rule: 'E6E2DE',
  dark: '11141C',
  darkSurface: '1D1F29',
  darkText: 'F8F7FC',
  darkMuted: 'B4B0AC',
  gray: '8A8580',
};
const FONT = 'Malgun Gothic';
const W = 13.333, H = 7.5, M = 0.65;

// ── 아이콘 → PNG ──
async function icon(name, color, px = 256) {
  const Comp = Fi[name];
  if (!Comp) throw new Error('icon ' + name);
  const svg = renderToStaticMarkup(React.createElement(Comp, { color: '#' + color, size: px, strokeWidth: 1.8 }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + buf.toString('base64');
}
async function wordmark(fill) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 344 100" width="1376" height="400"><text x="0" y="78" font-family="Poppins, Arial, Helvetica, sans-serif" font-weight="800" font-size="96" letter-spacing="-3.4" fill="#${fill}">urdeal</text><circle cx="322" cy="70" r="8.2" fill="#${C.brand}"/></svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + buf.toString('base64');
}

(async () => {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.author = '리스터코퍼레이션';
  pres.title = '유어딜 대행사 제휴 제안서';

  const wmDark = await wordmark(C.ink);
  const wmLight = await wordmark(C.darkText);
  const ic = {};
  for (const [k, col] of [
    ['FiPercent', C.brand], ['FiLayers', C.brand], ['FiUsers', C.brand], ['FiCreditCard', C.brand], ['FiLink', C.brand],
    ['FiMapPin', C.brand], ['FiUserCheck', C.brand], ['FiSearch', C.brand], ['FiHandshake', C.brand], ['FiEye', C.brand],
    ['FiBarChart2', C.brand], ['FiRefreshCcw', C.brand], ['FiLock', C.brand], ['FiFileText', C.brand], ['FiCheckCircle', C.brand],
    ['FiSmartphone', C.brand], ['FiShield', C.brand], ['FiMail', C.darkText], ['FiGlobe', C.darkText], ['FiHash', C.darkText],
  ]) {
    ic[k] = await icon(k === 'FiHandshake' ? 'FiThumbsUp' : k, col);
  }

  let page = 0;
  const T = (slide, text, o) => slide.addText(text, Object.assign({ fontFace: FONT, isTextBox: true, margin: 0 }, o));

  function chrome(slide, { dark = false } = {}) {
    page += 1;
    slide.background = { color: dark ? C.dark : C.bg };
    slide.addImage({ data: dark ? wmLight : wmDark, x: M, y: 0.42, w: 1.03, h: 0.3 });
    T(slide, '유어딜 대행사 제휴 제안', { x: M, y: H - 0.55, w: 6, h: 0.25, fontSize: 9.5, color: dark ? C.darkMuted : C.gray });
    T(slide, String(page).padStart(2, '0'), { x: W - M - 0.8, y: H - 0.55, w: 0.8, h: 0.25, fontSize: 10, bold: true, color: dark ? C.darkText : C.ink, align: 'right' });
  }
  function title(slide, text, { dark = false, y = 1.05, size = 30, w = W - 2 * M } = {}) {
    T(slide, text, { x: M, y, w, h: 1.0, fontSize: size, bold: true, color: dark ? C.darkText : C.ink, valign: 'top', lineSpacingMultiple: 1.15 });
  }
  function card(slide, x, y, w, h, { dark = false, fill } = {}) {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w, h, rectRadius: 0.12,
      fill: { color: fill || (dark ? C.darkSurface : C.surface) },
      line: { color: fill || (dark ? C.darkSurface : C.surface), width: 0 },
      shadow: dark ? undefined : { type: 'outer', color: '1A2C42', blur: 6, offset: 1.5, angle: 90, opacity: 0.08 },
    });
  }
  function iconCircle(slide, name, x, y, d = 0.5, { fill = C.brandSoft } = {}) {
    slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill, width: 0 } });
    slide.addImage({ data: ic[name], x: x + d * 0.25, y: y + d * 0.25, w: d * 0.5, h: d * 0.5 });
  }

  // ───────────────────────── 01 표지 ─────────────────────────
  {
    const s = pres.addSlide();
    chrome(s, { dark: true });
    s.addShape(pres.shapes.RECTANGLE, { x: 7.9, y: 0, w: W - 7.9, h: H, fill: { color: C.darkSurface }, line: { color: C.darkSurface, width: 0 } });
    s.addImage({ data: wmLight, x: M, y: 0.42, w: 1.03, h: 0.3 });
    T(s, '대행사 제휴 제안', { x: M, y: 1.75, w: 6.5, h: 0.3, fontSize: 12, bold: true, color: C.brand, charSpacing: 2 });
    s.addText([
      { text: '매장을 모아 운영하고,', options: { breakLine: true } },
      { text: '매장에게서 받으세요.', options: { color: C.brand } },
    ], { x: M, y: 2.15, w: 6.9, h: 2.0, fontFace: FONT, fontSize: 40, bold: true, color: C.darkText, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.18 });
    T(s, '유어딜은 식당, 카페, 미용, 숙박 이용권을 온라인 할인가로 파는 로컬 커머스입니다.\n대행사가 데려와 운영하는 매장에서 유어딜은 5%만 뗍니다. 나머지 95%는 매장 몫이고, 대행사 보수는 그 안에서 매장과 직접 정합니다.', {
      x: M, y: 4.35, w: 6.6, h: 1.4, fontSize: 13.5, color: C.darkMuted, lineSpacingMultiple: 1.45, valign: 'top',
    });
    T(s, '리스터코퍼레이션  |  2026년 9월', { x: M, y: H - 0.95, w: 5, h: 0.3, fontSize: 10.5, color: C.darkMuted });

    const rows = [
      ['대행사가 하는 일', '매장을 데려오고, 대신 운영한다'],
      ['매장이 하는 일', '딜과 소개비를 정한다'],
      ['유어딜이 하는 일', '결제, 정산, QR 확인, 세금'],
    ];
    let y = 1.9;
    rows.forEach(([k, v], i) => {
      s.addShape(pres.shapes.RECTANGLE, { x: 8.6, y: y + 0.05, w: 0.04, h: 0.82, fill: { color: i === 0 ? C.brand : '3A3D44' }, line: { color: i === 0 ? C.brand : '3A3D44', width: 0 } });
      T(s, k, { x: 8.85, y, w: 3.9, h: 0.3, fontSize: 10.5, color: C.darkMuted, charSpacing: 1 });
      T(s, v, { x: 8.85, y: y + 0.34, w: 4.1, h: 0.55, fontSize: 19, bold: true, color: C.darkText, valign: 'top' });
      y += 1.25;
    });
    T(s, '재고도, 택배도, 반품 응대도 이 구조에 없습니다.\n이용권은 매장에서 쓰는 권리라, 물건이 오가지 않습니다.', { x: 8.85, y: 5.75, w: 4.0, h: 0.9, fontSize: 12, color: C.darkMuted, lineSpacingMultiple: 1.45 });
    s.addNotes('표지. 핵심 메시지 하나: 유어딜은 대행사에게 지급하지 않고, 중개 매장에서 5%만 뗀다. 대행사 보수는 매장 몫 95% 안에서 매장과 직접 정한다.');
  }

  // ───────────────────────── 02 유어딜이 무엇인가 ─────────────────────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '배송되는 물건이 아니라,\n동네에서 쓰는 권리를 팝니다.', { size: 27, w: 5.5 });
    T(s, '소비자는 온라인에서 할인가로 미리 사고, 매장에 가서 QR이나 PIN으로 씁니다. 택배가 오가지 않으니 품절, 오배송, 반품이라는 사고가 애초에 없습니다. 미사용분은 100% 자동 환불되어 고객 응대가 매장이나 대행사로 흘러오지 않습니다.', {
      x: M, y: 2.55, w: 5.0, h: 1.9, fontSize: 13, color: C.inkSoft, lineSpacingMultiple: 1.5, valign: 'top',
    });
    // 실측 숫자
    card(s, M, 4.75, 5.0, 1.75);
    T(s, '338', { x: M + 0.3, y: 4.9, w: 1.7, h: 0.8, fontSize: 40, bold: true, color: C.ink });
    T(s, '판매 중 이용권', { x: M + 0.3, y: 5.75, w: 2, h: 0.3, fontSize: 11, color: C.inkSoft });
    T(s, '4', { x: M + 2.5, y: 4.9, w: 1.2, h: 0.8, fontSize: 40, bold: true, color: C.ink });
    T(s, '이용권 카테고리\n식사, 미용, 숙소, 액티비티', { x: M + 2.5, y: 5.75, w: 2.4, h: 0.6, fontSize: 11, color: C.inkSoft, lineSpacingMultiple: 1.3 });
    T(s, 'urdeal.kr 2026년 9월 7일 기준', { x: M + 0.3, y: 6.2, w: 3, h: 0.25, fontSize: 9, color: C.gray });

    const items = [
      ['FiCreditCard', '이용권', '식당, 미용, 숙박, 액티비티를 할인가로 미리 구매한 뒤 매장에서 QR이나 PIN으로 사용합니다. 유효기간은 매장이 정합니다.'],
      ['FiSmartphone', '교환권', '기프티콘형 즉시 교환권. 결제 즉시 발급되며 선물하기와 소액 전환에 강합니다.'],
      ['FiMapPin', '동네딜', '지도에서 찾는 내 주변 딜. 행정동 단위로 노출되어 상권이 뚜렷한 매장일수록 유리합니다.'],
      ['FiLink', '유어샵', '가입한 누구나 urdeal.kr/u/{주소} 진열대를 갖습니다. 매장에게는 카톡에 붙이면 미리보기 카드가 뜨는 내 페이지입니다.'],
    ];
    let y = 1.05;
    items.forEach(([i, h, p]) => {
      card(s, 6.35, y, W - M - 6.35, 1.28);
      iconCircle(s, i, 6.55, y + 0.36, 0.55);
      T(s, h, { x: 7.3, y: y + 0.17, w: 3, h: 0.35, fontSize: 15, bold: true, color: C.ink });
      T(s, p, { x: 7.3, y: y + 0.52, w: W - M - 7.5, h: 0.7, fontSize: 11, color: C.inkSoft, lineSpacingMultiple: 1.35, valign: 'top' });
      y += 1.4;
    });
    s.addNotes('제품 정의. 숫자는 2026-09-07 urdeal.kr 공개 API 실측(활성 이용권 338건).');
  }

  // ───────────────────────── 03 벤더 모델 이식 ─────────────────────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '쇼핑 공구의 벤더 모델을, 오프라인 이용권으로 옮겼습니다.');
    T(s, '공구 벤더가 이미 아는 구조입니다. 브랜드와 인플루언서를 조율하고 마진을 나누던 일이, 매장과 인플루언서를 조율하는 일로 바뀝니다. 재고와 택배와 반품이 빠지고, 정산은 자동이 됩니다. 경쟁이 아니라 이식입니다.', {
      x: M, y: 2.0, w: W - 2 * M, h: 0.8, fontSize: 13, color: C.inkSoft, lineSpacingMultiple: 1.5, valign: 'top',
    });
    const rows = [
      ['', '쇼핑 공구', '유어딜'],
      ['조율자', '벤더', '대행사'],
      ['조율 대상', '브랜드와 인플루언서', '매장과 인플루언서'],
      ['판매물', '상품', '이용권'],
      ['수령', '택배', '매장 방문, QR 확인'],
      ['마진 분배', '브랜드 프로모션 예산을 벤더와 인플루언서가 나눔', '매장 몫 95% 안에서 대행사와 인플루언서가 나눔'],
      ['플랫폼 몫', '오픈마켓 수수료와 PG', '결제, 정산, QR 인프라 5%'],
      ['남는 일', '재고, 배송, 반품, 정산 엑셀', '없음. 정산과 원천징수는 자동'],
    ];
    const tbl = rows.map((r, ri) => r.map((c, ci) => ({
      text: c,
      options: {
        fontFace: FONT, fontSize: ri === 0 ? 12 : 12.5, bold: ri === 0 || ci === 0,
        color: ri === 0 ? C.gray : (ci === 2 ? C.ink : C.inkSoft),
        fill: { color: ci === 2 && ri > 0 ? 'EEF3FE' : C.surface },
        align: 'left', valign: 'middle', margin: [0.06, 0.14, 0.06, 0.14],
        border: [{ type: 'none' }, { type: 'none' }, { type: 'solid', color: C.rule, pt: 0.75 }, { type: 'none' }],
      },
    })));
    s.addTable(tbl, { x: M, y: 3.0, w: W - 2 * M, colW: [2.0, 4.6, 5.43], rowH: 0.42 });
    s.addNotes('제품 정체성(2026-07-08 대표 확정): 쇼핑 공구의 벤더/에이전시 중개 모델을 오프라인 매장 이용권으로 옮긴 것. 쇼핑 벤더가 준비된 대행사 풀.');
  }

  // ───────────────────────── 04 시장 ─────────────────────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '대상은 동네 상권 전체이고, 온라인화는 이미 진행 중입니다.');
    const stats = [
      ['596만', '소상공인 사업체', '숙박, 음식점 79만 개와 도소매 200만 개가 이용권과 동네딜의 핵심 대상입니다.', '중기부, 소진공 2023 소상공인실태조사'],
      ['172.7조', 'O2O 서비스 거래액', '연평균 11.4%씩 자라는 오프라인 상거래의 온라인화. 유어딜이 파고드는 흐름입니다.', 'KISDI 2023 O2O 서비스산업 시장조사'],
      ['10조', '모바일 상품권 시장', '2019년 3조에서 3배. 미리 사서 매장에서 쓰는 습관이 이미 있습니다.', '업계 및 언론 추정, 2023'],
    ];
    const cw = (W - 2 * M - 0.6) / 3;
    stats.forEach(([n, l, p, src], i) => {
      const x = M + i * (cw + 0.3);
      card(s, x, 2.25, cw, 3.9);
      T(s, n, { x: x + 0.35, y: 2.5, w: cw - 0.7, h: 1.0, fontSize: 44, bold: true, color: i === 1 ? C.brand : C.ink });
      T(s, l, { x: x + 0.35, y: 3.5, w: cw - 0.7, h: 0.4, fontSize: 14, bold: true, color: C.ink });
      T(s, p, { x: x + 0.35, y: 4.0, w: cw - 0.7, h: 1.3, fontSize: 11.5, color: C.inkSoft, lineSpacingMultiple: 1.45, valign: 'top' });
      T(s, src, { x: x + 0.35, y: 5.6, w: cw - 0.7, h: 0.4, fontSize: 9, color: C.gray, lineSpacingMultiple: 1.3, valign: 'top' });
    });
    T(s, '수치는 발표 시점과 집계 범위에 따라 편차가 있습니다. 시장 전체가 아니라, 그중 손님이 방문해서 쓰는 업종이 유어딜의 직접 대상입니다.', { x: M, y: 6.4, w: W - 2 * M, h: 0.4, fontSize: 10, color: C.gray });
    s.addNotes('시장 규모는 사업계획서 B-1 공개 통계. 경쟁사 비교와 재무 추정은 대표 요청으로 제외.');
  }

  // ───────────────────────── 05 수수료 구조 ─────────────────────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '유어딜은 대행사에게 지급하지 않습니다.\n대신 대행사가 데려온 매장에서 5%만 뗍니다.');
    const cols = [
      ['매장이 직접 입점', '10', '90', false],
      ['대행사가 데려와 운영', '5', '95', true],
    ];
    cols.forEach(([h, fee, keep, hi], i) => {
      const x = M + i * 3.55;
      card(s, x, 2.7, 3.3, 3.75, { fill: hi ? C.ink : C.surface });
      T(s, h, { x: x + 0.3, y: 2.9, w: 2.8, h: 0.35, fontSize: 12.5, bold: true, color: hi ? C.darkText : C.inkSoft });
      T(s, fee + '%', { x: x + 0.3, y: 3.3, w: 2.8, h: 1.0, fontSize: 54, bold: true, color: hi ? C.brand : C.ink });
      T(s, '유어딜 수수료', { x: x + 0.3, y: 4.3, w: 2.8, h: 0.3, fontSize: 11, color: hi ? C.darkMuted : C.gray });
      s.addShape(pres.shapes.LINE, { x: x + 0.3, y: 4.8, w: 2.7, h: 0, line: { color: hi ? '3A3D44' : C.rule, width: 0.75 } });
      T(s, keep + '%', { x: x + 0.3, y: 4.95, w: 1.4, h: 0.6, fontSize: 28, bold: true, color: hi ? C.darkText : C.ink });
      T(s, '매장 몫', { x: x + 0.3, y: 5.6, w: 2.8, h: 0.3, fontSize: 11, color: hi ? C.darkMuted : C.gray });
    });
    const pts = [
      ['5%는 온전히 유어딜 몫입니다', '낮춘 요율은 대행사에게 주는 돈이 아니라 매장에게 드리는 여유입니다. 유어딜이 대행사에게 지급하는 항목은 없습니다.'],
      ['대행사 보수는 95% 안에서 매장과 직접', '금액, 방식, 기간 모두 두 분의 계약입니다. 유어딜은 그 계약에 관여하지 않고, 정산서에도 한 줄 나오지 않습니다.'],
      ['이중 수수료가 성립할 수 없는 구조', '플랫폼이 떼는 것은 하나뿐입니다. 사장님이 "대행사 붙이면 수수료가 두 번 나가나요"라고 물으면, 아니라고 답하시면 됩니다.'],
    ];
    let y = 2.7;
    pts.forEach(([h, p]) => {
      T(s, h, { x: 8.0, y, w: W - M - 8.0, h: 0.35, fontSize: 14.5, bold: true, color: C.ink });
      T(s, p, { x: 8.0, y: y + 0.38, w: W - M - 8.0, h: 0.85, fontSize: 11.5, color: C.inkSoft, lineSpacingMultiple: 1.45, valign: 'top' });
      y += 1.3;
    });
    s.addNotes('2026-09-04 대표 확정. store_channel direct=10% / brokered=5% (fee-resolver.ts 기본값, 어드민 조정 가능). 유어딜 정산에 중개사 지급은 등장하지 않는다.');
  }

  // ───────────────────────── 06 돈의 흐름 ─────────────────────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '손님이 낸 100원은 이렇게 흐릅니다.');
    // 흐름 상단: 3 박스
    const flow = [
      ['손님 결제', '100', '토스 간편결제로 할인가를 냅니다. 이용권이 즉시 발급됩니다.', C.surface, C.ink],
      ['유어딜', '5', '결제, 발급, QR 확인, 정산, 세금 처리의 인프라 비용입니다. 여기서 끝입니다.', C.ink, C.darkText],
      ['매장 몫', '95', '매장 계좌로 정산됩니다. 이 안에서 매장이 두 가지를 정합니다.', 'EEF3FE', C.ink],
    ];
    const bw = 3.55, gap = 0.6;
    flow.forEach(([h, n, p, fill, tc], i) => {
      const x = M + i * (bw + gap);
      card(s, x, 2.05, bw, 2.15, { fill });
      T(s, h, { x: x + 0.3, y: 2.2, w: bw - 0.6, h: 0.3, fontSize: 12, bold: true, color: fill === C.ink ? C.darkMuted : C.inkSoft });
      T(s, n + '원', { x: x + 0.3, y: 2.5, w: bw - 0.6, h: 0.7, fontSize: 34, bold: true, color: i === 1 ? C.brand : tc });
      T(s, p, { x: x + 0.3, y: 3.25, w: bw - 0.6, h: 0.85, fontSize: 10.5, color: fill === C.ink ? C.darkMuted : C.inkSoft, lineSpacingMultiple: 1.4, valign: 'top' });
      if (i < 2) T(s, '→', { x: x + bw + 0.1, y: 2.85, w: 0.4, h: 0.5, fontSize: 22, color: C.gray, align: 'center' });
    });
    // 하단: 매장 몫 안의 두 갈래
    const sub = [
      ['FiUsers', '인플루언서 소개비', '매장이 딜마다 제안하는 비율. 매장 부담이며, 링크 귀속과 정산과 원천징수는 유어딜이 자동으로 처리합니다. 대행사가 걷거나 나눌 일이 없습니다.'],
      ['FiFileText', '대행사 보수', '매장과 대행사의 계약입니다. 정액이든 매출 비율이든 두 분이 정하고, 유어딜 장부 밖에서 오갑니다.'],
      ['FiCheckCircle', '매장 순수취', '위 둘을 뺀 나머지. 대행사 보수를 5%p 안에 잡으면 사장님 손에는 직접 입점과 같은 돈이 남습니다.'],
    ];
    T(s, '매장 몫 95% 안에서', { x: M, y: 4.5, w: 4, h: 0.3, fontSize: 11, bold: true, color: C.gray, charSpacing: 1 });
    sub.forEach(([i, h, p], k) => {
      const x = M + k * (bw + gap);
      iconCircle(s, i, x, 4.9, 0.5);
      T(s, h, { x: x + 0.65, y: 4.93, w: bw - 0.65, h: 0.4, fontSize: 14, bold: true, color: C.ink });
      T(s, p, { x, y: 5.5, w: bw, h: 1.2, fontSize: 11, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
    });
    s.addNotes('머니 경로 SSOT: fee-resolver.ts (5%/10%), seller_influencer_deals(매장 부담 소개비), 중개사 보수는 유어딜 장부 밖.');
  }

  // ───────────────────────── 07 계산 (차트) ─────────────────────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '대행사 보수 5%p까지는,\n사장님 손에 남는 돈이 직접 입점과 같습니다.', { w: 7.7, size: 24 });
    s.addChart(pres.charts.BAR, [
      { name: '매장 순수취', labels: ['직접 입점', '대행사 경유, 보수 5%', '대행사 경유, 보수 10%'], values: [90, 90, 85] },
      { name: '대행사 보수', labels: ['직접 입점', '대행사 경유, 보수 5%', '대행사 경유, 보수 10%'], values: [0, 5, 10] },
      { name: '유어딜 수수료', labels: ['직접 입점', '대행사 경유, 보수 5%', '대행사 경유, 보수 10%'], values: [10, 5, 5] },
    ], {
      x: M, y: 2.3, w: 7.4, h: 4.55, barDir: 'col', barGrouping: 'stacked', barGapWidthPct: 55,
      chartColors: [C.brand, '8FB4F5', 'C9C5C1'],
      showValue: true, dataLabelPosition: 'ctr', dataLabelColor: 'FFFFFF', dataLabelFontSize: 11, dataLabelFontFace: FONT, dataLabelFormatCode: '0"%";;',
      valAxisMinVal: 0,
      showLegend: true, legendPos: 'b', legendFontFace: FONT, legendFontSize: 10.5, legendColor: C.inkSoft,
      catAxisLabelColor: C.ink, catAxisLabelFontFace: FONT, catAxisLabelFontSize: 11,
      valAxisLabelColor: C.gray, valAxisLabelFontSize: 9, valAxisMaxVal: 100, valAxisMajorUnit: 25, valAxisLabelFormatCode: '0"%"',
      valGridLine: { color: 'E6E2DE', size: 0.5 }, catGridLine: { style: 'none' },
      showTitle: false, plotArea: { fill: { color: C.bg } }, chartArea: { fill: { color: C.bg } },
    });
    card(s, 8.55, 1.05, W - M - 8.55, 5.8);
    const x = 8.85, w = W - M - 8.85 - 0.3;
    T(s, '월 예시', { x, y: 1.25, w, h: 0.3, fontSize: 11, bold: true, color: C.gray, charSpacing: 1 });
    T(s, '이용권 20,000원 × 100건', { x, y: 1.55, w, h: 0.4, fontSize: 15, bold: true, color: C.ink });
    T(s, '= 2,000,000원', { x, y: 1.95, w, h: 0.5, fontSize: 22, bold: true, color: C.brand });
    const rows = [
      ['유어딜 5%', '100,000원'],
      ['매장 몫', '1,900,000원'],
      ['대행사 보수 5%일 때', '100,000원'],
      ['   → 사장님 순수취', '1,800,000원'],
      ['대행사 보수 10%일 때', '200,000원'],
      ['   → 사장님 순수취', '1,700,000원'],
    ];
    let y = 2.7;
    rows.forEach(([k, v], i) => {
      const strong = i === 3 || i === 5;
      T(s, k, { x, y, w: w * 0.58, h: 0.36, fontSize: 11.5, color: strong ? C.ink : C.inkSoft, bold: strong });
      T(s, v, { x: x + w * 0.5, y, w: w * 0.5, h: 0.36, fontSize: 11.5, bold: true, color: C.ink, align: 'right' });
      if (i === 1 || i === 3) s.addShape(pres.shapes.LINE, { x, y: y + 0.42, w, h: 0, line: { color: C.rule, width: 0.75 } });
      y += 0.47;
    });
    T(s, '직접 입점이면 사장님 순수취는 1,800,000원입니다. 인플루언서 소개비는 매장이 딜마다 따로 정하는 값이라 이 계산에서 뺐습니다. 요율은 유어딜 어드민 설정 기준 기본값입니다.', { x, y: 5.6, w, h: 1.1, fontSize: 10, color: C.gray, lineSpacingMultiple: 1.4, valign: 'top' });
    s.addNotes('구조 설명용 가정 숫자. 대행사 보수 5%p까지는 매장이 직접 입점보다 손해 보지 않는다는 점이 대행사의 첫 설득 문장이 된다.');
  }

  // ───────────────────────── 08 대행사가 얻는 것 ─────────────────────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '대행사가 얻는 것은 다섯 가지입니다.');
    const items = [
      ['FiPercent', '재원이 구조 안에 있습니다', '대행사 매장은 유어딜 수수료가 10%가 아니라 5%입니다. 그 5%p가 매장에게 생기는 여유이고, 대행사 보수의 재원입니다. 별도 광고비를 먼저 받을 필요가 없습니다.'],
      ['FiLayers', '도구를 새로 만들지 않습니다', '전용 계정도, 전용 대시보드도 없습니다. 셀러 대시보드 하나에 로그인해서 맡은 매장 사이를 전환합니다. 매장마다 계정을 파고 비밀번호를 받아 두는 일이 사라집니다.'],
      ['FiUsers', '인플루언서 섭외 채널이 들어 있습니다', '유어애즈가 모은 인플루언서 DB에서 찾아 제안을 접수하면 유어딜이 발송합니다. 딜이 맺어지면 링크 귀속, 커미션 적립, 원천징수까지 자동입니다.'],
      ['FiCreditCard', '결제, 정산, QR 확인, 세금은 유어딜이 합니다', '대행사가 돈을 걷거나 나누는 지점이 없습니다. 판매 대금은 매장 계좌로, 소개비는 인플루언서에게, 각각 자동으로 갑니다.'],
      ['FiRefreshCcw', '관계는 권한 한 줄입니다', '매장과의 관계는 운영 권한 하나로 표현됩니다. 사장님이 직접 이어받을 때도 계정을 양도하는 게 아니라 권한을 바꿀 뿐이라, 상품과 주문과 리뷰가 그대로 남습니다.'],
    ];
    const colW = (W - 2 * M - 0.5) / 2;
    items.forEach(([i, h, p], k) => {
      const col = k % 2, row = Math.floor(k / 2);
      const x = M + col * (colW + 0.5);
      const y = 2.05 + row * 1.55;
      if (k === 4) {
        // 마지막 항목은 전폭
        iconCircle(s, i, x, y + 0.02, 0.5);
        T(s, h, { x: x + 0.7, y, w: colW - 0.7, h: 0.35, fontSize: 14.5, bold: true, color: C.ink });
        T(s, p, { x: x + 0.7, y: y + 0.4, w: W - 2 * M - 0.7, h: 0.9, fontSize: 11.5, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
        return;
      }
      iconCircle(s, i, x, y + 0.02, 0.5);
      T(s, h, { x: x + 0.7, y, w: colW - 0.7, h: 0.35, fontSize: 14.5, bold: true, color: C.ink });
      T(s, p, { x: x + 0.7, y: y + 0.4, w: colW - 0.7, h: 1.05, fontSize: 11.5, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
    });
    s.addNotes('사업계획서 C-2 "중개사가 얻는 것" 확장. 전용 대시보드는 2026-09-04 삭제됨. 자랑하지 말 것.');
  }

  // ───────────────────────── 09 도구 화면 ─────────────────────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '셀러 대시보드 화면 여섯 장이 대행사의 도구 전부입니다.');
    const tools = [
      ['FiMapPin', '매장 관리', '/seller/stores', '카카오맵으로 매장을 찾아 등록하고 국세청 사업자 검증을 겁니다. 등록 시 채널을 "중개"로 고르면 5% 요율이 적용됩니다. 맡은 매장 사이를 상단에서 전환합니다.'],
      ['FiUserCheck', '운영 권한', '/seller/operators', '사장님이 유어딜 핸들이나 이메일로 운영자를 추가합니다. 회수는 언제든, 조건 없이 가능합니다.'],
      ['FiSearch', '인플루언서 탐색', '/seller/influencers', '플랫폼과 팔로워 구간으로 걸러 보고, 매장 소개글을 담아 제안을 접수합니다. 연락처는 화면에 없고 발송은 유어딜이 합니다.'],
      ['FiHandshake', '소개 협업', '/seller/influencer-deals', '소개해 줄 사람에게 우대 커미션 %를 제안하거나 받은 신청에 응답합니다. 콘텐츠 게시를 확인한 뒤 발효되는 조건부 제안도 됩니다.'],
      ['FiEye', '소개비 지출 내역', '/seller/promo-spend', '내 매장에서 나간 소개비를 수령인별, 딜별로 봅니다. 운영을 맡겼어도 사장님이 항상 직접 열람하는 화면입니다.'],
      ['FiBarChart2', '운영 매장 요약', '/seller/operating', '맡은 매장마다 활성 이용권 수, 누적 매출과 주문, 운영 시작 이후 구간의 매출을 봅니다. 매장에 청구할 근거가 여기서 나옵니다.'],
    ];
    const cw = (W - 2 * M - 0.6) / 3, ch = 2.0;
    tools.forEach(([i, h, route, p], k) => {
      const col = k % 3, row = Math.floor(k / 3);
      const x = M + col * (cw + 0.3), y = 2.0 + row * (ch + 0.25);
      card(s, x, y, cw, ch);
      iconCircle(s, i, x + 0.25, y + 0.25, 0.48);
      T(s, h, { x: x + 0.85, y: y + 0.25, w: cw - 1.0, h: 0.3, fontSize: 14, bold: true, color: C.ink });
      T(s, route, { x: x + 0.85, y: y + 0.53, w: cw - 1.0, h: 0.25, fontSize: 9.5, color: C.brand, fontFace: 'Courier New' });
      T(s, p, { x: x + 0.25, y: y + 0.92, w: cw - 0.5, h: ch - 1.05, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.38, valign: 'top' });
    });
    T(s, '이용권 등록, 주문, QR 스캔, 정산 화면은 매장 사장님이 쓰는 것과 같은 화면을 그대로 씁니다.', { x: M, y: 6.45, w: W - 2 * M, h: 0.3, fontSize: 10.5, color: C.gray });
    s.addNotes('라우트는 2026-09-07 main 기준 실재. 별도 대행사 화면은 없다(2026-09-04 삭제).');
  }

  // ───────────────────────── 10 인플루언서 섭외 ─────────────────────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '매장에 인플루언서를 붙이는 일이, 다섯 단계로 끝납니다.');
    const steps = [
      ['DB에서 찾는다', '유어애즈가 모아 둔 인플루언서 DB를 플랫폼과 팔로워 구간으로 거릅니다.'],
      ['제안을 접수한다', '매장 소개와 조건을 적어 접수하면 유어딜이 발송합니다. 연락처는 대행사에게도 공개되지 않습니다.'],
      ['딜을 맺는다', '커미션 %는 매장이 정합니다. 콘텐츠 게시 링크를 확인한 뒤 발효되는 조건부 제안도 됩니다.'],
      ['귀속은 자동이다', '수락 즉시 전용 링크가 나오고, 그 링크로 들어온 주문은 자동으로 연결됩니다. 쿠폰 코드를 확인할 일이 없습니다.'],
      ['정산도 자동이다', '환불 가능 기간 7일이 지나면 확정되고, 원천징수를 계산해 지급합니다. 환불된 주문의 커미션은 자동 회수됩니다.'],
    ];
    const sw = (W - 2 * M - 4 * 0.22) / 5;
    steps.forEach(([h, p], i) => {
      const x = M + i * (sw + 0.22);
      card(s, x, 2.0, sw, 2.8);
      s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: 2.22, w: 0.42, h: 0.42, fill: { color: C.brand }, line: { color: C.brand, width: 0 } });
      T(s, String(i + 1), { x: x + 0.25, y: 2.22, w: 0.42, h: 0.42, fontSize: 12, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
      T(s, h, { x: x + 0.25, y: 2.78, w: sw - 0.5, h: 0.35, fontSize: 13.5, bold: true, color: C.ink });
      T(s, p, { x: x + 0.25, y: 3.16, w: sw - 0.5, h: 1.55, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.38, valign: 'top' });
    });
    // 하단 실측
    card(s, M, 5.05, W - 2 * M, 1.7, { fill: C.ink });
    const nums = [
      ['198,704', '인플루언서 DB'],
      ['45,725', '연락 가능 인원'],
      ['170,307', '네이버 블로그'],
      ['17,986', '유튜브'],
      ['9,803', '네이버 카페'],
    ];
    const nw = (W - 2 * M - 0.6) / 5;
    nums.forEach(([n, l], i) => {
      const x = M + 0.3 + i * nw;
      T(s, n, { x, y: 5.22, w: nw, h: 0.65, fontSize: 26, bold: true, color: i < 2 ? C.brand : C.darkText });
      T(s, l, { x, y: 5.85, w: nw, h: 0.3, fontSize: 11, color: C.darkMuted });
    });
    T(s, '2026년 9월 7일 유어딜 운영 콘솔 실측. 인스타그램과 틱톡은 탐색 필터에 있으나 DB의 대부분은 네이버 블로그와 유튜브입니다.', { x: M + 0.3, y: 6.3, w: W - 2 * M - 0.6, h: 0.3, fontSize: 9.5, color: C.darkMuted });
    s.addNotes('숫자는 /api/admin/ads/influencer-pool/stats 2026-09-07 실측. 발송은 대표가 직접 판단(자동 콜드 발송 없음).');
  }

  // ───────────────────────── 11 사장님이 안심하는 이유 ─────────────────────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '사장님이 안심하고 맡기는 구조라, 대행사의 설득이 쉬워집니다.');
    const items = [
      ['FiRefreshCcw', '회수는 언제든, 조건 없이', '사장님이 운영 권한을 회수해도 대행사가 올려 둔 이용권과 주문과 리뷰는 매장에 남습니다. 붙이는 것도 떼는 것도 권한 한 줄입니다.'],
      ['FiLock', '정산계좌와 사업자정보는 주인만', '운영자에게는 사업자등록번호와 대표자명이 가려 보이고, 계좌 변경과 사업자정보 수정과 탈퇴는 서버가 막습니다. 매장 돈이 딴 데로 갈 길이 없습니다.'],
      ['FiEye', '소개비 지출은 항상 사장님이 봅니다', '운영을 맡겨도 소개비가 누구에게 얼마 나갔는지 사장님이 직접 봅니다. 투명성은 위임 여부와 무관합니다.'],
      ['FiBarChart2', '운영 성과는 정직하게 씁니다', '운영 매장 요약은 매장 총액과 운영 시작 이후 구간을 나눠 보여 줍니다. "내가 만든 매출"이라고 부풀리지 않으니, 청구 근거로 쓸 수 있습니다.'],
    ];
    const cw = (W - 2 * M - 0.3) / 2;
    items.forEach(([i, h, p], k) => {
      const col = k % 2, row = Math.floor(k / 2);
      const x = M + col * (cw + 0.3), y = 2.05 + row * 1.6;
      card(s, x, y, cw, 1.42);
      iconCircle(s, i, x + 0.25, y + 0.25, 0.48);
      T(s, h, { x: x + 0.85, y: y + 0.22, w: cw - 1.05, h: 0.35, fontSize: 13.5, bold: true, color: C.ink });
      T(s, p, { x: x + 0.85, y: y + 0.58, w: cw - 1.1, h: 0.8, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.38, valign: 'top' });
    });
    T(s, '사장님께 이렇게 말하면 됩니다', { x: M, y: 5.35, w: 5, h: 0.3, fontSize: 11, bold: true, color: C.gray, charSpacing: 1 });
    const quotes = [
      '"가입비도 월 이용료도 없어요. 팔린 만큼만 5% 나갑니다."',
      '"계좌랑 사업자 정보는 사장님만 만질 수 있어요. 저는 못 봅니다."',
      '"맡기신 게 마음에 안 들면 오늘이라도 권한만 빼시면 돼요."',
    ];
    quotes.forEach((q, i) => {
      T(s, q, { x: M + i * ((W - 2 * M) / 3), y: 5.7, w: (W - 2 * M) / 3 - 0.2, h: 0.9, fontSize: 12, italic: true, color: C.ink, lineSpacingMultiple: 1.4, valign: 'top' });
    });
    s.addNotes('store-operator-model.md §7.7: 운영자 마스킹·403 게이트·operating summary 정직성. 실제 403 발생은 staging 확인 몫이라 "서버가 막는다"까지만 말한다.');
  }

  // ───────────────────────── 12 소비자 경험 ─────────────────────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '손님 쪽에서는 화면 네 장이면 끝나서, 팔립니다.');
    const steps = [
      ['FiMapPin', '발견', '홈 지도에서 내 동네 기준으로 이용권이 뜹니다. 유어샵 링크를 카톡에 붙이면 매장 카드가 미리보기로 뜨고, 네이버와 구글 검색에도 잡힙니다. 6개 언어를 지원합니다.'],
      ['FiCreditCard', '결제', '정가와 할인가를 함께 보고 토스로 결제합니다. 앱 설치나 가입 강요 구간이 없습니다.'],
      ['FiSmartphone', '사용', '매장에서 QR이나 PIN을 제시합니다. 매장은 POS 없이 스마트폰으로 확인합니다.'],
      ['FiShield', '환불과 응대', '미사용분은 100% 자동 환불됩니다. 재고, 배송, 반품이 없어 고객 응대가 매장이나 대행사로 흘러오지 않습니다.'],
    ];
    const cw = (W - 2 * M - 0.9) / 4;
    steps.forEach(([i, h, p], k) => {
      const x = M + k * (cw + 0.3);
      card(s, x, 2.05, cw, 3.6);
      iconCircle(s, i, x + 0.3, 2.35, 0.6);
      T(s, h, { x: x + 0.3, y: 3.15, w: cw - 0.6, h: 0.4, fontSize: 17, bold: true, color: C.ink });
      T(s, p, { x: x + 0.3, y: 3.6, w: cw - 0.6, h: 1.9, fontSize: 11, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
      if (k < 3) T(s, '→', { x: x + cw - 0.05, y: 3.6, w: 0.4, h: 0.4, fontSize: 18, color: C.gray, align: 'center' });
    });
    T(s, '가격은 매장이 정한 실제 판매가이고, 유효기간도 매장이 정합니다. 손님이 겪는 순서는 링크 클릭, 할인가 결제, 이용권 발급, 매장에서 사용입니다.', { x: M, y: 5.95, w: W - 2 * M, h: 0.6, fontSize: 11, color: C.inkSoft, lineSpacingMultiple: 1.4 });
    s.addNotes('소비자 경로: 홈 지도(/), 상세(/group-buy/:id) 토스 결제, /my-vouchers 지갑, 매장 QR/PIN 사용.');
  }

  // ───────────────────────── 13 시작 절차 ─────────────────────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '시작은 다섯 단계이고, 첫 매장까지 하루면 됩니다.');
    const steps = [
      ['셀러 계정을 만든다', '카카오 로그인 후 사업자 인증을 합니다. 대행사 자신의 사업자로 하나면 됩니다. 국세청 진위확인이 맞으면 자동 승인됩니다.'],
      ['매장을 등록하거나 권한을 받는다', '새 매장은 /seller/stores 에서 카카오맵으로 찾아 등록하고 채널을 "중개"로 고릅니다. 이미 있는 매장은 사장님이 대행사 핸들을 운영자로 추가합니다.'],
      ['이용권을 올린다', '사진, 가격, 마감, 유효기간. 모바일 한 손으로 3분이면 등록됩니다. 재고를 넣을 필요가 없습니다.'],
      ['인플루언서를 붙인다', 'DB에서 찾아 제안을 접수하고, 매장이 정한 커미션 %로 딜을 맺습니다. 링크 귀속과 정산은 자동입니다.'],
      ['운영하고 정산받는다', '판매 대금은 매장 계좌로 자동 정산됩니다. 대행사 보수는 매장과의 계약대로, 운영 매장 요약 화면의 숫자를 근거로 받습니다.'],
    ];
    const lineY = 2.55;
    s.addShape(pres.shapes.LINE, { x: M + 0.3, y: lineY, w: W - 2 * M - 0.6, h: 0, line: { color: C.rule, width: 1.5 } });
    const sw = (W - 2 * M) / 5;
    steps.forEach(([h, p], i) => {
      const x = M + i * sw;
      s.addShape(pres.shapes.OVAL, { x: x + 0.05, y: lineY - 0.25, w: 0.5, h: 0.5, fill: { color: i === 0 ? C.brand : C.surface }, line: { color: C.brand, width: 1.5 } });
      T(s, String(i + 1), { x: x + 0.05, y: lineY - 0.25, w: 0.5, h: 0.5, fontSize: 13, bold: true, color: i === 0 ? 'FFFFFF' : C.brand, align: 'center', valign: 'middle' });
      T(s, h, { x, y: lineY + 0.5, w: sw - 0.3, h: 0.75, fontSize: 13.5, bold: true, color: C.ink, lineSpacingMultiple: 1.25, valign: 'top' });
      T(s, p, { x, y: lineY + 1.3, w: sw - 0.3, h: 2.0, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.4, valign: 'top' });
    });
    card(s, M, 6.0, W - 2 * M, 0.85, { fill: C.brandSoft });
    T(s, '유어딜은 초기 서비스입니다. 트래픽을 약속하는 대신 요율과 정산 방식을 숫자로 먼저 공개합니다. 비어 있는 지역과 업종은 먼저 들어온 대행사가 가져갑니다.', { x: M + 0.3, y: 6.05, w: W - 2 * M - 0.6, h: 0.75, fontSize: 11.5, color: C.ink, valign: 'middle', lineSpacingMultiple: 1.35 });
    s.addNotes('입점 절차: 카카오 로그인 → 사업자 인증(/seller/business-info) → 승인(일치 시 자동) → 매장 등록(/seller/stores) → 이용권 등록(/seller/products/quick).');
  }

  // ───────────────────────── 14 FAQ + 연락처 ─────────────────────────
  {
    const s = pres.addSlide();
    chrome(s, { dark: true });
    title(s, '자주 나오는 질문과, 지금 하실 일.', { dark: true });
    const faqs = [
      ['수수료가 두 번 나가나요?', '아닙니다. 유어딜이 떼는 것은 하나, 중개 매장 5%뿐입니다. 대행사 보수는 매장과 대행사의 계약이고 유어딜 정산서에 나오지 않습니다.'],
      ['사장님이 직접 계정을 만들면 우리 관계는요?', '계정 양도가 아니라 권한 변경입니다. 상품, 주문, 리뷰, 정산 이력은 매장에 그대로 남고, 대행사는 운영자로 계속 일할 수 있습니다.'],
      ['비용이 드나요?', '가입비도 월 이용료도 없습니다. 매장에서 팔린 만큼만 수수료가 나가고, 대행사가 유어딜에 내는 돈은 없습니다.'],
      ['정산은 언제 되나요?', '구매확정 주문이 정산 대상이고, 신청 후 3~5 영업일 안에 매장 계좌로 입금됩니다. 인플루언서 소개비는 7일 성숙 후 유어딜이 지급합니다.'],
      ['쇼핑 공구 벤더인데 바로 할 수 있나요?', '구조가 같습니다. 브랜드 대신 매장, 상품 대신 이용권, 택배 대신 QR입니다. 재고와 반품이 빠지고 정산이 자동으로 바뀝니다.'],
    ];
    const cw = (W - 2 * M - 0.3) / 2;
    faqs.forEach(([q, a], i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = M + col * (cw + 0.3), y = 2.0 + row * 1.35;
      if (i === 4) {
        T(s, q, { x, y, w: cw, h: 0.3, fontSize: 13, bold: true, color: C.darkText });
        T(s, a, { x, y: y + 0.35, w: cw, h: 0.9, fontSize: 10.5, color: C.darkMuted, lineSpacingMultiple: 1.4, valign: 'top' });
        return;
      }
      T(s, q, { x, y, w: cw, h: 0.3, fontSize: 13, bold: true, color: C.darkText });
      T(s, a, { x, y: y + 0.35, w: cw, h: 0.9, fontSize: 10.5, color: C.darkMuted, lineSpacingMultiple: 1.4, valign: 'top' });
    });
    // 연락처 패널 (우측 하단)
    const px = M + cw + 0.3, py = 4.55, pw = cw, ph = 2.3;
    card(s, px, py, pw, ph, { fill: C.darkSurface });
    T(s, '제휴 문의', { x: px + 0.3, y: py + 0.2, w: 3, h: 0.3, fontSize: 11, bold: true, color: C.brand, charSpacing: 1 });
    const contact = [
      ['FiMail', 'jiwon@ur-team.com'],
      ['FiGlobe', 'urdeal.kr'],
      ['FiHash', '리스터코퍼레이션, 사업자등록번호 479-09-02930'],
    ];
    contact.forEach(([i, t], k) => {
      s.addImage({ data: ic[i], x: px + 0.3, y: py + 0.62 + k * 0.4, w: 0.22, h: 0.22 });
      T(s, t, { x: px + 0.7, y: py + 0.57 + k * 0.4, w: pw - 0.9, h: 0.32, fontSize: k === 2 ? 10.5 : 13, bold: k < 2, color: C.darkText, valign: 'middle' });
    });
    T(s, '매장 리스트를 보내 주시면 채널과 요율을 확인해 드립니다. 첫 매장 등록은 함께 진행합니다.', { x: px + 0.3, y: py + 1.78, w: pw - 0.6, h: 0.45, fontSize: 10, color: C.darkMuted, lineSpacingMultiple: 1.35, valign: 'top' });
    s.addNotes('FAQ 출처: 사업계획서 C-3, 셀러 가이드 "중개사 몫". 연락처는 사업계획서 A-2.');
  }

  await pres.writeFile({ fileName: OUT });
  console.log('wrote', OUT, 'slides', page);
})().catch((e) => { console.error(e); process.exit(1); });
