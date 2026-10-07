// 🛡️ 2026-05-17: Sentry lazy load — 초기 번들에서 sentry 청크 제거.
//   PerformanceObserver 콜백 안에서만 호출되므로 첫 페인트 영향 없음.
//   import('@sentry/react') 의 promise 를 1회 캐싱.
type SentryModule = typeof import('@sentry/react')
let sentryPromise: Promise<SentryModule> | null = null
function getSentry(): Promise<SentryModule> {
  if (!sentryPromise) {
    sentryPromise = import('@sentry/react').catch((e) => {
      if (import.meta.env.DEV) console.warn('[perf-monitor] Sentry lazy load failed', e)
      throw e
    })
  }
  return sentryPromise
}
// fire-and-forget wrapper — 각 호출이 sentry chunk 도착 후 실행.
const Sentry = {
  addBreadcrumb: (b: Parameters<SentryModule['addBreadcrumb']>[0]) => {
    getSentry().then((S) => S.addBreadcrumb(b)).catch(() => {})
  },
  captureMessage: (msg: string, level?: any) => {
    getSentry().then((S) => S.captureMessage(msg, level)).catch(() => {})
  },
  captureException: (err: any, ctx?: any) => {
    getSentry().then((S) => S.captureException(err, ctx)).catch(() => {})
  },
}

/**
 * 성능 자동 추적 클래스
 */
