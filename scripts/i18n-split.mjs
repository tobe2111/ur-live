/**
 * 🌐 번역 파일을 손님용(core)과 대시보드용(dash)으로 나눈다 — 2026-10-11 (대표 "다 해줘")
 *
 * 왜: 손님이든 셀러든 첫 접속 때 언어 파일 하나(ko 309 KB · gzip 91 KB)를 통째로 받았는데,
 *   그중 약 64% 가 손님은 볼 일이 없는 셀러·어드민·에이전시·제조사·도매 문구였다.
 *
 * 어떻게:
 *   - `DASH_NAMESPACES` 로 시작하는 키는 dash 로 보낸다.
 *   - 단, **손님이 볼 수 있는 파일**(아래 `isDashOnlyFile` 가 아닌 모든 src 파일)이 그 키를 문자열로 언급하면
 *     core 에 남긴다. 템플릿(`t(\`seller.x.${y}\`)`)이면 접두어 아래를 통째로 남긴다.
 *   - 판정은 **보수적**이다 — 애매하면 core 에 남긴다(손님 화면에 키가 그대로 뜨는 쪽이 훨씬 나쁘다).
 *   - 그래도 빠진 키가 런타임에 요청되면 `src/i18n.ts` 가 dash 를 불러오고 다시 그린다(이중 안전망).
 *
 * 순수 함수 + 파일 스캔 하나. vite.config(플러그인)와 테스트가 같은 함수를 쓴다.
 */
import fs from 'node:fs'
import path from 'node:path'

export const DASH_NAMESPACES = ['seller', 'admin', 'agency', 'supplier', 'wholesale', 'live', 'liveWs']

const NS_ALT = DASH_NAMESPACES.join('|')
const LITERAL_RE = new RegExp(`['"\`]((?:${NS_ALT})\\.[A-Za-z0-9_.-]+)['"\`]`, 'g')
const TEMPLATE_RE = new RegExp('`((?:' + NS_ALT + ')\\.[A-Za-z0-9_.-]*)\\$\\{', 'g')

/**
 * 대시보드 안에서만 그려지는 파일인가. **여기 없는 파일은 전부 손님이 볼 수 있다고 본다.**
 * ⚠️ `SellerPublicPage`·`seller-public/`·`user-profile/`(마이) 는 손님 화면이라 제외한다.
 */
export function isDashOnlyFile(rel) {
  const p = rel.replace(/\\/g, '/')
  if (/^src\/pages\/(SellerPublicPage|seller-public\/)/.test(p)) return false
  return /^src\/(pages\/(Admin|admin\/|Agency|agency|Supplier|supplier|Wholesale|wholesale|Distributor|distributor|Seller|seller-)|components\/(admin|wholesale|supplier|agency|dashboard|seller|seller-layout)\/|components\/(SellerLayout|AdminLayout|AgencyLayout)|routes\/)/.test(p)
}

function walk(dir, out = []) {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n)
    const st = fs.statSync(p)
    if (st.isDirectory()) { if (n !== 'tests' && n !== 'node_modules') walk(p, out) }
    else if (/\.(tsx?|jsx?|mjs)$/.test(n)) out.push(p)
  }
  return out
}

/** 손님이 볼 수 있는 파일이 언급하는 dash 키(정확한 경로)와 접두어(템플릿). */
export function collectConsumerDashKeys(root) {
  const exact = new Set()
  const prefixes = new Set()
  for (const f of walk(path.join(root, 'src'))) {
    const rel = path.relative(root, f)
    if (isDashOnlyFile(rel)) continue
    const s = fs.readFileSync(f, 'utf-8')
    for (const m of s.matchAll(LITERAL_RE)) exact.add(m[1].replace(/\.$/, ''))
    for (const m of s.matchAll(TEMPLATE_RE)) prefixes.add(m[1].replace(/\.$/, ''))
  }
  return { exact, prefixes }
}

