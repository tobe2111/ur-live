/**
 * 🪶 http-client — axios 를 대신하는 작은 HTTP 클라이언트 〔2026-10-14〕
 *
 * 대표: *"대기업급으로 개선점 모두 찾아줘"* → *"모두 순서대로 진행"* — 4번 JS 다이어트의 첫 조각.
 * axios 는 모든 화면의 첫 페인트에 실리는 청크 중 가장 컸다(49.7KB raw · 약 17KB br). 그런데 이 앱이
 * 쓰는 것은 그 일부다 — 인스턴스·인터셉터·params·timeout·signal·responseType·validateStatus.
 *
 * ## 무엇을 지키는가 — axios 와 **같은 동작**
 * 호출부 수백 곳(`api.get(url, { params })` · `res.data` · `err.response?.status` · `err.code === 'ECONNABORTED'`)이
 * axios 의 모양에 기대고 있다. 그래서 새 API 를 만들지 않고 **같은 모양**을 재현한다:
 * - 전송은 **XHR** — axios 의 브라우저 기본 어댑터도 XHR 이다(쿠키·진행률·blob 이 그대로 같다).
 * - params 직렬화는 axios `buildURL` 과 **글자까지 같다** — 엣지 캐시 키와 cron 예열 키가 이 문자열이다.
 *   (`,`·`:`·`$` 는 그대로, 공백은 `+`, 배열은 `key[]=`, null/undefined 는 생략, Date 는 ISO)
 * - 요청 인터셉터는 **나중에 등록한 것이 먼저**(axios 와 같다) · 응답 인터셉터는 등록 순.
 * - 데이터가 없으면 Content-Type 을 지운다 · FormData 면 브라우저가 boundary 를 붙이게 지운다.
 * - 2xx 밖이면 reject — 에러는 `isAxiosError: true` · `response` · `config` · `code` 를 갖는다.
 *
 * ## 못 하는 것(이 앱이 안 쓰는 것)
 * transformRequest/transformResponse · paramsSerializer · proxy · XSRF 쿠키 자동 첨부(서버 CSRF 는 인터셉터가 붙인다).
 */

export type Method = 'get' | 'GET' | 'post' | 'POST' | 'put' | 'PUT' | 'patch' | 'PATCH' | 'delete' | 'DELETE' | 'head' | 'HEAD' | 'options' | 'OPTIONS'
export type ResponseType = 'json' | 'text' | 'blob' | 'arraybuffer' | 'document'
export type Headers = Record<string, any>

export interface ProgressEventLike { loaded: number; total?: number; progress?: number; lengthComputable: boolean }

export interface RequestConfig<D = any> {
  url?: string
  method?: Method | string
  baseURL?: string
  headers?: Headers
  params?: any
  data?: D
  timeout?: number
  withCredentials?: boolean
  responseType?: ResponseType
  signal?: AbortSignal | { aborted?: boolean; addEventListener?: (t: string, l: () => void) => void; removeEventListener?: (t: string, l: () => void) => void }
  validateStatus?: ((status: number) => boolean) | null
  onUploadProgress?: (e: ProgressEventLike) => void
  onDownloadProgress?: (e: ProgressEventLike) => void
  /** 인터셉터가 붙이는 자유 필드(_retry 등). */
  [k: string]: any
}
export type InternalRequestConfig<D = any> = RequestConfig<D> & { headers: Headers }

export interface HttpResponse<T = any, D = any> {
  data: T
  status: number
  statusText: string
  headers: Record<string, string>
  config: InternalRequestConfig<D>
  request?: any
}

export class HttpError<T = any, D = any> extends Error {
  readonly isAxiosError = true
  code?: string
  config?: InternalRequestConfig<D>
  request?: any
  response?: HttpResponse<T, D>
  status?: number
  constructor(message: string, code?: string, config?: InternalRequestConfig<D>, request?: any, response?: HttpResponse<T, D>) {
    super(message)
    this.name = 'AxiosError'
    this.code = code
    this.config = config
    this.request = request
    this.response = response
    this.status = response?.status
  }
  toJSON() {
    return { message: this.message, name: this.name, code: this.code, status: this.status }
  }
  static readonly ECONNABORTED = 'ECONNABORTED'
  static readonly ERR_NETWORK = 'ERR_NETWORK'
  static readonly ERR_CANCELED = 'ERR_CANCELED'
  static readonly ERR_BAD_REQUEST = 'ERR_BAD_REQUEST'
  static readonly ERR_BAD_RESPONSE = 'ERR_BAD_RESPONSE'
}
/** 호출부 타입 호환용 별칭(`AxiosError<T>`). */
export type AxiosError<T = any, D = any> = HttpError<T, D>

