/**
 * useUserAuth — Session-cookie-based user authentication hook
 *
 * Replaces useAuthKR for determining user login state when httpOnly
 * session cookies are used (Kakao login).
 *
 * On mount, calls GET /api/auth/me (cookie sent automatically).
 * If the server returns user data the user is logged in.
 * If 401, the user is not logged in.
 *
 * Seller/Admin login is NOT affected — they continue using JWT Bearer tokens.
 */

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

export interface SessionUser {
  id: string | number;
  name: string;
  email: string;
  profileImage: string | null;
  role: string;
}

interface UseUserAuthReturn {
  user: SessionUser | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useUserAuth(): UseUserAuthReturn {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/api/auth/me');
      if (res.data?.success && res.data.data) {
        setUser(res.data.data);
      } else {
        setUser(null);
      }
    } catch {
      // 401 or network error — user is not logged in via session cookie
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Best-effort — cookie may already be cleared
    }
    setUser(null);
    // Clean up localStorage user data
    localStorage.removeItem('user_type');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_profile_image');
  }, []);

  return {
    user,
    isLoading,
    isLoggedIn: !!user,
    logout,
    refresh: fetchMe,
  };
}
