// 인스타 카드 HTML 템플릿 (2026-11-16 — 대표 "대기업 퀄리티로" · 2차 시안 deck2 를 봇에 이식).
// 순수 함수: spec → HTML 문자열. 그리기(스크린샷)는 scripts/render-html.mjs 가 한다.
// 원칙: 한 장에 메시지 하나 · 가격이 있으면 가격이 주인공 · 강조색은 블루 하나(가격 차이만 굵게) · 이모지 없음.
//
// spec = {
//   fonts: { heavy, bold?, semi, medium? }  (글꼴 파일 경로)
//   photo?: 경로, photo_size?: {w,h}
//   kicker?: 표지 맨 위 한 줄(예: "전주 덕진 · 홍대돈까스")
//   title: [줄...], sub?: 한 줄
//   slides?: [{ type: 'price'|'point'|'steps'|'rows'|'photo', label?, title?, body?, was?, now?, save?, note?, items?, rows? }]
//   end?: { label?, title, rows?: [{k,v}] }  또는 cta?: 한 줄
//   mascot?: 경로
// }

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const lines = (arr) => (Array.isArray(arr) ? arr : [arr]).flatMap((x) => String(x ?? '').split('\n')).filter(Boolean).map(esc).join('<br>');
const fileUrl = (p) => (p ? `file://${encodeURI(p)}` : '');

// 사진이 짧은 변 900px 이상이면 꽉 채우고, 그보다 작으면 액자로 넣는다(작은 사진을 늘려 흐려지지 않게).
export function photoMode(size) {
  if (!size) return 'full';
  return Math.min(size.w, size.h) >= 900 ? 'full' : 'framed';
}

const ICONS = [
  '<svg viewBox="0 0 32 32"><rect x="5" y="8" width="22" height="16" rx="3"/><path d="M5 13h22M9 19h5"/></svg>',
  '<svg viewBox="0 0 32 32"><rect x="9" y="3" width="14" height="26" rx="3"/><path d="M13 10h2v2h-2zM17 10h2v2h-2zM13 14h2v2h-2zM17 16h2v2"/></svg>',
  '<svg viewBox="0 0 32 32"><path d="M7 17l6 6L25 10"/></svg>',
];

// 표지 이후 장 수 = slides + end(있으면) → 진행 막대
export function slideCount(spec) {
  return 1 + (spec.slides?.length || 0) + (spec.end || spec.cta ? 1 : 0);
}

function foot(i, n, tone) {
  const bars = Array.from({ length: n }, (_, k) => `<i${k === i ? ' class="on"' : ''}></i>`).join('');
  return `<div class="foot ${tone}"><span class="wm">urdeal</span><span class="bar">${bars}</span></div>`;
}

function cover(spec, n) {
  const mode = spec.photo ? photoMode(spec.photo_size) : 'none';
  const kicker = spec.kicker ? `<div class="m kicker">${esc(spec.kicker)}</div>` : '';
  const sub = spec.sub ? `<div class="m csub">${esc(spec.sub)}</div>` : '';
  if (mode === 'full') {
    return `<section class="s cover-full grain" style="--ph:url('${fileUrl(spec.photo)}')"><div class="ph"></div><div class="shade"></div>
${kicker}<h1 class="m fit" data-max="112" data-min="64">${lines(spec.title)}</h1>${sub}${foot(0, n, 'light')}</section>`;
  }
  if (mode === 'framed') {
    return `<section class="s cover-framed"><div class="frame"><div class="ph" style="--ph:url('${fileUrl(spec.photo)}')"></div></div>
${kicker}<h1 class="m fit" data-max="88" data-min="56">${lines(spec.title)}</h1>${sub}${foot(0, n, 'dark')}</section>`;
  }
  return `<section class="s cover-type">${kicker}<h1 class="m fit" data-max="132" data-min="72">${lines(spec.title)}</h1>${sub}${foot(0, n, 'light')}</section>`;
}

