// NicePay 테스트(Sandbox) 환경 인증 테스트

const NICEPAY_MID = 'BItobe211m';
const NICEPAY_KEY = 'bPEmjXIPGt8FvmRxt7Q8nrbi4J3Z20I237Xbyp5pOxUP7A3UnyDbY5dOKBSrZxyflDzMop1kfVQwOsnl3D+wLA==';

const auth = Buffer.from(`${NICEPAY_MID}:${NICEPAY_KEY}`).toString('base64');

console.log('========================================');
console.log('NicePay 샌드박스 환경 테스트');
console.log('========================================');
console.log('MID:', NICEPAY_MID);
console.log('테스트 환경:', 'https://sandbox-api.nicepay.co.kr');
console.log('========================================\n');

async function testSandbox() {
    try {
        console.log('🔵 Sandbox API 테스트 중...\n');
        
        const response = await fetch('https://sandbox-api.nicepay.co.kr/v1/payments/approval', {
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
            console.log('❌ Sandbox에서도 인증 실패');
        } else if (response.status === 400) {
            console.log('✅ Sandbox 인증 성공!');
        } else {
            console.log('⚠️  응답:', response.status, result.resultMsg);
        }
        
    } catch (error) {
        console.error('❌ 오류:', error.message);
    }
}

testSandbox();
