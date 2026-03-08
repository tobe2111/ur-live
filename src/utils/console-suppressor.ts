// Console message suppressor for known harmless warnings/errors
if (typeof window !== 'undefined') {
  const originalError = console.error
  const originalWarn = console.warn
  
  const SUPPRESSED_ERROR_PATTERNS = [
    /postMessage.*youtube\.com/i,
    /www-embed-player\.js/i,
    /www-widgetapi\.js/i,
    /target origin.*youtube\.com/i,
    /DOMWindow.*postMessage/i,
  ]
  
  const SUPPRESSED_WARN_PATTERNS = [
    /passive event listener/i,
    /Added non-passive event listener/i,
    /\[Violation\].*passive/i,
  ]
  
  console.error = (...args: any[]) => {
    const message = args[0]?.toString() || ''
    if (SUPPRESSED_ERROR_PATTERNS.some(pattern => pattern.test(message))) {
      return
    }
    originalError.apply(console, args)
  }
  
  console.warn = (...args: any[]) => {
    const message = args[0]?.toString() || ''
    if (SUPPRESSED_WARN_PATTERNS.some(pattern => pattern.test(message))) {
      return
    }
    originalWarn.apply(console, args)
  }
}
