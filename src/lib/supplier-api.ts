/**
 * 🛡️ 2026-06-01 도매몰 INC-6: 공급자(도매상) 전용 API 헬퍼.
 *   supplier_token (JWT type='supplier') 을 Authorization 헤더로 첨부.
 *   셀러/어드민 토큰 흐름과 분리 — 충돌 방지.
 */
const TOKEN_KEY = 'supplier_token';
const REFRESH_KEY = 'supplier_refresh_token';

export function getSupplierToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setSupplierSession(token: string, supplier: { id: number; business_name: string; email: string }, refreshToken?: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    localStorage.setItem('supplier_id', String(supplier.id));
    localStorage.setItem('supplier_name', supplier.business_name);
  } catch { /* ignore */ }
}

export function clearSupplierSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem('supplier_id');
    localStorage.removeItem('supplier_name');
  } catch { /* ignore */ }
}

export function isSupplierLoggedIn(): boolean {
  return !!getSupplierToken();
}

// 🛡️ 2026-06-17 (로그인 영역 감사): access token 만료(401) 시 refresh 로 자동 갱신 →
//   제조사가 30일마다 재로그인하던 것 해소(셀러/어드민과 동일 흐름). inflight 락으로
//   동시 401 들이 한 번의 refresh 결과를 공유(중복 rotation/race 방지).
let _refreshInflight: Promise<string | null> | null = null;
async function refreshSupplierToken(): Promise<string | null> {
  let refreshToken: string | null = null;
  try { refreshToken = localStorage.getItem(REFRESH_KEY); } catch { refreshToken = null; }
  if (!refreshToken) return null;
  if (_refreshInflight) return _refreshInflight;
  _refreshInflight = (async () => {
    try {
      const res = await fetch('/api/supplier/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const data = await res.json().catch(() => null) as { success?: boolean; data?: { accessToken?: string; refreshToken?: string } } | null;
      if (res.ok && data?.success && data.data?.accessToken) {
        try {
          localStorage.setItem(TOKEN_KEY, data.data.accessToken);
          if (data.data.refreshToken) localStorage.setItem(REFRESH_KEY, data.data.refreshToken);
        } catch { /* ignore */ }
        return data.data.accessToken;
      }
      return null;
    } catch {
      return null;
    } finally {
      _refreshInflight = null;
    }
  })();
  return _refreshInflight;
}

type Json = Record<string, unknown>;

async function request<T = Json>(method: string, path: string, body?: unknown, _retried = false): Promise<T> {
  const token = getSupplierToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(path, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  // 🛡️ 2026-06-17 (로그인 영역 감사): 401(인증 만료) 시 refresh 로 1회 자동 갱신 후 재시도 → 실패할 때만 로그아웃.
  //   403(권한 없음)은 인증과 무관 → 세션을 건드리지 않고 에러만 throw(페이지가 "권한 없음" 처리).
  //   기존엔 401||403 둘 다 즉시 로그아웃 + refresh 부재로 30일마다 재로그인이었다.
  //   (메인 lib/api.ts 와 정합 — 거기도 403 은 로그아웃하지 않고, 401 은 refresh 후 재시도.)
  if (res.status === 401) {
    if (!_retried) {
      const newToken = await refreshSupplierToken();
      if (newToken) return request<T>(method, path, body, true);
    }
    clearSupplierSession();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/supplier/login')) {
      window.location.href = '/supplier/login';
    }
  }

  const data = await res.json().catch(() => ({})) as T & { success?: boolean; error?: string };
  if (!res.ok || data?.success === false) {
    throw new Error(data?.error || `요청 실패 (${res.status})`);
  }
  return data;
}

export const supplierApi = {
  get: <T = Json>(path: string) => request<T>('GET', path),
  post: <T = Json>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T = Json>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  put: <T = Json>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T = Json>(path: string) => request<T>('DELETE', path),
};
