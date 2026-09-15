// 유어딜 소개서 공통 모듈 (2026-09-13) — 사장님·인플루언서·대행사 세 덱이 같은 색·글꼴·헬퍼·공통 블록을 쓴다.
// 대행사 v4 생성기(urdeal-agency-proposal.build.mjs)의 헬퍼를 그대로 옮겼다. 한 곳을 고치면 셋이 같이 바뀐다.
// 사실 SSOT: docs/business/proposals/three-decks-plan-2026-09.md §0 · docs/design/actor-benefit-map.md
import pptxgen from 'pptxgenjs';
import sharp from 'sharp';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Fi from 'react-icons/fi';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPhone } from './phone-frame.mjs';

export const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 브랜드 토큰 (src/index.css SSOT · 코레일톡 디자인 시스템 2026-09-02) ──
export const C = {
  brand: '1C69EF', brandSoft: 'E4EDFD', bg: 'F8F7FC', surface: 'FFFFFF', ink: '16181C', ink2: '3A3D44', inkSoft: '6E6B68',
  rule: 'E6E2DE', dark: '11141C', darkSurface: '1D1F29', darkText: 'F8F7FC', darkMuted: 'A9A6A2', gray: '8A8580',
  tint: 'EEF3FE', chart2: '8FB4F5', chart3: 'C9C5C1',
};
export const FONT = 'Pretendard';
export const W = 13.333, H = 7.5, M = 0.75;

// ── 세 덱이 글자 그대로 공유하는 사실 (바뀌면 여기 한 곳만) ──
export const FACTS = {
  feeDirect: '10%', feeBrokered: '5%',
  pgNote: '카드 수수료(현재 약 2.75%, 카드사 정책에 따라 바뀔 수 있음)는 유어딜이 자기 몫 안에서 냅니다.',
  introPct: '2%', introTerm: '1년',
  reviewBonus: '1,000딜',
  minPayout: '1만원',
  liveMeasuredAt: '2026-09-13',
  activeVouchers: '337', realStores: '1', avgMeal: '32,411원', avgStay: '155,824원',
  influencerDb: '201,471명', influencerReachable: '46,220명', influencerYoutube: '18,170명', influencerNaverBlog: '172,755명', influencerAsOf: '2026년 9월 기준',
  influencerPayoutMin: '10만원', influencerPayoutDay: '매월 1일', clawbackWindow: '7일',
  contactEmail: 'jiwon@ur-team.com', kakaoChannel: 'pf.kakao.com/_AITdn', site: 'urdeal.kr', biz: '리스터코퍼레이션 · 사업자등록번호 479-09-02930',
};

export async function icon(name, color, px = 256) {
  const Comp = Fi[name];
  if (!Comp) throw new Error('icon ' + name);
  const svg = renderToStaticMarkup(React.createElement(Comp, { color: '#' + color, size: px, strokeWidth: 1.7 }));
  return 'image/png;base64,' + (await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64');
}
export async function wordmark(fill, scale = 1) {
  // Poppins 가 이 환경에 없어(대체 폰트로 그려지면 점이 글자에서 떨어진다) 글자를 먼저 그려 폭을 실측한 뒤 점을 붙인다.
  // scale: 표지처럼 크게 박을 때 해상도를 올린다(96px × scale).
  const fs = 96 * scale;
  const textSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${900 * scale}" height="${140 * scale}"><text x="${10 * scale}" y="${106 * scale}" font-family="Pretendard" font-weight="800" font-size="${fs}" letter-spacing="${-4 * scale}" fill="#${fill}">urdeal</text></svg>`;
  const txt = sharp(Buffer.from(textSvg)).png();
  const trimmed = await txt.trim().toBuffer({ resolveWithObject: true });
  const tw = trimmed.info.width, th = trimmed.info.height;
  const r = 10 * scale, gap = 12 * scale, pad = 8 * scale;
  const W_ = tw + gap + r * 2 + pad * 2, H_ = th + pad * 2;
  const dot = `<svg xmlns="http://www.w3.org/2000/svg" width="${W_}" height="${H_}"><circle cx="${pad + tw + gap + r}" cy="${pad + th - r - 2}" r="${r}" fill="#${C.brand}"/></svg>`;
  const buf = await sharp({ create: { width: W_, height: H_, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: trimmed.data, left: pad, top: pad }, { input: Buffer.from(dot), left: 0, top: 0 }]).png().toBuffer();
  return { data: 'image/png;base64,' + buf.toString('base64'), ratio: W_ / H_ };
}
/** 라이브 캡처(390×844 비율)를 폰 프레임이 합성된 PNG 로 미리 굽는다. 없으면 null. */
export async function shot(shotsDir, name, phoneStyle = 'minimal') {
  for (const ext of ['jpg', 'png']) {
    const p = path.join(shotsDir, `${name}.${ext}`);
    if (fs.existsSync(p)) {
      const r = await renderPhone(p, phoneStyle);
      const k = 1200 / r.height;
      const buf = await sharp(r.buffer).resize({ height: 1200 }).png({ compressionLevel: 9, palette: false }).toBuffer();
      return { data: 'image/png;base64,' + buf.toString('base64'), width: r.width * k, height: 1200, pad: r.pad * k, frameW: r.frameW * k, frameH: r.frameH * k };
    }
  }
  return null;
}

/** 데스크톱 캡처를 둥근 모서리로 깎아 base64 로 돌려준다(폭·높이 포함). 없으면 null. */
export async function roundedImage(file, radiusPx = 28) {
  if (!fs.existsSync(file)) return null;
  const img = sharp(file);
  const meta = await img.metadata();
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}"><rect x="0" y="0" width="${meta.width}" height="${meta.height}" rx="${radiusPx}" ry="${radiusPx}" fill="#fff"/></svg>`);
  const buf = await img.png().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  return { data: 'image/png;base64,' + buf.toString('base64'), width: meta.width, height: meta.height, ratio: meta.width / meta.height };
}

