# Notion 커버 이미지

유어팀 Notion 워크스페이스의 페이지 커버로 쓰는 그라데이션 이미지들이다.

## 왜 여기에 있나

Notion 파일 업로드 API(`api.notion.com`)가 이 개발 환경의 프록시에서 막혀(CONNECT 403) 직접 업로드가
안 된다. 그래서 **공개 레포의 raw URL 을 Notion 커버로 지정**한다. 브랜치가 아니라 **커밋 SHA 로 고정**해
쓰므로 브랜치가 지워지거나 파일이 바뀌어도 이미 걸린 커버는 안 깨진다.

```
https://raw.githubusercontent.com/tobe2111/ur-live/<commit-sha>/docs/design/brand-assets/notion-covers/<파일>.png
```

⚠️ **이 파일들을 지우거나 옮기지 말 것** — Notion 페이지 커버가 여기를 가리킨다. 새 커버가 필요하면
`generate.py` 에 팔레트를 추가하고 새 파일을 만든다(기존 파일 수정 X).

## 다시 만들려면

```bash
python3 generate.py               # 전체
python3 generate.py cover-urdeal  # 하나만
```

의존성 0(표준 라이브러리 `zlib`·`struct`·`math` 만). PIL 불필요 — 이 환경에 PIL 이 없어서 PNG 인코더를
직접 넣었다.

## 색 배정

| 파일 | 쓰는 곳 | 톤 |
|---|---|---|
| `cover-urteam` | 유어팀 메인페이지 | 잉크 네이비 + 브랜드 로즈 |
| `cover-urdeal` | 유어딜 | 로즈 (`#E0526B` 계열) |
| `cover-mall` | 공구 서비스 | 그린 |
| `cover-urads` | 유어애즈 | 퍼플 |
| `cover-closed` | 종료된 사업 (라이브 커머스·유통스타트) | 그레이 |
| `cover-ops` | 운영 | 블루 |
| `cover-growth` | 마케팅·세일즈 | 오렌지 |
| `cover-finance` | 재무 | 틸 |
| `cover-people` | 인사 | 마젠타 |
| `cover-docs` | 자료 및 매뉴얼 | 뉴트럴 |
| `cover-brand` | 브랜드 | 다크 + 로즈 |
