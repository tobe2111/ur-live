/**
 * 보안 모니터링 & 알림 시스템
 */

export interface SecurityEvent {
  type: 'unauthorized_access' | 'rate_limit_exceeded' | 'suspicious_activity' | 'authentication_failure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  userId?: number;
  userType?: string;
  ip?: string;
  path?: string;
  method?: string;
  details?: Record<string, any>;
}

/**
 * Discord Webhook으로 보안 이벤트 전송
 */
export async function sendSecurityAlert(event: SecurityEvent, webhookUrl?: string): Promise<void> {
  if (!webhookUrl) {
    // Webhook URL이 없으면 콘솔에만 로그
    console.warn('[Security Alert]', JSON.stringify(event, null, 2));
    return;
  }

  const color = {
    low: 3447003,      // 파란색
    medium: 16776960,  // 노란색
    high: 16744192,    // 주황색
    critical: 16711680 // 빨간색
  }[event.severity];

  const emoji = {
    low: '🔵',
    medium: '🟡',
    high: '🟠',
    critical: '🔴'
  }[event.severity];

  const embed = {
    title: `${emoji} 보안 경고: ${event.type}`,
    color,
    fields: [
      { name: '심각도', value: event.severity.toUpperCase(), inline: true },
      { name: '시간', value: new Date(event.timestamp).toISOString(), inline: true },
      ...(event.userId ? [{ name: 'User ID', value: String(event.userId), inline: true }] : []),
      ...(event.userType ? [{ name: 'User Type', value: event.userType, inline: true }] : []),
      ...(event.ip ? [{ name: 'IP Address', value: event.ip, inline: true }] : []),
      ...(event.path ? [{ name: 'Path', value: event.path, inline: true }] : []),
      ...(event.method ? [{ name: 'Method', value: event.method, inline: true }] : []),
      ...(event.details ? [{ name: 'Details', value: JSON.stringify(event.details, null, 2) }] : [])
    ],
    timestamp: new Date(event.timestamp).toISOString()
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    });
  } catch (error) {
    console.error('[Security Alert] Failed to send Discord notification:', error);
  }
}

/**
 * 보안 이벤트 로깅 (KV에 저장)
 */
export async function logSecurityEvent(
  event: SecurityEvent,
  kv: KVNamespace
): Promise<void> {
  const key = `security:${event.timestamp}:${crypto.randomUUID()}`;
  const ttl = 30 * 24 * 60 * 60; // 30일
  
  try {
    await kv.put(key, JSON.stringify(event), { expirationTtl: ttl });
  } catch (error) {
    console.error('[Security] Failed to log event to KV:', error);
  }
}

/**
 * IP 블랙리스트 체크
 */
export async function isIPBlacklisted(ip: string, kv: KVNamespace): Promise<boolean> {
  const key = `blacklist:ip:${ip}`;
  const result = await kv.get(key);
  return result !== null;
}

/**
 * IP를 블랙리스트에 추가
 */
export async function addIPToBlacklist(
  ip: string,
  reason: string,
  duration: number,
  kv: KVNamespace
): Promise<void> {
  const key = `blacklist:ip:${ip}`;
  const value = JSON.stringify({ reason, addedAt: Date.now() });
  
  await kv.put(key, value, { expirationTtl: duration });
  console.warn(`[Security] IP ${ip} added to blacklist. Reason: ${reason}`);
}

/**
 * 실패한 로그인 시도 추적
 */
export async function trackFailedLogin(
  identifier: string, // email 또는 username
  ip: string,
  kv: KVNamespace
): Promise<{ attempts: number; shouldBlock: boolean }> {
  const key = `failed_login:${identifier}:${ip}`;
  const MAX_ATTEMPTS = 5;
  const BLOCK_DURATION = 15 * 60; // 15분
  
  let attempts = 1;
  const existing = await kv.get(key);
  
  if (existing) {
    attempts = parseInt(existing) + 1;
  }
  
  await kv.put(key, String(attempts), { expirationTtl: 300 }); // 5분
  
  if (attempts >= MAX_ATTEMPTS) {
    // 5회 이상 실패 시 IP 블랙리스트 추가
    await addIPToBlacklist(ip, `Failed login attempts: ${attempts}`, BLOCK_DURATION, kv);
    return { attempts, shouldBlock: true };
  }
  
  return { attempts, shouldBlock: false };
}

/**
 * 일일 보안 리포트 생성
 */
export async function generateSecurityReport(
  kv: KVNamespace,
  startTimestamp: number,
  endTimestamp: number
): Promise<{
  totalEvents: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  topIPs: Array<{ ip: string; count: number }>;
}> {
  // KV에서 보안 이벤트 조회 (prefix scan)
  const events: SecurityEvent[] = [];
  
  // Note: KV list API 사용
  const list = await kv.list({ prefix: 'security:' });
  
  for (const key of list.keys) {
    const value = await kv.get(key.name);
    if (value) {
      try {
        const event = JSON.parse(value) as SecurityEvent;
        if (event.timestamp >= startTimestamp && event.timestamp <= endTimestamp) {
          events.push(event);
        }
      } catch (e) {
        // 파싱 에러 무시
      }
    }
  }
  
  // 통계 계산
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const ipCounts: Record<string, number> = {};
  
  for (const event of events) {
    byType[event.type] = (byType[event.type] || 0) + 1;
    bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
    
    if (event.ip) {
      ipCounts[event.ip] = (ipCounts[event.ip] || 0) + 1;
    }
  }
  
  const topIPs = Object.entries(ipCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ip, count]) => ({ ip, count }));
  
  return {
    totalEvents: events.length,
    byType,
    bySeverity,
    topIPs
  };
}
