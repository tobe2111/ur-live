/**
 * 🧩 위젯 코드 만들기 페이지 (`GET /embed`) — **스크립트 없는 폼**이다.
 *
 * 종류·아이디·장수·테마를 고르고 [코드 만들기] 를 누르면 같은 주소로 다시 와서(GET) 미리보기 iframe 과
 * 붙여 넣을 코드를 보여 준다. 스크립트를 안 쓰는 이유는 위젯과 같다(CSP nonce — `embed-widget.ts` 머리말).
 * 복사는 코드 칸을 눌러 전체 선택 → Ctrl+C.
 */
import { EMBED_DEFAULT_COUNT, EMBED_HEIGHT, EMBED_MAX_COUNT, esc, type EmbedTheme } from './embed-widget'

/** 붙여 넣을 코드에 박는 주소 — 정본 도메인. 미리보기만 현재 호스트를 쓴다. */
export const EMBED_PUBLIC_ORIGIN = 'https://urdeal.kr'

export interface EmbedTypeSpec {
  label: string
  /** 누가 쓰는가 — 폼에 그대로 적는다. */
  who: string
  keyLabel: string
  keyHint: string
  path: (key: string) => string | null
  layout: 'strip' | 'single' | 'partner'
}

const enc = (s: string) => encodeURIComponent(s)

export const EMBED_TYPES: Record<string, EmbedTypeSpec> = {
  ushop: {
    label: '유어샵', who: '인플루언서·유저의 블로그, 개인 홈페이지',
    keyLabel: '유어샵 아이디', keyHint: 'urdeal.kr/u/ 뒤의 글자 (예: jiwon1228)', layout: 'strip',
    path: (k) => (/^[a-z0-9_.]{2,40}$/i.test(k) ? `/embed/u/${enc(k.toLowerCase())}` : null),
  },
  agency: {
    label: '에이전시', who: '에이전시 회사 홈페이지(운영 매장 소개)',
    keyLabel: '에이전시 번호', keyHint: '에이전시 콘솔에 보이는 번호 (예: 3)', layout: 'strip',
    path: (k) => (/^\d{1,9}$/.test(k) ? `/embed/agency/${k}` : null),
  },
  store: {
    label: '매장', who: '사장님 가게 홈페이지·네이버 블로그',
    keyLabel: '매장 아이디', keyHint: 'urdeal.kr/s/ 뒤의 글자', layout: 'strip',
    path: (k) => (/^[A-Za-z0-9_.-]{1,64}$/.test(k) ? `/embed/store/${enc(k)}` : null),
  },
  region: {
    label: '지역', who: '관광·상인회·지역 안내 사이트',
    keyLabel: '지역', keyHint: '시/도 또는 시/도/시군구 (예: 강원 · 서울/종로구)', layout: 'strip',
    path: (k) => {
      const parts = k.split('/').map((x) => x.trim()).filter(Boolean)
      if (parts.length < 1 || parts.length > 2) return null
      return `/embed/region/${parts.map(enc).join('/')}`
    },
  },
  partner: {
    label: '제휴사 입점', who: '제휴사(에이전시) 사이트에서 사장님께 유어딜 입점 영업',
    keyLabel: '에이전시 번호', keyHint: '에이전시 콘솔에 보이는 번호 (예: 3)', layout: 'partner',
    path: (k) => (/^\d{1,9}$/.test(k) ? `/embed/partner/${k}` : null),
  },
  pass: {
    label: '이용권 하나', who: '블로그 글 속 소개 카드',
    keyLabel: '이용권 번호', keyHint: 'urdeal.kr/pass/ 뒤의 숫자 (예: 2919)', layout: 'single',
    path: (k) => (/^\d{1,9}$/.test(k) ? `/embed/pass/${k}` : null),
  },
}

/** 위젯 주소(쿼리 포함). 잘못된 입력이면 null. */
export function embedSrc(type: string, key: string, count: number, theme: EmbedTheme): string | null {
  const spec = EMBED_TYPES[type]
  if (!spec) return null
  const base = spec.path(key.trim())
  if (!base) return null
  const qs: string[] = []
  if (spec.layout === 'strip' && count !== EMBED_DEFAULT_COUNT) qs.push(`count=${count}`)
  if (theme !== 'light') qs.push(`theme=${theme}`)
  return qs.length ? `${base}?${qs.join('&')}` : base
}

/** 붙여 넣을 iframe 코드 한 덩어리. */
export function embedSnippet(type: string, src: string): string {
  const spec = EMBED_TYPES[type]
  const h = EMBED_HEIGHT[spec?.layout ?? 'strip']
  const maxW = spec?.layout === 'strip' ? 760 : 520
  return `<iframe src="${EMBED_PUBLIC_ORIGIN}${src}"\n  title="유어딜 ${spec?.label ?? ''} 이용권" loading="lazy"\n  style="width:100%;max-width:${maxW}px;height:${h}px;border:0;border-radius:14px;overflow:hidden"></iframe>`
}

