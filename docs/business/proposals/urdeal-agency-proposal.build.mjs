// 유어딜 대행사 제휴 제안서 (.pptx) 생성기 — v3 (2026-09-07): Pretendard · 라이브 모바일 캡처 · 매장 모집 실행서
// 사실 출처: docs/business/urdeal-business-plan.md C-2 · docs/design/store-operator-model.md §7 ·
//            seller-stores.routes.ts(국세청 진위확인·카카오맵·채널) · auto-settlement.ts(사용분 주간 정산) ·
//            라이브 실측 2026-09-07 (활성 이용권 338 · 인플루언서 DB 198,704)
// 재생성: npm i pptxgenjs sharp react react-dom react-icons
//         SHOTS_DIR=<캡처 폴더> node urdeal-agency-proposal.build.mjs out.pptx
//         캡처: NODE_USE_ENV_PROXY=1 node scripts/capture-proposal-shots.mjs <캡처 폴더>  (home/detail/use/shop.jpg)
import pptxgen from 'pptxgenjs';
import sharp from 'sharp';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Fi from 'react-icons/fi';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPhone } from './phone-frame.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] || path.join(__dirname, 'urdeal-agency-proposal.pptx');
const SHOTS_DIR = process.env.SHOTS_DIR || path.join(__dirname, 'shots');
const PHONE_STYLE = process.env.PHONE_STYLE || 'minimal'; // phone-frame.mjs STYLES: minimal | island | card | light

// ── 브랜드 토큰 (src/index.css SSOT) ──
const C = {
  brand: '1C69EF', brandSoft: 'E4EDFD', bg: 'F8F7FC', surface: 'FFFFFF', ink: '16181C', ink2: '3A3D44', inkSoft: '6E6B68',
  rule: 'E6E2DE', dark: '11141C', darkSurface: '1D1F29', darkText: 'F8F7FC', darkMuted: 'A9A6A2', gray: '8A8580',
  tint: 'EEF3FE', chart2: '8FB4F5', chart3: 'C9C5C1',
};
const FONT = 'Pretendard';
const W = 13.333, H = 7.5, M = 0.75;