/**
 * 덱 하나를 시작한다. 반환값의 헬퍼로 슬라이드를 그린다.
 * @param {object} o  { title, footer, shotsDir, shotKeys, phoneStyle, icons }
 */
export async function createDeck({ title, footer, shotsDir, shotKeys = [], phoneStyle = process.env.PHONE_STYLE || 'minimal', icons = [] }) {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.author = '리스터코퍼레이션';
  pres.title = title;

  const wmDark = await wordmark(C.ink);
  const wmLight = await wordmark(C.darkText);
  const wmBig = await wordmark(C.ink, 5);
  const wmBigLight = await wordmark(C.darkText, 5);
  const wmH = 0.26, wmW = wmH * wmDark.ratio;
  const ic = {};
  const base = ['FiPercent', 'FiLayers', 'FiUsers', 'FiCreditCard', 'FiMapPin', 'FiUserCheck', 'FiSearch', 'FiEye', 'FiBarChart2',
    'FiRefreshCcw', 'FiLock', 'FiFileText', 'FiCheckCircle', 'FiSmartphone', 'FiShield', 'FiClock', 'FiCamera', 'FiTag',
    'FiTrendingUp', 'FiXCircle', 'FiCheck', 'FiArrowRight', 'FiPhone', 'FiImage', 'FiHome', 'FiStar', 'FiVideo', 'FiMessageCircle', 'FiAlertCircle', 'FiCalendar'];
  for (const n of new Set([...base, ...icons])) ic[n] = await icon(n, C.brand);
  ic.FiArrowGray = await icon('FiArrowRight', C.gray);
  ic.FiMailW = await icon('FiMail', C.darkText);
  ic.FiGlobeW = await icon('FiGlobe', C.darkText);
  ic.FiMessageW = await icon('FiMessageCircle', C.darkText);
  ic.FiFileTextW = await icon('FiFileText', C.darkText);
  ic.FiCheckW = await icon('FiCheck', 'FFFFFF');
  ic.FiMinusG = await icon('FiMinus', C.gray);
  const shots = {};
  for (const k of shotKeys) shots[k] = await shot(shotsDir, k, phoneStyle);
  const missing = Object.entries(shots).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) console.warn('캡처 없음 (빈 슬롯으로 그림):', missing.join(', '));

  let page = 0;
  const T = (slide, text, o) => slide.addText(text, Object.assign({ fontFace: FONT, isTextBox: true, margin: 0 }, o));

  function chrome(slide, { dark = false } = {}) {
    page += 1;
    slide.background = { color: dark ? C.dark : C.bg };
    slide.addImage({ data: (dark ? wmLight : wmDark).data, x: M, y: 0.5, w: wmW, h: wmH });
    T(slide, footer, { x: M, y: H - 0.62, w: 6, h: 0.25, fontSize: 9, color: dark ? C.darkMuted : C.gray, charSpacing: 0.5 });
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
  /** 폰 프레임. (x, y) 는 보이는 프레임의 좌상단, h 는 프레임 높이. 반환값은 보이는 프레임 폭. */
  function phone(slide, key, x, y, h, { caption, dark = false } = {}) {
    const s = shots[key];
    const frameRatio = s ? s.frameW / s.frameH : (780 + 44) / (1688 + 44);
    const w = h * frameRatio;
    if (s) {
      const scale = h / s.frameH;
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
  /** 텍스트 상자 표 (pptx addTable 은 PDF 변환 때 한글 자간 보정이 안 먹어 쓰지 않는다). */
  function table(slide, { x, y, colW, hdr, body, hiRow = -1, rowH = 0.46, fontSize = 11, brandCol = -1 }) {
    const tw = colW.reduce((a, b) => a + b, 0);
    const colX = colW.map((_, i) => x + colW.slice(0, i).reduce((a, b) => a + b, 0));
    hdr.forEach((h, i) => T(slide, h, { x: colX[i], y, w: colW[i], h: 0.26, fontSize: 9.5, bold: true, color: C.gray, align: i === 0 ? 'left' : 'right' }));
    hr(slide, x, y + 0.3, tw);
    body.forEach((r, ri) => {
      const ry = y + 0.36 + ri * rowH, hi = ri === hiRow;
      if (hi) slide.addShape(pres.shapes.RECTANGLE, { x: x - 0.1, y: ry - 0.04, w: tw + 0.2, h: rowH, fill: { color: C.tint }, line: { color: C.tint, width: 0 } });
      r.forEach((t, i) => T(slide, t, { x: colX[i], y: ry, w: colW[i], h: rowH - 0.08, fontSize, bold: hi || i === brandCol, color: i === brandCol ? C.brand : C.ink, align: i === 0 ? 'left' : 'right', valign: 'middle' }));
      hr(slide, x, ry + rowH - 0.04, tw);
    });
    return y + 0.36 + body.length * rowH;
  }
  /** 손님 경험 4단계 (세 덱 공통 블록). 폰 4장을 가로로. */
  function customerSteps(slide, { y = 2.4, h = 4.2, keys = ['home', 'detail', 'use', 'shop'], caps: capsIn } = {}) {
    const caps = capsIn || ['찾기: 홈에서 동네 이용권', '결제: 정가와 할인가를 함께', '발급: 결제 즉시 내 이용권', '사용: 매장에서 QR 또는 확인코드'];
    const frameRatio = (780 + 44) / (1688 + 44);
    const pw = h * frameRatio, gap = (W - 2 * M - 4 * pw) / 3;
    keys.forEach((k, i) => {
      const x = M + i * (pw + gap);
      numBadge(slide, i + 1, x + pw / 2 - 0.2, y - 0.62, 0.4);
      phone(slide, k, x, y, h, { caption: caps[i] });
    });
  }
  /** 정직 고지 (세 덱 공통 문장). */
  function honesty(slide, { x = M, y, w = W - 2 * M, h = 1.5, text } = {}) {
    card(slide, x, y, w, h, { fill: C.tint });
    T(slide, '정직하게 말씀드립니다', { x: x + 0.3, y: y + 0.18, w: w - 0.6, h: 0.3, fontSize: 12.5, bold: true, color: C.ink, charSpacing: -0.3 });
    T(slide, text || `유어딜은 초기 서비스입니다. ${FACTS.liveMeasuredAt} 기준 판매 중인 이용권 ${FACTS.activeVouchers}건 가운데 실제 매장이 등록한 것은 ${FACTS.realStores}건이고, 나머지는 시범 운영을 위한 예시입니다. 트래픽을 약속하는 대신 조건을 숫자로 먼저 공개합니다. 지금 들어오시는 매장이 그 지역과 카테고리의 첫 자리를 가져갑니다.`,
      { x: x + 0.3, y: y + 0.52, w: w - 0.6, h: h - 0.62, fontSize: 10.5, color: C.ink, lineSpacingMultiple: 1.45, valign: 'top' });
  }

  /** 표지: 로고를 크게. 페이지 번호에 안 센다(REVU 류 대외 제안서 관행). */
  function cover(slide, { kicker = '우리동네 이용권', deckName, sub, date = '2026년 9월', dark = false } = {}) {
    slide.background = { color: dark ? C.dark : C.bg };
    const wm = dark ? wmBigLight : wmBig;
    const lw = 5.6, lh = lw / wm.ratio;
    const ly = 2.45;
    T(slide, kicker, { x: M, y: ly - 0.62, w: 8, h: 0.4, fontSize: 16, bold: true, color: C.brand, charSpacing: 0.5 });
    slide.addImage({ data: wm.data, x: M - 0.04, y: ly, w: lw, h: lh });
    if (deckName) T(slide, deckName, { x: M, y: ly + lh + 0.45, w: 9, h: 0.55, fontSize: 24, bold: true, color: dark ? C.darkText : C.ink, charSpacing: -0.6 });
    if (sub) T(slide, sub, { x: M, y: ly + lh + 1.05, w: 8.5, h: 0.5, fontSize: 12.5, color: dark ? C.darkMuted : C.inkSoft, lineSpacingMultiple: 1.45, valign: 'top' });
    slide.addShape(pres.shapes.LINE, { x: M, y: H - 0.95, w: W - 2 * M, h: 0, line: { color: dark ? C.ink2 : C.rule, width: 0.75 } });
    T(slide, FACTS.biz + ' · ' + FACTS.site, { x: M, y: H - 0.82, w: 8, h: 0.25, fontSize: 9, color: dark ? C.darkMuted : C.gray });
    T(slide, date, { x: W - M - 3, y: H - 0.82, w: 3, h: 0.25, fontSize: 9, color: dark ? C.darkMuted : C.gray, align: 'right' });
    T(slide, '본 문서의 내용을 무단으로 복제·전재·재배포할 수 없습니다.', { x: M, y: H - 0.58, w: 8, h: 0.25, fontSize: 8.5, color: dark ? C.darkMuted : C.gray });
  }
  /** 화면 위에 붙이는 말풍선 칩(브랜드 알약). 폭은 글자 수로 추정한다. 반환값은 폭. */
  function chip(slide, x, y, text, { tone = 'brand', size = 9.5 } = {}) {
    const w = Math.max(0.7, text.length * size * 0.0125 + 0.34), h = 0.3;
    const fill = tone === 'ink' ? C.ink : tone === 'white' ? C.surface : C.brand;
    const color = tone === 'white' ? C.ink : 'FFFFFF';
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.15, fill: { color: fill }, line: { color: fill, width: 0 }, shadow: { type: 'outer', color: '16181C', blur: 6, offset: 2, angle: 90, opacity: 0.22 } });
    T(slide, text, { x, y, w, h, fontSize: size, bold: true, color, align: 'center', valign: 'middle', charSpacing: -0.2 });
    return w;
  }
  /** 데스크톱 캡처를 둥근 카드에 얹는다. 높이는 비율로 계산해 반환. */
  async function screen(slide, file, x, y, w, { caption, radius = 28 } = {}) {
    const im = await roundedImage(file, radius);
    if (!im) { card(slide, x, y, w, w * 0.5); T(slide, '캡처 자리', { x, y: y + w * 0.25 - 0.15, w, h: 0.3, fontSize: 10, color: C.gray, align: 'center' }); return w * 0.5; }
    const h = w / im.ratio;
    card(slide, x - 0.08, y - 0.08, w + 0.16, h + 0.16);
    slide.addImage({ data: im.data, x, y, w, h });
    if (caption) T(slide, caption, { x, y: y + h + 0.2, w, h: 0.26, fontSize: 9.5, color: C.inkSoft, align: 'center' });
    return h;
  }
  /** "Q. 왜 …?" 뒤에 이유 셋. 반환값은 끝 y. */
  function qa3(slide, x, y, w, q, items, { dark = false, rowH = 0.6 } = {}) {
    T(slide, q, { x, y, w, h: 0.32, fontSize: 12.5, bold: true, color: dark ? C.darkText : C.ink, charSpacing: -0.3, valign: 'middle' });
    let yy = y + 0.42;
    items.forEach((t, i) => {
      numBadge(slide, i + 1, x, yy + 0.03, 0.26, { filled: false });
      T(slide, t, { x: x + 0.38, y: yy, w: w - 0.38, h: rowH - 0.06, fontSize: 10.2, color: dark ? C.darkMuted : C.inkSoft, valign: 'top', lineSpacingMultiple: 1.32 });
      yy += rowH;
    });
    return yy;
  }
  /** 숫자 타일(REVU 류 2×2). */
  function statTile(slide, x, y, w, h, { icon: name, n, l, brand = false }) {
    card(slide, x, y, w, h);
    T(slide, l, { x: x + 0.28, y: y + 0.22, w: w - 1.0, h: 0.28, fontSize: 10, bold: true, color: C.gray, charSpacing: 0.3 });
    T(slide, n, { x: x + 0.28, y: y + 0.5, w: w - 1.0, h: h - 0.6, fontSize: 24, bold: true, color: brand ? C.brand : C.ink, charSpacing: -0.8, valign: 'middle' });
    if (name) iconCircle(slide, name, x + w - 0.8, y + h / 2 - 0.25, 0.5);
  }

  return { pres, ic, shots, T, chrome, title, lead, card, iconCircle, numBadge, hr, label, phone, kv, table, customerSteps, honesty, cover, chip, screen, qa3, statTile };
}
