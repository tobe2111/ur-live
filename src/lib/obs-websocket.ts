/**
 * obs-websocket v5 client (Direct WS 또는 Chrome Extension proxy)
 *
 * OBS Studio 28+ 는 obs-websocket v5 를 기본 내장.
 * 셀러가 OBS → Tools → WebSocket Server Settings → Enable + password 설정.
 *
 * HTTPS 프로덕션에서는 ws://localhost 직접 연결이 Mixed Content 차단됨.
 * → Chrome Extension 설치된 경우 postMessage 프록시로 우회.
 * → 미설치 / HTTP 로컬 개발: 직접 WebSocket 연결.
 */

export interface OBSConnectConfig {
  host: string
  port: number
  password?: string
}

export interface OBSStatus {
  outputActive: boolean
  outputTimecode?: string
  outputBytes?: number
  outputCongestion?: number
  outputSkippedFrames?: number
  outputTotalFrames?: number
  currentScene?: string
  sceneList?: string[]
  previewImage?: string // data URL from GetSourceScreenshot
}

type EventHandler = (status: Partial<OBSStatus>) => void

const OP = {
  Hello: 0,
  Identify: 1,
  Identified: 2,
  Event: 5,
  Request: 6,
  RequestResponse: 7,
}

// ── Extension 감지 ──────────────────────────────────────────────
let extensionDetected = false
if (typeof window !== 'undefined') {
  window.addEventListener('ur-live-extension-ready', () => { extensionDetected = true })
}
export function hasOBSExtension(): boolean { return extensionDetected }

// ── Transport 추상화 ───────────────────────────────────────────
interface Transport {
  waitReady(): Promise<boolean>
  send(data: string): void
  close(): void
  onMessage(h: (data: string) => void): void
  onClose(h: () => void): void
}

class DirectWSTransport implements Transport {
  private ws: WebSocket
  private readyPromise: Promise<boolean>
  constructor(url: string) {
    this.ws = new WebSocket(url)
    this.readyPromise = new Promise(resolve => {
      this.ws.onopen = () => resolve(true)
      this.ws.onerror = () => resolve(false)
      this.ws.onclose = () => {} // handled by onClose
    })
  }
  waitReady() { return this.readyPromise }
  send(data: string) { try { this.ws.send(data) } catch { /* ignore */ } }
  close() { try { this.ws.close() } catch { /* ignore */ } }
  onMessage(h: (data: string) => void) { this.ws.onmessage = (e) => h(e.data) }
  onClose(h: () => void) {
    const prev = this.ws.onclose
    this.ws.onclose = (e) => { prev?.call(this.ws, e); h() }
  }
}

class ExtensionTransport implements Transport {
  private msgHandler: ((data: string) => void) | null = null
  private closeHandler: (() => void) | null = null
  private readyPromise: Promise<boolean>
  private listener = (ev: MessageEvent) => {
    if (ev.source !== window) return
    const d = ev.data
    if (!d?.__urlive) return
    if (d.type === 'OBS_MESSAGE') this.msgHandler?.(d.data)
    else if (d.type === 'OBS_CLOSED') this.closeHandler?.()
  }
  constructor(host: string, port: number) {
    window.addEventListener('message', this.listener)
    window.postMessage({ __urlive: true, type: 'OBS_CONNECT', host, port }, '*')
    this.readyPromise = new Promise(resolve => {
      const onResult = (ev: MessageEvent) => {
        if (ev.source !== window) return
        const d = ev.data
        if (d?.__urlive && d.type === 'OBS_CONNECT_RESULT') {
          window.removeEventListener('message', onResult)
          resolve(!!d.resp?.ok)
        }
      }
      window.addEventListener('message', onResult)
      setTimeout(() => {
        window.removeEventListener('message', onResult)
        resolve(false)
      }, 5000)
    })
  }
  waitReady() { return this.readyPromise }
  send(data: string) {
    window.postMessage({ __urlive: true, type: 'OBS_SEND', payload: data }, '*')
  }
  close() {
    window.postMessage({ __urlive: true, type: 'OBS_DISCONNECT' }, '*')
    window.removeEventListener('message', this.listener)
  }
  onMessage(h: (data: string) => void) { this.msgHandler = h }
  onClose(h: () => void) { this.closeHandler = h }
}

