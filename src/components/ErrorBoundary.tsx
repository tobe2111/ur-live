/**
 * Error Boundary Component
 * React 컴포넌트 트리에서 발생한 에러를 포착하고 폴백 UI를 표시합니다.
 */

import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('Error Boundary caught an error:', error, errorInfo);
      console.error('Component Stack:', errorInfo.componentStack);
    }

    // 🛡️ 2026-04-29: 프로덕션 Sentry 전송 (window.Sentry 동적 사용 — 번들 영향 최소)
    try {
      const sentryGlobal = (window as unknown as { Sentry?: { captureException?: (e: Error, ctx?: unknown) => void } }).Sentry;
      if (sentryGlobal?.captureException) {
        sentryGlobal.captureException(error, {
          tags: { boundary: 'ErrorBoundary' },
          extra: { componentStack: errorInfo.componentStack },
        });
      }
    } catch { /* Sentry 미초기화 — 조용히 무시 */ }
  }

  render() {
    if (this.state.hasError) {
      // 커스텀 폴백 UI가 제공되면 사용
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 기본 폴백 UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#121212] px-4">
          <div className="max-w-md w-full bg-white dark:bg-[#0A0A0A] rounded-2xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              문제가 발생했습니다
            </h2>

            <p className="text-gray-600 dark:text-gray-300 mb-6">
              일시적인 오류가 발생했습니다. 페이지를 새로고침하거나 잠시 후 다시 시도해주세요.
            </p>

            {this.state.error && (
              <details className="text-left mb-6">
                <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700">
                  오류 상세 보기
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 dark:bg-[#1A1A1A] p-3 rounded overflow-auto max-h-40">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-gray-900 text-white py-3 px-4 rounded-full font-medium hover:bg-gray-800 transition-colors"
              >
                새로고침
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-200 py-3 px-4 rounded-full font-medium hover:bg-gray-200 transition-colors"
              >
                홈으로
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
