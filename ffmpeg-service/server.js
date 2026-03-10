const express = require('express')
const { spawn } = require('child_process')
const cors = require('cors')

const app = express()
const PORT = process.env.PORT || 8080

// Middleware
app.use(cors())
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }))
app.use(express.json())

// Store active FFmpeg processes
const activeProcesses = new Map()

/**
 * Start RTMP streaming session
 * POST /bridge/:streamId/start
 */
app.post('/bridge/:streamId/start', (req, res) => {
  const { streamId } = req.params
  const { rtmpUrl, rtmpKey } = req.query

  if (!rtmpUrl || !rtmpKey) {
    return res.status(400).json({ error: 'Missing rtmpUrl or rtmpKey' })
  }

  // Check if already streaming
  if (activeProcesses.has(streamId)) {
    return res.json({ success: true, message: 'Already streaming' })
  }

  const fullRtmpUrl = `${rtmpUrl}/${rtmpKey}`

  console.log(`[${streamId}] Starting FFmpeg bridge to ${rtmpUrl}`)

  // Start FFmpeg process
  const ffmpeg = spawn('ffmpeg', [
    // Input from stdin (WebM chunks)
    '-f', 'webm',
    '-i', 'pipe:0',
    
    // Video encoding
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-b:v', '5000k',
    '-maxrate', '5000k',
    '-bufsize', '10000k',
    '-pix_fmt', 'yuv420p',
    '-g', '60', // GOP size
    '-keyint_min', '60',
    
    // Audio encoding
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '48000',
    '-ac', '2',
    
    // Output format
    '-f', 'flv',
    fullRtmpUrl
  ])

  // Store process
  activeProcesses.set(streamId, {
    process: ffmpeg,
    startTime: Date.now()
  })

  // Handle FFmpeg output
  ffmpeg.stdout.on('data', (data) => {
    console.log(`[${streamId}] FFmpeg stdout:`, data.toString())
  })

  ffmpeg.stderr.on('data', (data) => {
    console.error(`[${streamId}] FFmpeg stderr:`, data.toString())
  })

  ffmpeg.on('close', (code) => {
    console.log(`[${streamId}] FFmpeg process exited with code ${code}`)
    activeProcesses.delete(streamId)
  })

  ffmpeg.on('error', (err) => {
    console.error(`[${streamId}] FFmpeg error:`, err)
    activeProcesses.delete(streamId)
  })

  res.json({ 
    success: true, 
    message: 'FFmpeg bridge started',
    streamId 
  })
})

/**
 * Push video chunk to FFmpeg
 * POST /bridge/:streamId/chunk
 */
app.post('/bridge/:streamId/chunk', (req, res) => {
  const { streamId } = req.params
  const videoChunk = req.body

  const session = activeProcesses.get(streamId)

  if (!session) {
    return res.status(404).json({ error: 'No active streaming session' })
  }

  try {
    // Write chunk to FFmpeg stdin
    session.process.stdin.write(videoChunk)
    res.json({ success: true })
  } catch (error) {
    console.error(`[${streamId}] Error writing chunk:`, error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Stop streaming session
 * POST /bridge/:streamId/stop
 */
app.post('/bridge/:streamId/stop', (req, res) => {
  const { streamId } = req.params
  const session = activeProcesses.get(streamId)

  if (!session) {
    return res.status(404).json({ error: 'No active session' })
  }

  console.log(`[${streamId}] Stopping FFmpeg bridge`)

  // End FFmpeg stdin (graceful stop)
  session.process.stdin.end()

  // Force kill after 5 seconds if not stopped
  setTimeout(() => {
    if (activeProcesses.has(streamId)) {
      console.log(`[${streamId}] Force killing FFmpeg`)
      session.process.kill('SIGKILL')
      activeProcesses.delete(streamId)
    }
  }, 5000)

  res.json({ success: true, message: 'Stopping stream' })
})

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    activeStreams: activeProcesses.size,
    uptime: process.uptime()
  })
})

/**
 * Get active streams
 */
app.get('/streams', (req, res) => {
  const streams = []
  for (const [streamId, session] of activeProcesses.entries()) {
    streams.push({
      streamId,
      startTime: session.startTime,
      duration: Date.now() - session.startTime
    })
  }
  res.json({ streams })
})

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`FFmpeg RTMP Bridge listening on port ${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing all streams...')
  for (const [streamId, session] of activeProcesses.entries()) {
    console.log(`Killing stream ${streamId}`)
    session.process.kill()
  }
  process.exit(0)
})
