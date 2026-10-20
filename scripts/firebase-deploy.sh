#!/bin/bash
# Firebase 설정 후 빌드 및 배포 스크립트

set -e

echo "🔨 프로젝트 빌드 중..."
cd /home/user/webapp
npm run build

echo ""
echo "🔄 PM2 재시작 중..."
pm2 restart webapp

echo ""
echo "⏳ 서버 시작 대기 (3초)..."
sleep 3

echo ""
echo "✅ Firebase 설정 테스트..."
echo ""

# 1. 라이브 페이지 확인
echo "1. 라이브 페이지 로드 확인..."
LIVE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/live/1)
if [ "$LIVE_STATUS" = "200" ]; then
    echo "   ✅ 라이브 페이지: 정상 (200)"
else
    echo "   ❌ 라이브 페이지: 오류 ($LIVE_STATUS)"
fi

# 2. Firebase 스크립트 확인
echo ""
echo "2. Firebase 스크립트 로드 확인..."
FIREBASE_CHECK=$(curl -s http://localhost:3000/live/1 | grep -c "firebase-app-compat.js")
if [ "$FIREBASE_CHECK" -gt 0 ]; then
    echo "   ✅ Firebase SDK: 로드됨"
else
    echo "   ❌ Firebase SDK: 로드 실패"
fi

# 3. 채팅 UI 확인
echo ""
echo "3. 채팅 UI 확인..."
CHAT_CHECK=$(curl -s http://localhost:3000/live/1 | grep -c "chat-container")
if [ "$CHAT_CHECK" -gt 0 ]; then
    echo "   ✅ 채팅 UI: 표시됨"
else
    echo "   ❌ 채팅 UI: 표시 안 됨"
fi

# 4. 토스 유저 API 확인
echo ""
echo "4. 토스 유저 API 확인..."
USER_INFO=$(curl -s http://localhost:3000/api/toss/user-info | grep -o '"success":true')
if [ "$USER_INFO" = '"success":true' ]; then
    echo "   ✅ 토스 유저 API: 정상 작동"
else
    echo "   ❌ 토스 유저 API: 오류"
fi

echo ""
echo "═══════════════════════════════════════"
echo "🎉 배포 완료!"
echo "═══════════════════════════════════════"
echo ""
echo "📱 테스트 URL:"
echo "   https://3000-idza9aonokj4y1prq2vkt-b32ec7bb.sandbox.novita.ai/live/1"
echo ""
echo "🔍 브라우저 개발자 도구 콘솔 확인:"
echo "   1. F12 키로 개발자 도구 열기"
echo "   2. Console 탭 클릭"
echo "   3. 다음 메시지 확인:"
echo "      - ✅ Firebase 초기화 완료"
echo "      - ✅ 채팅 기능 활성화"
echo "      - ✅ 토스 유저 정보: ..."
echo ""
echo "💬 채팅 테스트:"
echo "   1. 메시지 입력창에 'Hello' 입력"
echo "   2. 전송 버튼 클릭 또는 엔터"
echo "   3. 채팅창에 메시지 표시 확인"
echo "   4. Firebase Console에서 실시간 데이터 확인"
echo ""
echo "🔧 문제 발생 시:"
echo "   - pm2 logs webapp --nostream --lines 50"
echo "   - 브라우저 콘솔에서 에러 메시지 확인"
echo ""