/**
 * 🧹 2026-10-18 손님 core 에서 **소스 어디에서도 언급되지 않는 키**도 뺀다 (대표 *"다 이상적으로 해줘"* — 첫 방문 무게).
 *   실측(ko): core 2,445키 중 746키(raw 39KB)를 src 의 어떤 문자열도 가리키지 않았다 — 지워진 화면의 문구들이다.
 *   core brotli 28.8 → 21.9KB(−7KB, **모든 화면의 첫 방문**). 빠진 키는 `rest` 청크로 가고, 화면이 그 키를
 *   요청하면 `src/i18n.ts` 의 missingKeyHandler 가 rest 를 받아 다시 그린다(dash 와 같은 안전망 — 받는 동안 defaultValue).
 *   판정은 **보수적**: 키 모양 문자열 리터럴 · 그 조상 · 끝이 '.' 인 리터럴(접두어) · 템플릿 접두어(`x.${…}`) 중 하나라도
 *   걸리면 남긴다. 대시보드 전용 파일이 쓰는 키도 남긴다(대시보드는 rest 를 부팅 때 안 받는다).
 */
const ANY_KEY_RE = /['"`]([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_-]+)+\.?)['"`]/g
const ANY_TEMPLATE_RE = /`([A-Za-z][A-Za-z0-9_.-]*)\$\{/g

export function collectReferencedKeys(root) {
  const exact = new Set()
  const prefixes = new Set()
  for (const f of walk(path.join(root, 'src'))) {
    const s = fs.readFileSync(f, 'utf-8')
    for (const m of s.matchAll(ANY_KEY_RE)) { if (m[1].endsWith('.')) prefixes.add(m[1].slice(0, -1)); else exact.add(m[1]) }
    for (const m of s.matchAll(ANY_TEMPLATE_RE)) prefixes.add(m[1].replace(/\.$/, ''))
  }
  return { exact, prefixes }
}

/** 조상이 언급돼도 남긴다(`t('a.b')` 를 접두어로 쓰는 코드가 있다) — keep 과 다른 점은 **조상 방향**이다. */
function makeRefKeep({ exact, prefixes }) {
  return (p) => {
    if (exact.has(p)) return true
    // 짝 키 — `t(f.key.replace(/\.q/, '.a'))`(FAQ)처럼 질문 키에서 답 키를 만드는 자리는 문자열로 안 남는다.
    //   질문(`…q1`)이 가리켜지면 답(`…a1`)도 core 에 둔다(빠지면 한국어 기본값이 다른 언어 화면에 뜬다).
    const qa = p.replace(/\.a(\d+)$/, '.q$1')
    if (qa !== p && exact.has(qa)) return true
    const parts = p.split('.')
    for (let i = 1; i < parts.length; i++) {
      const pre = parts.slice(0, i).join('.')
      if (exact.has(pre) || prefixes.has(pre)) return true
    }
    return prefixes.has(p)
  }
}

function isDashKey(key) {
  const head = key.split('.')[0]
  return DASH_NAMESPACES.includes(head)
}

/** keep 판정 — 그 경로 자체, 그 경로의 조상(통째 언급), 템플릿 접두어 아래면 core 에 남긴다. */
function makeKeep({ exact, prefixes }) {
  return (p) => {
    if (exact.has(p)) return true
    for (const x of exact) if (p.startsWith(x + '.')) return true
    for (const x of prefixes) if (p === x || p.startsWith(x + '.') || x === '') return true
    return false
  }
}

/**
 * 번역 객체를 core / dash 로 나눈다. 원본은 건드리지 않는다.
 * 평면 키(`"admin.dashboard.x": "…"`)와 중첩 객체가 섞여 있어도 같은 규칙으로 나눈다.
 */
export function splitTranslation(obj, used, refs) {
  const keep = makeKeep(used)
  const refKeep = refs ? makeRefKeep(refs) : null
  const core = {}
  const dash = {}
  const rest = {}
  const put = (target, pathParts, value) => {
    let cur = target
    for (let i = 0; i < pathParts.length - 1; i++) {
      const k = pathParts[i]
      if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {}
      cur = cur[k]
    }
    cur[pathParts[pathParts.length - 1]] = value
  }
  /** 대시보드 바깥 키 — refs 가 없으면 종전대로 통째 core, 있으면 언급된 가지만 core · 나머지는 rest. */
  const splitNonDash = (top, value) => {
    if (!refKeep) { core[top] = value; return }
    const visit = (node, parts) => {
      const p = parts.join('.')
      if (node && typeof node === 'object' && !Array.isArray(node)) {
        for (const [k, v] of Object.entries(node)) visit(v, [...parts, k])
        return
      }
      if (refKeep(p)) put(core, parts, node)
      else put(rest, parts, node)
    }
    if (top.includes('.')) { if (refKeep(top)) core[top] = value; else rest[top] = value; return }
    visit(value, [top])
  }
  for (const [top, value] of Object.entries(obj)) {
    if (!isDashKey(top)) { splitNonDash(top, value); continue }
    dash[top] = value
    if (top.includes('.')) { if (keep(top)) core[top] = value; continue }
    // 중첩 — 잎까지 내려가며 keep 인 가지만 core 로 복사
    const visit = (node, parts) => {
      const p = parts.join('.')
      if (keep(p)) { put(core, parts, node); return }
      if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) visit(v, [...parts, k])
    }
    visit(value, [top])
  }
  return { core, dash, rest }
}

/**
 * 🌐 2026-11-02 — **한국어 core 에서 "기본값과 똑같은" 키를 뺀다** (외국인 관광객 영어화의 대가를 0 으로).
 *
 * 왜: 이용권 상세·구매·지갑의 문장을 `t('pass.x', { defaultValue: '원래 한국어' })` 로 바꾸면서 ko 파일에도 같은
 *   문장을 넣었더니, 한국어 손님이 **모든 화면에서** 받는 `locale-ko` 가 +4.6 KB(실행 비용 예산 5건 빨간불)였다.
 *   그런데 그 키들은 소스가 **똑같은 한국어를 기본값으로 이미 들고 있다** — ko 파일 값은 같은 글자를 두 번 싣는 것이다.
 * 무엇: ko core 에서만, 아래를 **전부** 만족하는 잎을 rest 로 옮긴다(한국어 화면은 기본값을 그대로 그린다 —
 *   `src/i18n.ts` missingKeyHandler 는 ko + 기본값 있는 키 때문에 rest 를 받지 않는다).
 *   ① 이름공간이 `KO_DEFAULT_ONLY_NS` 안 ② 그 키 문자열이 소스에 나오는 **모든 자리**가 `t('키', { defaultValue: '…' })` 꼴
 *   ③ 그 기본값이 전부 ko 값과 **같다** ④ 템플릿 접두어(`x.${…}`)나 조상 키 언급에 걸리지 않는다.
 *   하나라도 어긋나면 남긴다(보수적 — 키 이름이 화면에 뜨는 쪽이 훨씬 나쁘다). 다른 언어(en 등)는 손대지 않는다.
 */
export const KO_DEFAULT_ONLY_NS = ['pass', 'passBuy', 'wallet', 'voucher', 'map']
const DV_CALL_RE = /\b(?:t|tr)\(\s*'([A-Za-z][\w.]*)'\s*,\s*\{\s*defaultValue:\s*'((?:[^'\\]|\\.)*)'/g

function getPath(obj, key) {
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key]
  let cur = obj
  for (const p of key.split('.')) {
    if (!cur || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, p)) return undefined
    cur = cur[p]
  }
  return cur
}

/** 소스만 보고 "ko 에서 빼도 되는" 키 후보와 그 기본값을 모은다(값 대조는 koDefaultOnlyKeys 가 한다). */
export function collectDefaultValueUses(root) {
  const literal = new Map()   // key → 소스에 그 문자열이 나온 횟수
  const dv = new Map()        // key → defaultValue 목록
  const prefixes = new Set()
  for (const f of walk(path.join(root, 'src'))) {
    if (/\/tests?\//.test(f)) continue
    const s = fs.readFileSync(f, 'utf-8')
    for (const m of s.matchAll(ANY_KEY_RE)) { const k = m[1]; if (k.endsWith('.')) prefixes.add(k.slice(0, -1)); else literal.set(k, (literal.get(k) || 0) + 1) }
    for (const m of s.matchAll(ANY_TEMPLATE_RE)) prefixes.add(m[1].replace(/\.$/, ''))
    for (const m of s.matchAll(DV_CALL_RE)) { const arr = dv.get(m[1]) || []; arr.push(m[2].replace(/\\'/g, "'")); dv.set(m[1], arr) }
  }
  return { literal, dv, prefixes }
}

/** ko 번역 객체와 소스 사용처로 "빼도 한국어가 같은" 키 목록을 낸다(순수 — 시험이 직접 부른다). */
export function koDefaultOnlyKeys(koObj, uses) {
  const out = []
  for (const [key, vals] of uses.dv) {
    if (!KO_DEFAULT_ONLY_NS.includes(key.split('.')[0])) continue
    if ((uses.literal.get(key) || 0) !== vals.length) continue
    const ko = getPath(koObj, key)
    if (typeof ko !== 'string' || vals.some((v) => v !== ko)) continue
    const parts = key.split('.')
    let blocked = uses.prefixes.has(key)
    for (let i = 1; i < parts.length && !blocked; i++) {
      const pre = parts.slice(0, i).join('.')
      if (uses.prefixes.has(pre) || uses.literal.has(pre)) blocked = true
    }
    if (!blocked) out.push(key)
  }
  return out
}

/** core 에서 그 키들을 떼어 rest 로 옮긴다(원본 불변). */
export function moveKeysToRest(parts, keys) {
  const core = JSON.parse(JSON.stringify(parts.core))
  const rest = JSON.parse(JSON.stringify(parts.rest))
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(core, key)) { rest[key] = core[key]; delete core[key]; continue }
    const ps = key.split('.')
    const chain = [core]
    for (const p of ps.slice(0, -1)) { const nxt = chain[chain.length - 1]?.[p]; if (!nxt || typeof nxt !== 'object') { chain.length = 0; break } chain.push(nxt) }
    if (!chain.length) continue
    const leafParent = chain[chain.length - 1]
    const leaf = ps[ps.length - 1]
    if (!Object.prototype.hasOwnProperty.call(leafParent, leaf)) continue
    let r = rest
    for (const p of ps.slice(0, -1)) { if (typeof r[p] !== 'object' || r[p] === null) r[p] = {}; r = r[p] }
    r[leaf] = leafParent[leaf]
    delete leafParent[leaf]
    for (let i = chain.length - 1; i > 0; i--) { if (Object.keys(chain[i]).length === 0) delete chain[i - 1][ps[i - 1]]; else break }
  }
  return { ...parts, core, rest }
}

/** Vite 플러그인 — `translation.json?i18n-core|dash` 를 나눠서 돌려준다(쿼리 없으면 그대로). */
export function i18nSplitPlugin(root) {
  let used = null
  let refs = null
  let dvUses = null
  return {
    name: 'i18n-split',
    enforce: 'pre',
    buildStart() { used = collectConsumerDashKeys(root); refs = collectReferencedKeys(root); dvUses = collectDefaultValueUses(root) },
    transform(code, id) {
      const m = id.match(/\/locales\/[a-z]{2}\/translation\.json\?i18n-(core|dash|rest)$/)
      if (!m) return null
      if (!used) used = collectConsumerDashKeys(root)
      if (!refs) refs = collectReferencedKeys(root)
      const obj = JSON.parse(code)
      let parts = splitTranslation(obj, used, refs)
      // 🌐 2026-11-02: 한국어만 — 소스 기본값과 같은 문장은 core 에서 뺀다(위 KO_DEFAULT_ONLY_NS 머리말).
      if (/\/locales\/ko\//.test(id) && m[1] !== 'dash') {
        if (!dvUses) dvUses = collectDefaultValueUses(root)
        parts = moveKeysToRest(parts, koDefaultOnlyKeys(obj, dvUses))
      }
      return { code: JSON.stringify(parts[m[1]]), map: null }
    },
  }
}
