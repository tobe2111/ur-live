// Login Page
import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LogIn, Mail, Lock, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth.store';
import type { ApiResponse } from '../../shared/types';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore(s => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 환경 변수에서 Kakao REST API Key 가져오기
  const KAKAO_REST_API_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY || '5dd74bccb797640b0efd070467f3bafd';
  const REDIRECT_URI = `${window.location.origin}/auth/kakao/sync/callback`;

  // 카카오 로그인 콜백 처리
  useEffect(() => {
    const firebaseToken = searchParams.get('firebase_token');
    const userName = searchParams.get('userName');
    const errorParam = searchParams.get('error');
    
    if (errorParam) {
      const detail = searchParams.get('detail');
      setError(`카카오 로그인 실패: ${detail || errorParam}`);
      console.error('[LoginPage] ❌ Kakao OAuth error:', errorParam, detail);
      return;
    }
    
    if (firebaseToken && userName) {
      console.log('[LoginPage] ✅ Received Firebase token from Kakao OAuth');
      // TODO: Sign in with Firebase custom token and save user info
      // For now, just navigate to home
      navigate('/', { replace: true });
    }
  }, [searchParams, navigate]);

  // 디버깅: 환경 변수 확인
  useEffect(() => {
    console.log('[LoginPage] 🔑 KAKAO_REST_API_KEY:', KAKAO_REST_API_KEY ? '✅ 설정됨' : '❌ 비어있음');
    console.log('[LoginPage] 📍 REDIRECT_URI:', REDIRECT_URI);
  }, [KAKAO_REST_API_KEY, REDIRECT_URI]);

  const handleKakaoLogin = (e: React.MouseEvent) => {
    e.preventDefault();
    console.log('[LoginPage] 🚀 카카오 로그인 시작');
    console.log('[LoginPage] 🔑 API Key:', KAKAO_REST_API_KEY);
    console.log('[LoginPage] 📍 Redirect URI:', REDIRECT_URI);
    
    if (!KAKAO_REST_API_KEY) {
      console.error('[LoginPage] ❌ 카카오 REST API Key 없음');
      setError('카카오 로그인 설정이 올바르지 않습니다.');
      return;
    }

    // State 파라미터로 returnUrl 전달
    const returnUrl = searchParams.get('returnUrl') || '/';
    const state = encodeURIComponent(returnUrl);
    
    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?` +
      `client_id=${KAKAO_REST_API_KEY}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code` +
      `&state=${state}`;
    
    console.log('[LoginPage] 🔗 Redirecting to:', kakaoAuthUrl);
    window.location.href = kakaoAuthUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await api.post<ApiResponse<{
        access_token: string;
        refresh_token: string;
        user: { id: string; email: string; name: string; role: string };
      }>>('/auth/login', { email, password });

      if (res.success && res.data) {
        setAuth(res.data.user, res.data.access_token, res.data.refresh_token);
        navigate('/');
      } else {
        setError(res.error ?? '로그인에 실패했습니다');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="text-center mb-6">
            <LogIn className="w-10 h-10 text-blue-600 mx-auto mb-2" />
            <h1 className="text-2xl font-bold text-gray-900">로그인</h1>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input-field pl-9"
                  placeholder="your@email.com"
                  required
                  data-testid="login-email"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-field pl-9"
                  placeholder="••••••••"
                  required
                  data-testid="login-password"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 text-base"
              data-testid="login-submit"
            >
              {isLoading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          {/* 소셜 로그인 구분선 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">또는</span>
            </div>
          </div>

          {/* 카카오 로그인 버튼 - 재구현 */}
          <button
            type="button"
            onClick={handleKakaoLogin}
            className="w-full py-3.5 px-4 bg-[#FEE500] hover:bg-[#FDD835] active:bg-[#FDD700] text-[#191919] font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-3 shadow-sm hover:shadow-md border border-[#F7E600]"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {/* Kakao 아이콘 */}
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="currentColor"
              className="flex-shrink-0"
            >
              <path d="M12 3C6.477 3 2 6.253 2 10.253c0 2.625 1.82 4.92 4.513 6.237-.196.712-.642 2.359-.735 2.738-.11.448.164.442.345.321.145-.097 2.32-1.549 3.214-2.146.553.076 1.121.116 1.697.116 5.523 0 10-3.253 10-7.253S17.523 3 12 3z"/>
            </svg>
            <span className="text-base font-medium">카카오 로그인</span>
          </button>

          <p className="text-center text-sm text-gray-500 mt-4">
            계정이 없으신가요?{' '}
            <Link to="/register" className="text-blue-600 hover:underline">회원가입</Link>
          </p>

          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
            <p className="font-medium mb-1">테스트 계정</p>
            <p>이메일: buyer@test.com</p>
            <p>비밀번호: test1234!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
