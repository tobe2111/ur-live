// Register Page
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth.store';
import type { ApiResponse } from '../../shared/types';

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);
  const [formData, setFormData] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await api.post<ApiResponse<{
        access_token: string;
        refresh_token: string;
        user: { id: string; email: string; name: string; role: string };
      }>>('/auth/register', formData);

      if (res.success && res.data) {
        setAuth(res.data.user, res.data.access_token, res.data.refresh_token);
        navigate('/');
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
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="text-center mb-6">
            <UserPlus className="w-10 h-10 text-blue-600 mx-auto mb-2" />
            <h1 className="text-2xl font-bold text-gray-900">회원가입</h1>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                className="input-field"
                placeholder="홍길동"
                required
                data-testid="register-name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                className="input-field"
                placeholder="your@email.com"
                required
                data-testid="register-email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
              <input
                type="password"
                value={formData.password}
                onChange={e => setFormData(f => ({ ...f, password: e.target.value }))}
                className="input-field"
                placeholder="8자 이상"
                required
                minLength={8}
                data-testid="register-password"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 text-base"
              data-testid="register-submit"
            >
              {isLoading ? '처리 중...' : '회원가입'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            이미 계정이 있으신가요?{' '}
            <Link to="/login" className="text-blue-600 hover:underline">로그인</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
