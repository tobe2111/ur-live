// NicePay API 테스트 스크립트

const NICEPAY_MID = 'PItobe211m';  // 코드에 있던 테스트 MID
const NICEPAY_KEY = 'GKHsnRI/P5V3RpU7v5UA2ElK5vz0v3Nyf+wdd+T+RXvh8R/xWwZk7gzwQwKZi6kcJ2lnif1xgYYF6amQ5cRnTA==';

// Base64 인코딩
const auth = Buffer.from(`${NICEPAY_MID}:${NICEPAY_KEY}`).toString('base64');

console.log('========================================');
console.log('NicePay 인증 정보 확인');
console.log('========================================');
console.log('MID:', NICEPAY_MID);
console.log('Key 길이:', NICEPAY_KEY.length, '문자');
console.log('Key 형식:', NICEPAY_KEY.endsWith('==') ? '✅ Base64 형식 (올바름)' : '❌ 형식 이상');
console.log('Authorization Header:', 'Basic ' + auth.substring(0, 50) + '...');
console.log('========================================');

// NicePay API에 테스트 요청 (실제 거래 없이 인증만 확인)
async function testAuth() {
    try {
        console.log('\n🔵 NicePay API 인증 테스트 중...\n');
        
        const response = await fetch('https://api.nicepay.co.kr/v1/payments/approval', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + auth
            },
            body: JSON.stringify({
                tid: 'test_tid_12345',
                amt: '1000',
                ediDate: '20260206',
                authToken: 'test_token'
            })
        });

        const result = await response.json();
        
        console.log('응답 상태:', response.status);
        console.log('응답 본문:', JSON.stringify(result, null, 2));
        console.log('');
        
        if (response.status === 401) {
            console.log('❌ 인증 실패: MID 또는 Key가 잘못되었습니다.');
        } else if (response.status === 400) {
            console.log('✅ 인증 성공! (요청 데이터는 잘못되었지만 인증은 통과)');
        } else {
            console.log('⚠️  예상치 못한 응답:', response.status);
        }
        
    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
    }
}

testAuth();
