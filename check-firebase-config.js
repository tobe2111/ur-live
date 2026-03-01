// Firebase Admin 설정 체크 스크립트
const fs = require('fs');
const path = require('path');

console.log('🔍 Firebase 설정 확인 중...\n');

// 1. .dev.vars 체크
console.log('1️⃣ .dev.vars 파일 확인:');
try {
  const devVars = fs.readFileSync('.dev.vars', 'utf8');
  
  const hasPrivateKey = devVars.includes('FIREBASE_PRIVATE_KEY');
  const hasClientEmail = devVars.includes('FIREBASE_CLIENT_EMAIL');
  const hasProjectId = devVars.includes('FIREBASE_PROJECT_ID');
  
  console.log(`   ✅ FIREBASE_PRIVATE_KEY: ${hasPrivateKey ? '존재' : '❌ 없음'}`);
  console.log(`   ✅ FIREBASE_CLIENT_EMAIL: ${hasClientEmail ? '존재' : '❌ 없음'}`);
  console.log(`   ✅ FIREBASE_PROJECT_ID: ${hasProjectId ? '존재' : '❌ 없음'}`);
  
  if (hasPrivateKey) {
    const privateKeyMatch = devVars.match(/FIREBASE_PRIVATE_KEY="([^"]+)"/);
    if (privateKeyMatch) {
      const key = privateKeyMatch[1];
      console.log(`   📝 Private Key 형식: ${key.includes('BEGIN PRIVATE KEY') ? '✅ 정상' : '❌ 잘못됨'}`);
      console.log(`   📏 Private Key 길이: ${key.length} chars`);
    }
  }
  
  if (hasClientEmail) {
    const emailMatch = devVars.match(/FIREBASE_CLIENT_EMAIL="([^"]+)"/);
    if (emailMatch) {
      console.log(`   📧 Client Email: ${emailMatch[1]}`);
    }
  }
  
  if (hasProjectId) {
    const projectMatch = devVars.match(/FIREBASE_PROJECT_ID="([^"]+)"/);
    if (projectMatch) {
      console.log(`   🆔 Project ID: ${projectMatch[1]}`);
    }
  }
} catch (e) {
  console.log('   ❌ .dev.vars 파일을 읽을 수 없음');
}

console.log('\n2️⃣ 클라이언트 Firebase 설정 확인:');
try {
  const firebaseClient = fs.readFileSync('src/lib/firebase.ts', 'utf8');
  const projectIdMatch = firebaseClient.match(/projectId:\s*['"]([\w-]+)['"]/);
  if (projectIdMatch) {
    console.log(`   🆔 Client Project ID: ${projectIdMatch[1]}`);
  }
} catch (e) {
  console.log('   ⚠️ firebase.ts 파일을 읽을 수 없음');
}

console.log('\n3️⃣ 서버 Firebase Admin 코드 확인:');
try {
  const adminCode = fs.readFileSync('src/lib/firebase-admin.ts', 'utf8');
  
  const hasPrivateKeyUsage = adminCode.includes('this.privateKey');
  const hasClientEmailUsage = adminCode.includes('this.clientEmail');
  const hasProjectIdUsage = adminCode.includes('this.projectId');
  
  console.log(`   ✅ privateKey 사용: ${hasPrivateKeyUsage ? '있음' : '❌ 없음'}`);
  console.log(`   ✅ clientEmail 사용: ${hasClientEmailUsage ? '있음' : '❌ 없음'}`);
  console.log(`   ✅ projectId 사용: ${hasProjectIdUsage ? '있음' : '❌ 없음'}`);
  
  const hasCreateCustomToken = adminCode.includes('createCustomToken');
  console.log(`   ✅ createCustomToken 메서드: ${hasCreateCustomToken ? '있음' : '❌ 없음'}`);
} catch (e) {
  console.log('   ⚠️ firebase-admin.ts 파일을 읽을 수 없음');
}

console.log('\n✅ 체크 완료!');
