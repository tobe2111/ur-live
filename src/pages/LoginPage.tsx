import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Play } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await axios.post('/api/auth/user/login', {
        email,
        password
      })

      if (response.data.success) {
        const { access_token, user } = response.data.data

        // localStorage에 저장
        localStorage.setItem('userId', user.id.toString())
        localStorage.setItem('userName', user.name)
        localStorage.setItem('userEmail', user.email)
        localStorage.setItem('accessToken', access_token)

        // 메인 페이지로 이동
        alert(`환영합니다, ${user.name}님!`)
        navigate('/')
      } else {
        setError(response.data.error || '로그인에 실패했습니다.')
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.response?.data?.error || '로그인 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fbfbfd] to-white flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <Link to="/" className="flex items-center space-x-2 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#007aff] to-[#0051d5]">
          <Play className="h-5 w-5 text-white fill-white" />
        </div>
        <span className="text-[24px] font-semibold tracking-tight text-[#1d1d1f]">
          유어 라이브
        </span>
      </Link>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-[24px]">로그인</CardTitle>
          <CardDescription>
            이메일과 비밀번호로 로그인하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">
                이메일
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="test@example.com"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007aff] transition-all"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007aff] transition-all"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full apple-button h-11 text-[16px]"
            >
              {loading ? '로그인 중...' : '로그인'}
            </Button>

            <div className="pt-4 border-t space-y-2">
              <p className="text-sm text-gray-600 text-center">
                테스트 계정으로 로그인해보세요
              </p>
              <div className="bg-[#f5f5f7] rounded-lg p-3 space-y-1 text-xs text-gray-700">
                <div><strong>계정 1:</strong> test@example.com / test123</div>
                <div><strong>계정 2:</strong> user@example.com / user123</div>
                <div><strong>계정 3:</strong> demo@example.com / demo123</div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mt-6 text-center">
        <Link to="/" className="text-sm text-[#007aff] hover:text-[#0051d5] transition-colors">
          ← 메인으로 돌아가기
        </Link>
      </div>
    </div>
  )
}