// ── OBS Client ─────────────────────────────────────────────────
export class OBSWebSocketClient {
  private transport: Transport | null = null
  private statusHandlers: EventHandler[] = []
  private requestSeq = 0
  private pendingRequests = new Map<string, (resp: any) => void>()
  private authenticated = false
  private connectionResolver: ((ok: boolean) => void) | null = null
  private status: OBSStatus = { outputActive: false }
  private statsTimer: ReturnType<typeof setInterval> | null = null
  private helloConfig: OBSConnectConfig | null = null
  private usingExtension = false

  get viaExtension(): boolean { return this.usingExtension }
  get isConnected(): boolean { return this.authenticated }

  onStatusChange(h: EventHandler): () => void {
    this.statusHandlers.push(h)
    return () => { this.statusHandlers = this.statusHandlers.filter(x => x !== h) }
  }

  private emit() {
    this.statusHandlers.forEach(h => h({ ...this.status }))
  }

  async connect(config: OBSConnectConfig): Promise<boolean> {
    this.helloConfig = config
    // HTTPS + Extension → Extension 경유, 아니면 직접
    const useExt = extensionDetected && typeof window !== 'undefined' &&
      window.location.protocol === 'https:'
    this.usingExtension = useExt

    return new Promise(resolve => {
      this.connectionResolver = resolve
      const transport = useExt
        ? new ExtensionTransport(config.host, config.port)
        : new DirectWSTransport(`ws://${config.host}:${config.port}`)
      this.transport = transport

      // 10s 연결 타임아웃 — OBS 미실행 시 infinite wait 방지
      const connectTimer = setTimeout(() => {
        if (this.connectionResolver) {
          this.connectionResolver(false)
          this.connectionResolver = null
          try { transport.close() } catch { /* ignore */ }
        }
      }, 10000)

      transport.onMessage(async (raw) => {
        let msg: any
        try { msg = JSON.parse(raw) } catch { return }
        await this.handleMessage(msg)
      })
      transport.onClose(() => {
        clearTimeout(connectTimer)
        this.authenticated = false
        if (this.statsTimer) { clearInterval(this.statsTimer); this.statsTimer = null }
        if (this.connectionResolver) { this.connectionResolver(false); this.connectionResolver = null }
      })

      transport.waitReady().then(ready => {
        if (!ready && this.connectionResolver) {
          clearTimeout(connectTimer)
          this.connectionResolver(false); this.connectionResolver = null
        }
        // Hello 응답은 ready 후 바로 서버가 쏴줌 → handleMessage 가 처리
      })

      // Identified 수신 시 타이머 해제 (handleMessage → connectionResolver(true) 호출 전)
      const origResolver = this.connectionResolver
      this.connectionResolver = (ok) => { clearTimeout(connectTimer); origResolver?.(ok) }
    })
  }

  private async handleMessage(msg: any) {
    if (msg.op === OP.Hello) {
      const auth = msg.d.authentication
      const identify: any = { rpcVersion: 1, eventSubscriptions: 0xFFFF }
      if (auth && this.helloConfig?.password) {
        const secret = await sha256Base64(this.helloConfig.password + auth.salt)
        identify.authentication = await sha256Base64(secret + auth.challenge)
      }
      this.transport?.send(JSON.stringify({ op: OP.Identify, d: identify }))
    } else if (msg.op === OP.Identified) {
      this.authenticated = true
      this.connectionResolver?.(true)
      this.connectionResolver = null
      await this.refreshStatus()
      if (this.statsTimer) clearInterval(this.statsTimer)
      this.statsTimer = setInterval(() => {
        if (this.authenticated) this.refreshStatus().catch(() => { /* silent */ })
      }, 2000)
    } else if (msg.op === OP.Event) {
      const type = msg.d.eventType
      const data = msg.d.eventData
      if (type === 'StreamStateChanged') {
        this.status.outputActive = data.outputActive
        this.emit()
      } else if (type === 'CurrentProgramSceneChanged') {
        this.status.currentScene = data.sceneName
        this.emit()
      }
    } else if (msg.op === OP.RequestResponse) {
      const cb = this.pendingRequests.get(msg.d.requestId)
      if (cb) { this.pendingRequests.delete(msg.d.requestId); cb(msg.d) }
    }
  }

