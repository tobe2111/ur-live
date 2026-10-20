import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router'
import './app.css'

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

export function ErrorBoundary() {
  return (
    <main style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <h1>일시적인 오류가 발생했어요</h1>
      <p>잠시 후 다시 시도해주세요.</p>
    </main>
  )
}
