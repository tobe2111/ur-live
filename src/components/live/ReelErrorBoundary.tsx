import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean }

export default class ReelErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    if (import.meta.env.DEV) console.error('[ReelCard] crashed:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-dvh w-full bg-black flex items-center justify-center">
          <p className="text-white/40 text-sm">이 방송을 불러올 수 없어요</p>
        </div>
      )
    }
    return this.props.children
  }
}
