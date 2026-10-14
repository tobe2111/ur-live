/**
 * 🌐 i18n-lite — i18next + react-i18next 대신 쓰는 작은 번역 엔진 〔2026-10-14〕
 *
 * 왜: 첫 화면이 받는 JS 중 `i18n` 청크가 **18.2 KB br**(62.5 KB raw)였다. 그런데 이 앱이 i18next 에서
 * 쓰는 기능은 몇 개뿐이다 — 복수형 키 0 · 서식(`{{x, number}}`) 0 · 중첩(`$t(`) 0 · 네임스페이스 하나 ·
 * 감지기는 `src/i18n.ts` 가 직접 한다. 나머지는 전부 첫 페인트에 실려 오기만 했다.
 *
 * 그래서 **쓰는 동작만** 옮겼다. 원칙은 axios 교체(`http-client.ts`)와 같다 — 동작은 **원본이 낸 값**에
 * 맞춘다(테스트가 i18next 25.8.20 실측값을 그대로 박아 대조한다).
 *   · 키 찾기   — i18next `deepFind` 그대로(평평한 `"cancelOrder.title"` 키 129개가 있다)
 *   · 순서      — 현재 언어 → fallbackLng → defaultValue → 키 이름. 빈 문자열('')은 "찾음"이다
 *   · 끼워넣기  — `{{ x }}`(공백 무시) · 값이 null 이면 '' · 안 넘긴 변수는 `{{x}}` 그대로 둔다
 *                 (i18next skipOnVariables 기본값) · 넘겼는데 undefined 면 ''
 *   · 후처리기  — `postProcess` 에 이름을 적은 것만
 *   · 빠진 키   — `saveMissing` + `missingKeyHandler`(대시보드 문구 안전망이 쓴다)
 *   · React     — `useTranslation()` 은 언어가 바뀌거나 문구가 더해지면('added') 다시 그린다.
 *                 그때마다 `t` 의 정체성도 바뀐다(react-i18next 와 같다 — `[t]` 의존 effect 동작 불변).
 *
 * ⚠️ 없는 것(쓰는 곳이 없다): 복수형 · 서식 · 중첩 · context · returnObjects · 여러 네임스페이스 · Suspense.
 *   쓰게 되면 **여기에 원본과 같은 동작으로** 넣고 테스트에 실측값을 더할 것.
 */
import { createElement, cloneElement, isValidElement, Fragment, useCallback, useMemo, useRef, useSyncExternalStore, type ReactElement, type ReactNode } from 'react'

type Dict = Record<string, unknown>
export type TOptions = Dict & { defaultValue?: string; lng?: string }
export type TFunction = (key: string, optionsOrDefault?: TOptions | string, maybeOptions?: TOptions) => string

type PostProcessor = { type: 'postProcessor'; name: string; process: (value: string, key: string, options: TOptions) => string }
type Listener = (...args: unknown[]) => void

export type InitOptions = {
  lng?: string
  fallbackLng?: string
  resources?: Record<string, { translation: Dict }>
  saveMissing?: boolean
  missingKeyHandler?: (lngs: readonly string[], ns: string, key: string, fallbackValue: string) => void
  postProcess?: string[]
  /** 받아들이기만 한다 — i18next 설정과 모양을 맞추려고(쓰지 않는 값). */
  [k: string]: unknown
}

const STORAGE_KEY = 'i18nextLng'

/** i18next `deepFind` 그대로 — 점이 든 평평한 키와 중첩 키를 같이 찾는다. */
export function deepFind(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined
  const o = obj as Dict
  if (o[path]) {
    if (!Object.prototype.hasOwnProperty.call(o, path)) return undefined
    return o[path]
  }
  const tokens = path.split('.')
  let current: unknown = o
  for (let i = 0; i < tokens.length;) {
    if (!current || typeof current !== 'object') return undefined
    let next: unknown
    let nextPath = ''
    for (let j = i; j < tokens.length; ++j) {
      if (j !== i) nextPath += '.'
      nextPath += tokens[j]
      next = (current as Dict)[nextPath]
      if (next !== undefined) {
        if (['string', 'number', 'boolean'].includes(typeof next) && j < tokens.length - 1) continue
        i += j - i + 1
        break
      }
    }
    current = next
  }
  return current
}

