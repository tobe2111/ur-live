import { jsxRenderer } from 'hono/jsx-renderer'

// @ts-ignore - hono/jsx-renderer type compatibility
export const renderer = jsxRenderer(({ children }: any) => {
  return (
    <html>
      <head>
        <link href="/static/style.css" rel="stylesheet" />
      </head>
      <body>{children as any}</body>
    </html>
  )
})