export function isHttpError<T = any, D = any>(e: unknown): e is HttpError<T, D> {
  return !!e && typeof e === 'object' && (e as { isAxiosError?: unknown }).isAxiosError === true
}
export function isCancel(e: unknown): boolean {
  return isHttpError(e) && e.code === HttpError.ERR_CANCELED
}

// ── params 직렬화 — axios buildURL 과 글자까지 같다 ───────────────────────────
export function encodeParam(val: string): string {
  return encodeURIComponent(val)
    .replace(/%3A/gi, ':')
    .replace(/%24/g, '$')
    .replace(/%2C/gi, ',')
    .replace(/%20/g, '+')
}
const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype
const isVisitable = (v: unknown) => isPlainObject(v) || Array.isArray(v)
const convertValue = (v: unknown): string => {
  if (v === null) return ''
  if (v instanceof Date) return v.toISOString()
  return String(v)
}

export function serializeParams(params: unknown): string {
  if (!params) return ''
  if (typeof URLSearchParams !== 'undefined' && params instanceof URLSearchParams) return params.toString()
  const pairs: Array<[string, string]> = []
  const visit = (value: unknown, path: string[] | null, key: string) => {
    if (value && !path && typeof value === 'object') {
      if (key.endsWith('{}')) { pairs.push([key, JSON.stringify(value)]); return }
      const arr = value as unknown[]
      if (Array.isArray(arr) && !arr.some(isVisitable)) {
        const k = key.endsWith('[]') ? key.slice(0, -2) : key
        for (const el of arr) if (!(el === undefined || el === null)) pairs.push([k + '[]', convertValue(el)])
        return
      }
    }
    if (isVisitable(value)) {
      const next = path ? [...path, key] : [key]
      for (const [k, el] of Object.entries(value as Record<string, unknown>)) {
        if (el === undefined || el === null) continue
        visit(el, next, k)
      }
      return
    }
    const name = path ? path.concat(key).map((t, i) => (i ? `[${t}]` : t)).join('') : key
    pairs.push([name, convertValue(value)])
  }
  if (!isPlainObject(params)) return ''
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    visit(v, null, k)
  }
  return pairs.map(([k, v]) => encodeParam(k) + '=' + encodeParam(v)).join('&')
}

export function buildURL(url: string, params?: unknown): string {
  const s = serializeParams(params)
  if (!s) return url
  const hash = url.indexOf('#')
  const base = hash === -1 ? url : url.slice(0, hash)
  return base + (base.indexOf('?') === -1 ? '?' : '&') + s
}

export function combineURL(baseURL: string | undefined, url: string): string {
  if (!baseURL || /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url)) return url
  return url ? baseURL.replace(/\/?\/$/, '') + '/' + url.replace(/^\/+/, '') : baseURL
}

function parseHeaders(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of raw.split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i <= 0) continue
    const k = line.slice(0, i).trim().toLowerCase()
    const v = line.slice(i + 1).trim()
    if (!k) continue
    out[k] = k in out ? (k === 'set-cookie' ? `${out[k]}, ${v}` : `${out[k]}, ${v}`) : v
  }
  return out
}

const findHeader = (h: Headers, name: string) => Object.keys(h).find(k => k.toLowerCase() === name.toLowerCase())
function deleteHeader(h: Headers, name: string) {
  for (const k of Object.keys(h)) if (k.toLowerCase() === name.toLowerCase()) delete h[k]
}

