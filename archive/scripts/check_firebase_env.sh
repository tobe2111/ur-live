#!/bin/bash

# 🔍 Firebase 환경변수 체크 스크립트

echo "🔍 Firebase 환경변수 진단 시작..."
echo ""

# ============================================
# 1. wrangler.toml 확인
# ============================================
echo "📄 wrangler.toml 확인:"
echo ""

if [ -f "wrangler.toml" ]; then
  echo "✅ wrangler.toml 파일 존재"
  
  # vars 섹션 확인
  if grep -q "\[vars\]" wrangler.toml; then
    echo "✅ [vars] 섹션 존재"
    grep -A 5 "\[vars\]" wrangler.toml
  else
    echo "⚠️  [vars] 섹션 없음"
  fi
  
  echo ""
else
  echo "❌ wrangler.toml 파일 없음!"
  echo ""
fi

# ============================================
# 2. .env 파일 확인 (로컬 개발용)
# ============================================
echo "📄 .env 파일 확인:"
echo ""

if [ -f ".env" ]; then
  echo "✅ .env 파일 존재"
  
  # Firebase 관련 변수 확인
  if grep -q "FIREBASE_" .env; then
    echo "✅ Firebase 환경변수 발견:"
    grep "FIREBASE_" .env | sed 's/=.*/=***/' # 값은 숨김
  else
    echo "⚠️  Firebase 환경변수 없음"
  fi
  
  echo ""
else
  echo "⚠️  .env 파일 없음 (로컬 개발용)"
  echo ""
fi

# ============================================
# 3. 필수 환경변수 체크리스트
# ============================================
echo "📋 필수 환경변수 체크리스트:"
echo ""

REQUIRED_VARS=(
  "FIREBASE_PROJECT_ID"
  "FIREBASE_PRIVATE_KEY"
  "FIREBASE_CLIENT_EMAIL"
  "FIREBASE_DATABASE_URL"
)

for var in "${REQUIRED_VARS[@]}"; do
  if grep -q "$var" wrangler.toml .env 2>/dev/null; then
    echo "✅ $var - 발견됨"
  else
    echo "❌ $var - 없음!"
  fi
done

echo ""

# ============================================
# 4. Cloudflare Pages 환경변수 확인 방법
# ============================================
echo "☁️  Cloudflare Pages 환경변수 확인 방법:"
echo ""
echo "1. Cloudflare Dashboard 접속:"
echo "   https://dash.cloudflare.com/"
echo ""
echo "2. Pages → ur-live 프로젝트 선택"
echo ""
echo "3. Settings → Environment variables 확인"
echo ""
echo "4. 다음 변수가 설정되어 있어야 함:"
for var in "${REQUIRED_VARS[@]}"; do
  echo "   - $var"
done
echo ""

# ============================================
# 5. 환경변수 설정 명령어
# ============================================
echo "🔧 환경변수 설정 명령어:"
echo ""
echo "# Cloudflare Pages (프로덕션)"
echo "npx wrangler pages secret put FIREBASE_PROJECT_ID"
echo "npx wrangler pages secret put FIREBASE_PRIVATE_KEY"
echo "npx wrangler pages secret put FIREBASE_CLIENT_EMAIL"
echo "npx wrangler pages secret put FIREBASE_DATABASE_URL"
echo ""
echo "# 또는 Cloudflare Dashboard에서 수동 설정"
echo ""

# ============================================
# 6. Firebase Private Key 형식 확인
# ============================================
echo "🔑 Firebase Private Key 형식 주의사항:"
echo ""
echo "❌ 잘못된 형식:"
echo '   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg...\n-----END PRIVATE KEY-----"'
echo ""
echo "✅ 올바른 형식 (JSON에서 그대로):"
echo '   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg...\n-----END PRIVATE KEY-----"'
echo ""
echo "✅ 또는 Cloudflare에서 multi-line으로 입력:"
echo "   -----BEGIN PRIVATE KEY-----"
echo "   MIIEvgIBADANBg..."
echo "   -----END PRIVATE KEY-----"
echo ""

# ============================================
# 7. 테스트 방법
# ============================================
echo "🧪 환경변수 테스트 방법:"
echo ""
echo "1. 로컬 테스트:"
echo "   npx wrangler pages dev dist"
echo ""
echo "2. 환경변수 출력 테스트 (임시):"
echo "   src/index.tsx에 다음 추가:"
echo '   console.log("FIREBASE_PROJECT_ID:", env.FIREBASE_PROJECT_ID)'
echo '   console.log("FIREBASE_CLIENT_EMAIL:", env.FIREBASE_CLIENT_EMAIL)'
echo ""
echo "3. 프로덕션 배포 후 로그 확인:"
echo "   npx wrangler pages deployment tail"
echo ""

echo "✅ 진단 완료!"
echo ""
echo "📚 자세한 내용은 ENV_VARS_GUIDE.md 참조"
