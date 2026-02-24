/**
 * Discord Webhook 보안 모니터링
 * 
 * 비정상 로그인, 인증 실패, 보안 이벤트를 Discord로 실시간 알림
 */

export interface SecurityEvent {
  type: 'login_success' | 'login_failure' | 'suspicious_login' | 'jwt_validation_failure' | 'rate_limit_exceeded';
  userId?: string | number;
  username?: string;
  userType?: 'user' | 'admin' | 'seller';
  ip?: string;
  userAgent?: string;
  timestamp: string;
  details?: string;
  metadata?: Record<string, any>;
}

/**
 * Discord Webhook으로 보안 알림 전송
 */
export async function sendDiscordAlert(event: SecurityEvent, webhookUrl?: string): Promise<void> {
  // Webhook URL이 없으면 콘솔 로그만 출력
  if (!webhookUrl) {
    console.log('[Discord Alert - Mock]', event);
    return;
  }

  try {
    const color = getEventColor(event.type);
    const embed = {
      title: getEventTitle(event.type),
      description: event.details || getEventDescription(event),
      color: color,
      fields: [
        {
          name: '사용자',
          value: event.username || event.userId?.toString() || 'Unknown',
          inline: true
        },
        {
          name: '사용자 타입',
          value: event.userType || 'N/A',
          inline: true
        },
        {
          name: 'IP 주소',
          value: event.ip || 'Unknown',
          inline: true
        },
        {
          name: 'User Agent',
          value: event.userAgent ? truncate(event.userAgent, 100) : 'Unknown',
          inline: false
        },
        {
          name: '시간',
          value: event.timestamp,
          inline: false
        }
      ],
      footer: {
        text: 'UR LIVE Security Monitoring'
      },
      timestamp: new Date().toISOString()
    };

    // 추가 메타데이터가 있으면 필드에 추가
    if (event.metadata) {
      for (const [key, value] of Object.entries(event.metadata)) {
        embed.fields.push({
          name: key,
          value: String(value),
          inline: true
        });
      }
    }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        embeds: [embed]
      })
    });

    console.log('[Discord Alert] Sent:', event.type);
  } catch (error) {
    console.error('[Discord Alert Error]', error);
    // 알림 전송 실패해도 서비스에 영향 주지 않음
  }
}

/**
 * 이벤트 타입별 색상 (Discord embed color)
 */
function getEventColor(type: SecurityEvent['type']): number {
  const colors = {
    login_success: 0x00ff00,        // 초록색
    login_failure: 0xff9900,        // 주황색
    suspicious_login: 0xff0000,     // 빨간색
    jwt_validation_failure: 0xff6600, // 주황-빨강
    rate_limit_exceeded: 0xff0000   // 빨간색
  };
  return colors[type] || 0x808080;
}

/**
 * 이벤트 타입별 제목
 */
function getEventTitle(type: SecurityEvent['type']): string {
  const titles = {
    login_success: '✅ 로그인 성공',
    login_failure: '⚠️ 로그인 실패',
    suspicious_login: '🚨 의심스러운 로그인 감지',
    jwt_validation_failure: '❌ JWT 검증 실패',
    rate_limit_exceeded: '🚫 Rate Limit 초과'
  };
  return titles[type] || '📊 보안 이벤트';
}

/**
 * 이벤트 타입별 설명
 */
function getEventDescription(event: SecurityEvent): string {
  const descriptions = {
    login_success: '사용자가 성공적으로 로그인했습니다.',
    login_failure: '로그인 시도가 실패했습니다. 비밀번호 오류 또는 존재하지 않는 계정입니다.',
    suspicious_login: '비정상적인 로그인 패턴이 감지되었습니다. 즉시 확인이 필요합니다.',
    jwt_validation_failure: 'JWT 토큰 검증에 실패했습니다. 만료되었거나 유효하지 않은 토큰입니다.',
    rate_limit_exceeded: 'API Rate Limit을 초과했습니다. DDoS 공격 가능성이 있습니다.'
  };
  return descriptions[event.type] || '보안 관련 이벤트가 발생했습니다.';
}

/**
 * 문자열 자르기 (긴 User Agent 등)
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}

/**
 * 의심스러운 로그인 패턴 감지
 * 
 * 감지 조건:
 * - 5분 내 3회 이상 로그인 실패
 * - 알려지지 않은 IP에서의 관리자 로그인
 * - 비정상적인 User Agent
 */
export function detectSuspiciousLogin(
  ip: string,
  userAgent: string,
  userType: 'user' | 'admin' | 'seller',
  loginHistory: Array<{ ip: string; timestamp: number; success: boolean }>
): boolean {
  // 1. 5분 내 3회 이상 실패
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  const recentFailures = loginHistory.filter(
    h => h.ip === ip && !h.success && h.timestamp > fiveMinutesAgo
  );
  
  if (recentFailures.length >= 3) {
    return true;
  }

  // 2. 관리자 로그인은 항상 의심스러운 것으로 간주 (알림용)
  if (userType === 'admin') {
    return true;
  }

  // 3. 비정상적인 User Agent (봇, 스크립트 등)
  const suspiciousUserAgents = [
    'python', 'curl', 'wget', 'postman', 'insomnia',
    'bot', 'crawler', 'spider', 'scraper'
  ];
  
  const userAgentLower = userAgent.toLowerCase();
  if (suspiciousUserAgents.some(ua => userAgentLower.includes(ua))) {
    return true;
  }

  return false;
}

/**
 * 메모리 기반 로그인 히스토리 (Worker 재시작 시 초기화됨)
 * 
 * 프로덕션에서는 KV 또는 D1 Database 사용 권장
 */
const loginHistoryCache = new Map<string, Array<{ timestamp: number; success: boolean }>>();

export function addLoginHistory(ip: string, success: boolean): void {
  const history = loginHistoryCache.get(ip) || [];
  history.push({ timestamp: Date.now(), success });
  
  // 최근 1시간 데이터만 유지
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const filtered = history.filter(h => h.timestamp > oneHourAgo);
  
  loginHistoryCache.set(ip, filtered);
  
  // 캐시 크기 제한 (1000개)
  if (loginHistoryCache.size > 1000) {
    const firstKey = loginHistoryCache.keys().next().value;
    loginHistoryCache.delete(firstKey);
  }
}

export function getLoginHistory(ip: string): Array<{ timestamp: number; success: boolean; ip: string }> {
  return (loginHistoryCache.get(ip) || []).map(h => ({ ...h, ip }));
}
