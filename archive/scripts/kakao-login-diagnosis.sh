#!/bin/bash
# 카카오 로그인 진단 스크립트

echo "🔍 카카오 로그인 진단 시작..."
echo ""

# 1. 현재 프로덕션 URL 확인
PROD_URL="https://live.ur-team.com"
echo "📍 프로덕션 URL: $PROD_URL"
echo ""

# 2. HTTPS 확인
echo "🔒 HTTPS 확인 중..."
if curl -s -o /dev/null -w "%{http_code}" "$PROD_URL" | grep -q "200\|301\|302"; then
    echo "✅ HTTPS 접속 가능"
else
    echo "❌ HTTPS 접속 불가"
fi
echo ""

# 3. Redirect URI 확인
echo "🔗 Redirect URI 확인..."
REDIRECT_URI="$PROD_URL/auth/kakao/sync/callback"
echo "  예상 Redirect URI: $REDIRECT_URI"
echo ""

# 4. 환경 변수 확인 (로컬)
echo "🔑 환경 변수 확인 (로컬)..."
if [ -f ".dev.vars" ]; then
    echo "✅ .dev.vars 파일 존재"
    if grep -q "KAKAO_REST_API_KEY" .dev.vars; then
        echo "✅ KAKAO_REST_API_KEY 설정됨"
        KEY=$(grep "KAKAO_REST_API_KEY" .dev.vars | cut -d'=' -f2)
        echo "  키 길이: ${#KEY}자 (32자 권장)"
    else
        echo "❌ KAKAO_REST_API_KEY 없음"
    fi
else
    echo "⚠️  .dev.vars 파일 없음 (프로덕션에서는 Cloudflare 환경 변수 사용)"
fi
echo ""

# 5. 코드에서 하드코딩된 값 확인
echo "📝 코드 분석..."
if grep -q "5dd74bccb797640b0efd070467f3bafd" src/index.tsx; then
    echo "⚠️  하드코딩된 기본 REST API 키 발견"
    echo "  → Cloudflare Pages 환경 변수 설정 권장"
fi
echo ""

# 6. 카카오 개발자 콘솔 체크리스트
echo "📋 카카오 개발자 콘솔 체크리스트"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "다음 항목을 카카오 개발자 콘솔에서 확인하세요:"
echo ""
echo "1. Redirect URI 등록 (필수)"
echo "   [ ] $REDIRECT_URI"
echo ""
echo "2. 플랫폼 등록 (필수)"
echo "   [ ] $PROD_URL"
echo ""
echo "3. 카카오 로그인 활성화 (필수)"
echo "   [ ] 활성화 설정: ON"
echo ""
echo "4. 동의항목 설정 (필수)"
echo "   [ ] 닉네임: 필수"
echo "   [ ] 이메일: 선택"
echo "   [ ] 프로필 사진: 선택"
echo ""
echo "5. REST API 키 확인 (필수)"
echo "   [ ] 앱 키 > REST API 키 복사"
echo "   [ ] Cloudflare Pages 환경 변수에 설정"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 7. Cloudflare Pages 환경 변수 설정 가이드
echo "☁️  Cloudflare Pages 환경 변수 설정"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Cloudflare Dashboard 접속"
echo "   https://dash.cloudflare.com"
echo ""
echo "2. Workers & Pages > toss-live-commerce 선택"
echo ""
echo "3. Settings > Environment variables"
echo ""
echo "4. 환경 변수 추가:"
echo "   변수명: KAKAO_REST_API_KEY"
echo "   값: [카카오 개발자 콘솔에서 복사한 REST API 키]"
echo "   환경: Production"
echo ""
echo "5. Save 클릭 → 자동 재배포"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 8. 테스트 가이드
echo "🧪 테스트 방법"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. 브라우저에서 접속:"
echo "   $PROD_URL/login"
echo ""
echo "2. 카카오 로그인 버튼 클릭"
echo ""
echo "3. 에러 발생 시 URL 확인:"
echo "   성공: $PROD_URL/?success=true"
echo "   실패: $PROD_URL/?error=...&detail=..."
echo ""
echo "4. 브라우저 개발자 도구 (F12) 확인:"
echo "   Network 탭 > kauth.kakao.com/oauth/token 요청 확인"
echo "   Response에서 정확한 에러 메시지 확인"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 9. 에러 메시지별 해결 방법
echo "🔧 에러 메시지별 해결 방법"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "❌ redirect_uri_mismatch"
echo "   → 카카오 개발자 콘솔에서 정확한 Redirect URI 등록"
echo "   → $REDIRECT_URI"
echo ""
echo "❌ invalid_client"
echo "   → REST API 키 확인"
echo "   → Cloudflare Pages 환경 변수 설정"
echo ""
echo "❌ invalid_grant"
echo "   → Authorization code 만료 (10분)"
echo "   → 다시 로그인 시도"
echo ""
echo "❌ unauthorized_client"
echo "   → 카카오 로그인 활성화 확인"
echo "   → 비즈 앱 전환 필요 시 신청"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "✅ 진단 완료!"
echo ""
echo "📖 상세 가이드: KAKAO_LOGIN_500_ERROR_DIAGNOSIS.md 참고"
