/**
 * ✉️ **비-AI 제휴 제안 문안** — 엑셀 내보내기와 발송 큐가 **같은 문구**를 쓰게 하는 SSOT (2026-07-29).
 *
 * ## 왜 분리했나
 * 이 문안은 원래 `influencer-pool-export.ts` 안의 지역 함수였다. 그래서 **엑셀을 받은 사람만** 쓸 수 있었고,
 * 어드민 화면의 발송 큐에는 아무 문구도 없었다 — 실측(2026-07-29): 큐 상위 5명이 전부 점수 99~100·이메일
 * 보유인데 `outreach_draft` 는 **전원 비어 있음**. AI 초안 레인은 비용 때문에 기본 OFF 라(대표 방침) 화면에서
 * 복사할 것이 없다. 접촉 0명의 원인 중 **코드가 해결할 수 있는 부분**이 이것이다.
 *
 * ## ⚖️ 법적 문구는 발송 경로와 같은 함수로
 * `(광고)` 표기 · 수신거부 안내 · 전송자 정보를 `outreach-send` 의 헬퍼로 만든다. 여기서 문자열을 따로 쓰면
 * 법이 바뀔 때 한쪽만 고쳐진다. ⚠️ 이건 **표기 의무를 돕는 것이지 사전동의를 대체하지 않는다** —
 * 발송 여부·범위는 대표 판단이다(수집 이메일은 사전동의가 아니다).
 */
import { withAdLabel, withOptOut, withSenderInfo } from './outreach-send'

/** 플랫폼 한국어 라벨 — 본문에서 "유튜브에서 …" 처럼 자연스럽게 읽히게. */
const PLAT_KO: Record<string, string> = {
  youtube: '유튜브', naver_blog: '네이버 블로그', naver_cafe: '네이버 카페',
  tistory: '티스토리', instagram: '인스타그램', tiktok: '틱톡',
}

/** 제목 — `(광고)` 표기는 정보통신망법상 영리 목적 광고성 정보의 의무 표기. */
export function outreachSubject(name: string): string {
  return withAdLabel(`${(name || '').slice(0, 20)}님께 유어딜 제휴 제안 드립니다`)
}

/** 본문 — 수신거부 안내 + 전송자 정보가 항상 붙는다(SSOT 헬퍼). */
export function outreachBody(name: string, platform: string, category: string | null): string {
  const ch = PLAT_KO[platform] || platform
  const cat = category && category !== '기타' ? `${category} ` : ''
  return withSenderInfo(withOptOut(
    `안녕하세요, ${(name || '').slice(0, 20)}님.\n유어딜(UR Team) 제휴 담당자입니다.\n\n`
    + `${ch}에서 ${cat}콘텐츠를 꾸준히 올리시는 것을 보고 연락드립니다.\n\n`
    + '유어딜은 동네 매장의 이용권·공동구매를 소개하는 서비스입니다. 지역 매장 협찬을 원하는 사장님과 '
    + '크리에이터를 연결해 드리고, 성사되면 협찬비와 별도로 판매 성과에 따른 수익을 드립니다.\n\n'
    + '관심 있으시면 이 메일에 회신 주세요. 진행 방식과 조건을 자세히 안내드리겠습니다.\n\n'
    + '감사합니다.\n유어딜 드림',
  ))
}
