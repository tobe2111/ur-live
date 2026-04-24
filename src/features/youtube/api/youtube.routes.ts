/**
 * YouTube API Routes — Aggregator
 *
 * This file composes all YouTube sub-routers into a single Hono app.
 * Sub-files:
 *   youtube-oauth.routes.ts   — OAuth, channel list, disconnect
 *   youtube-live.routes.ts    — Live broadcast CRUD (create/start/status/stats/end)
 *   youtube-shorts.routes.ts  — Shorts sync from YouTube channel
 *   youtube-shared.ts         — Shared types, helpers, DB setup
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Bindings } from './youtube-shared'
import youtubeOAuthRoutes from './youtube-oauth.routes'
import youtubeLiveRoutes from './youtube-live.routes'
import youtubeShortsRoutes from './youtube-shorts.routes'

const app = new Hono<{ Bindings: Bindings }>()

// CORS configuration
app.use('/*', cors({
  origin: [
    'https://live.ur-team.com',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}))

// Mount sub-routers
app.route('/', youtubeOAuthRoutes)
app.route('/', youtubeLiveRoutes)
app.route('/', youtubeShortsRoutes)

export default app
