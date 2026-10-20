/**
 * Development-only logging utility
 * Prevents console spam in production
 */

const isDev = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private prefix: string;

  constructor(moduleName?: string) {
    this.prefix = moduleName ? `[${moduleName}]` : '';
  }

  /**
   * Debug logs - only shown in development
   * Use for detailed debugging information
   */
  debug(...args: any[]) {
    if (isDev) {
      console.log(this.prefix, '[DEBUG]', ...args);
    }
  }

  /**
   * Info logs - only shown in development
   * Use for general information
   */
  info(...args: any[]) {
    if (isDev) {
      console.info(this.prefix, '[INFO]', ...args);
    }
  }

  /**
   * Warning logs - always shown
   * Use for non-critical issues
   */
  warn(...args: any[]) {
    console.warn(this.prefix, '[WARN]', ...args);
  }

  /**
   * Error logs - always shown
   * Use for errors and exceptions
   */
  error(...args: any[]) {
    console.error(this.prefix, '[ERROR]', ...args);
  }

  /**
   * Group logs together - only in development
   */
  group(label: string, collapsed: boolean = false) {
    if (isDev) {
      if (collapsed) {
        console.groupCollapsed(this.prefix, label);
      } else {
        console.group(this.prefix, label);
      }
    }
  }

  /**
   * End log group
   */
  groupEnd() {
    if (isDev) {
      console.groupEnd();
    }
  }

  /**
   * Table display - only in development
   */
  table(data: any) {
    if (isDev) {
      console.table(data);
    }
  }

  /**
   * Time tracking - only in development
   */
  time(label: string) {
    if (isDev) {
      console.time(this.prefix + ' ' + label);
    }
  }

  timeEnd(label: string) {
    if (isDev) {
      console.timeEnd(this.prefix + ' ' + label);
    }
  }
}

// Default logger instance
export const logger = new Logger();

// Create module-specific logger
export const createLogger = (moduleName: string) => new Logger(moduleName);

// Export for convenience
export default logger;