/** `{{ x }}` 끼워넣기 — i18next Interpolator(escapeValue:false · skipOnVariables:true)와 같은 결과. */
export function interpolate(str: string, data: Dict | undefined): string {
  if (!data || str.indexOf('{{') < 0) return str
  return str.replace(/\{\{(.+?)\}\}/g, (whole, raw: string) => {
    const name = raw.trim()
    const v = deepFind(data, name)
    if (v === undefined) return Object.prototype.hasOwnProperty.call(data, name) ? '' : whole
    return v == null ? '' : String(v)
  })
}

function deepMerge(target: Dict, source: Dict, overwrite: boolean): Dict {
  for (const k of Object.keys(source)) {
    const s = source[k]
    const t = target[k]
    if (s && typeof s === 'object' && !Array.isArray(s) && t && typeof t === 'object' && !Array.isArray(t)) {
      deepMerge(t as Dict, s as Dict, overwrite)
    } else if (overwrite || !(k in target)) {
      target[k] = s && typeof s === 'object' && !Array.isArray(s) ? deepMerge({}, s as Dict, true) : s
    }
  }
  return target
}

export class I18nLite {
  language = 'ko'
  isInitialized = false
  options: InitOptions = {}
  private data: Record<string, Dict> = {}
  private listeners = new Map<string, Set<Listener>>()
  private processors = new Map<string, PostProcessor>()

  /** react-i18next 가 `i18n.store.on('added')` 로 구독하던 자리 — 같은 이벤트를 인스턴스에서 낸다. */
  readonly store = { on: (e: string, f: Listener) => this.on(e, f), off: (e: string, f: Listener) => this.off(e, f) }

  use(mod: unknown): this {
    const m = mod as Partial<PostProcessor> | undefined
    if (m && m.type === 'postProcessor' && m.name && m.process) this.processors.set(m.name, m as PostProcessor)
    return this
  }

  async init(options: InitOptions): Promise<TFunction> {
    this.options = options
    for (const [lng, bundle] of Object.entries(options.resources || {})) {
      this.data[lng] = deepMerge(this.data[lng] || {}, bundle.translation || {}, true)
    }
    this.isInitialized = true
    await this.changeLanguage(options.lng || this.language)
    this.emit('initialized', options)
    return this.t
  }

  get resolvedLanguage(): string { return this.language }
  get languages(): string[] {
    const fb = this.options.fallbackLng
    return fb && fb !== this.language ? [this.language, fb] : [this.language]
  }

  async changeLanguage(lng?: string): Promise<TFunction> {
    if (lng && lng !== this.language) {
      this.language = lng
      this.emit('languageChanged', lng)
    }
    try { if (lng && typeof window !== 'undefined') window.localStorage?.setItem(STORAGE_KEY, lng) } catch { /* 저장소 막힘 — 무시 */ }
    return this.t
  }

  addResourceBundle(lng: string, _ns: string, resources: Dict, deep = false, overwrite = false): this {
    const cur = this.data[lng] || (this.data[lng] = {})
    if (deep) deepMerge(cur, resources, overwrite)
    else for (const k of Object.keys(resources)) if (overwrite || !(k in cur)) cur[k] = resources[k]
    this.emit('added', lng, 'translation')
    return this
  }

  hasResourceBundle(lng: string): boolean { return !!this.data[lng] }

  exists(key: string, opts?: TOptions): boolean {
    return this.lookup(key, opts?.lng) !== undefined
  }

  private lookup(key: string, lng?: string): unknown {
    const order = lng ? [lng, ...this.languages.filter((l) => l !== lng)] : this.languages
    for (const l of order) {
      const v = deepFind(this.data[l], key)
      if (v !== undefined) return v
    }
    return undefined
  }

  /** 인스턴스에 묶인 `t` — 떼어서 넘겨도 동작한다. */
  t: TFunction = (key, optionsOrDefault, maybeOptions) => {
    let opts: TOptions
    if (typeof optionsOrDefault === 'string') opts = { ...(maybeOptions || {}), defaultValue: optionsOrDefault }
    else opts = optionsOrDefault || {}

    const found = this.lookup(key, opts.lng)
    let res: string
    if (found !== undefined && found !== null && typeof found === 'object') {
      res = `key '${key} (${opts.lng || this.language})' returned an object instead of string.`
    } else if (found !== undefined) {
      res = interpolate(String(found ?? ''), opts)
    } else {
      if (this.options.saveMissing && this.options.missingKeyHandler) {
        try { this.options.missingKeyHandler(this.languages, 'translation', key, opts.defaultValue ?? key) } catch { /* 안전망 실패는 번역을 막지 않는다 */ }
      }
      res = opts.defaultValue !== undefined ? interpolate(opts.defaultValue, opts) : key
    }
    for (const name of this.options.postProcess || []) {
      const p = this.processors.get(name)
      if (p) res = p.process(res, key, opts)
    }
    return res
  }

