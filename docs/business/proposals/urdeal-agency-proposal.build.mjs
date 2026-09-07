// 유어딜 대행사 제휴 제안서 (.pptx) 생성기 — "매장을 모집하게 만드는" 실행서 판 (2026-09-07 v2)
// 사실 출처: docs/business/urdeal-business-plan.md C-2 · docs/design/store-operator-model.md §7 ·
//            seller-stores.routes.ts(국세청 진위확인·카카오맵·채널) · auto-settlement.ts(사용분 주간 정산) ·
//            라이브 실측 2026-09-07 (활성 이용권 338 · 인플루언서 DB 198,704)
// 재생성: npm i pptxgenjs sharp react react-dom react-icons && node urdeal-agency-proposal.build.mjs out.pptx
import pptxgen from 'pptxgenjs';
import sharp from 'sharp';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Fi from 'react-icons/fi';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] || path.join(__dirname, 'urdeal-agency-proposal.pptx');

// ── 브랜드 토큰 (src/index.css SSOT) ──
const C = {
  brand: '1C69EF', brandSoft: 'E4EDFD', bg: 'F8F7FC', surface: 'FFFFFF', ink: '16181C', inkSoft: '6E6B68',
  rule: 'E6E2DE', dark: '11141C', darkSurface: '1D1F29', darkText: 'F8F7FC', darkMuted: 'B4B0AC', gray: '8A8580',
  tint: 'EEF3FE',
};
const FONT = 'Malgun Gothic';
const W = 13.333, H = 7.5, M = 0.65;

