import type { AppLoadContext, EntryContext } from 'react-router'
import { ServerRouter } from 'react-router'
import { isbot } from 'isbot'
import { renderToReadableStream } from 'react-dom/server'

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext,
) {
  let shellRendered = false
  const userAgent = request.headers.get('user-agent')
  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {
      onError(error: unknown) {
        responseStatusCode = 500
        if (shellRendered) console.error(error)
      },
    },
  )
  shellRendered = true
  // 봇(크롤러)은 전체 렌더 완료 후 응답 — SEO 안전.
  if (userAgent && isbot(userAgent)) {
    await body.allReady
  }
  responseHeaders.set('Content-Type', 'text/html')
  return new Response(body, { headers: responseHeaders, status: responseStatusCode })
}