  getFixedT(): TFunction { return this.t }

  on(event: string, fn: Listener): this {
    for (const e of event.split(' ')) {
      let set = this.listeners.get(e)
      if (!set) this.listeners.set(e, (set = new Set()))
      set.add(fn)
    }
    return this
  }

  off(event: string, fn?: Listener): this {
    for (const e of event.split(' ')) {
      if (fn) this.listeners.get(e)?.delete(fn)
      else this.listeners.delete(e)
    }
    return this
  }

  private emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((f) => { try { f(...args) } catch { /* 구독자 오류는 격리 */ } })
  }
}

/** 앱 전체가 쓰는 인스턴스 하나 — `src/i18n.ts` 가 설정한다. */
export const i18n = new I18nLite()
export default i18n

// ── React ────────────────────────────────────────────────────────────────

/** react-i18next 의 `initReactI18next` 자리 — 하는 일이 없다(인스턴스가 이미 하나다). 모양만 맞춘다. */
export const initReactI18next = { type: '3rdParty' as const, init() {} }

type UseTranslationResult = { t: TFunction; i18n: I18nLite; ready: boolean } & [TFunction, I18nLite, boolean]

/**
 * 언어가 바뀌거나 문구가 더해지면 다시 그린다. `t` 는 그때마다 새 함수다(react-i18next 와 같다).
 * 인자(네임스페이스)는 받기만 한다 — 이 앱은 'translation' 하나뿐이다.
 */
export function useTranslation(_ns?: string | string[]): UseTranslationResult {
  const rev = useRef(0)
  const subscribe = useCallback((cb: () => void) => {
    const f = () => { rev.current += 1; cb() }
    i18n.on('languageChanged added', f)
    return () => { i18n.off('languageChanged', f); i18n.off('added', f) }
  }, [])
  const version = useSyncExternalStore(subscribe, () => rev.current, () => rev.current)
  return useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _v = version
    const t: TFunction = (k, o, m) => i18n.t(k, o, m)
    const out = [t, i18n, true] as unknown as UseTranslationResult
    out.t = t; out.i18n = i18n; out.ready = true
    return out
  }, [version])
}

/**
 * `<Trans i18nKey values components>` — 문구 안의 `<0>…</0>` · `<1/>` · `<1></1>` 를
 * `components[번호]` 로 바꿔 그린다(이 앱이 쓰는 모양 그대로). 번호 없는 태그는 글자로 둔다.
 */
export function Trans({ i18nKey, values, components = [], defaults }: {
  i18nKey: string
  values?: Dict
  components?: ReactElement[] | Record<string, ReactElement>
  defaults?: string
}): ReactElement {
  const { t } = useTranslation()
  const text = t(i18nKey, { ...(values || {}), ...(defaults !== undefined ? { defaultValue: defaults } : {}) })
  return createElement(Fragment, null, ...renderTagged(text, components as Record<string, ReactElement>))
}

const TAG = /<(\w+)\s*\/>|<(\w+)>([\s\S]*?)<\/\2>/

function renderTagged(text: string, comps: Record<string, ReactElement>): ReactNode[] {
  const out: ReactNode[] = []
  let rest = text
  let n = 0
  while (rest) {
    const m = TAG.exec(rest)
    if (!m) { out.push(rest); break }
    if (m.index > 0) out.push(rest.slice(0, m.index))
    const name = m[1] ?? m[2]
    const comp = comps[name]
    if (comp && isValidElement(comp)) {
      const inner = m[1] !== undefined ? [] : renderTagged(m[3], comps)
      out.push(cloneElement(comp, { key: `t${n++}` }, ...(inner.length ? inner : [])))
    } else {
      out.push(m[0])
    }
    rest = rest.slice(m.index + m[0].length)
  }
  return out
}
