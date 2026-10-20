/**
 * 구조화된 로깅 시스템
 * 
 * 기능:
 * - 일관된 JSON 형식 로그
 * - 로그 레벨 분리 (info, warn, error)
 * - 성능 추적 (duration)
 * - 컨텍스트 정보 포함
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  duration?: number;
  requestId?: string;
}

class Logger {
  private isDevelopment: boolean;
  
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }
  
  /**
   * 로그 출력
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>, duration?: number) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      duration,
    };
    
    // JSON 형식으로 출력
    const output = JSON.stringify(entry);
    
    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'debug':
        if (this.isDevelopment) {
          console.debug(output);
        }
        break;
      default:
        console.log(output);
    }
  }
  
  /**
   * Info 로그
   */
  info(message: string, context?: Record<string, any>) {
    this.log('info', message, context);
  }
  
  /**
   * Warning 로그
   */
  warn(message: string, context?: Record<string, any>) {
    this.log('warn', message, context);
  }
  
  /**
   * Error 로그
   */
  error(message: string, error?: Error | any, context?: Record<string, any>) {
    const errorContext = {
      ...context,
      error: {
        message: error?.message,
        stack: this.isDevelopment ? error?.stack : undefined,
        name: error?.name,
      },
    };
    
    this.log('error', message, errorContext);
  }
  
  /**
   * Debug 로그 (개발 환경에서만)
   */
  debug(message: string, context?: Record<string, any>) {
    this.log('debug', message, context);
  }
  
  /**
   * 성능 추적 로그
   */
  performance(message: string, duration: number, context?: Record<string, any>) {
    this.log('info', message, context, duration);
  }
}

/**
 * 싱글톤 Logger 인스턴스
 */
export const logger = new Logger();

/**
 * 성능 측정 유틸리티
 */
export class PerformanceTracker {
  private startTime: number;
  private label: string;
  
  constructor(label: string) {
    this.label = label;
    this.startTime = Date.now();
  }
  
  /**
   * 측정 종료 및 로그 출력
   */
  end(context?: Record<string, any>) {
    const duration = Date.now() - this.startTime;
    logger.performance(this.label, duration, context);
    return duration;
  }
}

/**
 * API 요청 로거 미들웨어용 헬퍼
 */
export interface ApiLogContext {
  method: string;
  path: string;
  status: number;
  duration: number;
  userId?: number;
  userType?: string;
  error?: string;
}

export function logApiRequest(context: ApiLogContext) {
  const level = context.status >= 500 ? 'error' : context.status >= 400 ? 'warn' : 'info';
  
  if (level === 'error') {
    logger.error('API Request', new Error(String(context.status)), context);
  } else if (level === 'warn') {
    logger.warn('API Request', context);
  } else {
    logger.info('API Request', context);
  }
}
