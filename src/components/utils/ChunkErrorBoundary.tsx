import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

/**
 * ChunkErrorBoundary - 청크 로딩 실패 자동 복구
 * 
 * Vite 코드 스플리팅으로 생성된 청크 파일 로딩 실패 시:
 * 1. 자동으로 페이지 새로고침 (1회만)
 * 2. localStorage에 재시도 기록
 * 3. 재시도 후에도 실패 시 에러 UI 표시
 */
export class ChunkErrorBoundary extends Component<Props, State> {
  private static readonly RETRY_KEY = 'chunk_error_retry';
  private static readonly RETRY_TIMEOUT = 5000; // 5초

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      isChunkError: false,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // CRITICAL: Ensure error is an Error instance to prevent React Error #31
    const actualError = error instanceof Error ? error : new Error(String(error));
    
    // 청크 로딩 실패 감지
    const isChunkError =
      actualError.message.includes('Failed to fetch dynamically imported module') ||
      actualError.message.includes('Importing a module script failed') ||
      actualError.message.includes('error loading dynamically imported module');

    console.error('[ChunkErrorBoundary] Error caught:', {
      message: actualError.message,
      isChunkError,
      errorType: actualError.constructor.name,
    });

    return {
      hasError: true,
      error: actualError,
      isChunkError,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ChunkErrorBoundary] Component stack:', errorInfo.componentStack);

    // 청크 로딩 실패 시 자동 복구 시도
    if (this.state.isChunkError) {
      this.handleChunkError();
    }
  }

  /**
   * 청크 로딩 실패 자동 복구
   * - 1회 자동 새로고침
   * - localStorage로 무한 루프 방지
   */
  private handleChunkError = () => {
    const retryCount = parseInt(localStorage.getItem(ChunkErrorBoundary.RETRY_KEY) || '0', 10);
    const now = Date.now();

    // 이미 재시도했으면 에러 UI 표시
    if (retryCount > 0) {
      console.warn('[ChunkErrorBoundary] Already retried, showing error UI');
      return;
    }

    console.log('[ChunkErrorBoundary] Chunk loading failed, reloading page...');

    // 재시도 기록
    localStorage.setItem(ChunkErrorBoundary.RETRY_KEY, '1');

    // 5초 후 재시도 카운터 초기화 (무한 루프 방지)
    setTimeout(() => {
      localStorage.removeItem(ChunkErrorBoundary.RETRY_KEY);
    }, ChunkErrorBoundary.RETRY_TIMEOUT);

    // 페이지 새로고침 (캐시 무시)
    window.location.reload();
  };

  /**
   * 수동 재시도 (에러 UI에서 버튼 클릭)
   */
  private handleManualRetry = () => {
    localStorage.removeItem(ChunkErrorBoundary.RETRY_KEY);
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // 청크 로딩 실패 에러 UI
      if (this.state.isChunkError) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full text-center">
              <div className="mb-4">
                <svg
                  className="mx-auto h-12 w-12 text-yellow-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                페이지 로딩 중 오류가 발생했습니다
              </h1>
              <p className="text-gray-600 mb-6">
                새로운 버전이 배포되어 페이지를 다시 불러와야 합니다.
                <br />
                아래 버튼을 클릭해주세요.
              </p>
              <button
                onClick={this.handleManualRetry}
                className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg
                  className="mr-2 h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                페이지 새로고침
              </button>
              <p className="mt-4 text-sm text-gray-500">
                문제가 계속되면 브라우저 캐시를 삭제해주세요.
                <br />
                (Ctrl+Shift+Del 또는 Cmd+Shift+Del)
              </p>
            </div>
          </div>
        );
      }

      // 일반 에러 UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full text-center">
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">오류가 발생했습니다</h1>
            <p className="text-gray-600 mb-4">
              페이지를 불러오는 중 예상치 못한 오류가 발생했습니다.
            </p>
            <details className="text-left bg-gray-100 p-4 rounded-md mb-6">
              <summary className="cursor-pointer text-sm font-medium text-gray-700">
                오류 상세 정보
              </summary>
              <pre className="mt-2 text-xs text-gray-600 overflow-auto">
                {this.state.error?.message}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              홈으로 돌아가기
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