async function icon(name, color, px = 256) {
  const Comp = Fi[name];
  if (!Comp) throw new Error('icon ' + name);
  const svg = renderToStaticMarkup(React.createElement(Comp, { color: '#' + color, size: px, strokeWidth: 1.7 }));
  return 'image/png;base64,' + (await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64');
}
async function wordmark(fill) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 344 100" width="1376" height="400"><text x="0" y="78" font-family="Poppins, Pretendard, Arial, sans-serif" font-weight="800" font-size="96" letter-spacing="-3.4" fill="#${fill}">urdeal</text><circle cx="322" cy="70" r="8.2" fill="#${C.brand}"/></svg>`;
  return 'image/png;base64,' + (await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64');
}
// 라이브 캡처(390×844 비율)를 폰 프레임(둥근 화면 + 베젤 + 그림자)이 합성된 PNG 로 미리 굽는다.
// pptxgenjs 는 이미지를 둥글게 못 자르므로(rounding:true 는 원형 크롭) 프레임을 여기서 만든다. 없으면 null.
async function shot(name) {
  for (const ext of ['jpg', 'png']) {
    const p = path.join(SHOTS_DIR, `${name}.${ext}`);
    if (fs.existsSync(p)) {
      const r = await renderPhone(p, PHONE_STYLE);
      // 슬라이드에서 최대 6in 높이라 캔버스 1,200px 이면 충분하다(2× 원본은 파일을 12MB 로 불린다).
      const k = 1200 / r.height;
      const buf = await sharp(r.buffer).resize({ height: 1200 }).png({ compressionLevel: 9, palette: false }).toBuffer();
      return { data: 'image/png;base64,' + buf.toString('base64'), width: r.width * k, height: 1200, pad: r.pad * k, frameW: r.frameW * k, frameH: r.frameH * k };
    }
  }
  return null;
}

(async () => {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.author = '리스터코퍼레이션';
  pres.title = '유어딜 대행사 제휴 제안서';

  const wmDark = await wordmark(C.ink);
  const wmLight = await wordmark(C.darkText);
  const ic = {};
  const names = ['FiPercent', 'FiLayers', 'FiUsers', 'FiCreditCard', 'FiMapPin', 'FiUserCheck', 'FiSearch', 'FiEye',
    'FiBarChart2', 'FiRefreshCcw', 'FiLock', 'FiFileText', 'FiCheckCircle', 'FiSmartphone', 'FiShield', 'FiClock', 'FiCamera', 'FiTag',
    'FiTrendingUp', 'FiXCircle', 'FiCheck', 'FiArrowRight'];
  for (const n of names) ic[n] = await icon(n, C.brand);
  ic.FiArrowGray = await icon('FiArrowRight', C.gray);
  ic.FiMailW = await icon('FiMail', C.darkText);
  ic.FiGlobeW = await icon('FiGlobe', C.darkText);
  ic.FiFileTextW = await icon('FiFileText', C.darkText);
  const shots = {};
  for (const k of ['home', 'detail', 'use', 'shop', 'seller-stores', 'seller-influencers', 'seller-operating', 'seller-operators']) shots[k] = await shot(k);
  const missing = Object.entries(shots).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) console.warn('캡처 없음 (빈 슬롯으로 그림):', missing.join(', '));

  let page = 0;
  const T = (slide, text, o) => slide.addText(text, Object.assign({ fontFace: FONT, isTextBox: true, margin: 0 }, o));

  function chrome(slide, { dark = false } = {}) {
    page += 1;
    slide.background = { color: dark ? C.dark : C.bg };
    slide.addImage({ data: dark ? wmLight : wmDark, x: M, y: 0.5, w: 0.96, h: 0.28 });
    T(slide, '유어딜 대행사 제휴 제안', { x: M, y: H - 0.62, w: 6, h: 0.25, fontSize: 9, color: dark ? C.darkMuted : C.gray, charSpacing: 0.5 });
    T(slide, String(page).padStart(2, '0'), { x: W - M - 0.8, y: H - 0.62, w: 0.8, h: 0.25, fontSize: 9.5, bold: true, color: dark ? C.darkText : C.ink, align: 'right' });
  }
  function title(slide, text, { dark = false, y = 1.15, size = 27, w = W - 2 * M } = {}) {
    T(slide, text, { x: M, y, w, h: 0.9, fontSize: size, bold: true, color: dark ? C.darkText : C.ink, valign: 'top', lineSpacingMultiple: 1.15, charSpacing: -0.6 });
  }
  function lead(slide, text, { x = M, y = 2.05, w = W - 2 * M, dark = false, size = 12.5, h = 0.8 } = {}) {
    T(slide, text, { x, y, w, h, fontSize: size, color: dark ? C.darkMuted : C.inkSoft, lineSpacingMultiple: 1.5, valign: 'top' });
  }
  function card(slide, x, y, w, h, { fill } = {}) {
    const f = fill || C.surface;
    const darkFill = f === C.ink || f === C.darkSurface || f === C.dark;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w, h, rectRadius: 0.14, fill: { color: f }, line: { color: f, width: 0 },
      shadow: darkFill || f === C.tint ? undefined : { type: 'outer', color: '1A2C42', blur: 8, offset: 2, angle: 90, opacity: 0.07 },
    });
  }
  function iconCircle(slide, name, x, y, d = 0.5, { fill = C.brandSoft } = {}) {
    slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill, width: 0 } });
    slide.addImage({ data: ic[name], x: x + d * 0.26, y: y + d * 0.26, w: d * 0.48, h: d * 0.48 });
  }
  function numBadge(slide, n, x, y, d = 0.4, { filled = true } = {}) {
    slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: filled ? C.brand : C.surface }, line: { color: C.brand, width: 1.25 } });
    T(slide, String(n), { x, y, w: d, h: d, fontSize: 11.5, bold: true, color: filled ? 'FFFFFF' : C.brand, align: 'center', valign: 'middle' });
  }
  function hr(slide, x, y, w, { dark = false } = {}) {
    slide.addShape(pres.shapes.LINE, { x, y, w, h: 0, line: { color: dark ? C.ink2 : C.rule, width: 0.75 } });
  }
  function label(slide, text, x, y, w, { dark = false, color } = {}) {
    T(slide, text, { x, y, w, h: 0.26, fontSize: 10, bold: true, color: color || (dark ? C.darkMuted : C.gray), charSpacing: 1.2 });
  }
  /** 폰 프레임. (x, y) 는 보이는 프레임의 좌상단, h 는 프레임 높이. 그림자는 PNG 에 구워져 있어 프레임 밖으로 비어져 나온다.
   *  캡처가 없으면 빈 슬롯. 반환값은 보이는 프레임 폭. */
  function phone(slide, key, x, y, h, { caption, dark = false } = {}) {
    const s = shots[key];
    const frameRatio = s ? s.frameW / s.frameH : (780 + 44) / (1688 + 44);
    const w = h * frameRatio;
    if (s) {
      const scale = h / s.frameH; // inch per px
      slide.addImage({ data: s.data, x: x - s.pad * scale, y: y - s.pad * scale, w: s.width * scale, h: s.height * scale });
    } else {
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.3, fill: { color: C.darkSurface }, line: { color: C.darkSurface, width: 0 } });
      T(slide, '라이브 화면\n캡처 자리', { x, y: y + h / 2 - 0.3, w, h: 0.6, fontSize: 10, color: C.darkMuted, align: 'center', valign: 'middle' });
    }
    if (caption) T(slide, caption, { x: x - 0.4, y: y + h + 0.16, w: w + 0.8, h: 0.3, fontSize: 10.5, color: dark ? C.darkMuted : C.inkSoft, align: 'center' });
    return w;
  }
  function kv(slide, rows, x, y, w, { rowH = 0.4 } = {}) {
    rows.forEach(([k, v, kind, rule]) => {
      const strong = kind > 0;
      T(slide, k, { x, y, w: w * 0.64, h: rowH - 0.08, fontSize: 11.5, color: strong ? C.ink : C.inkSoft, bold: strong, valign: 'middle' });
      T(slide, v, { x: x + w * 0.55, y, w: w * 0.45, h: rowH - 0.08, fontSize: 12, bold: true, color: kind === 2 ? C.brand : C.ink, align: 'right', valign: 'middle' });
      if (rule) hr(slide, x, y + rowH - 0.03, w);
      y += rowH;
    });
    return y;
  }

  // ───────── 01 표지 ─────────
  {
    const s = pres.addSlide();
    chrome(s, { dark: true });
    label(s, '대행사 제휴 제안, 2026년 9월', M, 1.7, 6, { color: C.brand });
    s.addText([
      { text: '동네 매장을 데려오세요.', options: { breakLine: true } },
      { text: '매장 한 곳당 월 12만원이', options: { color: C.brand, breakLine: true } },
      { text: '대행사에게 남습니다.', options: { color: C.brand } },
    ], { x: M, y: 2.15, w: 7.2, h: 2.7, fontFace: FONT, fontSize: 40, bold: true, color: C.darkText, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.14, charSpacing: -1 });
    T(s, '이용권 평균 2만원, 매장당 월 60건, 대행사 보수 매출의 10%를 가정한 값입니다. 유어딜은 매장에서 5%만 떼고, 인플루언서 소개비와 대행사 보수는 매장 몫 95% 안에서 매장이 정합니다.', {
      x: M, y: 4.85, w: 6.6, h: 1.0, fontSize: 12.5, color: C.darkMuted, lineSpacingMultiple: 1.5, valign: 'top',
    });
    const rows = [['대행사', '매장을 찾아 올리고, 이용권을 운영한다'], ['매장', '팔린 금액의 5% + 소개비 + 대행사 보수'], ['유어딜', '결제, 발급, QR, 정산, 세금, 손님 유입']];
    let y = 5.85;
    rows.forEach(([k, v]) => {
      T(s, k, { x: M, y, w: 0.9, h: 0.26, fontSize: 10.5, bold: true, color: C.darkText });
      T(s, v, { x: M + 0.95, y, w: 5.8, h: 0.26, fontSize: 10.5, color: C.darkMuted });
      y += 0.28;
    });
    phone(s, 'home', 9.3, 0.95, 5.95, { dark: true });
    s.addNotes('표지. 첫 문장에 숫자. 가정은 5장에 공개. 오른쪽은 urdeal.kr 홈(모바일) 라이브 캡처.');
  }

  // ───────── 02 한 장 요약 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '제안을 한 장으로 줄이면 이렇습니다.');
    const cells = [
      ['FiMapPin', '무엇을 파나', '동네 식당, 카페, 미용, 숙박, 액티비티의 이용권. 손님이 온라인에서 할인가로 미리 사고 매장에 와서 QR로 씁니다. 배송도 재고도 없습니다.'],
      ['FiUsers', '대행사는 무엇을 하나', '매장을 찾아 유어딜에 올리고(10분), 이용권을 만들고(3분), 인플루언서를 붙이고, 매장에 성과를 보고합니다. 돈을 걷거나 나누는 일은 없습니다.'],
      ['FiPercent', '누가 얼마를 내나', '매장이 팔린 금액의 5%를 유어딜에 냅니다(직접 입점은 10%). 나머지 95% 안에서 매장이 인플루언서 소개비(딜마다 정한 %)와 대행사 보수(계약)를 냅니다. 대행사가 유어딜에 내는 돈은 0입니다.'],
      ['FiCreditCard', '유어딜은 무엇을 하나', '결제(토스), 이용권 발급, QR 확인 앱, 주간 정산, 원천징수, 환불 응대, 홈 지도 노출과 검색 유입. 인플루언서 DB와 제안 발송까지.'],
    ];
    const cw = (W - 2 * M - 0.4) / 2;
    cells.forEach(([i, h, p], k) => {
      const col = k % 2, row = Math.floor(k / 2);
      const x = M + col * (cw + 0.4), y = 2.2 + row * 2.2;
      iconCircle(s, i, x, y, 0.46);
      T(s, h, { x: x + 0.65, y: y + 0.06, w: cw - 0.7, h: 0.35, fontSize: 16, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x, y: y + 0.65, w: cw - 0.3, h: 1.2, fontSize: 11.5, color: C.inkSoft, lineSpacingMultiple: 1.5, valign: 'top' });
      if (row === 0) hr(s, x, y + 1.95, cw - 0.3);
    });
    T(s, '숫자 근거와 절차는 다음 장부터 순서대로. 마지막 장에 8주 파일럿 조건이 있습니다.', { x: M, y: 6.55, w: W - 2 * M, h: 0.3, fontSize: 10.5, color: C.gray });
    s.addNotes('요약. 사업계획서 C-2 + store-operator-model §7.');
  }

  // ───────── 03 이용권 (라이브 화면) ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '이용권은 이렇게 생겼습니다.\n매장 메뉴 하나가 곧 상품입니다.', { w: 6.6 });
    lead(s, '손님이 보는 실제 화면입니다. 정가와 할인가가 함께 보이고, 토스로 결제하면 이용권이 바로 발급됩니다. 유효기간, 할인율, 마감 수량은 전부 매장이 정하고, 안 쓴 이용권은 100% 자동 환불됩니다.', { w: 6.3, y: 2.35, h: 1.1 });
    const facts = [['338', '지금 판매 중인 이용권'], ['4', '카테고리 (식사, 미용, 숙소, 액티비티)'], ['0', '재고, 배송, 반품']];
    let y = 3.75;
    facts.forEach(([n, l], i) => {
      T(s, n, { x: M, y, w: 1.5, h: 0.7, fontSize: 36, bold: true, color: i === 2 ? C.brand : C.ink, charSpacing: -1 });
      T(s, l, { x: M + 1.45, y: y + 0.22, w: 4.5, h: 0.4, fontSize: 12, color: C.inkSoft });
      hr(s, M, y + 0.82, 5.8);
      y += 0.92;
    });
    T(s, 'urdeal.kr 2026년 9월 7일 기준. 화면은 같은 날 모바일에서 그대로 캡처했습니다.', { x: M, y: 6.55, w: 6, h: 0.3, fontSize: 9.5, color: C.gray });
    const pw3 = phone(s, 'detail', 7.6, 1.1, 4.95, { caption: '이용권 상세' });
    phone(s, 'use', 7.6 + pw3 + 0.3, 1.1, 4.95, { caption: '사용 방법과 환불 안내' });
    s.addNotes('338 은 2026-09-07 공개 API 실측(활성 이용권). 캡처는 scripts/capture-proposal-shots.mjs (detail/use).');
  }

  // ───────── 04 돈의 흐름 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '손님이 낸 100원은 이렇게 갈립니다. 유어딜은 5에서 끝납니다.');
    const flow = [
      ['손님 결제', '100원', '토스로 할인가를 냅니다. 이용권이 즉시 발급됩니다.', C.surface],
      ['유어딜', '5원', '결제, 발급, QR 확인, 정산, 세금, 손님 유입의 인프라 비용입니다.', C.ink],
      ['매장 몫', '95원', '손님이 매장에서 실제로 쓴 이용권만, 매주 매장 계좌로 정산됩니다.', C.tint],
    ];
    const bw = 3.6, gap = 0.5;
    flow.forEach(([h, n, p, fill], i) => {
      const x = M + i * (bw + gap);
      const dk = fill === C.ink;
      card(s, x, 2.15, bw, 1.95, { fill });
      label(s, h, x + 0.3, 2.35, bw - 0.6, { dark: dk });
      T(s, n, { x: x + 0.3, y: 2.62, w: bw - 0.6, h: 0.65, fontSize: 32, bold: true, color: i === 1 ? C.brand : C.ink, charSpacing: -1 });
      T(s, p, { x: x + 0.3, y: 3.3, w: bw - 0.6, h: 0.75, fontSize: 10.5, color: dk ? C.darkMuted : C.inkSoft, lineSpacingMultiple: 1.4, valign: 'top' });
      if (i < 2) s.addImage({ data: ic.FiArrowGray, x: x + bw + 0.13, y: 2.98, w: 0.24, h: 0.24 });
    });
    label(s, '매장 몫 95원 안에서 매장이 정하는 두 가지, 그리고 남는 것', M, 4.5, 8);
    const sub = [
      ['FiUsers', '인플루언서 소개비', '매장이 딜마다 제안하는 비율입니다. 매장 부담이고, 링크 귀속과 지급과 원천징수는 유어딜이 자동 처리합니다. 대행사가 걷거나 나눌 일이 없습니다.'],
      ['FiFileText', '대행사 보수', '매장과 대행사의 계약입니다. 매출의 몇 %든, 월 정액이든 두 분이 정합니다. 유어딜 장부 밖이라 정산서에 한 줄도 나오지 않고, 유어딜이 중간에서 떼지도 않습니다.'],
      ['FiCheckCircle', '매장 순수취', '위 둘을 뺀 나머지입니다. 다음 장에서 매장 한 곳 기준으로 실제 숫자를 놓습니다.'],
    ];
    sub.forEach(([i, h, p], k) => {
      const x = M + k * (bw + gap);
      iconCircle(s, i, x, 4.9, 0.46);
      T(s, h, { x: x + 0.62, y: 4.95, w: bw - 0.62, h: 0.36, fontSize: 14, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x, y: 5.5, w: bw, h: 1.25, fontSize: 11, color: C.inkSoft, lineSpacingMultiple: 1.45, valign: 'top' });
    });
    s.addNotes('2026-09-04 대표 확정. 정산은 used 이용권만 주간(auto-settlement.ts).');
  }

  // ───────── 05 매장 1곳 단위 경제 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '매장 한 곳이 대행사에게 얼마가 되는가. 가정은 전부 공개합니다.', { size: 25 });
    card(s, M, 2.15, 5.7, 4.65);
    const x = M + 0.35, w = 5.0;
    label(s, '가정 (바꿔서 다시 계산하셔도 됩니다)', x, 2.35, w);
    const yEnd = kv(s, [
      ['이용권 평균 판매가', '20,000원', 0], ['매장당 월 판매', '60건', 0], ['매장 월 매출(GMV)', '1,200,000원', 0, true],
      ['유어딜 5%', '60,000원', 0], ['매장 몫 95%', '1,140,000원', 0, true],
      ['   인플루언서 소개비 (매장 제안 10% 가정)', '120,000원', 1], ['   대행사 보수 (매출 10% 계약 시)', '120,000원', 2], ['   매장 순수취', '900,000원', 1],
    ], x, 2.7, w, { rowH: 0.41 });
    T(s, '매장 몫 95% 안에서 세 갈래로 갈립니다. 매장 10곳이면 대행사 월 120만원, 30곳이면 360만원입니다.', { x, y: yEnd + 0.12, w, h: 0.6, fontSize: 11, color: C.ink, lineSpacingMultiple: 1.4, valign: 'top' });
    s.addChart(pres.charts.BAR, [
      { name: '보수 10%', labels: ['5곳', '10곳', '20곳', '30곳'], values: [60, 120, 240, 360] },
      { name: '보수 15%', labels: ['5곳', '10곳', '20곳', '30곳'], values: [90, 180, 360, 540] },
    ], {
      x: 6.75, y: 2.15, w: W - M - 6.75, h: 4.65, barDir: 'col', barGrouping: 'clustered', barGapWidthPct: 70,
      chartColors: [C.brand, C.chart2],
      showValue: true, dataLabelPosition: 'outEnd', dataLabelColor: C.ink, dataLabelFontSize: 10, dataLabelFontFace: FONT, dataLabelFormatCode: '#,##0"만"',
      showLegend: true, legendPos: 'b', legendFontFace: FONT, legendFontSize: 10.5, legendColor: C.inkSoft,
      catAxisLabelColor: C.ink, catAxisLabelFontFace: FONT, catAxisLabelFontSize: 11,
      valAxisLabelColor: C.gray, valAxisLabelFontSize: 9, valAxisLabelFontFace: FONT, valAxisMinVal: 0, valAxisMaxVal: 600, valAxisMajorUnit: 150, valAxisLabelFormatCode: '#,##0"만원"',
      valGridLine: { color: 'E6E2DE', size: 0.5 }, catGridLine: { style: 'none' },
      showTitle: true, title: '매장 수별 대행사 월 수입 (매장당 월 매출 120만원 가정)', titleFontFace: FONT, titleFontSize: 11, titleColor: C.inkSoft,
      plotArea: { fill: { color: C.bg } }, chartArea: { fill: { color: C.bg } },
    });
    s.addNotes('전부 가정. 보수율은 매장과 대행사의 계약이며 유어딜이 정하지 않는다.');
  }

  // ───────── 06 사장님 셈법 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '사장님이 "네" 하는 이유도 숫자입니다. 광고비 선지출이 없습니다.', { size: 25 });
    card(s, M, 2.15, 5.9, 4.65);
    const x = M + 0.35, w = 5.2;
    label(s, '이용권 한 장이 팔렸을 때 (파스타 2인 세트 예시)', x, 2.35, w);
    const yEnd = kv(s, [
      ['정가', '32,000원', 0], ['이용권 판매가 (22% 할인)', '25,000원', 0, true],
      ['유어딜 5%', '1,250원', 0], ['인플루언서 소개비 10% (매장 제안 예시)', '2,500원', 0], ['대행사 보수 10% (계약 예시)', '2,500원', 0, true],
      ['매장에 들어오는 돈', '18,750원', 2], ['재료비 35% 가정', '11,200원', 0, true], ['매장 이익', '7,550원', 2],
    ], x, 2.7, w, { rowH: 0.41 });
    T(s, '광고 없이 온 새 손님 한 명당 7,550원이 남습니다. 안 팔리면 0원이고, 세 항목 전부 팔린 뒤에만 나갑니다.', { x, y: yEnd + 0.12, w, h: 0.6, fontSize: 11, color: C.ink, lineSpacingMultiple: 1.4, valign: 'top' });
    const pts = [
      ['FiXCircle', '선지출 광고비 0', '배너, 검색 광고, 체험단처럼 미리 내는 돈이 없습니다. 팔린 만큼만 나갑니다.'],
      ['FiTag', '할인율과 유효기간은 사장님이', '남는 메뉴만 올리고, 할인율도 마감 수량도 직접 정합니다. 손해 보는 구조를 만들 수 없습니다.'],
      ['FiClock', '정산은 손님이 쓴 뒤 매주', '손님이 매장에서 QR을 찍은 이용권만 주간 정산으로 매장 계좌에 들어옵니다. 안 쓴 이용권은 손님에게 자동 환불됩니다.'],
      ['FiSmartphone', '사장님이 하는 일은 하나', '손님 QR을 폰으로 찍거나 확인 PIN을 눌러 주는 것. 등록과 운영은 대행사가 합니다.'],
    ];
    let py = 2.2;
    pts.forEach(([i, h, p]) => {
      iconCircle(s, i, 7.05, py, 0.44);
      T(s, h, { x: 7.7, y: py, w: W - M - 7.7, h: 0.32, fontSize: 13.5, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: 7.7, y: py + 0.36, w: W - M - 7.7, h: 0.75, fontSize: 11, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
      py += 1.18;
    });
    s.addNotes('재료비 35% 는 가정. 정산 규칙은 auto-settlement.ts. 사용 처리는 매장 QR 스캔 또는 확인 PIN.');
  }

  // ───────── 07 어떤 매장을 데려올지 (+ 유어샵 화면) ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '이 여섯 가지가 되면 데려오세요.\n대부분 그 자리에서 진행됩니다.', { w: 7.5, size: 26 });
    const checks = [
      ['사업자등록이 있다', '사업자번호, 대표자명, 개업일로 국세청 진위확인을 합니다. 없으면 올릴 수 없습니다.'],
      ['카카오맵에 매장이 있다', '등록할 때 카카오맵 장소를 연결합니다. 없으면 사장님이 먼저 등록해야 합니다(무료, 하루 이틀).'],
      ['손님이 방문해서 쓰는 업종이다', '식당, 카페, 미용, 네일, 숙박, 키즈카페, 스튜디오, 클래스. 택배 상품만 파는 곳은 대상이 아닙니다.'],
      ['15~30% 할인해도 남는 대표 메뉴가 있다', '이용권은 할인가로 팝니다. 마진이 얇은 메뉴만 있는 곳은 사장님이 곧 후회합니다.'],
      ['사진이 3장 이상 있다', '이용권 카드의 절반은 사진입니다. 없으면 방문할 때 폰으로 찍어 오세요.'],
      ['사장님이나 직원이 폰으로 QR을 찍을 수 있다', '사용 처리는 매장 폰 한 대로 끝납니다. POS 연동이 필요 없습니다.'],
    ];
    const cw = (9.0 - 0.4) / 2;
    checks.forEach(([h, p], k) => {
      const col = k % 2, row = Math.floor(k / 2);
      const x = M + col * (cw + 0.4), y = 2.4 + row * 1.35;
      s.addImage({ data: ic.FiCheck, x, y: y + 0.03, w: 0.26, h: 0.26 });
      T(s, h, { x: x + 0.38, y, w: cw - 0.4, h: 0.32, fontSize: 13, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: x + 0.38, y: y + 0.36, w: cw - 0.45, h: 0.85, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
    });
    card(s, M, 6.35, 9.0, 0.55, { fill: C.tint });
    T(s, '먼저 갈 곳: 배달앱이나 예약앱에 광고비를 쓰고 있는 매장. "그 돈을 팔린 뒤에만 내는 걸로 바꾸자"가 통합니다.', { x: M + 0.25, y: 6.35, w: 8.5, h: 0.55, fontSize: 10.5, color: C.ink, valign: 'middle' });
    phone(s, 'shop', 10.2, 1.1, 5.0, { caption: '올라간 매장 페이지 (유어샵)' });
    s.addNotes('등록 필수 필드는 seller-stores.routes.ts. 오른쪽은 /u/jiwon1228 라이브 캡처(대표 계정).');
  }

  // ───────── 08 매장 등록 10분 (+ 매장 관리 화면) ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '사장님 앞에서 10분.\n서명도 서류도 없이 대행사 폰으로 끝납니다.', { w: 8.8, size: 26 });
    const steps = [
      ['FiSearch', '카카오맵에서 매장 찾기', '/seller/stores 에서 매장 이름을 검색해 장소를 연결합니다. 주소와 좌표가 자동으로 들어옵니다.', '1분'],
      ['FiShield', '국세청 진위확인', '사업자번호, 대표자명, 개업일을 넣으면 국세청 조회로 즉시 확인됩니다. 사업자등록증 사진만 보면 됩니다.', '2분'],
      ['FiLayers', '채널 "중개" 선택', '등록 시 채널을 중개로 고르면 유어딜 수수료가 5%로 잡힙니다. 매장 확인 PIN도 여기서 정합니다.', '1분'],
      ['FiCamera', '이용권 만들기', '사진, 정가, 판매가, 유효기간, 마감 수량. 대표 메뉴 두세 개면 충분합니다. 사진은 그 자리에서 찍어도 됩니다.', '3분씩'],
      ['FiSmartphone', '사장님께 사용법', '손님이 QR을 보여 주면 매장 폰으로 찍거나, 손님 화면에 매장 PIN을 눌러 주면 끝. 이것만 설명하면 됩니다.', '3분'],
    ];
    let y = 2.35;
    steps.forEach(([i, h, p, t], k) => {
      T(s, t, { x: M, y: y + 0.03, w: 0.9, h: 0.36, fontSize: 17, bold: true, color: C.brand, charSpacing: -0.6 });
      iconCircle(s, i, M + 0.95, y + 0.02, 0.4);
      T(s, h, { x: M + 1.5, y: y + 0.03, w: 6.4, h: 0.3, fontSize: 13, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: M + 1.5, y: y + 0.36, w: 6.7, h: 0.5, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.36, valign: 'top' });
      if (k < 4) hr(s, M, y + 0.84, 8.4);
      y += 0.88;
    });
    phone(s, 'seller-stores', 10.0, 1.15, 5.15, { caption: '매장 관리 화면 (예시 데이터)' });
    s.addNotes('시간은 현장 추정. 필드는 seller-stores.routes.ts 실재. 오른쪽은 /seller/stores 실제 UI 를 예시 데이터로 렌더한 캡처(프로덕션 무접촉).');
  }

  // ───────── 09 사장님 대본 (+ 상세 화면) ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '사장님께 하는 말 네 마디와, 거절 다섯 가지의 답.');
    card(s, M, 2.15, 4.5, 4.7, { fill: C.ink });
    label(s, '5분 대본', M + 0.3, 2.35, 3, { color: C.brand });
    const lines = [
      ['열기', '"사장님, 배달앱 말고 손님이 가게에 직접 오게 하는 건데요. 미리 내는 돈은 없고 팔린 만큼만 5% 나갑니다."'],
      ['보여주기', '"이 메뉴를 이용권으로 올리면 이렇게 보입니다." (오른쪽 화면을 폰으로 보여 준다)'],
      ['정하기', '"어떤 메뉴를 몇 % 할인해서 올릴까요? 유효기간은요?" 사장님이 정하게 한다.'],
      ['끝내기', '"사업자등록증만 보여 주시면 지금 10분 안에 올라갑니다. 손님 오면 QR만 찍어 주세요."'],
    ];
    let y = 2.72;
    lines.forEach(([k, v]) => {
      T(s, k, { x: M + 0.3, y, w: 0.85, h: 0.3, fontSize: 10.5, bold: true, color: C.darkMuted });
      T(s, v, { x: M + 1.15, y, w: 3.05, h: 0.95, fontSize: 10.5, color: C.darkText, lineSpacingMultiple: 1.4, valign: 'top' });
      y += 1.0;
    });
    phone(s, 'detail', 5.6, 2.15, 4.7);
    const obj = [
      ['"할인하면 손해 아니에요?"', '남는 메뉴만, 사장님이 정한 할인율로만 올립니다. 안 팔리면 0원이고, 팔리면 새 손님입니다.'],
      ['"배달앱이랑 뭐가 달라요?"', '배달이 없고 손님이 가게에 옵니다. 수수료는 5%이고, 가게 페이지가 사장님 것으로 남습니다. 병행해도 됩니다.'],
      ['"정산은 언제 들어와요?"', '손님이 매장에서 쓴 이용권만 매주 정산돼 매장 계좌로 들어옵니다. 안 쓴 건 손님에게 자동 환불이라 분쟁이 없습니다.'],
      ['"귀찮은 일 있어요?"', '손님 QR을 폰으로 찍는 것 하나입니다. 등록, 이용권 관리, 인플루언서 섭외는 제가 합니다.'],
      ['"계약서 써야 해요?"', '유어딜과는 가입뿐입니다. 저와의 운영 위임은 권한 한 줄이고, 마음에 안 들면 오늘이라도 사장님이 빼시면 됩니다.'],
    ];
    const ox = 8.2, ow = W - M - ox;
    let oy = 2.15;
    obj.forEach(([q, a]) => {
      T(s, q, { x: ox, y: oy, w: ow, h: 0.28, fontSize: 12, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, a, { x: ox, y: oy + 0.3, w: ow, h: 0.6, fontSize: 10, color: C.inkSoft, lineSpacingMultiple: 1.38, valign: 'top' });
      oy += 0.95;
    });
    s.addNotes('대본의 사실 주장은 앞 장들과 동일 출처. 가운데는 이용권 상세 라이브 캡처.');
  }

  // ───────── 10 인플루언서 붙이기 (+ 소개 파트너 찾기 화면) ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '인플루언서 섭외, 계약, 정산이\n화면 안에서 끝납니다.', { w: 6.8 });
    const steps = [
      ['DB에서 고른다', '/seller/influencers 에서 플랫폼과 팔로워 구간으로 거릅니다. 매장 동네에서 활동하는 채널을 우선합니다.'],
      ['제안을 접수한다', '매장 소개와 조건을 적어 접수하면 유어딜이 발송합니다. 연락처는 대행사에게도 공개되지 않습니다.'],
      ['딜을 맺는다', '/seller/influencer-deals 에서 커미션 %를 제안합니다. 매장이 정한 값이고 매장 부담입니다. 콘텐츠 게시 확인 뒤 발효되는 조건부도 됩니다.'],
      ['귀속은 자동', '수락 즉시 전용 링크가 나오고 그 링크로 들어온 주문이 자동 연결됩니다. 쿠폰 코드를 확인할 일이 없습니다.'],
      ['지급도 자동', '환불 가능 기간 7일이 지나면 확정되고, 원천징수를 계산해 유어딜이 지급합니다. 대행사가 돈을 옮기지 않습니다.'],
    ];
    let y = 2.35;
    steps.forEach(([h, p], i) => {
      numBadge(s, i + 1, M, y + 0.02, 0.36);
      T(s, h, { x: M + 0.55, y: y + 0.03, w: 6.0, h: 0.3, fontSize: 13, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: M + 0.55, y: y + 0.36, w: 6.1, h: 0.5, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.36, valign: 'top' });
      if (i < 4) hr(s, M, y + 0.84, 6.65);
      y += 0.88;
    });
    const pw10 = phone(s, 'seller-influencers', 7.75, 1.15, 5.15, { caption: '소개 파트너 찾기 (예시 데이터)' });
    const sx = 7.75 + pw10 + 0.45, sw = W - M - sx;
    label(s, '인플루언서 DB (2026.9.7 실측)', sx, 1.3, sw);
    const nums = [['198,704', '전체'], ['45,725', '연락 가능'], ['170,307', '네이버 블로그'], ['17,986', '유튜브'], ['9,803', '네이버 카페']];
    let ny = 1.68;
    nums.forEach(([n, l], i) => {
      T(s, n, { x: sx, y: ny, w: sw, h: 0.45, fontSize: 21, bold: true, color: i < 2 ? C.brand : C.ink, charSpacing: -0.8 });
      T(s, l, { x: sx, y: ny + 0.44, w: sw, h: 0.25, fontSize: 10, color: C.inkSoft });
      if (i < 4) hr(s, sx, ny + 0.78, sw);
      ny += 0.9;
    });
    T(s, '인스타그램과 틱톡은 필터에 있으나 DB의 대부분은 네이버 블로그와 유튜브입니다.', { x: sx, y: 6.2, w: sw, h: 0.6, fontSize: 8.5, color: C.gray, lineSpacingMultiple: 1.35, valign: 'top' });
    s.addNotes('숫자는 /api/admin/ads/influencer-pool/stats 2026-09-07 실측. 가운데는 /seller/influencers 실제 UI 를 예시 데이터로 렌더한 캡처.');
  }

  // ───────── 11 주간 루틴 + 화면 3장 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '담당자 한 명의 일주일.\n쓰는 화면은 여섯 장뿐입니다.', { w: 5.4 });
    const days = [
      ['월·화', '매장 방문 4곳', '체크리스트로 고른 매장을 방문해 등록합니다. 하루 2곳이면 충분합니다.'],
      ['수', '이용권 손보기', '사진 교체, 마감 수량, 할인율 조정. 잘 팔리는 메뉴는 수량을 늘립니다.'],
      ['목', '인플루언서 제안 5건', 'DB에서 매장 동네 채널을 골라 제안을 접수하고, 들어온 신청에 답합니다.'],
      ['금', '매장에 보고', '운영 매장 요약의 매장별 매출과 주문을 사장님께 보내고, 계약대로 청구합니다.'],
    ];
    let y = 2.35;
    days.forEach(([d, h, p], i) => {
      T(s, d, { x: M, y: y + 0.03, w: 0.8, h: 0.3, fontSize: 11, bold: true, color: C.brand, charSpacing: 0.5 });
      T(s, h, { x: M + 0.85, y: y + 0.02, w: 4.4, h: 0.3, fontSize: 13, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: M + 0.85, y: y + 0.34, w: 4.5, h: 0.5, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.36, valign: 'top' });
      if (i < 3) hr(s, M, y + 0.82, 5.3);
      y += 0.86;
    });
    label(s, '쓰는 화면 여섯 장 (전부 셀러 대시보드, 별도 프로그램 없음)', M, 5.85, 5.4);
    const tools = [['매장 관리', '/seller/stores'], ['운영 권한', '/seller/operators'], ['인플루언서 탐색', '/seller/influencers'], ['소개 협업', '/seller/influencer-deals'], ['소개비 내역', '/seller/promo-spend'], ['운영 매장 요약', '/seller/operating']];
    tools.forEach(([h, r], k) => {
      const col = k % 2, row = Math.floor(k / 2);
      const x = M + col * 2.75, ty = 6.15 + row * 0.25;
      T(s, h, { x, y: ty, w: 1.15, h: 0.24, fontSize: 9.5, bold: true, color: C.ink });
      T(s, r, { x: x + 1.15, y: ty + 0.01, w: 1.6, h: 0.22, fontSize: 8.5, color: C.brand, fontFace: 'Courier New' });
    });
    const ph = 4.05;
    const pw11 = ph * ((780 + 44) / (1688 + 44));
    const gap = 0.22, x0 = W - M - (3 * pw11 + 2 * gap);
    [['seller-stores', '매장 관리'], ['seller-operating', '운영 매장 요약'], ['seller-operators', '운영자 관리']].forEach(([k, cap], i) => {
      phone(s, k, x0 + i * (pw11 + gap), 2.0, ph, { caption: cap });
    });
    T(s, '예시 데이터로 렌더한 실제 화면', { x: x0, y: 6.55, w: 3 * pw11 + 2 * gap, h: 0.25, fontSize: 9, color: C.gray, align: 'center' });
    s.addNotes('라우트 6개는 2026-09-07 main 실재. 요일 배분은 권장 루틴. 오른쪽 3장은 실제 UI + 예시 데이터 캡처.');
  }

  // ───────── 12 사장님이 안심하는 이유 (+ 운영자 관리 화면) ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '사장님이 맡겨도 잃을 게 없어서,\n두 번째 방문이 쉬워집니다.', { w: 8.6, size: 25 });
    const items = [
      ['FiRefreshCcw', '회수는 언제든, 조건 없이', '사장님이 권한을 빼도 대행사가 올려 둔 이용권, 주문, 리뷰는 매장에 남습니다. 붙이는 것도 떼는 것도 권한 한 줄입니다.'],
      ['FiLock', '정산계좌와 사업자정보는 주인만', '운영자에게는 사업자번호와 대표자명이 가려 보이고, 계좌 변경과 사업자정보 수정과 탈퇴는 서버가 막습니다.'],
      ['FiEye', '소개비 지출은 항상 사장님이 봅니다', '운영을 맡겨도 소개비가 누구에게 얼마 나갔는지 사장님이 직접 봅니다. 투명성은 위임 여부와 무관합니다.'],
      ['FiBarChart2', '운영 성과는 부풀리지 않습니다', '운영 매장 요약은 매장 총액과 "운영 시작 이후" 구간을 나눠 보여 줍니다. 그 숫자를 청구 근거로 쓸 수 있습니다.'],
    ];
    const cw = (8.7 - 0.4) / 2;
    items.forEach(([i, h, p], k) => {
      const col = k % 2, row = Math.floor(k / 2);
      const x = M + col * (cw + 0.4), y = 2.4 + row * 1.7;
      iconCircle(s, i, x, y, 0.42);
      T(s, h, { x: x + 0.58, y: y + 0.05, w: cw - 0.6, h: 0.32, fontSize: 13, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x, y: y + 0.58, w: cw - 0.1, h: 0.95, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
      if (row === 0) hr(s, x, y + 1.5, cw - 0.1);
    });
    card(s, M, 5.85, 8.7, 0.95, { fill: C.tint });
    T(s, '"계좌랑 사업자 정보는 사장님만 만질 수 있고 저는 못 봅니다. 마음에 안 들면 오늘이라도 권한만 빼시면 되고, 올려 둔 건 다 사장님 것으로 남습니다."', { x: M + 0.3, y: 5.85, w: 8.1, h: 0.95, fontSize: 11.5, italic: true, color: C.ink, lineSpacingMultiple: 1.4, valign: 'middle' });
    phone(s, 'seller-operators', 10.05, 1.15, 5.15, { caption: '운영자 관리 (예시 데이터)' });
    s.addNotes('store-operator-model.md §7.7. 오른쪽은 /seller/operators 실제 UI 를 예시 데이터로 렌더한 캡처.');
  }

  // ───────── 13 유어딜이 대행사에게 해 주는 것 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '유어딜이 대행사에게 붙여 드리는 것 여섯 가지.');
    const items = [
      ['FiUserCheck', '첫 매장 세 곳은 같이 갑니다', '첫 등록 세 건은 유어딜 담당자가 현장이나 통화로 동행합니다. 한 번 같이 하면 그다음은 혼자 됩니다.'],
      ['FiFileText', '사장님용 한 장 안내', '수수료, 정산, QR 사용법이 적힌 매장용 안내 한 장을 드립니다. 대행사 이름을 넣어 드립니다.'],
      ['FiUsers', '인플루언서 DB와 발송 대행', '19만 명 DB 탐색과 제안 발송을 유어딜이 합니다. 연락처를 모으거나 DM을 돌릴 필요가 없습니다.'],
      ['FiCreditCard', '결제, 정산, 환불, 세금', '토스 결제, 주간 정산, 미사용 환불, 원천징수를 유어딜이 처리합니다. 손님 CS도 유어딜로 옵니다.'],
      ['FiMapPin', '손님 유입', '홈 지도에 동네 기준으로 노출되고, 매장 페이지는 카톡 미리보기 카드와 네이버, 구글 검색에 잡힙니다. 6개 언어를 지원합니다.'],
      ['FiTrendingUp', '주간 실적 공유', '파일럿 기간에는 매주 매장별 판매와 사용 숫자를 유어딜이 먼저 보내 드립니다. 매장 보고서에 그대로 쓰시면 됩니다.'],
    ];
    const cw = (W - 2 * M - 0.8) / 3;
    items.forEach(([i, h, p], k) => {
      const col = k % 3, row = Math.floor(k / 3);
      const x = M + col * (cw + 0.4), y = 2.25 + row * 2.25;
      iconCircle(s, i, x, y, 0.46);
      T(s, h, { x, y: y + 0.62, w: cw, h: 0.35, fontSize: 14, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x, y: y + 1.0, w: cw - 0.1, h: 1.1, fontSize: 11, color: C.inkSoft, lineSpacingMultiple: 1.45, valign: 'top' });
      if (row === 0) hr(s, x, y + 2.05, cw - 0.1);
    });
    s.addNotes('동행·안내장·주간 실적 공유는 파일럿 제안의 유어딜 측 약속. 나머지 셋은 현행 기능.');
  }

  // ───────── 14 8주 파일럿 제안 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '8주 파일럿 제안. 매장 10곳이면 구조가 맞는지 판정이 납니다.', { size: 25 });
    card(s, M, 2.15, 4.0, 4.65, { fill: C.ink });
    label(s, '8주 목표', M + 0.35, 2.35, 3, { color: C.brand });
    const goals = [['10곳', '등록 매장'], ['30개', '판매 중 이용권 (매장당 3개)'], ['20건', '인플루언서 제안 접수'], ['1회', '매장별 실적 보고와 청구']];
    let gy = 2.75;
    goals.forEach(([n, l]) => {
      T(s, n, { x: M + 0.35, y: gy, w: 1.5, h: 0.6, fontSize: 28, bold: true, color: C.darkText, charSpacing: -1 });
      T(s, l, { x: M + 1.75, y: gy + 0.13, w: 2.1, h: 0.4, fontSize: 11, color: C.darkMuted, valign: 'middle' });
      gy += 0.92;
    });
    T(s, '숫자는 제안입니다. 담당자 한 명, 주 2일 방문 기준입니다.', { x: M + 0.35, y: 6.4, w: 3.4, h: 0.3, fontSize: 9.5, color: C.darkMuted });
    const cx = M + 4.35, cw = (W - M - cx - 0.35) / 2;
    const cols = [
      ['대행사가 준비할 것', false, ['담당자 1명과 카카오 계정 (셀러 계정은 사업자 인증으로 10분)', '후보 매장 리스트 10~20곳 (7장 체크리스트 기준)', '매장과 맺을 보수 조건 초안 (매출 % 또는 월 정액. 유어딜은 관여하지 않습니다)', '첫 방문 일정 2주치']],
      ['유어딜이 준비할 것', true, ['첫 3매장 등록 동행 (현장 또는 통화)', '대행사 이름이 들어간 사장님용 안내 한 장', '인플루언서 제안 발송, 결제, 정산, 환불, CS 전부', '매주 매장별 판매와 사용 숫자 공유. 8주 뒤 함께 판정']],
    ];
    cols.forEach(([h, filled, items], ci) => {
      const x = cx + ci * (cw + 0.35);
      label(s, h, x, 2.3, cw);
      let py = 2.75;
      items.forEach((t, i) => {
        numBadge(s, i + 1, x, py, 0.36, { filled });
        T(s, t, { x: x + 0.5, y: py - 0.02, w: cw - 0.55, h: 0.85, fontSize: 11.5, color: C.ink, lineSpacingMultiple: 1.42, valign: 'top' });
        py += 0.98;
      });
    });
    s.addNotes('파일럿 조건은 이 문서의 제안. 유어딜은 대행사 보수 조건에 관여하지 않는다.');
  }

  // ───────── 15 손님 경험 (라이브 화면 4장) ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '손님 쪽은 화면 네 장이면 끝납니다. 그래서 매장이 올리면 팔립니다.', { size: 25 });
    const steps = [
      ['home', '발견', '홈에서 내 동네 기준으로 이용권이 뜹니다. 카톡 카드와 네이버, 구글 검색에도 잡힙니다.'],
      ['detail', '결제', '정가와 할인가를 함께 보고 토스로 결제합니다. 앱 설치나 가입 강요 구간이 없습니다.'],
      ['use', '사용', '매장에서 QR을 보여 주거나 매장 PIN을 입력합니다. 매장은 폰 한 대로 확인합니다.'],
      ['shop', '다시 찾기', '매장 페이지(유어샵)가 남습니다. 안 쓴 이용권은 100% 자동 환불이라 응대가 매장이나 대행사로 오지 않습니다.'],
    ];
    const ph = 3.4, pw = ph * ((780 + 44) / (1688 + 44));
    const colW = (W - 2 * M) / 4;
    steps.forEach(([key, h, p], k) => {
      const cx0 = M + k * colW;
      phone(s, key, cx0 + (colW - pw) / 2, 2.15, ph);
      T(s, h, { x: cx0, y: 5.7, w: colW - 0.2, h: 0.32, fontSize: 14, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: cx0, y: 6.02, w: colW - 0.3, h: 0.75, fontSize: 10, color: C.inkSoft, lineSpacingMultiple: 1.38, valign: 'top' });
    });
    s.addNotes('4장 전부 2026-09-07 urdeal.kr 모바일 라이브 캡처(home/detail/use/shop). 지갑 화면은 로그인이 필요해 제외.');
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
    const cw = (W - 2 * M - 0.5) / 2;
    faqs.forEach(([q, a], i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = M + col * (cw + 0.5), y = 2.15 + row * 1.35;
      T(s, q, { x, y, w: cw, h: 0.3, fontSize: 13, bold: true, color: C.darkText, charSpacing: -0.3 });
      T(s, a, { x, y: y + 0.34, w: cw, h: 0.9, fontSize: 10.5, color: C.darkMuted, lineSpacingMultiple: 1.42, valign: 'top' });
    });
    const px = M + cw + 0.5, py = 4.65, pw = cw, ph = 2.2;
    card(s, px, py, pw, ph, { fill: C.darkSurface });
    label(s, '지금 하실 일', px + 0.35, py + 0.22, 3, { color: C.brand });
    T(s, '후보 매장 5곳의 이름과 동네만 보내 주세요. 하루 안에 채널과 요율을 확인해 드리고, 첫 방문 일정을 잡습니다.', { x: px + 0.35, y: py + 0.52, w: pw - 0.7, h: 0.7, fontSize: 11.5, color: C.darkText, lineSpacingMultiple: 1.4, valign: 'top' });
    const contact = [['FiMailW', 'jiwon@ur-team.com'], ['FiGlobeW', 'urdeal.kr'], ['FiFileTextW', '리스터코퍼레이션, 사업자등록번호 479-09-02930']];
    contact.forEach(([i, t], k) => {
      s.addImage({ data: ic[i], x: px + 0.35, y: py + 1.3 + k * 0.3, w: 0.18, h: 0.18 });
      T(s, t, { x: px + 0.65, y: py + 1.24 + k * 0.3, w: pw - 1.0, h: 0.3, fontSize: k === 2 ? 10 : 12.5, bold: k < 2, color: C.darkText, valign: 'middle' });
    });
    s.addNotes('FAQ 출처: 사업계획서 C-3, 셀러 가이드, auto-settlement.ts.');
  }

  await pres.writeFile({ fileName: OUT });
  console.log('wrote', OUT, 'slides', page);
})().catch((e) => { console.error(e); process.exit(1); });
