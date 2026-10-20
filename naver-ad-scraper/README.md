# 네이버 검색광고 이메일 수집기

네이버 파워링크(검색광고) 광고주의 웹사이트를 방문하여 이메일/연락처 정보를 수집합니다.

## 구조

```
naver-ad-scraper/
├── src/
│   ├── scraper/
│   │   ├── browser.js          # Playwright 브라우저 풀 (봇 감지 우회)
│   │   └── naverAdScraper.js   # 네이버 파워링크 광고 추출
│   ├── crawler/
│   │   └── emailCrawler.js     # 광고주 웹사이트 이메일 크롤링
│   ├── storage/
│   │   └── database.js         # SQLite 저장소 (세션/광고주/이메일/큐)
│   ├── queue/
│   │   └── orchestrator.js     # 전체 파이프라인 조율
│   ├── cli/
│   │   ├── index.js            # CLI 진입점
│   │   └── export.js           # CSV/JSON 내보내기
│   ├── utils/
│   │   ├── constants.js        # 상수 정의
│   │   └── helpers.js          # 유틸리티 함수
│   └── index.js                # 라이브러리 진입점
├── data/                       # DB 파일 (자동 생성)
└── package.json
```

## 파이프라인

```
키워드 입력
    ↓
[1단계] 네이버 파워링크 스크래핑
  - 키워드로 네이버 검색
  - 파워링크(상단/하단 광고) 추출
  - 광고주 실제 URL 확보
    ↓
[2단계] 광고주 웹사이트 이메일 크롤링
  - robots.txt 준수
  - 메인 페이지 + 문의/연락처 페이지 탐색
  - mailto 링크, 텍스트 패턴, JSON-LD 구조화 데이터 파싱
  - 카카오채널/네이버톡톡 등 대안 연락처도 수집
    ↓
[3단계] SQLite 저장 + CSV 내보내기
```

## 설치

```bash
cd naver-ad-scraper
npm install
npx playwright install chromium
```

## 사용법

### 이메일 수집 시작
```bash
node src/cli/index.js scrape --keywords "골프용품,테니스용품,헬스용품" --session "스포츠_광고주"
```

### 결과 CSV 내보내기
```bash
node src/cli/index.js export --session-id 1 --output results.csv
```

### 세션 목록 보기
```bash
node src/cli/index.js list
```

### 통계 보기
```bash
node src/cli/index.js stats --session-id 1
```

### 옵션
| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `--keywords` | 쉼표 구분 키워드 | 필수 |
| `--session` | 세션 이름 | 오늘 날짜 |
| `--concurrency` | 동시 크롤링 수 | 3 |
| `--headed` | 브라우저 창 표시 (디버그) | headless |
| `--proxy` | 프록시 목록 (쉼표 구분) | 없음 |
| `--db` | DB 파일 경로 | `data/ads.db` |

## 프로그래매틱 사용

```javascript
import { Orchestrator } from './src/index.js';

const orchestrator = new Orchestrator({
  concurrency: 3,
  headless: true,
  onProgress: ({ phase, pct, item, found }) => {
    console.log(`[${phase}] ${pct}% - ${item}: ${found}개`);
  },
});

const { sessionId, stats } = await orchestrator.run('내 세션', [
  '온라인쇼핑', '패션', '뷰티',
]);
```

## 수집 데이터 항목

| 항목 | 설명 |
|------|------|
| 이메일 | 광고주 공개 이메일 |
| 도메인 | 웹사이트 도메인 |
| 회사명 | 사이트 제목/메타 정보 |
| 전화번호 | 공개 연락처 |
| 카카오채널 | 카카오 비즈채널 URL |
| 네이버톡톡 | 네이버 톡톡 URL |
| 광고 키워드 | 해당 광고주가 구매한 키워드 |
| 광고 제목 | 파워링크 광고 문구 |

## 법적 고지

- 이 도구는 **공개된 정보**만 수집합니다
- robots.txt를 준수합니다
- **스팸방지법** 및 **개인정보보호법**을 준수하여 사용하세요
- 수집된 이메일은 수신자가 동의한 방식으로만 활용하세요
- 과도한 요청으로 인한 서버 부하를 방지하기 위해 딜레이가 설정되어 있습니다
