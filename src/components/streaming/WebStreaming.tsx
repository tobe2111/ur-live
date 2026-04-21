/**
 * Web-Based Live Streaming Component
 * Zero-setup streaming directly from browser
 */

import { useState, useRef, useEffect } from 'react'
import { Play, Square, Camera, Monitor, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface WebStreamingProps {
  rtmpUrl: string
  rtmpKey: string
  streamId: number
  products: Array<{
    id: number
    name: string
    price: number
    image_url: string
    discount_rate?: number
  }>
  onStatusChange?: (status: 'idle' | 'starting' | 'live' | 'error') => void
}

export default function WebStreaming({
  rtmpUrl,
  rtmpKey,
  streamId,
  products,
  onStatusChange
}: WebStreamingProps) {
  const [status, setStatus] = useState<'idle' | 'starting' | 'live' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [sourceType, setSourceType] = useState<'camera' | 'screen'>('camera')
  const [currentProductIndex, setCurrentProductIndex] = useState(0)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number>(0)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    return () => {
      stopStreaming()
    }
  }, [])

  /**
   * Start media capture
   */
  async function startMediaCapture() {
    try {
      let stream: MediaStream

      if (sourceType === 'camera') {
        // Camera + Microphone
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 48000
          }
        })
      } else {
        // Screen capture + System audio
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          },
          audio: true
        })
      }

      mediaStreamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      return stream
    } catch (err: any) {
      throw new Error(`미디어 캡처 실패: ${err.message}`)
    }
  }

  /**
   * Draw product overlay on canvas
   */
  function drawProductOverlay(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const product = products[currentProductIndex]
    if (!product) return

    // Overlay background (bottom-right)
    const overlayWidth = 400
    const overlayHeight = 150
    const overlayX = width - overlayWidth - 20
    const overlayY = height - overlayHeight - 20

    // Semi-transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.roundRect(overlayX, overlayY, overlayWidth, overlayHeight, 12)
    ctx.fill()

    // Product image
    const imgSize = 120
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = product.image_url
    ctx.drawImage(img, overlayX + 15, overlayY + 15, imgSize, imgSize)

    // Product info
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 24px sans-serif'
    ctx.fillText(product.name, overlayX + imgSize + 30, overlayY + 40)

    ctx.font = 'bold 32px sans-serif'
    ctx.fillStyle = '#00ff00'
    ctx.fillText(`₩${(product.price || 0).toLocaleString()}`, overlayX + imgSize + 30, overlayY + 80)

    if (product.discount_rate) {
      ctx.font = 'bold 20px sans-serif'
      ctx.fillStyle = '#ff3b30'
      ctx.fillText(`${product.discount_rate}% OFF`, overlayX + imgSize + 30, overlayY + 110)
    }

    // "구매하기" button
    ctx.fillStyle = '#007aff'
    ctx.roundRect(overlayX + imgSize + 30, overlayY + overlayHeight - 50, 100, 35, 8)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 16px sans-serif'
    ctx.fillText('구매하기', overlayX + imgSize + 45, overlayY + overlayHeight - 25)
  }

  /**
   * Render video frame with overlay
   */
  function renderFrame() {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(renderFrame)
      return
    }

    // Set canvas size to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Draw overlay
    drawProductOverlay(ctx, canvas.width, canvas.height)

    // Continue rendering
    animationFrameRef.current = requestAnimationFrame(renderFrame)
  }

  /**
   * Connect WebSocket for real-time control
   */
  function connectWebSocket() {
    const baseUrl = import.meta.env.VITE_RTMP_SERVER_URL || 'wss://live.ur-team.com'
    const wsUrl = `${baseUrl}/ws/stream/${streamId}`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'seller_join', streamId }))
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === 'switch_product') {
        setCurrentProductIndex(data.productIndex)
      } else if (data.type === 'chat_message') {
        // Handle incoming chat
      }
    }

    ws.onerror = (err) => {
      console.error('[WebSocket] Error:', err)
    }

    wsRef.current = ws
  }

  /**
   * Start streaming
   */
  async function startStreaming() {
    try {
      setStatus('starting')
      setError(null)
      onStatusChange?.('starting')

      // Step 1: Capture media
      const stream = await startMediaCapture()

      // Step 2: Start canvas rendering
      animationFrameRef.current = requestAnimationFrame(renderFrame)

      // Step 3: Connect WebSocket
      connectWebSocket()

      // Step 4: Start RTMP push (using FFmpeg.wasm or WebRTC-to-RTMP bridge)
      // Note: Browser cannot directly push RTMP, so we need a bridge
      await startRTMPBridge(stream)

      setStatus('live')
      onStatusChange?.('live')
    } catch (err: any) {
      console.error('[Streaming] Error:', err)
      setError(err.message)
      setStatus('error')
      onStatusChange?.('error')
    }
  }

  /**
   * Start RTMP bridge (WebRTC → Server → RTMP)
   */
  async function startRTMPBridge(stream: MediaStream) {
    // Option A: Use WebRTC to send to our server, which pushes to YouTube RTMP
    // Option B: Use MediaRecorder to send chunks via WebSocket
    // Option C: Use FFmpeg.wasm (heavy, ~20MB)

    // For now, we'll use a hybrid approach:
    // MediaRecorder → WebSocket → Server → FFmpeg → RTMP

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9,opus',
      videoBitsPerSecond: 5000000 // 5 Mbps
    })

    mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
        // Send video chunks to server
        wsRef.current.send(event.data)
      }
    }

    mediaRecorder.start(100) // Send chunks every 100ms
  }

  /**
   * Stop streaming
   */
  function stopStreaming() {
    // Stop media tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }

    // Stop canvas rendering
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setStatus('idle')
    onStatusChange?.('idle')
  }

  /**
   * Switch product
   */
  function switchProduct(index: number) {
    setCurrentProductIndex(index)
    
    // Broadcast to other clients
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'switch_product',
        productIndex: index
      }))
    }
  }

  return (
    <div className="space-y-6">
      {/* Source Selection */}
      <div className="flex gap-3">
        <Button
          onClick={() => setSourceType('camera')}
          variant={sourceType === 'camera' ? 'default' : 'outline'}
          className="flex-1"
        >
          <Camera className="h-4 w-4 mr-2" />
          카메라
        </Button>
        <Button
          onClick={() => setSourceType('screen')}
          variant={sourceType === 'screen' ? 'default' : 'outline'}
          className="flex-1"
        >
          <Monitor className="h-4 w-4 mr-2" />
          화면 공유
        </Button>
      </div>

      {/* Video Preview */}
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted
          playsInline
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ display: status === 'live' ? 'block' : 'none' }}
        />
        
        {status === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <p className="text-lg">미리보기가 여기에 표시됩니다</p>
          </div>
        )}

        {status === 'live' && (
          <div className="absolute top-4 left-4 bg-red-600 text-white px-4 py-2 rounded-full font-bold flex items-center gap-2">
            <span className="w-3 h-3 bg-white rounded-full animate-pulse"></span>
            LIVE
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-900 mb-1">스트리밍 오류</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex gap-3">
        {status === 'idle' && (
          <Button
            onClick={startStreaming}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white h-14 text-lg font-bold"
          >
            <Play className="h-6 w-6 mr-2" />
            브라우저에서 바로 시작
          </Button>
        )}

        {status === 'starting' && (
          <Button disabled className="flex-1 h-14">
            <Loader2 className="h-6 w-6 mr-2 animate-spin" />
            시작 중...
          </Button>
        )}

        {status === 'live' && (
          <Button
            onClick={stopStreaming}
            variant="destructive"
            className="flex-1 h-14 text-lg font-bold"
          >
            <Square className="h-6 w-6 mr-2" />
            방송 종료
          </Button>
        )}
      </div>

      {/* Product Switcher (only when live) */}
      {status === 'live' && products.length > 1 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-gray-700">실시간 상품 전환</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {products.map((product, index) => (
              <button
                key={product.id}
                onClick={() => switchProduct(index)}
                className={`
                  p-3 rounded-lg border-2 transition-all text-left
                  ${currentProductIndex === index
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                  }
                `}
              >
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full aspect-square object-cover rounded mb-2"
                />
                <p className="text-xs font-semibold truncate">{product.name}</p>
                <p className="text-xs text-gray-600">₩{product.price.toLocaleString()}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tech Info */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>✅ 브라우저에서 직접 스트리밍 (OBS/Prism 불필요)</p>
        <p>✅ 실시간 상품 오버레이 자동 표시</p>
        <p>✅ 카메라 또는 화면 공유 선택</p>
        <p>⚠️ Chrome/Edge 권장 (Safari는 제한적 지원)</p>
      </div>
    </div>
  )
}