// ── 전송 ─────────────────────────────────────────────────────────────────
function dispatch(config: InternalRequestConfig): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const method = String(config.method || 'get').toUpperCase()
    const headers: Headers = { ...config.headers }
    let body: any = config.data
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData
    if (body === undefined) deleteHeader(headers, 'Content-Type')
    else if (isForm) deleteHeader(headers, 'Content-Type')
    else if (body !== null && typeof body === 'object'
      && !(typeof Blob !== 'undefined' && body instanceof Blob)
      && !(typeof ArrayBuffer !== 'undefined' && (body instanceof ArrayBuffer || ArrayBuffer.isView(body)))
      && !(typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams)) {
      body = JSON.stringify(body)
      if (!findHeader(headers, 'Content-Type')) headers['Content-Type'] = 'application/json'
    } else if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
      if (!findHeader(headers, 'Content-Type')) headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8'
      body = body.toString()
    }

    const fullUrl = buildURL(combineURL(config.baseURL, config.url || ''), config.params)
    const xhr = new XMLHttpRequest()
    xhr.open(method, fullUrl, true)
    xhr.timeout = config.timeout || 0
    if (config.withCredentials) xhr.withCredentials = true
    const rt = config.responseType
    if (rt && rt !== 'json') xhr.responseType = rt
    for (const [k, v] of Object.entries(headers)) {
      if (v === undefined || v === null || v === false) continue
      xhr.setRequestHeader(k, String(v))
    }

    let done = false
    const signal = config.signal
    const onAbort = () => {
      if (done) return
      done = true
      xhr.abort()
      reject(new HttpError('canceled', HttpError.ERR_CANCELED, config, xhr))
    }
    const cleanup = () => { done = true; signal?.removeEventListener?.('abort', onAbort) }
    if (signal) {
      if (signal.aborted) { reject(new HttpError('canceled', HttpError.ERR_CANCELED, config, xhr)); return }
      signal.addEventListener?.('abort', onAbort)
    }

    xhr.onload = () => {
      if (done) return
      cleanup()
      let data: any = !rt || rt === 'text' || rt === 'json' ? xhr.responseText : xhr.response
      if ((!rt || rt === 'json') && typeof data === 'string' && data) {
        try { data = JSON.parse(data) } catch { /* axios 와 같다 — 파싱 실패면 문자열 그대로 */ }
      } else if ((!rt || rt === 'json') && data === '') {
        data = ''
      }
      const response: HttpResponse = {
        data, status: xhr.status, statusText: xhr.statusText,
        headers: parseHeaders(xhr.getAllResponseHeaders() || ''), config, request: xhr,
      }
      const validate = config.validateStatus
      if (!response.status || !validate || validate(response.status)) resolve(response)
      else {
        const code = Math.floor(response.status / 100) === 4 ? HttpError.ERR_BAD_REQUEST : HttpError.ERR_BAD_RESPONSE
        reject(new HttpError(`Request failed with status code ${response.status}`, code, config, xhr, response))
      }
    }
    xhr.onerror = () => {
      if (done) return
      cleanup()
      reject(new HttpError('Network Error', HttpError.ERR_NETWORK, config, xhr))
    }
    xhr.ontimeout = () => {
      if (done) return
      cleanup()
      reject(new HttpError(`timeout of ${config.timeout}ms exceeded`, HttpError.ECONNABORTED, config, xhr))
    }
    xhr.onabort = () => {
      if (done) return
      cleanup()
      reject(new HttpError('Request aborted', HttpError.ECONNABORTED, config, xhr))
    }
    const prog = (cb?: (e: ProgressEventLike) => void) => cb && ((e: ProgressEvent) =>
      cb({ loaded: e.loaded, total: e.lengthComputable ? e.total : undefined, progress: e.lengthComputable && e.total ? e.loaded / e.total : undefined, lengthComputable: e.lengthComputable }))
    const up = prog(config.onUploadProgress)
    if (up && xhr.upload) xhr.upload.addEventListener('progress', up)
    const down = prog(config.onDownloadProgress)
    if (down) xhr.addEventListener('progress', down)

    xhr.send(body === undefined ? null : body)
  })
}

// ── 인스턴스 ──────────────────────────────────────────────────────────────
type Fulfilled<V> = ((v: V) => V | Promise<V>) | null | undefined
type Rejected = ((e: any) => any) | null | undefined
class InterceptorManager<V> {
  handlers: Array<{ fulfilled: Fulfilled<V>; rejected: Rejected } | null> = []
  use(fulfilled?: Fulfilled<V>, rejected?: Rejected): number {
    this.handlers.push({ fulfilled, rejected })
    return this.handlers.length - 1
  }
  eject(id: number) { if (this.handlers[id]) this.handlers[id] = null }
  clear() { this.handlers = [] }
}