function inner(sl, i, n, spec) {
  const label = sl.label ? `<div class="m eyebrow">${esc(sl.label)}</div>` : '';
  switch (sl.photo ? 'photo' : sl.type) {
    case 'price':
      return `<section class="s price">${label}
${sl.was ? `<div class="m was">${esc(sl.was)}<span>원</span></div><div class="m arrow"><svg viewBox="0 0 24 24"><path d="M12 4v16M5 13l7 7 7-7"/></svg></div>` : ''}
<div class="m now">${esc(sl.now)}<small>원</small></div>
${sl.note ? `<div class="m note">${lines(sl.note)}</div>` : ''}${sl.save ? `<div class="m pill">${esc(sl.save)}</div>` : ''}${foot(i, n, 'dark')}</section>`;
    case 'photo':
      return `<section class="s photo-slide grain${sl.photo ? ' own' : ''}"><div class="ph" style="--ph:url('${fileUrl(sl.photo || spec.photo)}')"></div>
<h2 class="m fit" data-max="80" data-min="52">${lines(sl.title)}</h2>${sl.body ? `<div class="m pbody">${esc(sl.body)}</div>` : ''}${foot(i, n, 'light')}</section>`;
    case 'steps':
      return `<section class="s steps">${label}<h2 class="m fit" data-max="92" data-min="60">${lines(sl.title)}</h2>
<div class="m flow">${(sl.items || []).slice(0, 3).map((t, k) => `<div class="st"><span class="no">0${k + 1}</span><b>${esc(t)}</b>${sl.icons ? ICONS[k] || '' : ''}</div>`).join('')}</div>${foot(i, n, 'dark')}</section>`;
    case 'rows':
      return `<section class="s rows">${label}<h2 class="m fit" data-max="92" data-min="60">${lines(sl.title)}</h2>
<div class="m table">${(sl.rows || []).slice(0, 4).map((r) => `<div class="tr"><span>${esc(r.k)}</span><b>${esc(r.v)}</b></div>`).join('')}</div>${foot(i, n, 'dark')}</section>`;
    default: {
      const no = String(i).padStart(2, '0');
      return `<section class="s point"><div class="m idx">${no}</div>${label}<div class="m pwrap"><h2 class="fit" data-max="104" data-min="64">${lines(sl.title)}</h2>
${sl.body ? `<div class="body">${lines(sl.body)}</div>` : ''}</div>${foot(i, n, 'dark')}</section>`;
    }
  }
}

function endSlide(spec, i, n) {
  const e = spec.end || { title: spec.cta };
  const rows = (e.rows || []).slice(0, 4).map((r) => `<span class="k">${esc(r.k)}</span>${esc(r.v)}`).join('<br>');
  const mascot = spec.mascot ? `<img class="mascot" src="${fileUrl(spec.mascot)}">` : '';
  return `<section class="s end">${e.label ? `<div class="m eyebrow">${esc(e.label)}</div>` : ''}<h2 class="m fit" data-max="104" data-min="60">${lines(e.title)}</h2>
${rows ? `<div class="m info">${rows}</div>` : ''}${mascot}${foot(i, n, 'light')}</section>`;
}

