import * as Sentry from '@sentry/react'

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

    // LCP (Largest Contentful Paint) 추적
    const lcpObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const lcp = entry as PerformanceEntry & { renderTime: number }
        
        console.log(`📊 LCP for ${pageName}:`, lcp.renderTime, 'ms')

        Sentry.addBreadcrumb({
          category: 'performance',
          message: `LCP: ${lcp.renderTime}ms`,
          data: { page: pageName },
          level: 'info',
        })

        // 2.5초 초과 시 경고
        if (lcp.renderTime > 2500) {
          Sentry.captureMessage(
            `Slow LCP on ${pageName}: ${lcp.renderTime}ms`,
            'warning'
          )
        }
      }
    })

    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })

    // FID (First Input Delay) 추적
    const fidObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const fid = entry as PerformanceEventTiming
        
        console.log(`📊 FID for ${pageName}:`, fid.processingStart - fid.startTime, 'ms')

        Sentry.addBreadcrumb({
          category: 'performance',
          message: `FID: ${fid.processingStart - fid.startTime}ms`,
          data: { page: pageName },
          level: 'info',
        })

        // 100ms 초과 시 경고
        if (fid.processingStart - fid.startTime > 100) {
          Sentry.captureMessage(
            `Slow FID on ${pageName}: ${fid.processingStart - fid.startTime}ms`,
            'warning'
          )
        }
      }
    })

    fidObserver.observe({ entryTypes: ['first-input'] })

    // CLS (Cumulative Layout Shift) 추적
    let clsValue = 0
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const cls = entry as PerformanceEntry & { value: number; hadRecentInput: boolean }
        
        if (!cls.hadRecentInput) {
          clsValue += cls.value
        }
      }

      console.log(`📊 CLS for ${pageName}:`, clsValue)

      Sentry.addBreadcrumb({
        category: 'performance',
        message: `CLS: ${clsValue}`,
        data: { page: pageName },
        level: 'info',
      })

      // 0.1 초과 시 경고
      if (clsValue > 0.1) {
        Sentry.captureMessage(
          `High CLS on ${pageName}: ${clsValue}`,
          'warning'
        )
      }
    })

    clsObserver.observe({ entryTypes: ['layout-shift'] })
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

    console.log(`📊 API Call: ${endpoint} - ${duration}ms (${status})`)

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

    console.log(`📊 Custom Metric: ${name} - ${value} ${unit}`)

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

    console.log(`📦 Bundle Size for ${pageName}:`, sizeInKB, 'KB')

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

      console.log(`💾 Memory Usage: ${usedMB} / ${totalMB} MB`)

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
