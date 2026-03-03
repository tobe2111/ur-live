/**
 * 🚀 AuthContext - Multi-Auth Support (완전 재작성)
 * 
 * 인증 방식:
 * 1. Buyer (일반 구매자): Firebase Auth (Kakao/Email)
 * 2. Seller (판매자): JWT Token (localStorage)
 * 3. Admin (관리자): JWT Token (localStorage)
 * 
 * 핵심 원칙:
 * - Firebase는 buyer만 처리
 * - Seller/Admin은 JWT로 독립 처리
 * - 경로별로 적절한 인증 방식 사용
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { 
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import api from '@/lib/api'

// ============================================
// Types
// ============================================

type UserType = 'buyer' | 'seller' | 'admin' | null

interface AuthUser {
  id: string
  email: string
  name: string
  type: UserType
  firebaseUser?: User  // buyer only
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  isAuthReady: boolean
  isLoggedIn: boolean
  userType: UserType
  
  // Buyer methods (Firebase)
  loginWithEmail: (email: string, password: string) => Promise<void>
  signupWithEmail: (email: string, password: string, name: string) => Promise<void>
  loginWithKakao: (accessToken: string) => Promise<void>
  
  // Universal
  logout: () => Promise<void>
}

// ============================================
// Context
// ============================================

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

// ============================================
// Provider
// ============================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthReady, setIsAuthReady] = useState(false)

  // ============================================
  // 🔍 Check JWT Authentication (Seller/Admin)
  // ============================================
  
  const checkJWTAuth = async (): Promise<AuthUser | null> => {
    const userType = localStorage.getItem('user_type')
    
    // Check seller JWT
    if (userType === 'seller') {
      const sellerToken = localStorage.getItem('seller_token')
      const sellerId = localStorage.getItem('seller_id')
      const sellerName = localStorage.getItem('seller_name') || localStorage.getItem('user_name')
      const sellerEmail = localStorage.getItem('seller_email') || localStorage.getItem('user_email')
      
      if (sellerToken && sellerId) {
        console.log('[AuthContext] ✅ Seller JWT found:', { sellerId, sellerEmail })
        return {
          id: sellerId,
          email: sellerEmail || '',
          name: sellerName || '',
          type: 'seller'
        }
      }
    }
    
    // Check admin JWT
    if (userType === 'admin') {
      const adminToken = localStorage.getItem('admin_token')
      const adminId = localStorage.getItem('admin_id')
      const adminName = localStorage.getItem('user_name')
      const adminEmail = localStorage.getItem('user_email')
      
      if (adminToken && adminId) {
        console.log('[AuthContext] ✅ Admin JWT found:', { adminId, adminEmail })
        return {
          id: adminId,
          email: adminEmail || '',
          name: adminName || '',
          type: 'admin'
        }
      }
    }
    
    return null
  }

  // ============================================
  // 🔥 Initialize Authentication
  // ============================================
  
  useEffect(() => {
    const initAuth = async () => {
      const currentPath = location.pathname
      
      // 1️⃣ Seller/Admin paths: JWT only, skip Firebase
      if (currentPath.startsWith('/seller') || currentPath.startsWith('/admin')) {
        console.log('[AuthContext] 🔐 JWT path detected:', currentPath)
        
        const jwtUser = await checkJWTAuth()
        setUser(jwtUser)
        setLoading(false)
        setIsAuthReady(true)
        
        console.log('[AuthContext] JWT auth result:', jwtUser ? 'Logged in' : 'Not logged in')
        return
      }
      
      // 2️⃣ Buyer paths: Firebase Auth
      console.log('[AuthContext] 🔥 Firebase path detected:', currentPath)
      
      // First check JWT (in case seller/admin visits buyer pages)
      const jwtUser = await checkJWTAuth()
      if (jwtUser) {
        console.log('[AuthContext] ✅ JWT user on buyer path:', jwtUser.type)
        setUser(jwtUser)
        setLoading(false)
        setIsAuthReady(true)
        return
      }
      
      // Then set up Firebase listener
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          console.log('[AuthContext] 🔥 Firebase user:', firebaseUser.email)
          
          const userId = localStorage.getItem('user_id') || firebaseUser.uid
          const userName = localStorage.getItem('user_name') || firebaseUser.displayName || ''
          
          setUser({
            id: userId,
            email: firebaseUser.email || '',
            name: userName,
            type: 'buyer',
            firebaseUser
          })
        } else {
          console.log('[AuthContext] No Firebase user')
          setUser(null)
        }
        
        setLoading(false)
        setIsAuthReady(true)
      })
      
      // Timeout for slow Firebase
      const timeout = setTimeout(() => {
        if (loading) {
          console.warn('[AuthContext] ⏰ Firebase timeout, continuing...')
          setLoading(false)
          setIsAuthReady(true)
        }
      }, 3000)
      
      return () => {
        clearTimeout(timeout)
        unsubscribe()
      }
    }
    
    initAuth()
  }, [location.pathname])  // Re-run when path changes

  // ============================================
  // 🔄 Re-check JWT when localStorage changes
  // ============================================
  
  useEffect(() => {
    const handleStorageChange = async () => {
      const jwtUser = await checkJWTAuth()
      if (jwtUser && jwtUser.id !== user?.id) {
        console.log('[AuthContext] 🔄 JWT updated from localStorage')
        setUser(jwtUser)
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [user])

  // ============================================
  // 📋 Computed Values
  // ============================================
  
  const isLoggedIn = !!user
  const userType = user?.type || null

  // ============================================
  // 🔐 Buyer Login Methods (Firebase)
  // ============================================
  
  const loginWithEmail = async (email: string, password: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    const firebaseUser = userCredential.user
    const idToken = await firebaseUser.getIdToken()
    
    localStorage.setItem('firebase_token', idToken)
    localStorage.setItem('user_id', firebaseUser.uid)
    localStorage.setItem('user_type', 'buyer')
    
    console.log('[AuthContext] ✅ Buyer email login successful')
  }
  
  const signupWithEmail = async (email: string, password: string, name: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    const firebaseUser = userCredential.user
    const idToken = await firebaseUser.getIdToken()
    
    localStorage.setItem('firebase_token', idToken)
    localStorage.setItem('user_id', firebaseUser.uid)
    localStorage.setItem('user_name', name)
    localStorage.setItem('user_type', 'buyer')
    
    console.log('[AuthContext] ✅ Buyer signup successful')
  }
  
  const loginWithKakao = async (accessToken: string) => {
    // Call backend to get Firebase custom token
    const response = await api.post('/api/auth/kakao/login', { accessToken })
    const { firebaseToken, user: userData } = response.data.data
    
    // Sign in with custom token
    const userCredential = await signInWithCustomToken(auth, firebaseToken)
    const firebaseUser = userCredential.user
    const idToken = await firebaseUser.getIdToken()
    
    localStorage.setItem('firebase_token', idToken)
    localStorage.setItem('user_id', userData.id)
    localStorage.setItem('user_name', userData.name)
    localStorage.setItem('user_type', 'buyer')
    
    console.log('[AuthContext] ✅ Kakao login successful')
  }

  // ============================================
  // 🚪 Universal Logout
  // ============================================
  
  const logout = async () => {
    const currentType = user?.type
    
    console.log('[AuthContext] 🚪 Logging out:', currentType)
    
    // Clear all localStorage
    localStorage.clear()
    
    // Firebase signout (for buyers)
    try {
      await firebaseSignOut(auth)
    } catch (err) {
      console.warn('[AuthContext] Firebase signout failed (may not be logged in)')
    }
    
    setUser(null)
    
    console.log('[AuthContext] ✅ Logout complete')
  }

  // ============================================
  // 🎨 Render
  // ============================================
  
  // Debug log on every render
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[AuthContext] 🔄 Render:', {
        user: user?.type || 'null',
        loading,
        isAuthReady,
        path: location.pathname
      })
    }
  })

  const value: AuthContextType = {
    user,
    loading,
    isAuthReady,
    isLoggedIn,
    userType,
    loginWithEmail,
    signupWithEmail,
    loginWithKakao,
    logout
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
