/**
 * Firebase Realtime Database 설정
 * 
 * Firebase Console에서 프로젝트 생성 후 설정:
 * 1. https://console.firebase.google.com
 * 2. 프로젝트 추가 → "toss-live-commerce"
 * 3. Realtime Database 생성
 * 4. 규칙 설정 (테스트용):
 *    {
 *      "rules": {
 *        "chats": {
 *          ".read": true,
 *          ".write": true
 *        }
 *      }
 *    }
 * 5. 프로젝트 설정 → 웹 앱 추가 → 구성 정보 복사
 */

// Firebase SDK 초기화
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Firebase App 초기화
let firebaseApp = null;
let database = null;

function initializeFirebase() {
  if (!window.firebase) {
    console.error('Firebase SDK가 로드되지 않았습니다.');
    return false;
  }

  // Firebase가 이미 초기화되었는지 확인
  if (!firebaseApp) {
    try {
      firebaseApp = firebase.initializeApp(firebaseConfig);
      database = firebase.database();
      console.log('✅ Firebase 초기화 완료');
      return true;
    } catch (error) {
      console.error('❌ Firebase 초기화 실패:', error);
      return false;
    }
  }
  return true;
}

// 메시지 전송
function sendMessage(streamId, username, text) {
  if (!database) {
    console.error('Firebase가 초기화되지 않았습니다.');
    return;
  }

  const chatRef = database.ref(`chats/stream${streamId}`);
  const newMessageRef = chatRef.push();
  
  newMessageRef.set({
    username: username,
    text: text,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
}

// 메시지 수신 (최신 50개만)
function listenToMessages(streamId, callback) {
  if (!database) {
    console.error('Firebase가 초기화되지 않았습니다.');
    return null;
  }

  const chatRef = database.ref(`chats/stream${streamId}`);
  const recentMessagesQuery = chatRef.limitToLast(50);

  // 새 메시지 추가 이벤트
  recentMessagesQuery.on('child_added', (snapshot) => {
    const message = snapshot.val();
    callback({
      id: snapshot.key,
      username: message.username,
      text: message.text,
      timestamp: message.timestamp
    });
  });

  // cleanup 함수 반환
  return () => {
    recentMessagesQuery.off('child_added');
  };
}

// 오래된 메시지 자동 삭제 (최신 50개만 유지)
function cleanupOldMessages(streamId) {
  if (!database) return;

  const chatRef = database.ref(`chats/stream${streamId}`);
  
  chatRef.once('value', (snapshot) => {
    const messages = [];
    snapshot.forEach((child) => {
      messages.push({
        key: child.key,
        timestamp: child.val().timestamp
      });
    });

    // 메시지가 50개 초과하면 오래된 것 삭제
    if (messages.length > 50) {
      // 타임스탬프 기준 정렬
      messages.sort((a, b) => a.timestamp - b.timestamp);
      
      // 가장 오래된 것부터 삭제 (50개만 남기기)
      const toDelete = messages.slice(0, messages.length - 50);
      toDelete.forEach((msg) => {
        chatRef.child(msg.key).remove();
      });
      
      console.log(`🗑️ 오래된 메시지 ${toDelete.length}개 삭제`);
    }
  });
}

// Export
window.FirebaseChat = {
  initialize: initializeFirebase,
  sendMessage: sendMessage,
  listenToMessages: listenToMessages,
  cleanupOldMessages: cleanupOldMessages
};
