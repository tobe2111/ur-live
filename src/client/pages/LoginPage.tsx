// Login Page - 29cm Inspired Design
import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth.store';
import type { ApiResponse } from '../../shared/types';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore(s => s.setAuth);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 환경 변수에서 Kakao REST API Key 가져오기
  const KAKAO_REST_API_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY;
  if (!KAKAO_REST_API_KEY) {
    console.error('[LoginPage] ⚠️ VITE_KAKAO_REST_API_KEY is not set in environment variables');
  }
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
      const returnUrl = searchParams.get('returnUrl') || '/';
      navigate(returnUrl, { replace: true });
    }
  }, [searchParams, navigate]);

  const handleKakaoLogin = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!KAKAO_REST_API_KEY) {
      setError('카카오 로그인 설정이 올바르지 않습니다.');
      return;
    }

    const returnUrl = searchParams.get('returnUrl') || '/';
    const state = encodeURIComponent(returnUrl);
    
    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?` +
      `client_id=${KAKAO_REST_API_KEY}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code` +
      `&state=${state}`;
    
    window.location.href = kakaoAuthUrl;
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
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
        const returnUrl = searchParams.get('returnUrl') || '/';
        navigate(returnUrl);
      } else {
        setError(res.error ?? '로그인에 실패했습니다');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    try {
      const res = await api.post<ApiResponse<{
        access_token: string;
        refresh_token: string;
        user: { id: string; email: string; name: string; role: string };
      }>>('/auth/register', { email, password, name, phone });

      if (res.success && res.data) {
        setAuth(res.data.user, res.data.access_token, res.data.refresh_token);
        const returnUrl = searchParams.get('returnUrl') || '/';
        navigate(returnUrl);
      } else {
        setError(res.error ?? '회원가입에 실패했습니다');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '회원가입에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row" style={{ isolation: 'isolate' }}>
      {/* Left Side - Brand & Image */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden shrink-0" style={{ pointerEvents: 'none' }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500 rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16 text-white pointer-events-none">
          <h1 className="text-5xl font-bold mb-6">
            글로벌 마켓플레이스
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            라이브 커머스의 새로운 기준
          </p>
          <div className="space-y-4 text-gray-400">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>실시간 라이브 쇼핑</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>다양한 판매자 상품</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>안전한 결제 시스템</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login/Register Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative" style={{ pointerEvents: 'auto' }}>
        <div className="w-full max-w-md relative z-20" style={{ pointerEvents: 'auto' }}>
          {/* Logo for mobile */}
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">글로벌 마켓플레이스</h1>
            <p className="text-sm text-gray-500 mt-1">라이브 커머스</p>
          </div>

          {/* Tab Switcher */}
          <div className="flex gap-2 mb-8 bg-gray-100 p-1 rounded-lg relative z-10">
            <button
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-2.5 px-4 rounded-md font-medium transition-all ${
                mode === 'login'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              로그인
            </button>
            <button
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 py-2.5 px-4 rounded-md font-medium transition-all ${
                mode === 'register'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              회원가입
            </button>
          </div>

          {/* Error Message - Fixed Height to prevent layout shift */}
          <div className="min-h-[20px] mb-6 relative z-0">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>

          {/* Kakao Login Button */}
          <div className="relative z-30 mb-4 kakao-login-btn-force-clickable" style={{ pointerEvents: 'auto' }}>
            <button
              type="button"
              disabled={false}
              onClick={handleKakaoLogin}
              style={{ pointerEvents: 'auto', cursor: 'pointer' }}
              className="kakao-login-btn-force-clickable w-full py-4 px-6 bg-[#FEE500] hover:bg-[#FDD835] active:bg-[#FDD700] text-[#191919] font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-3 shadow-sm hover:shadow relative z-10"
            >
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="currentColor"
                className="flex-shrink-0 pointer-events-none"
              >
                <path d="M12 3C6.477 3 2 6.253 2 10.253c0 2.625 1.82 4.92 4.513 6.237-.196.712-.642 2.359-.735 2.738-.11.448.164.442.345.321.145-.097 2.32-1.549 3.214-2.146.553.076 1.121.116 1.697.116 5.523 0 10-3.253 10-7.253S17.523 3 12 3z"/>
              </svg>
              <span className="text-base pointer-events-none">카카오 로그인</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">또는 이메일로 {mode === 'login' ? '로그인' : '회원가입'}</span>
            </div>
          </div>

          {/* Email Login Form */}
          {mode === 'login' ? (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  이메일
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="your@email.com"
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  비밀번호
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="••••••••"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? '로그인 중...' : '로그인'}
              </button>
            </form>
          ) : (
            /* Email Register Form */
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="register-name" className="block text-sm font-medium text-gray-700 mb-2">
                  이름
                </label>
                <input
                  id="register-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="홍길동"
                  required
                />
              </div>
              <div>
                <label htmlFor="register-email" className="block text-sm font-medium text-gray-700 mb-2">
                  이메일
                </label>
                <input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="your@email.com"
                  required
                />
              </div>
              <div>
                <label htmlFor="register-password" className="block text-sm font-medium text-gray-700 mb-2">
                  비밀번호
                </label>
                <input
                  id="register-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="8자 이상"
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label htmlFor="register-phone" className="block text-sm font-medium text-gray-700 mb-2">
                  전화번호 <span className="text-gray-400 text-xs">(선택)</span>
                </label>
                <input
                  id="register-phone"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="010-1234-5678"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? '회원가입 중...' : '회원가입'}
              </button>
            </form>
          )}

          {/* Footer Links */}
          <div className="mt-6 text-center text-sm text-gray-500">
            <Link to="/" className="hover:text-gray-900 transition-colors">
              홈으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
