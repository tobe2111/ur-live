/**
 * Error Boundary Component
 * React 컴포넌트 트리에서 발생한 에러를 포착하고 폴백 UI를 표시합니다.
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { isChunkLoadError, reloadWithCacheBust } from '@/utils/chunk-error';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  componentStack?: string;
  isChunkError?: boolean;
}

// 청크 에러 자동복구 루프 가드 — ChunkErrorBoundary 와 동일 키 공유(이중 reload 방지).
const CHUNK_RETRY_KEY = 'chunk_error_retry';

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // 🛡️ 새 배포 후 옛 HTML 이 참조하는 옛 청크 해시 404 → lazy import 실패(ChunkLoadError).
    //   이 generic 바운더리가 라우트를 감싸므로 여기서도 감지해야 "문제가 발생했습니다" 대신 자동복구.
    const isChunkError = isChunkLoadError(error?.message);
    return { hasError: true, error, isChunkError };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ componentStack: errorInfo.componentStack || '' });
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary] caught:', error?.message || '(no message)', error, 'chunk?', isChunkLoadError(error?.message));
      console.error('[ErrorBoundary] component stack:', errorInfo.componentStack);
    }

    // 🛡️ 청크 에러(=새 배포 업데이트) 는 무서운 에러 대신 자동 새로고침(캐시버스트)으로 조용히 복구.
    //   유저는 새 버전을 바로 받게 됨. 무한 루프는 localStorage 가드로 차단(1회, 5초 창).
    if (this.state.isChunkError) {
      try {
        const tried = parseInt(localStorage.getItem(CHUNK_RETRY_KEY) || '0', 10);
        if (!tried) {
          localStorage.setItem(CHUNK_RETRY_KEY, '1');
          setTimeout(() => { try { localStorage.removeItem(CHUNK_RETRY_KEY); } catch { /* noop */ } }, 5000);
          reloadWithCacheBust(); // location.replace → 항상 새 문서/새 청크 해시
        }
      } catch { /* storage/location 차단 — render 의 수동 새로고침 버튼으로 폴백 */ }
      return; // 청크 에러는 Sentry 전송 안 함(정상적 배포 전환 노이즈)
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

  private handleManualReload = () => {
    try { localStorage.removeItem(CHUNK_RETRY_KEY); } catch { /* noop */ }
    reloadWithCacheBust();
  };

  render() {
    if (this.state.hasError) {
      // 🛡️ 청크 에러(새 배포 업데이트) — 무서운 에러 대신 "업데이트 중" 안내.
      //   componentDidCatch 가 자동 새로고침(캐시버스트) 중이라 보통 즉시 사라짐.
      //   자동복구가 막힌 환경(storage/location 차단·2회차)에선 수동 버튼으로 폴백.
      if (this.state.isChunkError) {
        return (
          <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 dark:bg-[#0A0A0A] px-4">
            <div className="max-w-sm w-full text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-gray-200 dark:border-[#2A2A2A] border-t-gray-900 dark:border-t-white animate-spin" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">화면을 업데이트하고 있어요</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 leading-relaxed">
                새 버전이 배포되어 최신 화면으로 새로고침하고 있어요.<br />잠시만 기다려 주세요.
              </p>
              <button
                onClick={this.handleManualReload}
                className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full text-sm font-bold hover:opacity-90"
              >
                지금 새로고침
              </button>
            </div>
          </div>
        );
      }

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

            {import.meta.env.DEV && this.state.error && (
              <details className="text-left mb-6">
                <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                  오류 상세 보기 (개발 환경)
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 dark:bg-[#1A1A1A] p-3 rounded overflow-auto max-h-60">
                  {this.state.error.toString()}
                  {'\n\n--- Stack ---\n'}
                  {this.state.error?.stack || ''}
                  {this.state.componentStack ? '\n\n--- Component Tree ---\n' + this.state.componentStack : ''}
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
