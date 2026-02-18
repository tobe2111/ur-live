/**
 * 🧪 ur-live Authentication Flow Test
 * 
 * Copy and paste this entire script into browser console (F12)
 * Run after logging in with Kakao
 */

console.log('=================================================')
console.log('🧪 ur-live Authentication Flow Test')
console.log('=================================================')
console.log('')

// Test 1: Check localStorage keys
console.log('TEST 1: localStorage Keys')
console.log('----------------------------------------')
const authData = {
  user_session_token: localStorage.getItem('user_session_token'),
  user_id: localStorage.getItem('user_id'),
  user_type: localStorage.getItem('user_type'),
  user_name: localStorage.getItem('user_name'),
  user_email: localStorage.getItem('user_email')
}
console.table(authData)

const hasAuth = authData.user_session_token && authData.user_id
console.log(hasAuth ? '✅ Authentication data present' : '❌ Missing authentication data')
console.log('')

// Test 2: Check for legacy keys (should be empty)
console.log('TEST 2: Legacy Keys (should be empty)')
console.log('----------------------------------------')
const legacyKeys = {
  session: localStorage.getItem('session'),
  accessToken: localStorage.getItem('accessToken'),
  userId: localStorage.getItem('userId'),
  userName: localStorage.getItem('userName')
}
console.table(legacyKeys)

const hasLegacy = Object.values(legacyKeys).some(v => v !== null)
console.log(hasLegacy ? '⚠️  Legacy keys found (will be cleaned)' : '✅ No legacy keys')
console.log('')

// Test 3: API Authentication Test
console.log('TEST 3: API Authentication')
console.log('----------------------------------------')
if (!authData.user_session_token) {
  console.error('❌ No session token found. Please login first.')
} else {
  console.log('Testing /api/cart endpoint...')
  
  fetch('/api/cart', {
    headers: {
      'Authorization': `Bearer ${authData.user_session_token}`,
      'Content-Type': 'application/json'
    }
  })
  .then(response => {
    console.log('Response status:', response.status)
    return response.json()
  })
  .then(data => {
    console.log('Response data:', data)
    
    if (data.success) {
      console.log('✅ API Authentication SUCCESS')
      console.log(`   Cart has ${data.data?.length || 0} items`)
    } else {
      console.error('❌ API returned error:', data.error)
    }
  })
  .catch(error => {
    console.error('❌ API call failed:', error)
  })
}
console.log('')

// Test 4: isLoggedIn() function simulation
console.log('TEST 4: Login State Check')
console.log('----------------------------------------')
function isLoggedIn() {
  const token = localStorage.getItem('user_session_token') || localStorage.getItem('session')
  const userId = localStorage.getItem('user_id') || localStorage.getItem('userId')
  return !!(token && userId)
}

const loggedIn = isLoggedIn()
console.log('isLoggedIn():', loggedIn ? '✅ Logged in' : '❌ Not logged in')
console.log('')

// Summary
console.log('=================================================')
console.log('📊 Test Summary')
console.log('=================================================')
console.log(`✅ Authentication Keys: ${hasAuth ? 'PASS' : 'FAIL'}`)
console.log(`✅ No Legacy Keys: ${!hasLegacy ? 'PASS' : 'FAIL'}`)
console.log(`✅ Login State: ${loggedIn ? 'PASS' : 'FAIL'}`)
console.log('')
console.log('Next steps:')
console.log('1. Go to: https://live.ur-team.com/live/2')
console.log('2. Click "장바구니 담기"')
console.log('3. Click "구매하기"')
console.log('4. Verify cart page shows (NOT /login redirect)')
console.log('=================================================')
