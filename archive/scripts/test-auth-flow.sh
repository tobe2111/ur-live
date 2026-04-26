#!/bin/bash

# 🧪 Complete Authentication Flow Test Script
# Run this in browser console after clearing localStorage

echo "==================================================="
echo "🧪 ur-live Authentication Flow Test"
echo "==================================================="
echo ""

# STEP 1: Clear all storage
echo "STEP 1: Clearing localStorage..."
localStorage.clear()
sessionStorage.clear()
echo "✅ Storage cleared"
echo ""

# STEP 2: Test login endpoint
echo "STEP 2: Testing login..."
echo "👉 Please login at: https://live.ur-team.com/login"
echo "   Click '카카오로 시작하기'"
echo ""
read -p "Press Enter after you've logged in..."

# STEP 3: Verify localStorage
echo ""
echo "STEP 3: Verifying localStorage keys..."
echo "----------------------------------------"
console.log("user_session_token:", localStorage.getItem('user_session_token'))
console.log("user_id:", localStorage.getItem('user_id'))
console.log("user_type:", localStorage.getItem('user_type'))
console.log("user_name:", localStorage.getItem('user_name'))
echo ""

# STEP 4: Test API call
echo "STEP 4: Testing API authentication..."
fetch('/api/cart', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('user_session_token')
  }
})
.then(r => r.json())
.then(data => {
  console.log('✅ Cart API:', data)
  if (data.success) {
    console.log('✅ Authentication working!')
  } else {
    console.error('❌ Cart API failed:', data)
  }
})
.catch(err => console.error('❌ API Error:', err))

echo ""
echo "STEP 5: Navigate to live page..."
echo "👉 Go to: https://live.ur-team.com/live/2"
echo ""

echo "STEP 6: Add to cart and checkout..."
echo "👉 Click '장바구니 담기' then '구매하기'"
echo "   Expected: Cart page shows items"
echo "   NOT Expected: Redirect to /login"
echo ""

echo "==================================================="
echo "✅ Test Complete!"
echo "==================================================="