export class PerformanceMonitor {
  /**
   * 페이지 로드 성능 추적
   */
  static trackPageLoad(pageName: string): void {
    if (typeof window === 'undefined' || !import.meta.env.PROD) {
      return
    }

    // 🔔 2026-10-07 — **경고는 페이지 로드당 한 번, 최종값으로** 보낸다.
    //
    // ## 종전(라이브 실측으로 드러난 것)
    // 네 지표 전부 `captureMessage` 를 **옵저버 콜백마다** 쏘고 있었다. 라이브 `/map` 한 번
    // 열었을 때 `Slow LCP on app: 3524ms` 와 `4140ms` 가 **둘 다** 갔다 — 같은 한 번의 로드다.
    // LCP 는 entry 마다, **CLS 는 레이아웃 시프트마다**(0.1 을 넘긴 뒤로는 시프트 하나하나가
    // 경고 1건), INP 는 배치마다 발화한다. 즉 느린 화면일수록 이슈 트래커가 같은 경고로 묻힌다
    // (게다가 중간값이라 **읽는 사람이 최종값보다 작은 숫자**를 보게 된다).
    //
    // ## 왜 이렇게 고쳤나
    // 형제 파일 `lib/web-vitals-report.ts` 가 **이미 올바른 모양**을 갖고 있었다 — 마지막 값만
    // 쓰고 `sent` 가드로 한 번만 보내고 옵저버를 끊는다. 그 주석이 근거까지 적어 뒀다:
    // *"LCP 는 첫 입력/스크롤 뒤 확정되므로 10초면 최종값이다"*, 그리고 카카오 인앱·사파리는
    // `visibilitychange→hidden` 이 **안 오므로** `pagehide` 와 10초 폴백이 함께 필요하다.
    // ⇒ 같은 지표를 두 벌로 보고하면서 한쪽만 올바른 상태였다. 그 모양을 여기로 가져온다.
    //
    // 🔵 **breadcrumb 은 그대로 entry 마다** 남긴다 — 그건 로컬에 쌓이는 추적 흔적이라
    //    중복이 비용이 아니고, 오히려 변화 과정을 보여 준다. 바뀐 것은 **보고(이슈 생성)** 뿐이다.
    //
    // 🔴 **방어는 한 겹이다** — `flushed` 가드 하나. 처음엔 여기에 `pending.clear()` 와
    //    `warnOnce` 안의 `!flushed` 까지 세 겹을 깔았는데, 그러면 **어느 한 줄도 자기가 무엇을
    //    막는지 증명할 수 없다**(한 겹을 빼도 나머지가 막아 변화가 안 보인다 — 주입 검증이
    //    "이 가드는 아무것도 안 지킨다" 로 잡아 줬다). 겹을 늘리는 것이 안전해 보이지만,
    //    실제로는 **어느 겹이 일하는지 모르는 상태**를 만든다. 한 겹으로 두고 시험이 그 한 겹을 잠근다.
    //    (flush 가 옵저버를 끊으므로 그 뒤로는 entry 자체가 안 들어온다 — 그게 두 번째 안전판이고
    //     ⑥ 이 그것을 따로 잠근다.)
    const pending = new Map<string, string>()
    const observers: PerformanceObserver[] = []
    let flushed = false
    const flush = () => {
      if (flushed) return
      flushed = true
      for (const msg of pending.values()) Sentry.captureMessage(msg, 'warning')
      for (const o of observers) { try { o.disconnect() } catch { /* 이미 끊김 */ } }
    }
    // 같은 키는 **덮어쓴다** → 지표마다 최종값 1건.
    const warnOnce = (key: string, msg: string) => { pending.set(key, msg) }
    // `visibilitychange` 가 안 오는 환경(카카오 인앱·사파리) 때문에 셋 다 걸어 둔다.
    window.addEventListener('pagehide', flush, { once: true })
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })
    window.setTimeout(flush, 10000)

    // LCP (Largest Contentful Paint) 추적
    const lcpObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const lcp = entry as PerformanceEntry & { renderTime: number }

        Sentry.addBreadcrumb({
          category: 'performance',
          message: `LCP: ${lcp.renderTime}ms`,
          data: { page: pageName },
          level: 'info',
        })

        // 2.5초 초과 시 경고 (최종값 1건 — 위 flush 가 보낸다)
        if (lcp.renderTime > 2500) {
          warnOnce('lcp', `Slow LCP on ${pageName}: ${lcp.renderTime}ms`)
        }
      }
    })

    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
    observers.push(lcpObserver)

    // FID (First Input Delay) 추적
    const fidObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const fid = entry as PerformanceEventTiming

        Sentry.addBreadcrumb({
          category: 'performance',
          message: `FID: ${fid.processingStart - fid.startTime}ms`,
          data: { page: pageName },
          level: 'info',
        })

        // 100ms 초과 시 경고 (명세상 1회지만 같은 길로 보낸다)
        if (fid.processingStart - fid.startTime > 100) {
          warnOnce('fid', `Slow FID on ${pageName}: ${fid.processingStart - fid.startTime}ms`)
        }
      }
    })

    fidObserver.observe({ entryTypes: ['first-input'] })
    observers.push(fidObserver)

    // 🛡️ 2026-04-30: INP (Interaction to Next Paint) 추적 — Google 2024+ 권장 (FID 대체).
    // 모든 사용자 interaction 의 응답 지연 측정. p98 가 200ms 이하 권장.
    try {
      let inpMax = 0
      const inpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const event = entry as PerformanceEventTiming
          // duration = (paint - input) — 사용자 입력 후 다음 paint 까지
          const inp = event.duration
          if (inp > inpMax) inpMax = inp
        }
        Sentry.addBreadcrumb({
          category: 'performance',
          message: `INP (max so far): ${Math.round(inpMax)}ms`,
          data: { page: pageName },
          level: 'info',
        })
        // 200ms 초과 시 경고 (Google "Poor") — 종전엔 상호작용마다 다시 갔다
        if (inpMax > 200) {
          warnOnce('inp', `Slow INP on ${pageName}: ${Math.round(inpMax)}ms`)
        }
      })
      inpObserver.observe({ type: 'event', buffered: true, durationThreshold: 40 } as PerformanceObserverInit)
      observers.push(inpObserver)
    } catch { /* 일부 구형 브라우저 미지원 — silent skip */ }

    // CLS (Cumulative Layout Shift) 추적
    let clsValue = 0
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const cls = entry as PerformanceEntry & { value: number; hadRecentInput: boolean }

        if (!cls.hadRecentInput) {
          clsValue += cls.value
        }
      }

      Sentry.addBreadcrumb({
        category: 'performance',
        message: `CLS: ${clsValue}`,
        data: { page: pageName },
        level: 'info',
      })

      // 0.1 초과 시 경고 — 종전엔 **시프트 하나하나가** 1건이었다(넷 중 가장 심했다)
      if (clsValue > 0.1) {
        warnOnce('cls', `High CLS on ${pageName}: ${clsValue}`)
      }
    })

    clsObserver.observe({ entryTypes: ['layout-shift'] })
    observers.push(clsObserver)
  }

  /**
   * API 호출 성능 추적
   */
  static trackAPICall(
    endpoint: string,
    duration: number,
    status: number
  ): void {
    if (!import.meta.env.PROD) {
      return
    }

    Sentry.addBreadcrumb({
      category: 'api',
      message: `${endpoint} - ${duration}ms (${status})`,
      level: 'info',
    })

    // 3초 초과 시 느린 API 보고
    if (duration > 3000) {
      Sentry.captureMessage(
        `Slow API: ${endpoint} (${duration}ms)`,
        'warning'
      )
    }

    // 5xx 에러 시 보고
    if (status >= 500) {
      Sentry.captureMessage(
        `API Error: ${endpoint} returned ${status}`,
        'error'
      )
    }
  }

  /**
   * 커스텀 메트릭 추적
   */
  static trackCustomMetric(
    name: string,
    value: number,
    unit: 'millisecond' | 'byte' | 'count' = 'millisecond'
  ): void {
    if (!import.meta.env.PROD) {
      return
    }

    Sentry.addBreadcrumb({
      category: 'metric',
      message: `${name}: ${value} ${unit}`,
      level: 'info',
    })
  }

  /**
   * 번들 크기 추적
   */
  static trackBundleSize(pageName: string, sizeInKB: number): void {
    if (!import.meta.env.PROD) {
      return
    }

    Sentry.addBreadcrumb({
      category: 'bundle',
      message: `${pageName}: ${sizeInKB} KB`,
      level: 'info',
    })

    // 50KB 초과 시 경고
    if (sizeInKB > 50) {
      Sentry.captureMessage(
        `Large Bundle: ${pageName} (${sizeInKB} KB)`,
        'warning'
      )
    }
  }

  /**
   * 메모리 사용량 추적
   */
  static trackMemoryUsage(): void {
    if (typeof window === 'undefined' || !import.meta.env.PROD) {
      return
    }

    // @ts-ignore
    if (window.performance?.memory) {
      // @ts-ignore
      const memory = window.performance.memory
      const usedMB = Math.round(memory.usedJSHeapSize / 1048576)
      const totalMB = Math.round(memory.totalJSHeapSize / 1048576)

      Sentry.addBreadcrumb({
        category: 'memory',
        message: `Used: ${usedMB} MB / Total: ${totalMB} MB`,
        level: 'info',
      })

      // 메모리 사용량이 80% 초과 시 경고
      if (usedMB / totalMB > 0.8) {
        Sentry.captureMessage(
          `High Memory Usage: ${usedMB} / ${totalMB} MB`,
          'warning'
        )
      }
    }
  }
}

// Axios 인터셉터에 사용할 성능 추적 헬퍼
export function createAPIPerformanceInterceptor() {
  return {
    onRequest: (config: any) => {
      config.metadata = { startTime: Date.now() }
      return config
    },
    onResponse: (response: any) => {
      const duration = Date.now() - response.config.metadata.startTime
      PerformanceMonitor.trackAPICall(
        response.config.url,
        duration,
        response.status
      )
      return response
    },
    onError: (error: any) => {
      if (error.config?.metadata?.startTime) {
        const duration = Date.now() - error.config.metadata.startTime
        PerformanceMonitor.trackAPICall(
          error.config.url,
          duration,
          error.response?.status || 0
        )
      }
      throw error
    },
  }
}
