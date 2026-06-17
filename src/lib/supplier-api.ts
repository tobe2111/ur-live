/**
 * 🛡️ 2026-06-01 도매몰 INC-6: 공급자(도매상) 전용 API 헬퍼.
 *   supplier_token (JWT type='supplier') 을 Authorization 헤더로 첨부.
 *   셀러/어드민 토큰 흐름과 분리 — 충돌 방지.
 */
const TOKEN_KEY = 'supplier_token';

export function getSupplierToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setSupplierSession(token: string, supplier: { id: number; business_name: string; email: string }) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem('supplier_id', String(supplier.id));
    localStorage.setItem('supplier_name', supplier.business_name);
  } catch { /* ignore */ }
}

export function clearSupplierSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('supplier_id');
    localStorage.removeItem('supplier_name');
  } catch { /* ignore */ }
}

export function isSupplierLoggedIn(): boolean {
  return !!getSupplierToken();
}

type Json = Record<string, unknown>;

async function request<T = Json>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getSupplierToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(path, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  // 🛡️ 2026-06-17 (로그인 영역 감사): 401(인증 만료)에서만 로그아웃.
  //   403(권한 없음)은 인증과 무관 → 세션을 건드리지 않고 에러만 throw(페이지가 "권한 없음" 처리).
  //   기존엔 401||403 둘 다 로그아웃해, 제조사가 단순 권한/일시적 403 에도 부당 로그아웃됐다.
  //   (메인 lib/api.ts 와 정합 — 거기도 403 은 로그아웃하지 않음.)
  if (res.status === 401) {
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
