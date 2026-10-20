// 임시 환경변수 체크용 엔드포인트 추가
// src/index.tsx의 app.get('/api/test/env-check') 바로 위에 추가

app.get('/api/test/env-check', cors(), (c) => {
  return c.json({
    hasPrivateKey: !!c.env.FIREBASE_PRIVATE_KEY,
    hasClientEmail: !!c.env.FIREBASE_CLIENT_EMAIL,
    hasProjectId: !!c.env.FIREBASE_PROJECT_ID,
    hasDatabaseURL: !!c.env.FIREBASE_DATABASE_URL,
    privateKeyLength: c.env.FIREBASE_PRIVATE_KEY?.length || 0,
    clientEmail: c.env.FIREBASE_CLIENT_EMAIL || 'NOT_SET',
    projectId: c.env.FIREBASE_PROJECT_ID || 'NOT_SET'
  });
});
