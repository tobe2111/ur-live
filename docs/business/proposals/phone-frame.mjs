// 폰 프레임 렌더러 — 캡처(390×844 비율)를 둥근 화면 + 베젤 + 그림자가 있는 PNG 한 장으로 굽는다.
// pptxgenjs 는 이미지를 둥글게 못 자르므로(rounding:true 는 원형) 프레임을 여기서 미리 합성한다.
//
//   import { renderPhone, STYLES } from './phone-frame.mjs'
//   const { buffer, width, height } = await renderPhone('/path/shot.jpg', 'minimal')
import sharp from 'sharp';

export const STYLES = {
  // A. 미니멀 다크 베젤 — 얇은 잉크 베젤, 노치 없음. 문서 톤과 가장 맞는다 (추천).
  minimal: { bezel: 22, outerR: 74, innerR: 52, bezelColor: '#16181C', notch: null, border: null, shadow: { blur: 34, opacity: 0.22, dy: 18 } },
  // B. 다이내믹 아일랜드 — A 에 상단 알약. 실제 폰처럼 보이지만 캡처 상단 상태바가 없어 어색할 수 있다.
  island: { bezel: 24, outerR: 78, innerR: 54, bezelColor: '#0E1014', notch: { w: 210, h: 56, y: 28 }, border: null, shadow: { blur: 34, opacity: 0.26, dy: 18 } },
  // C. 베젤 없음 — 둥근 화면 + 1px 헤어라인 + 그림자. 가장 에디토리얼하고 가볍다.
  card: { bezel: 0, outerR: 56, innerR: 56, bezelColor: null, notch: null, border: { color: '#D9D5D0', width: 2 }, shadow: { blur: 40, opacity: 0.18, dy: 22 } },
  // D. 라이트 베젤 — 흰 베젤. 밝은 슬라이드에서 부드럽고, 다크 슬라이드에서는 튄다.
  light: { bezel: 22, outerR: 74, innerR: 52, bezelColor: '#FFFFFF', notch: null, border: { color: '#E3DFDA', width: 2 }, shadow: { blur: 36, opacity: 0.2, dy: 18 } },
};

const SCREEN_W = 780; // 390 @2x
const SCREEN_H = 1688; // 844 @2x

function roundedRectSvg(w, h, r, fill, extra = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}" ${extra}/></svg>`;
}

/** @returns {Promise<{buffer: Buffer, width: number, height: number, pad: number}>} PNG(알파) + 캔버스 치수 + 그림자 여백 */
export async function renderPhone(shotPath, styleName = 'minimal') {
  const st = STYLES[styleName];
  if (!st) throw new Error('unknown phone style ' + styleName);
  const shadowPad = st.shadow ? st.shadow.blur * 2 + st.shadow.dy : 0;
  const frameW = SCREEN_W + st.bezel * 2;
  const frameH = SCREEN_H + st.bezel * 2;
  const canvasW = frameW + shadowPad * 2;
  const canvasH = frameH + shadowPad * 2;

  // 1) 화면: 캡처를 화면 크기로 cover-리사이즈(위 기준) 후 둥근 마스크
  const screen = await sharp(shotPath).resize(SCREEN_W, SCREEN_H, { fit: 'cover', position: 'top' }).png().toBuffer();
  const mask = Buffer.from(roundedRectSvg(SCREEN_W, SCREEN_H, st.innerR, '#fff'));
  const screenRounded = await sharp(screen).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();

  const layers = [];
  // 2) 그림자: 프레임 모양의 검은 둥근 사각형을 블러
  if (st.shadow) {
    const sh = await sharp(Buffer.from(roundedRectSvg(frameW, frameH, st.outerR, `rgba(10,12,16,${st.shadow.opacity})`)))
      .extend({ top: shadowPad, bottom: shadowPad, left: shadowPad, right: shadowPad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .blur(st.shadow.blur).png().toBuffer();
    layers.push({ input: sh, left: 0, top: st.shadow.dy });
  }
  // 3) 베젤
  if (st.bezel > 0) {
    layers.push({ input: Buffer.from(roundedRectSvg(frameW, frameH, st.outerR, st.bezelColor)), left: shadowPad, top: shadowPad });
  }
  // 4) 화면
  layers.push({ input: screenRounded, left: shadowPad + st.bezel, top: shadowPad + st.bezel });
  // 5) 헤어라인 테두리 (화면 가장자리)
  if (st.border) {
    const bw = st.border.width;
    const ring = `<svg xmlns="http://www.w3.org/2000/svg" width="${frameW}" height="${frameH}"><rect x="${bw / 2}" y="${bw / 2}" width="${frameW - bw}" height="${frameH - bw}" rx="${st.outerR}" ry="${st.outerR}" fill="none" stroke="${st.border.color}" stroke-width="${bw}"/></svg>`;
    layers.push({ input: Buffer.from(ring), left: shadowPad, top: shadowPad });
  }
  // 6) 다이내믹 아일랜드
  if (st.notch) {
    const pill = `<svg xmlns="http://www.w3.org/2000/svg" width="${st.notch.w}" height="${st.notch.h}"><rect width="${st.notch.w}" height="${st.notch.h}" rx="${st.notch.h / 2}" fill="${st.bezelColor}"/></svg>`;
    layers.push({ input: Buffer.from(pill), left: Math.round(shadowPad + (frameW - st.notch.w) / 2), top: shadowPad + st.bezel + st.notch.y });
  }

  const buffer = await sharp({ create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers).png({ compressionLevel: 8 }).toBuffer();
  return { buffer, width: canvasW, height: canvasH, pad: shadowPad, frameW, frameH };
}
