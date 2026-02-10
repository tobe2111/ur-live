import React from 'react'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Sentry로 에러 전송 (Mock 모드에서는 콘솔 로그)
    console.error('🔴 ErrorBoundary caught an error:', error, errorInfo)
    
    // 추가 컨텍스트 정보
    const context = {
      componentStack: errorInfo.componentStack,
      errorBoundary: 'App',
    }
    
    console.error('📍 Context:', context)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/'
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-white flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
              {/* Error Icon */}
              <div className="flex items-center justify-center h-20 w-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-red-500 to-red-600 shadow-xl">
                <AlertTriangle className="h-10 w-10 text-white" />
              </div>

              {/* Error Title */}
              <h1 className="text-3xl font-extrabold text-gray-900 mb-3">
                앗! 오류가 발생했습니다
              </h1>

              {/* Error Message */}
              <p className="text-gray-600 mb-2">
                예상치 못한 오류가 발생했습니다.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                불편을 드려 죄송합니다.
              </p>

              {/* Error Details (Development Only) */}
              {import.meta.env.DEV && this.state.error && (
                <div className="mb-6 p-4 bg-red-50 rounded-2xl text-left">
                  <p className="text-xs font-mono text-red-800 break-all">
                    {this.state.error.message}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={this.handleReload}
                  className="w-full py-6 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold text-lg rounded-2xl shadow-lg hover:shadow-xl transition-all"
                >
                  <RefreshCw className="h-5 w-5 mr-2" />
                  페이지 새로고침
                </Button>

                <Button
                  onClick={this.handleReset}
                  variant="outline"
                  className="w-full py-6 bg-white hover:bg-gray-50 text-gray-900 font-bold text-lg rounded-2xl border-2 border-gray-200"
                >
                  <Home className="h-5 w-5 mr-2" />
                  홈으로 돌아가기
                </Button>
              </div>

              {/* Support Link */}
              <div className="mt-6 text-sm text-gray-500">
                문제가 계속되면{' '}
                <a
                  href="mailto:jiwon@ur-team.com"
                  className="text-red-600 hover:text-red-700 font-medium underline"
                >
                  고객센터
                </a>
                로 문의해주세요.
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