export interface BuilderInput { type?: string; key?: string; count?: string; theme?: EmbedTheme; origin: string }

export function renderEmbedBuilder(i: BuilderInput): string {
  const type = i.type && EMBED_TYPES[i.type] ? i.type : 'ushop'
  const key = String(i.key ?? '').slice(0, 80)
  const n = parseInt(String(i.count ?? ''), 10)
  const count = Number.isFinite(n) ? Math.min(EMBED_MAX_COUNT, Math.max(1, n)) : EMBED_DEFAULT_COUNT
  const theme: EmbedTheme = i.theme === 'dark' || i.theme === 'auto' ? i.theme : 'light'
  const spec = EMBED_TYPES[type]
  const src = key ? embedSrc(type, key, count, theme) : null

  const opt = (v: string, l: string, cur: string) => `<option value="${v}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`
  const typeOpts = Object.entries(EMBED_TYPES).map(([k, s]) => opt(k, `${s.label} — ${s.who}`, type)).join('')
  const themeOpts = [['light', '밝게'], ['dark', '어둡게'], ['auto', '방문자 설정 따라']].map(([v, l]) => opt(v, l, theme)).join('')
  const h = EMBED_HEIGHT[spec.layout]

  let result = ''
  if (key && !src) {
    result = `<p class="err">${esc(spec.keyLabel)} 형식이 맞지 않아요. ${esc(spec.keyHint)}</p>`
  } else if (src) {
    result = `<h2>미리보기</h2><iframe src="${esc(src)}" title="미리보기" style="width:100%;max-width:${spec.layout === 'strip' ? 760 : 520}px;height:${h}px;border:0;border-radius:14px;background:#fff"></iframe>`
      + `<h2>붙여 넣을 코드</h2><p class="hint">칸을 눌러 전체 선택(Ctrl+A · ⌘A)한 뒤 복사(Ctrl+C · ⌘C)해서, 홈페이지 편집기의 <b>HTML 넣기</b> 칸에 붙여 넣으세요.</p>`
      + `<textarea readonly rows="4">${esc(embedSnippet(type, src))}</textarea>`
  }

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>위젯 코드 만들기 - 유어딜</title><style>
*{box-sizing:border-box}body{margin:0;background:#F8F7FC;color:#16181C;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif}
main{max-width:800px;margin:0 auto;padding:32px 16px 64px;display:flex;flex-direction:column;gap:16px}
h1{font-size:24px;margin:0}h2{font-size:17px;margin:16px 0 0}p{margin:0;color:#666C72;font-size:15px;line-height:1.6}
form{background:#fff;border-radius:16px;padding:20px;display:grid;gap:14px;box-shadow:0 2px 10px rgba(22,24,28,.06)}
label{display:grid;gap:6px;font-size:13px;font-weight:500}small{color:#81868C;font-weight:400}
select,input{font:inherit;font-size:15px;padding:10px 12px;border:1px solid #CFD3D8;border-radius:10px;background:#fff;color:#16181C;width:100%}
.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
button{font:inherit;font-weight:700;font-size:15px;background:#1C69EF;color:#fff;border:0;border-radius:12px;padding:12px;cursor:pointer}
textarea{width:100%;font:13px/1.55 ui-monospace,Menlo,monospace;padding:12px;border-radius:12px;border:0;background:#11141C;color:#E2E5E9;resize:vertical}
.keys{margin:-6px 0 0;padding-left:18px;font-size:12px;color:#81868C;line-height:1.7}.err{color:#DC2626}.hint{font-size:13px}
</style></head><body><main>
<h1>유어딜 위젯 코드 만들기</h1>
<p>홈페이지·블로그에 유어딜 이용권을 띄우는 코드를 만듭니다. 위젯의 이용권과 가격은 자동으로 최신 상태로 바뀌어요.</p>
<form method="get" action="/embed">
<label>어떤 위젯인가요?<select name="type">${typeOpts}</select></label>
<label>아이디·번호 <small>위젯마다 넣는 값이 달라요</small><input name="key" value="${esc(key)}" autocomplete="off" required></label>
<ul class="keys">${Object.values(EMBED_TYPES).map((s) => `<li><b>${esc(s.label)}</b> ${esc(s.keyLabel)} — ${esc(s.keyHint)}</li>`).join('')}</ul>
<div class="two"><label>보여 줄 이용권 수<input name="count" type="number" min="1" max="${EMBED_MAX_COUNT}" value="${count}"></label>
<label>색<select name="theme">${themeOpts}</select></label></div>
<button type="submit">코드 만들기</button>
</form>
${result}
</main></body></html>`
}