  disconnect() {
    try { this.transport?.close() } catch { /* ignore */ }
    this.transport = null
    this.authenticated = false
    if (this.statsTimer) { clearInterval(this.statsTimer); this.statsTimer = null }
  }

  private request<T = any>(type: string, data?: any): Promise<T | null> {
    if (!this.transport || !this.authenticated) return Promise.resolve(null)
    const requestId = `req-${++this.requestSeq}`
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId)
          resolve(null)
        }
      }, 5000)
      this.pendingRequests.set(requestId, (resp) => {
        clearTimeout(timer)
        if (resp.requestStatus?.result) resolve(resp.responseData as T)
        else resolve(null)
      })
      this.transport?.send(JSON.stringify({
        op: OP.Request,
        d: { requestType: type, requestId, requestData: data || {} }
      }))
    })
  }

  async refreshStatus() {
    const [streamStatus, sceneList, currentScene] = await Promise.all([
      this.request<{ outputActive: boolean; outputTimecode?: string; outputBytes?: number; outputCongestion?: number; outputSkippedFrames?: number; outputTotalFrames?: number }>('GetStreamStatus'),
      this.request<{ scenes: { sceneName: string }[] }>('GetSceneList'),
      this.request<{ currentProgramSceneName: string }>('GetCurrentProgramScene'),
    ])
    if (streamStatus) {
      this.status.outputActive = streamStatus.outputActive
      this.status.outputTimecode = streamStatus.outputTimecode
      this.status.outputBytes = streamStatus.outputBytes
      this.status.outputCongestion = streamStatus.outputCongestion
      this.status.outputSkippedFrames = streamStatus.outputSkippedFrames
      this.status.outputTotalFrames = streamStatus.outputTotalFrames
    }
    if (sceneList) this.status.sceneList = sceneList.scenes.map(s => s.sceneName)
    if (currentScene) this.status.currentScene = currentScene.currentProgramSceneName
    this.emit()
  }

  /** 현재 프로그램 씬 스크린샷 (data URL). 없으면 null. */
  async getPreviewScreenshot(): Promise<string | null> {
    if (!this.status.currentScene) return null
    const resp = await this.request<{ imageData: string }>('GetSourceScreenshot', {
      sourceName: this.status.currentScene,
      imageFormat: 'jpeg',
      imageWidth: 320,
      imageCompressionQuality: 60,
    })
    return resp?.imageData || null
  }

  async setRtmpTarget(rtmpUrl: string, rtmpKey: string) {
    await this.request('SetStreamServiceSettings', {
      streamServiceType: 'rtmp_custom',
      streamServiceSettings: { server: rtmpUrl, key: rtmpKey }
    })
  }

  async startStreaming() { await this.request('StartStream') }
  async stopStreaming() { await this.request('StopStream') }
  async switchScene(sceneName: string) {
    await this.request('SetCurrentProgramScene', { sceneName })
  }
}

// WebCrypto SHA-256 → base64
async function sha256Base64(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', enc)
  const bytes = new Uint8Array(hash)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

// ── localStorage config 저장/복원 ──────────────────────────────
const OBS_CONFIG_KEY = 'seller_obs_config'
export function saveOBSConfig(c: OBSConnectConfig) {
  try { localStorage.setItem(OBS_CONFIG_KEY, JSON.stringify(c)) } catch { /* ignore */ }
}
export function loadOBSConfig(): OBSConnectConfig | null {
  try {
    const v = localStorage.getItem(OBS_CONFIG_KEY)
    return v ? JSON.parse(v) : null
  } catch { return null }
}
export function clearOBSConfig() {
  try { localStorage.removeItem(OBS_CONFIG_KEY) } catch { /* ignore */ }
}