export function buildDeckHtml(spec) {
  const f = spec.fonts || {};
  const face = (w, p) => (p ? `@font-face{font-family:P;font-weight:${w};src:url('${fileUrl(p)}')}` : '');
  const n = slideCount(spec);
  const body = [cover(spec, n), ...(spec.slides || []).map((sl, k) => inner(sl, k + 1, n, spec)), ...(spec.end || spec.cta ? [endSlide(spec, n - 1, n)] : [])].join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${face(800, f.heavy)}${face(700, f.bold || f.heavy)}${face(600, f.semi)}${face(500, f.medium || f.semi)}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:P,sans-serif;background:#111;word-break:keep-all;-webkit-font-smoothing:antialiased}
.s{width:1080px;height:1350px;position:relative;overflow:hidden;background:#F4F3EF;color:#141414;letter-spacing:-0.035em}
.m{position:absolute;left:88px;right:88px}
.foot{position:absolute;left:88px;right:88px;bottom:72px;display:flex;justify-content:space-between;align-items:center;font-size:24px;font-weight:600;letter-spacing:-0.01em;opacity:.55}
.foot.light{color:#fff;opacity:.8}
.bar{display:flex;gap:8px}.bar i{display:block;width:28px;height:4px;border-radius:2px;background:currentColor;opacity:.25}.bar i.on{opacity:1}
.grain:after{content:"";position:absolute;inset:-50%;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/></filter><rect width='200' height='200' filter='url(%23n)' opacity='.5'/></svg>");opacity:.12;mix-blend-mode:overlay;pointer-events:none}
.ph{position:absolute;background:var(--ph) 50% 55%/cover;filter:saturate(1.08) contrast(1.06) brightness(1.02)}
.eyebrow{top:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:30px;font-weight:600;letter-spacing:-0.02em;color:#1C69EF}
.kicker{top:88px;font-size:28px;font-weight:600;letter-spacing:-0.01em}
.fit{line-height:1.14;font-weight:800}
/* 표지: 꽉 찬 사진 */
.cover-full{color:#fff}.cover-full .ph{inset:0}
.cover-full .shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.28) 0%,rgba(0,0,0,0) 22%,rgba(0,0,0,0) 40%,rgba(0,0,0,.8) 100%)}
.cover-full .kicker{color:#fff;opacity:.92}
.cover-full h1{bottom:200px;max-height:520px}
.cover-full .csub{bottom:150px;font-size:34px;font-weight:600;opacity:.85}
/* 표지: 액자 사진(작은 사진) */
.cover-framed .frame{position:absolute;left:88px;right:88px;top:180px;height:660px;border-radius:28px;overflow:hidden}
.cover-framed .ph{inset:0}
.cover-framed .kicker{top:100px;color:#55534E}
.cover-framed h1{top:890px;max-height:270px}
.cover-framed .csub{top:1180px;font-size:32px;font-weight:600;color:#55534E}
/* 표지: 사진 없음 — 글자만 */
.cover-type{background:#141414;color:#fff}
.cover-type .kicker{top:150px;color:#7FA8F7}
.cover-type h1{top:260px;max-height:760px}
.cover-type .csub{bottom:170px;font-size:36px;font-weight:600;opacity:.7}
/* 가격 */
.price .was{top:270px;right:auto;font-size:110px;font-weight:700;color:#B9B7B0}
.price .was span{font-size:60px}
.price .was:after{content:"";position:absolute;left:-6px;width:var(--ww,420px);top:52%;height:8px;background:#141414;opacity:.7;transform:rotate(-4deg)}
.price .arrow{top:420px}.price .arrow svg{width:64px;height:64px;stroke:#B9B7B0;stroke-width:2.4;fill:none;stroke-linecap:round;stroke-linejoin:round}
.price .now{top:500px;font-size:250px;font-weight:800;line-height:1;letter-spacing:-0.06em}
.price .now small{font-size:104px;letter-spacing:-0.04em}
.price .note{top:820px;font-size:40px;font-weight:600;line-height:1.5;color:#55534E}
.price .pill{top:1010px;right:auto;background:#1C69EF;color:#fff;font-size:34px;font-weight:700;padding:20px 32px;border-radius:999px;letter-spacing:-0.02em}
/* 사진 장 */
.photo-slide{background:#141414;color:#fff}.photo-slide .ph{left:0;right:0;top:0;height:900px;background-size:140% auto;background-position:46% 86%}
.photo-slide.own .ph{background-size:cover;background-position:50% 50%}
.photo-slide h2{top:970px;max-height:200px}
.photo-slide .pbody{top:1180px;font-size:32px;font-weight:500;opacity:.7}
/* 요점 */
.point .idx{top:150px;font-size:30px;font-weight:600;color:#1C69EF}
.point .eyebrow{top:150px;left:160px}
.point .pwrap{top:240px}
.point h2{max-height:560px}
.point .body{margin-top:56px;font-size:42px;font-weight:600;line-height:1.55;color:#55534E}
/* 단계 */
.steps h2,.rows h2{top:220px;max-height:330px}
.steps .flow{top:620px}
.st{display:flex;align-items:center;gap:40px;padding:38px 0;border-top:2px solid rgba(20,20,20,.1)}
.st:last-child{border-bottom:2px solid rgba(20,20,20,.1)}
.st .no{width:60px;font-size:30px;font-weight:600;color:#1C69EF}
.st b{flex:1;font-size:46px;font-weight:700}
.st svg{width:64px;height:64px;stroke:#141414;stroke-width:2.4;fill:none;stroke-linecap:round;stroke-linejoin:round}
/* 표 */
.rows .table{top:620px}
.tr{display:flex;justify-content:space-between;align-items:baseline;gap:32px;padding:38px 0;border-top:2px solid rgba(20,20,20,.1);font-size:40px;font-weight:600;color:#55534E}
.tr:last-child{border-bottom:2px solid rgba(20,20,20,.1)}
.tr b{font-size:52px;font-weight:800;color:#141414;text-align:right}
/* 마지막 */
.end{background:#1C69EF;color:#fff}
.end .eyebrow{color:#fff;opacity:.75}
.end h2{top:220px;max-height:400px}
.end .info{top:760px;font-size:36px;font-weight:600;line-height:1.75;opacity:.92}
.end .info .k{display:inline-block;width:150px;opacity:.6;font-weight:500}
.end .mascot{position:absolute;right:60px;bottom:120px;width:260px}
</style></head><body>
${body}
<script>
// 제목이 상자에 맞을 때까지 글자를 줄인다(data-max → data-min). 글꼴이 다 온 뒤에 잰다.
document.fonts.ready.then(() => {
for (const el of document.querySelectorAll('.fit')) {
  let s = +el.dataset.max; const min = +el.dataset.min;
  el.style.fontSize = s + 'px';
  const box = parseFloat(getComputedStyle(el).maxHeight) || 9999;
  while (s > min && (el.scrollHeight > box || el.scrollWidth > el.clientWidth + 1)) { s -= 4; el.style.fontSize = s + 'px'; }
}
for (const el of document.querySelectorAll('.price .was')) el.style.setProperty('--ww', (el.scrollWidth + 12) + 'px');
document.body.dataset.ready = '1';
});
</script></body></html>`;
}
