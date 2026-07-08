/**
 * Error Boundary Component
 * React 컴포넌트 트리에서 발생한 에러를 포착하고 폴백 UI를 표시합니다.
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { isChunkLoadError, recoverFromChunkError, reloadWithCacheBust } from '@/utils/chunk-error';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  componentStack?: string;
  isChunkError?: boolean;
  chunkExhausted?: boolean;
}

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
    //   단일 SSOT(recoverFromChunkError) — 인라인 부트가드·main.tsx 와 같은 가드(60초 2회) 공유.
    //   가드 한도 초과(진짜 에러)면 chunkExhausted 로 수동 새로고침 UI 폴백.
    if (isChunkLoadError(error?.message)) {
      if (!recoverFromChunkError()) this.setState({ chunkExhausted: true });
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

  private handleManualReload = () => { reloadWithCacheBust(); };

  // 소프트 재시도 — 전체 새로고침 없이 바운더리 상태만 리셋해 재렌더(일시적 렌더 에러 회복).
  private handleSoftRetry = () => {
    this.setState({ hasError: false, error: undefined, componentStack: undefined, isChunkError: undefined, chunkExhausted: undefined });
  };

  render() {
    if (this.state.hasError) {
      // 🛡️ 청크 에러(새 배포 업데이트) — 무서운 에러 대신 "업데이트 중" 안내.
      //   componentDidCatch 가 자동 새로고침(캐시버스트) 중이라 보통 즉시 사라짐.
      //   자동복구가 막힌 환경(storage/location 차단·2회차)에선 수동 버튼으로 폴백.
      if (this.state.isChunkError) {
        const exhausted = this.state.chunkExhausted;
        return (
          <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 dark:bg-[#0A0A0A] px-4">
            <div className="max-w-sm w-full text-center">
              {!exhausted && (
                <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-gray-200 dark:border-[#2A2A2A] border-t-gray-900 dark:border-t-white animate-spin" />
              )}
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {exhausted ? '새 버전이 배포됐어요' : '화면을 업데이트하고 있어요'}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 leading-relaxed">
                {exhausted
                  ? '아래 버튼을 눌러 최신 화면으로 새로고침해 주세요.'
                  : <>새 버전이 배포되어 최신 화면으로 새로고침하고 있어요.<br />잠시만 기다려 주세요.</>}
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
              {/* 소프트 재시도 — 전체 새로고침 없이 상태 리셋 후 재렌더(일시적 에러 회복). 지속되면 다시 이 화면. */}
              <button
                onClick={this.handleSoftRetry}
                className="flex-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-3 px-4 rounded-full font-medium hover:opacity-90 transition-opacity"
              >
                다시 시도
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-200 py-3 px-4 rounded-full font-medium hover:bg-gray-200 dark:hover:bg-[#2A2A2A] transition-colors"
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
