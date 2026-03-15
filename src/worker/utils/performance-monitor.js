/**
 * 📊 Performance Monitoring Dashboard
 *
 * 실시간 성능 지표 추적 및 대시보드
 * - API 응답 시간
 * - DB 쿼리 시간
 * - 에러율
 * - 슬로우 쿼리
 */
class PerformanceMonitor {
    metrics = [];
    maxMetrics = 1000; // 최근 1000개만 메모리에 유지
    slowQueryThreshold = 1000; // 1초 이상은 슬로우 쿼리
    /**
     * 성능 지표 기록
     */
    recordMetric(metric) {
        this.metrics.push(metric);
        // 오래된 메트릭 제거 (메모리 관리)
        if (this.metrics.length > this.maxMetrics) {
            this.metrics.shift();
        }
        // 슬로우 쿼리 로깅
        if (metric.responseTime > this.slowQueryThreshold) {
            console.warn('[Performance] 🐌 Slow query detected:', {
                endpoint: metric.endpoint,
                responseTime: `${metric.responseTime}ms`,
                dbQueryTime: metric.dbQueryTime ? `${metric.dbQueryTime}ms` : 'N/A',
                dbQueryCount: metric.dbQueryCount || 0,
            });
        }
    }
    /**
     * 통계 계산
     */
    getStats(timeWindowMs = 60000) {
        const now = Date.now();
        const recentMetrics = this.metrics.filter(m => now - m.timestamp < timeWindowMs);
        if (recentMetrics.length === 0) {
            return {
                totalRequests: 0,
                avgResponseTime: 0,
                p50ResponseTime: 0,
                p95ResponseTime: 0,
                p99ResponseTime: 0,
                errorRate: 0,
                slowQueriesCount: 0,
                slowQueriesThreshold: this.slowQueryThreshold,
            };
        }
        // 응답 시간 정렬
        const sortedResponseTimes = recentMetrics
            .map(m => m.responseTime)
            .sort((a, b) => a - b);
        // 백분위수 계산
        const p50Index = Math.floor(sortedResponseTimes.length * 0.5);
        const p95Index = Math.floor(sortedResponseTimes.length * 0.95);
        const p99Index = Math.floor(sortedResponseTimes.length * 0.99);
        // 에러율 계산 (4xx, 5xx)
        const errorCount = recentMetrics.filter(m => m.statusCode >= 400).length;
        // 슬로우 쿼리 수
        const slowQueriesCount = recentMetrics.filter(m => m.responseTime > this.slowQueryThreshold).length;
        return {
            totalRequests: recentMetrics.length,
            avgResponseTime: Math.round(recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length),
            p50ResponseTime: sortedResponseTimes[p50Index] || 0,
            p95ResponseTime: sortedResponseTimes[p95Index] || 0,
            p99ResponseTime: sortedResponseTimes[p99Index] || 0,
            errorRate: (errorCount / recentMetrics.length) * 100,
            slowQueriesCount,
            slowQueriesThreshold: this.slowQueryThreshold,
        };
    }
    /**
     * 엔드포인트별 통계
     */
    getStatsByEndpoint(timeWindowMs = 60000) {
        const now = Date.now();
        const recentMetrics = this.metrics.filter(m => now - m.timestamp < timeWindowMs);
        const byEndpoint = {};
        for (const metric of recentMetrics) {
            const key = `${metric.method} ${metric.endpoint}`;
            if (!byEndpoint[key]) {
                byEndpoint[key] = [];
            }
            byEndpoint[key].push(metric);
        }
        const stats = {};
        for (const [endpoint, metrics] of Object.entries(byEndpoint)) {
            const sortedResponseTimes = metrics
                .map(m => m.responseTime)
                .sort((a, b) => a - b);
            const p50Index = Math.floor(sortedResponseTimes.length * 0.5);
            const p95Index = Math.floor(sortedResponseTimes.length * 0.95);
            const p99Index = Math.floor(sortedResponseTimes.length * 0.99);
            const errorCount = metrics.filter(m => m.statusCode >= 400).length;
            const slowQueriesCount = metrics.filter(m => m.responseTime > this.slowQueryThreshold).length;
            stats[endpoint] = {
                totalRequests: metrics.length,
                avgResponseTime: Math.round(metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length),
                p50ResponseTime: sortedResponseTimes[p50Index] || 0,
                p95ResponseTime: sortedResponseTimes[p95Index] || 0,
                p99ResponseTime: sortedResponseTimes[p99Index] || 0,
                errorRate: (errorCount / metrics.length) * 100,
                slowQueriesCount,
                slowQueriesThreshold: this.slowQueryThreshold,
            };
        }
        return stats;
    }
    /**
     * 성능 보고서 생성
     */
    generateReport(timeWindowMs = 60000) {
        const globalStats = this.getStats(timeWindowMs);
        const endpointStats = this.getStatsByEndpoint(timeWindowMs);
        const timeWindowMinutes = timeWindowMs / 60000;
        let report = `
📊 Performance Report (Last ${timeWindowMinutes} minutes)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 Global Stats:
  • Total Requests: ${globalStats.totalRequests}
  • Avg Response Time: ${globalStats.avgResponseTime}ms
  • P50: ${globalStats.p50ResponseTime}ms
  • P95: ${globalStats.p95ResponseTime}ms
  • P99: ${globalStats.p99ResponseTime}ms
  • Error Rate: ${globalStats.errorRate.toFixed(2)}%
  • Slow Queries: ${globalStats.slowQueriesCount} (>${this.slowQueryThreshold}ms)

🎯 Top 10 Endpoints by Response Time:
`;
        const sortedEndpoints = Object.entries(endpointStats)
            .sort((a, b) => b[1].avgResponseTime - a[1].avgResponseTime)
            .slice(0, 10);
        for (const [endpoint, stats] of sortedEndpoints) {
            report += `
  ${endpoint}
    - Avg: ${stats.avgResponseTime}ms | P95: ${stats.p95ResponseTime}ms
    - Requests: ${stats.totalRequests} | Errors: ${stats.errorRate.toFixed(1)}%
    - Slow: ${stats.slowQueriesCount}
`;
        }
        report += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        return report;
    }
    /**
     * 알람 체크 (임계값 초과 시)
     */
    checkAlerts() {
        const stats = this.getStats(300000); // 최근 5분
        const alerts = [];
        // 평균 응답 시간 알람
        if (stats.avgResponseTime > 500) {
            alerts.push({
                type: 'response_time',
                message: `⚠️ High average response time: ${stats.avgResponseTime}ms (threshold: 500ms)`,
            });
        }
        // P95 응답 시간 알람
        if (stats.p95ResponseTime > 2000) {
            alerts.push({
                type: 'p95_response_time',
                message: `⚠️ High P95 response time: ${stats.p95ResponseTime}ms (threshold: 2000ms)`,
            });
        }
        // 에러율 알람
        if (stats.errorRate > 5) {
            alerts.push({
                type: 'error_rate',
                message: `🚨 High error rate: ${stats.errorRate.toFixed(2)}% (threshold: 5%)`,
            });
        }
        // 슬로우 쿼리 알람
        const slowQueryRate = (stats.slowQueriesCount / stats.totalRequests) * 100;
        if (slowQueryRate > 10) {
            alerts.push({
                type: 'slow_queries',
                message: `🐌 High slow query rate: ${slowQueryRate.toFixed(2)}% (threshold: 10%)`,
            });
        }
        return alerts;
    }
    /**
     * 메트릭 초기화 (테스트용)
     */
    reset() {
        this.metrics = [];
    }
}
// 싱글톤 인스턴스
let monitorInstance = null;
export function getPerformanceMonitor() {
    if (!monitorInstance) {
        monitorInstance = new PerformanceMonitor();
    }
    return monitorInstance;
}
/**
 * 미들웨어: API 성능 추적
 */
export function performanceMiddleware(c, next) {
    const startTime = Date.now();
    const monitor = getPerformanceMonitor();
    return next().then(() => {
        const responseTime = Date.now() - startTime;
        const request = c.req;
        monitor.recordMetric({
            timestamp: Date.now(),
            endpoint: new URL(request.url).pathname,
            method: request.method,
            responseTime,
            statusCode: c.res.status || 200,
            region: c.env.REGION || 'KR',
        });
        // 응답 헤더에 성능 정보 추가
        c.res.headers.set('X-Response-Time', `${responseTime}ms`);
        return c.res;
    });
}
export default getPerformanceMonitor;