async function icon(name, color, px = 256) {
  const Comp = Fi[name];
  if (!Comp) throw new Error('icon ' + name);
  const svg = renderToStaticMarkup(React.createElement(Comp, { color: '#' + color, size: px, strokeWidth: 1.8 }));
  return 'image/png;base64,' + (await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64');
}
async function wordmark(fill) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 344 100" width="1376" height="400"><text x="0" y="78" font-family="Poppins, Arial, Helvetica, sans-serif" font-weight="800" font-size="96" letter-spacing="-3.4" fill="#${fill}">urdeal</text><circle cx="322" cy="70" r="8.2" fill="#${C.brand}"/></svg>`;
  return 'image/png;base64,' + (await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64');
}

(async () => {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.author = '리스터코퍼레이션';
  pres.title = '유어딜 대행사 제휴 제안서';

  const wmDark = await wordmark(C.ink);
  const wmLight = await wordmark(C.darkText);
  const ic = {};
  const names = ['FiPercent', 'FiLayers', 'FiUsers', 'FiCreditCard', 'FiLink', 'FiMapPin', 'FiUserCheck', 'FiSearch', 'FiThumbsUp', 'FiEye',
    'FiBarChart2', 'FiRefreshCcw', 'FiLock', 'FiFileText', 'FiCheckCircle', 'FiSmartphone', 'FiShield', 'FiClock', 'FiCamera', 'FiTag',
    'FiMessageSquare', 'FiTrendingUp', 'FiXCircle', 'FiCheck', 'FiCalendar'];
  for (const n of names) ic[n] = await icon(n, C.brand);
  ic.FiMailW = await icon('FiMail', C.darkText);
  ic.FiGlobeW = await icon('FiGlobe', C.darkText);
  ic.FiFileTextW = await icon('FiFileText', C.darkText);

  let page = 0;
  const T = (slide, text, o) => slide.addText(text, Object.assign({ fontFace: FONT, isTextBox: true, margin: 0 }, o));
  function chrome(slide, { dark = false } = {}) {
    page += 1;
    slide.background = { color: dark ? C.dark : C.bg };
    slide.addImage({ data: dark ? wmLight : wmDark, x: M, y: 0.42, w: 1.03, h: 0.3 });
    T(slide, '유어딜 대행사 제휴 제안', { x: M, y: H - 0.55, w: 6, h: 0.25, fontSize: 9.5, color: dark ? C.darkMuted : C.gray });
    T(slide, String(page).padStart(2, '0'), { x: W - M - 0.8, y: H - 0.55, w: 0.8, h: 0.25, fontSize: 10, bold: true, color: dark ? C.darkText : C.ink, align: 'right' });
  }
  function title(slide, text, { dark = false, y = 1.05, size = 28, w = W - 2 * M } = {}) {
    T(slide, text, { x: M, y, w, h: 1.0, fontSize: size, bold: true, color: dark ? C.darkText : C.ink, valign: 'top', lineSpacingMultiple: 1.15 });
  }
  function card(slide, x, y, w, h, { dark = false, fill } = {}) {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w, h, rectRadius: 0.12,
      fill: { color: fill || (dark ? C.darkSurface : C.surface) },
      line: { color: fill || (dark ? C.darkSurface : C.surface), width: 0 },
      shadow: dark || fill === C.ink || fill === C.darkSurface ? undefined : { type: 'outer', color: '1A2C42', blur: 6, offset: 1.5, angle: 90, opacity: 0.08 },
    });
  }
  function iconCircle(slide, name, x, y, d = 0.5, { fill = C.brandSoft } = {}) {
    slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill, width: 0 } });
    slide.addImage({ data: ic[name], x: x + d * 0.25, y: y + d * 0.25, w: d * 0.5, h: d * 0.5 });
  }
  function numBadge(slide, n, x, y, d = 0.42, { filled = true } = {}) {
    slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: filled ? C.brand : C.surface }, line: { color: C.brand, width: 1.5 } });
    T(slide, String(n), { x, y, w: d, h: d, fontSize: 12, bold: true, color: filled ? 'FFFFFF' : C.brand, align: 'center', valign: 'middle' });
  }
  function hr(slide, x, y, w, { dark = false } = {}) {
    slide.addShape(pres.shapes.LINE, { x, y, w, h: 0, line: { color: dark ? '3A3D44' : C.rule, width: 0.75 } });
  }

  // ───────── 01 표지 ─────────
  {
    const s = pres.addSlide();
    chrome(s, { dark: true });
    s.addShape(pres.shapes.RECTANGLE, { x: 7.9, y: 0, w: W - 7.9, h: H, fill: { color: C.darkSurface }, line: { color: C.darkSurface, width: 0 } });
    s.addImage({ data: wmLight, x: M, y: 0.42, w: 1.03, h: 0.3 });
    T(s, '대행사 제휴 제안', { x: M, y: 1.65, w: 6.5, h: 0.3, fontSize: 12, bold: true, color: C.brand, charSpacing: 2 });
    s.addText([
      { text: '동네 매장을 데려오세요.', options: { breakLine: true } },
      { text: '매장 한 곳당 월 12만원이', options: { color: C.brand, breakLine: true } },
      { text: '대행사에게 남는 구조입니다.', options: { color: C.brand } },
    ], { x: M, y: 2.05, w: 6.9, h: 2.6, fontFace: FONT, fontSize: 36, bold: true, color: C.darkText, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.18 });
    T(s, '이용권 평균 2만원, 매장당 월 60건, 대행사 보수 매출의 10%를 가정한 값입니다. 유어딜은 매장에서 5%만 떼고, 대행사 보수는 매장 몫 95% 안에서 매장과 직접 정합니다. 이 문서는 그 매장을 어떻게 고르고, 10분 안에 어떻게 올리고, 사장님께 뭐라고 말하는지까지 적었습니다.', {
      x: M, y: 4.75, w: 6.7, h: 1.5, fontSize: 12.5, color: C.darkMuted, lineSpacingMultiple: 1.45, valign: 'top',
    });
    T(s, '리스터코퍼레이션  |  2026년 9월', { x: M, y: H - 0.95, w: 5, h: 0.3, fontSize: 10.5, color: C.darkMuted });

    const rows = [
      ['대행사가 하는 일', '매장을 찾아 올리고, 이용권을 운영한다'],
      ['매장이 내는 것', '팔린 금액의 5%(유어딜) + 대행사와 정한 보수'],
      ['유어딜이 하는 일', '결제, 발급, QR 확인, 정산, 세금, 손님 유입'],
    ];
    let y = 1.9;
    rows.forEach(([k, v], i) => {
      s.addShape(pres.shapes.RECTANGLE, { x: 8.6, y: y + 0.05, w: 0.04, h: 0.95, fill: { color: i === 0 ? C.brand : '3A3D44' }, line: { color: i === 0 ? C.brand : '3A3D44', width: 0 } });
      T(s, k, { x: 8.85, y, w: 3.9, h: 0.3, fontSize: 10.5, color: C.darkMuted, charSpacing: 1 });
      T(s, v, { x: 8.85, y: y + 0.34, w: 4.2, h: 0.75, fontSize: 17, bold: true, color: C.darkText, valign: 'top', lineSpacingMultiple: 1.25 });
      y += 1.35;
    });
    T(s, '대행사가 유어딜에 내는 돈은 없습니다.\n가입비도, 월 이용료도, 매장당 등록비도 없습니다.', { x: 8.85, y: 5.95, w: 4.1, h: 0.8, fontSize: 12, color: C.darkMuted, lineSpacingMultiple: 1.45 });
    s.addNotes('표지. 첫 문장에 숫자를 건다. 가정은 본문 5장에 그대로 공개한다.');
  }

  // ───────── 02 한 장 요약 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '제안을 한 장으로 줄이면 이렇습니다.');
    const cells = [
      ['FiMapPin', '무엇을 파나', '동네 식당, 카페, 미용, 숙박, 액티비티의 이용권. 손님이 온라인에서 할인가로 미리 사고 매장에 와서 QR로 씁니다. 배송도 재고도 없습니다.'],
      ['FiUsers', '대행사는 무엇을 하나', '매장을 찾아 유어딜에 올리고(10분), 이용권을 만들고(3분), 인플루언서를 붙이고, 매장에 성과를 보고합니다. 돈을 걷거나 나누는 일은 없습니다.'],
      ['FiPercent', '누가 얼마를 내나', '매장이 팔린 금액의 5%를 유어딜에 냅니다(직접 입점은 10%). 대행사 보수는 매장 몫 95% 안에서 매장과 직접 정합니다. 대행사가 유어딜에 내는 돈은 0입니다.'],
      ['FiCreditCard', '유어딜은 무엇을 하나', '결제(토스), 이용권 발급, QR 확인 앱, 주간 정산, 원천징수, 환불 응대, 홈 지도 노출과 검색 유입. 인플루언서 DB와 제안 발송까지.'],
    ];
    const cw = (W - 2 * M - 0.3) / 2, ch = 2.1;
    cells.forEach(([i, h, p], k) => {
      const col = k % 2, row = Math.floor(k / 2);
      const x = M + col * (cw + 0.3), y = 2.0 + row * (ch + 0.3);
      card(s, x, y, cw, ch);
      iconCircle(s, i, x + 0.28, y + 0.3, 0.5);
      T(s, h, { x: x + 0.95, y: y + 0.32, w: cw - 1.2, h: 0.4, fontSize: 15, bold: true, color: C.ink });
      T(s, p, { x: x + 0.28, y: y + 0.95, w: cw - 0.56, h: 1.05, fontSize: 11.5, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
    });
    T(s, '숫자 근거와 절차는 다음 장부터 순서대로 나옵니다. 마지막 장에 8주 파일럿 조건이 있습니다.', { x: M, y: 6.6, w: W - 2 * M, h: 0.3, fontSize: 10.5, color: C.gray });
    s.addNotes('요약. 사업계획서 C-2 + store-operator-model §7. "대행사가 유어딜에 내는 돈 0" 은 가입비·월정액·등록비 전부 없음(사실).');
  }

  // ───────── 03 이용권이란 (예시로) ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '이용권은 이렇게 생겼습니다. 매장 메뉴 하나가 곧 상품입니다.');
    const ex = [
      ['파스타 2인 세트', '식당', '32,000', '25,000', '22%', '유효기간 60일'],
      ['젤 네일 기본', '미용', '45,000', '35,000', '22%', '유효기간 90일'],
      ['평일 1박 (2인)', '숙박', '120,000', '89,000', '26%', '날짜 지정'],
    ];
    const cw = (W - 2 * M - 0.6) / 3;
    ex.forEach(([n, cat, orig, sale, pct, valid], i) => {
      const x = M + i * (cw + 0.3);
      card(s, x, 2.0, cw, 2.75);
      s.addShape(pres.shapes.RECTANGLE, { x, y: 2.0, w: cw, h: 0.9, fill: { color: C.tint }, line: { color: C.tint, width: 0 } });
      T(s, cat, { x: x + 0.3, y: 2.12, w: 2, h: 0.28, fontSize: 10.5, bold: true, color: C.brand });
      T(s, n, { x: x + 0.3, y: 2.4, w: cw - 0.6, h: 0.4, fontSize: 16, bold: true, color: C.ink });
      T(s, pct, { x: x + 0.3, y: 3.1, w: 1.2, h: 0.5, fontSize: 24, bold: true, color: C.brand });
      T(s, orig + '원', { x: x + 1.45, y: 3.2, w: 1.5, h: 0.3, fontSize: 12, color: C.gray, strike: true });
      T(s, sale + '원', { x: x + 0.3, y: 3.65, w: cw - 0.6, h: 0.5, fontSize: 26, bold: true, color: C.ink });
      T(s, valid + ', 미사용 시 100% 자동 환불', { x: x + 0.3, y: 4.25, w: cw - 0.6, h: 0.3, fontSize: 10.5, color: C.inkSoft });
    });
    T(s, '위 세 개는 구조를 보여드리기 위한 예시입니다. 할인율, 유효기간, 판매 수량 마감은 전부 매장이 정합니다.', { x: M, y: 4.95, w: W - 2 * M, h: 0.3, fontSize: 10.5, color: C.gray });
    const facts = [
      ['338', '지금 판매 중인 이용권'],
      ['4', '카테고리: 식사, 미용, 숙소, 액티비티'],
      ['0', '재고, 배송, 반품'],
    ];
    facts.forEach(([n, l], i) => {
      const x = M + i * 4.05;
      T(s, n, { x, y: 5.4, w: 1.6, h: 0.75, fontSize: 38, bold: true, color: i === 2 ? C.brand : C.ink });
      T(s, l, { x: x + 1.55, y: 5.62, w: 2.5, h: 0.5, fontSize: 11.5, color: C.inkSoft, lineSpacingMultiple: 1.3, valign: 'top' });
    });
    T(s, 'urdeal.kr 2026년 9월 7일 기준', { x: M, y: 6.45, w: 4, h: 0.25, fontSize: 9, color: C.gray });
    s.addNotes('예시 상품 3개는 가정. 338 은 2026-09-07 공개 API 실측(활성 이용권).');
  }

  // ───────── 04 돈의 흐름 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '손님이 낸 100원은 이렇게 갈립니다. 유어딜은 5에서 끝납니다.');
    const flow = [
      ['손님 결제', '100원', '토스로 할인가를 냅니다. 이용권이 즉시 발급됩니다.', C.surface, C.ink],
      ['유어딜', '5원', '결제, 발급, QR 확인, 정산, 세금, 손님 유입의 인프라 비용입니다.', C.ink, C.darkText],
      ['매장 몫', '95원', '손님이 매장에서 실제로 쓴 이용권만, 매주 매장 계좌로 정산됩니다.', C.tint, C.ink],
    ];
    const bw = 3.55, gap = 0.6;
    flow.forEach(([h, n, p, fill, tc], i) => {
      const x = M + i * (bw + gap);
      card(s, x, 2.05, bw, 2.05, { fill });
      T(s, h, { x: x + 0.3, y: 2.2, w: bw - 0.6, h: 0.3, fontSize: 12, bold: true, color: fill === C.ink ? C.darkMuted : C.inkSoft });
      T(s, n, { x: x + 0.3, y: 2.5, w: bw - 0.6, h: 0.7, fontSize: 34, bold: true, color: i === 1 ? C.brand : tc });
      T(s, p, { x: x + 0.3, y: 3.25, w: bw - 0.6, h: 0.8, fontSize: 10.5, color: fill === C.ink ? C.darkMuted : C.inkSoft, lineSpacingMultiple: 1.4, valign: 'top' });
      if (i < 2) T(s, '→', { x: x + bw + 0.1, y: 2.8, w: 0.4, h: 0.5, fontSize: 22, color: C.gray, align: 'center' });
    });
    T(s, '매장 몫 95원 안에서 매장이 정하는 두 가지', { x: M, y: 4.4, w: 6, h: 0.3, fontSize: 11, bold: true, color: C.gray, charSpacing: 1 });
    const sub = [
      ['FiFileText', '대행사 보수', '매장과 대행사의 계약입니다. 매출의 몇 %든, 월 정액이든 두 분이 정합니다. 유어딜 장부 밖이라 유어딜 정산서에 한 줄도 나오지 않고, 유어딜이 중간에서 떼지도 않습니다.'],
      ['FiUsers', '인플루언서 소개비', '매장이 딜마다 제안하는 비율입니다. 매장 부담이고, 링크 귀속과 지급과 원천징수는 유어딜이 자동 처리합니다. 대행사가 걷거나 나눌 일이 없습니다.'],
      ['FiCheckCircle', '매장 순수취', '위 둘을 뺀 나머지. 다음 장에서 매장 한 곳 기준으로 실제 숫자를 놓습니다.'],
    ];
    sub.forEach(([i, h, p], k) => {
      const x = M + k * (bw + gap);
      iconCircle(s, i, x, 4.8, 0.5);
      T(s, h, { x: x + 0.65, y: 4.83, w: bw - 0.65, h: 0.4, fontSize: 14, bold: true, color: C.ink });
      T(s, p, { x, y: 5.4, w: bw, h: 1.3, fontSize: 11, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
    });
    s.addNotes('2026-09-04 대표 확정. 정산은 used 상태 이용권만 주간(auto-settlement.ts). 중개사 지급은 유어딜 장부 밖.');
  }

  // ───────── 05 매장 1곳 단위 경제 (대행사 시점) ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '매장 한 곳이 대행사에게 얼마가 되는가. 가정은 전부 공개합니다.', { size: 25 });
    // 좌: 가정과 계산
    card(s, M, 2.05, 5.6, 4.7);
    const x = M + 0.3, w = 5.0;
    T(s, '가정 (바꿔서 다시 계산하셔도 됩니다)', { x, y: 2.25, w, h: 0.3, fontSize: 11, bold: true, color: C.gray, charSpacing: 1 });
    const a = [
      ['이용권 평균 판매가', '20,000원'],
      ['매장당 월 판매', '60건'],
      ['매장 월 매출(GMV)', '1,200,000원'],
      ['유어딜 5%', '60,000원'],
      ['매장 몫 95%', '1,140,000원'],
      ['대행사 보수 (매출 10% 계약 시)', '120,000원'],
    ];
    let y = 2.62;
    a.forEach(([k, v], i) => {
      const strong = i === 5;
      T(s, k, { x, y, w: w * 0.62, h: 0.34, fontSize: 11.5, color: strong ? C.ink : C.inkSoft, bold: strong });
      T(s, v, { x: x + w * 0.55, y, w: w * 0.45, h: 0.34, fontSize: 12, bold: true, color: strong ? C.brand : C.ink, align: 'right' });
      if (i === 2 || i === 4) hr(s, x, y + 0.4, w);
      y += 0.46;
    });
    T(s, '매장 10곳이면 월 120만원, 30곳이면 월 360만원입니다. 매장 하나를 올리는 데 드는 시간은 방문 30분과 등록 10분입니다.', { x, y: 5.5, w, h: 1.1, fontSize: 11.5, color: C.ink, lineSpacingMultiple: 1.45, valign: 'top' });
    // 우: 차트 (매장 수 × 대행사 월 수입)
    s.addChart(pres.charts.BAR, [
      { name: '보수 10%', labels: ['5곳', '10곳', '20곳', '30곳'], values: [60, 120, 240, 360] },
      { name: '보수 15%', labels: ['5곳', '10곳', '20곳', '30곳'], values: [90, 180, 360, 540] },
    ], {
      x: 6.6, y: 2.05, w: W - M - 6.6, h: 4.7, barDir: 'col', barGrouping: 'clustered', barGapWidthPct: 60,
      chartColors: [C.brand, '8FB4F5'],
      showValue: true, dataLabelPosition: 'outEnd', dataLabelColor: C.ink, dataLabelFontSize: 10, dataLabelFontFace: FONT, dataLabelFormatCode: '#,##0"만"',
      showLegend: true, legendPos: 'b', legendFontFace: FONT, legendFontSize: 10.5, legendColor: C.inkSoft,
      catAxisLabelColor: C.ink, catAxisLabelFontFace: FONT, catAxisLabelFontSize: 11,
      valAxisLabelColor: C.gray, valAxisLabelFontSize: 9, valAxisMinVal: 0, valAxisMaxVal: 600, valAxisMajorUnit: 150, valAxisLabelFormatCode: '#,##0"만원"',
      valGridLine: { color: 'E6E2DE', size: 0.5 }, catGridLine: { style: 'none' },
      showTitle: true, title: '매장 수별 대행사 월 수입 (매장당 월 매출 120만원 가정)', titleFontFace: FONT, titleFontSize: 11, titleColor: C.inkSoft,
      plotArea: { fill: { color: C.bg } }, chartArea: { fill: { color: C.bg } },
    });
    s.addNotes('전부 가정. 판매가 2만·월 60건은 구조 설명용. 보수율은 매장과 대행사의 계약이며 유어딜이 정하지 않는다.');
  }

  // ───────── 06 사장님 셈법 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '사장님이 "네" 하는 이유도 숫자입니다. 광고비 선지출이 없습니다.', { size: 25 });
    // 좌: 한 건의 셈
    card(s, M, 2.05, 5.9, 4.7);
    const x = M + 0.3, w = 5.3;
    T(s, '이용권 한 장이 팔렸을 때 (파스타 2인 세트 예시)', { x, y: 2.25, w, h: 0.3, fontSize: 11, bold: true, color: C.gray, charSpacing: 1 });
    const rows = [
      ['정가', '32,000원', false],
      ['이용권 판매가 (22% 할인)', '25,000원', false],
      ['유어딜 5%', '1,250원', false],
      ['대행사 보수 10% (계약 예시)', '2,500원', false],
      ['매장에 들어오는 돈', '21,250원', true],
      ['재료비 35% 가정', '11,200원', false],
      ['매장 이익', '10,050원', true],
    ];
    let y = 2.62;
    rows.forEach(([k, v, strong], i) => {
      T(s, k, { x, y, w: w * 0.62, h: 0.34, fontSize: 11.5, color: strong ? C.ink : C.inkSoft, bold: strong });
      T(s, v, { x: x + w * 0.55, y, w: w * 0.45, h: 0.34, fontSize: 12, bold: true, color: strong ? C.brand : C.ink, align: 'right' });
      if (i === 1 || i === 3 || i === 5) hr(s, x, y + 0.4, w);
      y += 0.46;
    });
    T(s, '이 손님은 광고 없이 온 새 손님입니다. 안 팔리면 0원이고, 팔린 뒤에만 수수료가 나갑니다.', { x, y: 5.95, w, h: 0.7, fontSize: 11.5, color: C.ink, lineSpacingMultiple: 1.4, valign: 'top' });
    // 우: 사장님이 좋아하는 것 4
    const pts = [
      ['FiXCircle', '선지출 광고비 0', '배너, 검색 광고, 체험단처럼 미리 내는 돈이 없습니다. 팔린 만큼만 나갑니다.'],
      ['FiTag', '할인율과 유효기간은 사장님이', '남는 메뉴만 올리고, 할인율도 마감 수량도 직접 정합니다. 손해 보는 구조를 만들 수 없습니다.'],
      ['FiClock', '정산은 손님이 쓴 뒤 매주', '손님이 매장에서 QR을 찍은 이용권만 주간 정산으로 매장 계좌에 들어옵니다. 안 쓴 이용권은 손님에게 자동 환불됩니다.'],
      ['FiSmartphone', '사장님이 하는 일은 하나', '손님 QR을 폰으로 찍거나 확인 PIN을 눌러 주는 것. 등록과 운영은 대행사가 합니다.'],
    ];
    let py = 2.05;
    pts.forEach(([i, h, p]) => {
      iconCircle(s, i, 6.95, py + 0.02, 0.46);
      T(s, h, { x: 7.6, y: py, w: W - M - 7.6, h: 0.32, fontSize: 13.5, bold: true, color: C.ink });
      T(s, p, { x: 7.6, y: py + 0.35, w: W - M - 7.6, h: 0.75, fontSize: 11, color: C.inkSoft, lineSpacingMultiple: 1.4, valign: 'top' });
      py += 1.2;
    });
    s.addNotes('재료비 35% 는 가정. 정산 규칙(used 만 주간)은 auto-settlement.ts. 사용 처리는 매장 계산대 QR 스캔 또는 확인 PIN(store_verify_pin).');
  }

  // ───────── 07 어떤 매장을 데려올지 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '이 여섯 가지가 되면 데려오세요. 대부분 그 자리에서 진행됩니다.', { size: 25 });
    const checks = [
      ['사업자등록이 있다', '사업자번호, 대표자명, 개업일 세 가지로 국세청 진위확인을 합니다. 이게 없으면 올릴 수 없습니다.'],
      ['카카오맵에 매장이 있다', '등록할 때 카카오맵 장소를 연결합니다. 없으면 사장님이 카카오맵에 먼저 등록해야 합니다(무료, 하루 이틀).'],
      ['손님이 방문해서 쓰는 업종이다', '식당, 카페, 미용, 네일, 숙박, 키즈카페, 스튜디오, 클래스. 택배로 보내는 상품만 파는 곳은 대상이 아닙니다.'],
      ['15~30% 할인해도 남는 대표 메뉴가 있다', '이용권은 할인가로 팝니다. 마진이 얇은 메뉴만 있는 곳은 사장님이 곧 후회합니다.'],
      ['사진이 3장 이상 있다', '이용권 카드의 절반은 사진입니다. 없으면 방문할 때 폰으로 찍어 오세요.'],
      ['사장님이나 직원이 폰으로 QR을 찍을 수 있다', '사용 처리는 매장 폰 한 대로 끝납니다. POS 연동이 필요 없습니다.'],
    ];
    const cw = (W - 2 * M - 0.3) / 2;
    checks.forEach(([h, p], k) => {
      const col = k % 2, row = Math.floor(k / 2);
      const x = M + col * (cw + 0.3), y = 2.0 + row * 1.45;
      s.addImage({ data: ic.FiCheck, x, y: y + 0.03, w: 0.3, h: 0.3 });
      T(s, h, { x: x + 0.45, y, w: cw - 0.5, h: 0.35, fontSize: 14, bold: true, color: C.ink });
      T(s, p, { x: x + 0.45, y: y + 0.38, w: cw - 0.6, h: 0.9, fontSize: 11, color: C.inkSoft, lineSpacingMultiple: 1.4, valign: 'top' });
    });
    card(s, M, 6.35, W - 2 * M, 0.55, { fill: C.tint });
    T(s, '먼저 갈 곳: 이미 배달앱이나 예약앱에 광고비를 쓰고 있는 매장. "그 돈을 팔린 뒤에만 내는 걸로 바꾸자"는 한 문장이 통합니다.', { x: M + 0.3, y: 6.35, w: W - 2 * M - 0.6, h: 0.55, fontSize: 11, color: C.ink, valign: 'middle' });
    s.addNotes('등록 필수 필드는 seller-stores.routes.ts: business_number·representative·business_start_date(국세청) + kakao_place_id. 카카오맵 미등록 매장은 연결 불가.');
  }

  // ───────── 08 매장 등록 10분 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '사장님 앞에서 10분. 서명도 서류도 없이 대행사 폰으로 끝납니다.');
    const steps = [
      ['FiSearch', '카카오맵에서 매장 찾기', '/seller/stores 에서 매장 이름을 검색해 장소를 연결합니다. 주소와 좌표가 자동으로 들어옵니다.', '1분'],
      ['FiShield', '국세청 진위확인', '사업자번호, 대표자명, 개업일을 넣으면 국세청 조회로 즉시 확인됩니다. 사장님이 사업자등록증 사진만 보여 주면 됩니다.', '2분'],
      ['FiLayers', '채널 "중개" 선택', '등록 시 채널을 중개로 고르면 유어딜 수수료가 5%로 잡힙니다. 매장 확인 PIN도 여기서 정합니다.', '1분'],
      ['FiCamera', '이용권 만들기', '사진, 정가, 판매가, 유효기간, 마감 수량. 대표 메뉴 두세 개면 충분합니다. 사진은 그 자리에서 찍어도 됩니다.', '3분씩'],
      ['FiSmartphone', '사장님께 사용법 알려 드리기', '손님이 QR을 보여 주면 매장 폰으로 찍거나, 손님 화면에 매장 PIN을 눌러 주면 끝. 이 한 가지만 설명하면 됩니다.', '3분'],
    ];
    const sw = (W - 2 * M - 4 * 0.22) / 5;
    steps.forEach(([i, h, p, t], k) => {
      const x = M + k * (sw + 0.22);
      card(s, x, 2.0, sw, 3.9);
      numBadge(s, k + 1, x + 0.25, 2.22);
      T(s, t, { x: x + sw - 1.1, y: 2.27, w: 0.85, h: 0.3, fontSize: 11, bold: true, color: C.brand, align: 'right' });
      iconCircle(s, i, x + 0.25, 2.85, 0.5);
      T(s, h, { x: x + 0.25, y: 3.5, w: sw - 0.5, h: 0.7, fontSize: 13, bold: true, color: C.ink, lineSpacingMultiple: 1.25, valign: 'top' });
      T(s, p, { x: x + 0.25, y: 4.2, w: sw - 0.5, h: 1.6, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.38, valign: 'top' });
    });
    T(s, '등록은 대행사 셀러 계정으로 합니다. 사장님이 나중에 직접 계정을 만들어 이어받을 때는 계정 양도가 아니라 권한 변경이라, 올려 둔 이용권과 주문과 리뷰가 그대로 남습니다.', { x: M, y: 6.15, w: W - 2 * M, h: 0.6, fontSize: 11, color: C.inkSoft, lineSpacingMultiple: 1.4 });
    s.addNotes('시간은 현장 추정. 필드는 seller-stores.routes.ts 실재(kakao_place_id, business_number/representative/business_start_date, store_channel, verify_pin). 이용권 3분 등록은 /seller/products/quick.');
  }

  // ───────── 09 사장님 설득 대본 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '사장님께 하는 말 네 마디와, 거절 다섯 가지의 답.');
    // 좌: 3문장
    card(s, M, 2.0, 5.3, 4.75, { fill: C.ink });
    T(s, '5분 대본', { x: M + 0.3, y: 2.2, w: 3, h: 0.3, fontSize: 11, bold: true, color: C.brand, charSpacing: 1 });
    const lines = [
      ['열기', '"사장님, 배달앱 말고 손님이 가게에 직접 오게 하는 건데요. 미리 내는 돈은 없고 팔린 만큼만 5% 나갑니다."'],
      ['보여주기', '"이 메뉴를 이용권으로 올리면 이렇게 보입니다." (홈 지도와 이용권 카드 화면을 폰으로 보여 준다)'],
      ['정하기', '"어떤 메뉴를 몇 % 할인해서 올릴까요? 유효기간은요?" 사장님이 정하게 한다. 대행사가 대신 정하지 않는다.'],
      ['끝내기', '"사업자등록증만 보여 주시면 지금 10분 안에 올라갑니다. 손님 오면 QR만 찍어 주세요."'],
    ];
    let y = 2.6;
    lines.forEach(([k, v]) => {
      T(s, k, { x: M + 0.3, y, w: 1.0, h: 0.3, fontSize: 11, bold: true, color: C.darkMuted });
      T(s, v, { x: M + 1.2, y, w: 3.85, h: 0.95, fontSize: 11, color: C.darkText, lineSpacingMultiple: 1.4, valign: 'top' });
      y += 1.0;
    });
    // 우: 거절 5
    const obj = [
      ['"할인하면 손해 아니에요?"', '남는 메뉴만, 사장님이 정한 할인율로만 올립니다. 안 팔리면 0원이고, 팔리면 새 손님입니다.'],
      ['"배달앱이랑 뭐가 달라요?"', '배달이 없고 손님이 가게에 옵니다. 수수료는 5%이고, 가게 페이지가 사장님 것으로 남습니다. 병행해도 됩니다.'],
      ['"정산은 언제 들어와요?"', '손님이 매장에서 쓴 이용권만 매주 정산돼 매장 계좌로 들어옵니다. 안 쓴 건 손님에게 자동 환불이라 분쟁이 없습니다.'],
      ['"귀찮은 일 있어요?"', '손님 QR을 폰으로 찍는 것 하나입니다. 등록, 이용권 관리, 인플루언서 섭외는 제가 합니다.'],
      ['"계약서 써야 해요?"', '유어딜과는 가입뿐입니다. 저와의 운영 위임은 권한 한 줄이고, 마음에 안 들면 오늘이라도 사장님이 빼시면 됩니다.'],
    ];
    let oy = 2.0;
    obj.forEach(([q, a]) => {
      T(s, q, { x: 6.3, y: oy, w: W - M - 6.3, h: 0.3, fontSize: 12.5, bold: true, color: C.ink });
      T(s, a, { x: 6.3, y: oy + 0.32, w: W - M - 6.3, h: 0.6, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.38, valign: 'top' });
      oy += 0.96;
    });
    s.addNotes('대본의 모든 사실 주장은 앞 장들과 동일 출처. "권한 한 줄, 언제든 회수" 는 seller_operators 모델.');
  }

  // ───────── 10 인플루언서 붙이기 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '인플루언서 섭외, 계약, 정산이 화면 안에서 끝납니다.');
    const steps = [
      ['DB에서 고른다', '/seller/influencers 에서 플랫폼과 팔로워 구간으로 거릅니다. 매장 동네에서 활동하는 채널을 우선합니다.'],
      ['제안을 접수한다', '매장 소개와 조건을 적어 접수하면 유어딜이 발송합니다. 연락처는 대행사에게도 공개되지 않습니다.'],
      ['딜을 맺는다', '/seller/influencer-deals 에서 커미션 %를 제안합니다. 매장이 정한 값이고 매장 부담입니다. 콘텐츠 게시를 확인한 뒤 발효되는 조건부도 됩니다.'],
      ['귀속은 자동', '수락 즉시 전용 링크가 나오고 그 링크로 들어온 주문이 자동 연결됩니다. 쿠폰 코드를 확인할 일이 없습니다.'],
      ['지급도 자동', '환불 가능 기간 7일이 지나면 확정되고, 원천징수를 계산해 유어딜이 지급합니다. 대행사가 돈을 옮기지 않습니다.'],
    ];
    const sw = (W - 2 * M - 4 * 0.22) / 5;
    steps.forEach(([h, p], i) => {
      const x = M + i * (sw + 0.22);
      card(s, x, 2.0, sw, 2.85);
      numBadge(s, i + 1, x + 0.25, 2.22);
      T(s, h, { x: x + 0.25, y: 2.78, w: sw - 0.5, h: 0.35, fontSize: 13.5, bold: true, color: C.ink });
      T(s, p, { x: x + 0.25, y: 3.16, w: sw - 0.5, h: 1.6, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.38, valign: 'top' });
    });
    card(s, M, 5.1, W - 2 * M, 1.65, { fill: C.ink });
    const nums = [['198,704', '인플루언서 DB'], ['45,725', '연락 가능'], ['170,307', '네이버 블로그'], ['17,986', '유튜브'], ['9,803', '네이버 카페']];
    const nw = (W - 2 * M - 0.6) / 5;
    nums.forEach(([n, l], i) => {
      const x = M + 0.3 + i * nw;
      T(s, n, { x, y: 5.27, w: nw, h: 0.65, fontSize: 26, bold: true, color: i < 2 ? C.brand : C.darkText });
      T(s, l, { x, y: 5.9, w: nw, h: 0.3, fontSize: 11, color: C.darkMuted });
    });
    T(s, '2026년 9월 7일 유어딜 운영 콘솔 실측. 인스타그램과 틱톡은 탐색 필터에 있으나 DB의 대부분은 네이버 블로그와 유튜브입니다.', { x: M + 0.3, y: 6.33, w: W - 2 * M - 0.6, h: 0.3, fontSize: 9.5, color: C.darkMuted });
    s.addNotes('숫자는 /api/admin/ads/influencer-pool/stats 2026-09-07 실측.');
  }

  // ───────── 11 주간 루틴 + 도구 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '담당자 한 명의 일주일. 쓰는 화면은 여섯 장뿐입니다.');
    const days = [
      ['월·화', '매장 방문 4곳', '7장 체크리스트로 고른 매장을 방문해 등록합니다. 하루 2곳이면 충분합니다.', '/seller/stores'],
      ['수', '이용권 손보기', '사진 교체, 마감 수량, 할인율 조정. 잘 팔리는 메뉴는 수량을 늘립니다.', '/seller/products'],
      ['목', '인플루언서 제안 5건', 'DB에서 매장 동네 채널을 골라 제안을 접수하고, 들어온 신청에 답합니다.', '/seller/influencers'],
      ['금', '매장에 보고', '운영 매장 요약에서 매장별 매출과 주문을 뽑아 사장님께 보내고, 계약대로 청구합니다.', '/seller/operating'],
    ];
    const cw = (W - 2 * M - 0.9) / 4;
    days.forEach(([d, h, p, r], i) => {
      const x = M + i * (cw + 0.3);
      card(s, x, 2.0, cw, 2.6);
      T(s, d, { x: x + 0.25, y: 2.18, w: cw - 0.5, h: 0.3, fontSize: 11, bold: true, color: C.brand, charSpacing: 1 });
      T(s, h, { x: x + 0.25, y: 2.5, w: cw - 0.5, h: 0.4, fontSize: 15, bold: true, color: C.ink });
      T(s, p, { x: x + 0.25, y: 2.95, w: cw - 0.5, h: 1.1, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.38, valign: 'top' });
      T(s, r, { x: x + 0.25, y: 4.15, w: cw - 0.5, h: 0.25, fontSize: 9.5, color: C.brand, fontFace: 'Courier New' });
    });
    T(s, '쓰는 화면 여섯 장 (전부 셀러 대시보드. 대행사 전용 계정이나 별도 프로그램이 없습니다)', { x: M, y: 4.85, w: W - 2 * M, h: 0.3, fontSize: 11, bold: true, color: C.gray, charSpacing: 1 });
    const tools = [
      ['매장 관리', '/seller/stores', '등록, 국세청 확인, 채널, 매장 전환'],
      ['운영 권한', '/seller/operators', '사장님이 대행사 핸들을 추가하거나 회수'],
      ['인플루언서 탐색', '/seller/influencers', '필터, 제안 접수'],
      ['소개 협업', '/seller/influencer-deals', '커미션 % 제안, 조건부 발효'],
      ['소개비 내역', '/seller/promo-spend', '수령인별·딜별. 사장님도 항상 열람'],
      ['운영 매장 요약', '/seller/operating', '매장별 매출·주문, 운영 시작 이후 구간'],
    ];
    const tw = (W - 2 * M - 0.4) / 3;
    tools.forEach(([h, r, p], k) => {
      const col = k % 3, row = Math.floor(k / 3);
      const x = M + col * (tw + 0.2), y = 5.25 + row * 0.75;
      T(s, h, { x, y, w: 1.6, h: 0.3, fontSize: 11.5, bold: true, color: C.ink });
      T(s, r, { x: x + 1.55, y: y + 0.02, w: 2.2, h: 0.26, fontSize: 9.5, color: C.brand, fontFace: 'Courier New' });
      T(s, p, { x, y: y + 0.3, w: tw - 0.2, h: 0.35, fontSize: 10, color: C.inkSoft });
    });
    s.addNotes('라우트 6개는 2026-09-07 main 실재. 요일 배분은 권장 루틴.');
  }

  // ───────── 12 사장님이 안심하는 이유 (짧게) ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '사장님이 맡겨도 잃을 게 없어서, 두 번째 방문이 쉬워집니다.', { size: 25 });
    const items = [
      ['FiRefreshCcw', '회수는 언제든, 조건 없이', '사장님이 권한을 빼도 대행사가 올려 둔 이용권, 주문, 리뷰는 매장에 남습니다. 붙이는 것도 떼는 것도 권한 한 줄입니다.'],
      ['FiLock', '정산계좌와 사업자정보는 주인만', '운영자에게는 사업자번호와 대표자명이 가려 보이고, 계좌 변경과 사업자정보 수정과 탈퇴는 서버가 막습니다. 매장 돈이 딴 데로 갈 길이 없습니다.'],
      ['FiEye', '소개비 지출은 항상 사장님이 봅니다', '운영을 맡겨도 소개비가 누구에게 얼마 나갔는지 사장님이 직접 봅니다. 투명성은 위임 여부와 무관합니다.'],
      ['FiBarChart2', '운영 성과는 부풀리지 않습니다', '운영 매장 요약은 매장 총액과 "운영 시작 이후" 구간을 나눠 보여 줍니다. 그래서 그 숫자를 청구 근거로 쓸 수 있습니다.'],
    ];
    const cw = (W - 2 * M - 0.3) / 2;
    items.forEach(([i, h, p], k) => {
      const col = k % 2, row = Math.floor(k / 2);
      const x = M + col * (cw + 0.3), y = 2.05 + row * 1.7;
      card(s, x, y, cw, 1.5);
      iconCircle(s, i, x + 0.25, y + 0.27, 0.48);
      T(s, h, { x: x + 0.85, y: y + 0.24, w: cw - 1.05, h: 0.35, fontSize: 13.5, bold: true, color: C.ink });
      T(s, p, { x: x + 0.85, y: y + 0.6, w: cw - 1.1, h: 0.85, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.38, valign: 'top' });
    });
    card(s, M, 5.65, W - 2 * M, 1.05, { fill: C.tint });
    T(s, '그래서 사장님께 이렇게 말할 수 있습니다.', { x: M + 0.3, y: 5.75, w: 5, h: 0.3, fontSize: 10.5, bold: true, color: C.gray });
    T(s, '"계좌랑 사업자 정보는 사장님만 만질 수 있고 저는 못 봅니다. 마음에 안 들면 오늘이라도 권한만 빼시면 되고, 올려 둔 건 다 사장님 것으로 남습니다."', { x: M + 0.3, y: 6.05, w: W - 2 * M - 0.6, h: 0.55, fontSize: 12, italic: true, color: C.ink, lineSpacingMultiple: 1.35, valign: 'top' });
    s.addNotes('store-operator-model.md §7.7. 실제 403 발생은 staging 확인 몫이라 "서버가 막는다"까지만.');
  }

  // ───────── 13 유어딜이 대행사에게 해 주는 것 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '유어딜이 대행사에게 붙여 드리는 것 여섯 가지.');
    const items = [
      ['FiUserCheck', '첫 매장 세 곳은 같이 갑니다', '첫 등록 세 건은 유어딜 담당자가 현장이나 통화로 동행합니다. 국세청 확인, 카카오맵 연결, 이용권 등록을 한 번 같이 하면 그다음은 혼자 됩니다.'],
      ['FiFileText', '사장님용 한 장 안내', '수수료, 정산, QR 사용법이 적힌 매장용 안내 한 장을 드립니다. 대행사 이름을 넣어 드립니다.'],
      ['FiUsers', '인플루언서 DB와 발송 대행', '19만 명 DB 탐색과 제안 발송을 유어딜이 합니다. 연락처를 모으거나 DM을 돌릴 필요가 없습니다.'],
      ['FiCreditCard', '결제, 정산, 환불, 세금', '토스 결제, 주간 정산, 미사용 환불, 원천징수를 유어딜이 처리합니다. 손님 CS도 유어딜로 옵니다.'],
      ['FiMapPin', '손님 유입', '홈 지도에 동네 기준으로 노출되고, 매장 페이지는 카톡 미리보기 카드와 네이버·구글 검색에 잡힙니다. 6개 언어를 지원합니다.'],
      ['FiTrendingUp', '주간 실적 공유', '파일럿 기간에는 매주 매장별 판매와 사용 숫자를 유어딜이 먼저 보내 드립니다. 매장 보고서에 그대로 쓰시면 됩니다.'],
    ];
    const cw = (W - 2 * M - 0.6) / 3, ch = 2.15;
    items.forEach(([i, h, p], k) => {
      const col = k % 3, row = Math.floor(k / 3);
      const x = M + col * (cw + 0.3), y = 2.0 + row * (ch + 0.3);
      card(s, x, y, cw, ch);
      iconCircle(s, i, x + 0.25, y + 0.25, 0.48);
      T(s, h, { x: x + 0.85, y: y + 0.3, w: cw - 1.05, h: 0.4, fontSize: 13.5, bold: true, color: C.ink });
      T(s, p, { x: x + 0.25, y: y + 0.85, w: cw - 0.5, h: ch - 1.0, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.38, valign: 'top' });
    });
    s.addNotes('동행·안내장·주간 실적 공유는 파일럿 제안의 유어딜 측 약속. 나머지 셋은 현행 기능.');
  }

  // ───────── 14 8주 파일럿 제안 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '8주 파일럿 제안. 매장 10곳이면 구조가 맞는지 판정이 납니다.', { size: 25 });
    // 좌: 목표 숫자
    card(s, M, 2.0, 4.1, 4.75, { fill: C.ink });
    T(s, '8주 목표', { x: M + 0.3, y: 2.2, w: 3, h: 0.3, fontSize: 11, bold: true, color: C.brand, charSpacing: 1 });
    const goals = [['10곳', '등록 매장'], ['30개', '판매 중 이용권 (매장당 3개)'], ['20건', '인플루언서 제안 접수'], ['1회', '매장별 실적 보고와 청구']];
    let gy = 2.6;
    goals.forEach(([n, l]) => {
      T(s, n, { x: M + 0.3, y: gy, w: 1.5, h: 0.6, fontSize: 28, bold: true, color: C.darkText });
      T(s, l, { x: M + 1.75, y: gy + 0.15, w: 2.2, h: 0.4, fontSize: 11, color: C.darkMuted, valign: 'middle' });
      gy += 0.95;
    });
    T(s, '숫자는 제안입니다. 담당자 한 명, 주 2일 방문 기준으로 잡았습니다.', { x: M + 0.3, y: 6.35, w: 3.5, h: 0.35, fontSize: 9.5, color: C.darkMuted });
    // 중: 대행사가 준비할 것
    const cx = M + 4.4, cw = (W - M - cx - 0.3) / 2;
    card(s, cx, 2.0, cw, 4.75);
    T(s, '대행사가 준비할 것', { x: cx + 0.3, y: 2.2, w: cw - 0.6, h: 0.3, fontSize: 11, bold: true, color: C.gray, charSpacing: 1 });
    const prep = [
      '담당자 1명과 카카오 계정 (셀러 계정은 사업자 인증으로 10분)',
      '후보 매장 리스트 10~20곳 (7장 체크리스트 기준)',
      '매장과 맺을 보수 조건 초안 (매출 % 또는 월 정액. 유어딜은 관여하지 않습니다)',
      '첫 방문 일정 2주치',
    ];
    let py = 2.6;
    prep.forEach((t, i) => {
      numBadge(s, i + 1, cx + 0.3, py, 0.36, { filled: false });
      T(s, t, { x: cx + 0.8, y: py - 0.02, w: cw - 1.1, h: 0.85, fontSize: 11.5, color: C.ink, lineSpacingMultiple: 1.4, valign: 'top' });
      py += 0.95;
    });
    // 우: 유어딜이 준비할 것
    const rx = cx + cw + 0.3;
    card(s, rx, 2.0, cw, 4.75);
    T(s, '유어딜이 준비할 것', { x: rx + 0.3, y: 2.2, w: cw - 0.6, h: 0.3, fontSize: 11, bold: true, color: C.gray, charSpacing: 1 });
    const ours = [
      '첫 3매장 등록 동행 (현장 또는 통화)',
      '대행사 이름이 들어간 사장님용 안내 한 장',
      '인플루언서 제안 발송, 결제·정산·환불·CS 전부',
      '매주 매장별 판매·사용 숫자 공유. 8주 뒤 함께 판정',
    ];
    py = 2.6;
    ours.forEach((t, i) => {
      numBadge(s, i + 1, rx + 0.3, py, 0.36);
      T(s, t, { x: rx + 0.8, y: py - 0.02, w: cw - 1.1, h: 0.85, fontSize: 11.5, color: C.ink, lineSpacingMultiple: 1.4, valign: 'top' });
      py += 0.95;
    });
    s.addNotes('파일럿 조건은 이 문서의 제안. 유어딜은 대행사 보수 조건에 관여하지 않는다(대표 확정).');
  }

  // ───────── 15 손님 경험 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '손님 쪽은 화면 네 장이면 끝납니다. 그래서 매장이 올리면 팔립니다.', { size: 26 });
    const steps = [
      ['FiMapPin', '발견', '홈 지도에서 내 동네 기준으로 이용권이 뜹니다. 매장 링크를 카톡에 붙이면 미리보기 카드가 뜨고, 네이버와 구글 검색에도 잡힙니다.'],
      ['FiCreditCard', '결제', '정가와 할인가를 함께 보고 토스로 결제합니다. 앱 설치나 가입 강요 구간이 없습니다.'],
      ['FiSmartphone', '사용', '매장에서 QR을 보여 주거나 매장 PIN을 입력합니다. 매장은 폰 한 대로 확인합니다.'],
      ['FiShield', '환불과 응대', '안 쓴 이용권은 100% 자동 환불됩니다. 재고, 배송, 반품이 없어 고객 응대가 매장이나 대행사로 흘러오지 않습니다.'],
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
    T(s, '유어딜은 초기 서비스입니다. 트래픽을 약속하는 대신 요율과 정산 방식을 숫자로 먼저 공개합니다. 비어 있는 동네와 업종은 먼저 들어온 대행사의 매장이 가져갑니다.', { x: M, y: 5.95, w: W - 2 * M, h: 0.6, fontSize: 11, color: C.inkSoft, lineSpacingMultiple: 1.4 });
    s.addNotes('소비자 경로: 홈 지도(/), 상세 토스 결제, /my-vouchers 지갑, 매장 QR/PIN 사용.');
  }

  // ───────── 16 FAQ + 연락처 ─────────
  {
    const s = pres.addSlide();
    chrome(s, { dark: true });
    title(s, '남은 질문과, 지금 하실 일.', { dark: true });
    const faqs = [
      ['수수료가 두 번 나가나요?', '아닙니다. 유어딜이 떼는 것은 중개 매장 5% 하나뿐입니다. 대행사 보수는 매장과 대행사의 계약이고 유어딜 정산서에 나오지 않습니다.'],
      ['사장님이 직접 계정을 만들면 우리 관계는요?', '계정 양도가 아니라 권한 변경입니다. 상품, 주문, 리뷰, 정산 이력은 매장에 그대로 남고, 대행사는 운영자로 계속 일할 수 있습니다.'],
      ['대행사가 유어딜에 내는 돈이 있나요?', '없습니다. 가입비, 월 이용료, 매장당 등록비 전부 없습니다. 매장에서 팔린 만큼만 유어딜 수수료가 나갑니다.'],
      ['매장 정산은 언제 되나요?', '손님이 매장에서 실제로 사용한 이용권만 주간 정산으로 매장 계좌에 들어옵니다. 안 쓴 이용권은 손님에게 자동 환불됩니다.'],
      ['쇼핑 공구 벤더인데 바로 할 수 있나요?', '구조가 같습니다. 브랜드 대신 매장, 상품 대신 이용권, 택배 대신 QR입니다. 재고와 반품이 빠지고 정산이 자동으로 바뀝니다.'],
    ];
    const cw = (W - 2 * M - 0.3) / 2;
    faqs.forEach(([q, a], i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = M + col * (cw + 0.3), y = 2.0 + row * 1.35;
      T(s, q, { x, y, w: cw, h: 0.3, fontSize: 13, bold: true, color: C.darkText });
      T(s, a, { x, y: y + 0.35, w: cw, h: 0.9, fontSize: 10.5, color: C.darkMuted, lineSpacingMultiple: 1.4, valign: 'top' });
    });
    const px = M + cw + 0.3, py = 4.55, pw = cw, ph = 2.3;
    card(s, px, py, pw, ph, { fill: C.darkSurface });
    T(s, '지금 하실 일', { x: px + 0.3, y: py + 0.2, w: 3, h: 0.3, fontSize: 11, bold: true, color: C.brand, charSpacing: 1 });
    T(s, '후보 매장 5곳의 이름과 동네만 보내 주세요. 하루 안에 채널과 요율을 확인해 드리고, 첫 방문 일정을 잡습니다.', { x: px + 0.3, y: py + 0.5, w: pw - 0.6, h: 0.7, fontSize: 11.5, color: C.darkText, lineSpacingMultiple: 1.4, valign: 'top' });
    const contact = [['FiMailW', 'jiwon@ur-team.com'], ['FiGlobeW', 'urdeal.kr'], ['FiFileTextW', '리스터코퍼레이션, 사업자등록번호 479-09-02930']];
    contact.forEach(([i, t], k) => {
      s.addImage({ data: ic[i], x: px + 0.3, y: py + 1.3 + k * 0.32, w: 0.2, h: 0.2 });
      T(s, t, { x: px + 0.65, y: py + 1.25 + k * 0.32, w: pw - 0.9, h: 0.3, fontSize: k === 2 ? 10 : 12.5, bold: k < 2, color: C.darkText, valign: 'middle' });
    });
    s.addNotes('FAQ 출처: 사업계획서 C-3, 셀러 가이드 "중개사 몫", auto-settlement.ts.');
  }

  await pres.writeFile({ fileName: OUT });
  console.log('wrote', OUT, 'slides', page);
})().catch((e) => { console.error(e); process.exit(1); });