const DEFAULTS: RequestConfig = {
  timeout: 0,
  headers: { Accept: 'application/json, text/plain, */*' },
  validateStatus: (s: number) => s >= 200 && s < 300,
}

function mergeConfig(a: RequestConfig, b: RequestConfig): InternalRequestConfig {
  const out: InternalRequestConfig = { ...a, ...b, headers: { ...(a.headers || {}) } }
  for (const [k, v] of Object.entries(b.headers || {})) {
    deleteHeader(out.headers, k)
    out.headers[k] = v
  }
  return out
}

export interface HttpInstance {
  <T = any, R = HttpResponse<T>, D = any>(config: RequestConfig<D>): Promise<R>
  <T = any, R = HttpResponse<T>, D = any>(url: string, config?: RequestConfig<D>): Promise<R>
  defaults: RequestConfig
  interceptors: { request: InterceptorManager<InternalRequestConfig>; response: InterceptorManager<HttpResponse> }
  request<T = any, R = HttpResponse<T>, D = any>(config: RequestConfig<D>): Promise<R>
  get<T = any, R = HttpResponse<T>, D = any>(url: string, config?: RequestConfig<D>): Promise<R>
  delete<T = any, R = HttpResponse<T>, D = any>(url: string, config?: RequestConfig<D>): Promise<R>
  head<T = any, R = HttpResponse<T>, D = any>(url: string, config?: RequestConfig<D>): Promise<R>
  options<T = any, R = HttpResponse<T>, D = any>(url: string, config?: RequestConfig<D>): Promise<R>
  post<T = any, R = HttpResponse<T>, D = any>(url: string, data?: D, config?: RequestConfig<D>): Promise<R>
  put<T = any, R = HttpResponse<T>, D = any>(url: string, data?: D, config?: RequestConfig<D>): Promise<R>
  patch<T = any, R = HttpResponse<T>, D = any>(url: string, data?: D, config?: RequestConfig<D>): Promise<R>
}

export function createHttp(instanceDefaults: RequestConfig = {}): HttpInstance {
  const defaults = mergeConfig(DEFAULTS, instanceDefaults)
  const interceptors = {
    request: new InterceptorManager<InternalRequestConfig>(),
    response: new InterceptorManager<HttpResponse>(),
  }
  const request = (configOrUrl: string | RequestConfig, maybe?: RequestConfig): Promise<any> => {
    const cfg: RequestConfig = typeof configOrUrl === 'string' ? { ...(maybe || {}), url: configOrUrl } : (configOrUrl || {})
    const config = mergeConfig(instance.defaults, cfg)
    config.method = String(config.method || 'get').toLowerCase()
    // axios 와 같은 사슬: [요청 인터셉터(역순)…, 전송, 응답 인터셉터(등록순)…]
    const chain: Array<[Fulfilled<any>, Rejected]> = []
    for (const h of interceptors.request.handlers) if (h) chain.unshift([h.fulfilled, h.rejected])
    chain.push([dispatch as Fulfilled<any>, undefined])
    for (const h of interceptors.response.handlers) if (h) chain.push([h.fulfilled, h.rejected])
    let p: Promise<any> = Promise.resolve(config)
    for (const [f, r] of chain) p = p.then(f || undefined, r || undefined)
    return p
  }
  const instance = request as unknown as HttpInstance
  instance.defaults = defaults
  instance.interceptors = interceptors
  instance.request = (c) => request(c)
  for (const m of ['get', 'delete', 'head', 'options'] as const) {
    (instance as any)[m] = (url: string, c?: RequestConfig) => request({ ...(c || {}), method: m, url, data: c?.data })
  }
  for (const m of ['post', 'put', 'patch'] as const) {
    (instance as any)[m] = (url: string, data?: unknown, c?: RequestConfig) => request({ ...(c || {}), method: m, url, data })
  }
  return instance
}

/** 인터셉터 없는 기본 인스턴스(옛 `axios.get/post` 자리). */
export const http = createHttp()
