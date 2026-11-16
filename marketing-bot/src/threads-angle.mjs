// 스레드 글 2.0 (2026-11-16 대표 "계속 개선해줘").
// 진단(11/10~11/15 실제 스레드 글 6개): 6개 중 4개가 "0원"·"수수료 5%"를 되풀이 — 매일 같은 말을 조금씩 바꿔 쓰고 있었다.
// 원인: 스레드 프롬프트가 오늘 주제를 강조하지 않아 [확인된 사실]에서 가장 눈에 띄는 숫자로 돌아갔고, 스레드 기록에 주제가 안 남아 돌아가며 고르기도 안 됐다.
// 처방: ① 오늘 주제의 사실 하나만 쓰게 못 박기 ② 글의 형식(장면·오해·비교·운영자·목록)을 돌리고 성과로 학습(learn.mjs 'tformat')
//       ③ 최근 스레드 3개 중 2개 이상에 나온 핵심 문구를 또 쓰면 반려.

export const THREADS_FORMATS = [
  { id: 'scene', guide: '독자가 실제로 겪는 장면 한 컷으로 시작한다("~할 때 있잖아요" 같은 흔한 상황. 특정 인물·일화를 지어내지 않는다). 다음 문장에서 오늘 주제의 사실 하나로 답한다.' },
  { id: 'myth', guide: '흔한 오해 하나를 짚고("~라고 생각하기 쉬운데") 오늘 주제의 사실로 바로잡는다.' },
  { id: 'contrast', guide: '보통 방식과 유어딜 방식을 한 줄씩 나란히 놓는다. 숫자는 [확인된 사실]에 있는 것만.' },
  { id: 'operator', guide: '운영자 1인칭으로, 이 규칙을 왜 이렇게 정했는지 이유 하나를 말한다(사실 범위 안에서, 감정 과장 없이).' },
  { id: 'list', guide: '짧은 줄 3개로 정리한다. 줄마다 15자 안팎, 앞에 기호 없이.' },
];

// 반복을 세는 핵심 문구(사실의 "얼굴"이 되는 말)
export const KEY_CLAIMS = [
  ['0원', /0\s*원/], ['수수료 5%', /5\s*%/], ['수수료 10%', /10\s*%/], ['90%', /90\s*%/], ['1분', /1\s*분/], ['10분', /10\s*분/],
  ['3단계', /3\s*단계|세\s*단계/], ['4단계', /4\s*단계|네\s*단계/], ['가입비', /가입비/], ['광고비', /광고비/], ['노쇼', /노쇼|안\s*오는/],
];

// text 가 최근 스레드(최신순 아님, 아무 순서) 가운데 window 개 중 limit 개 이상에서 이미 쓴 핵심 문구를 또 쓰면 문제.
// 오늘 주제(topic)에 그 말이 들어 있으면 허용(주제 자체가 그 사실일 때).
export function repeatProblems(text, recent = [], topic = '', { window = 3, limit = 2 } = {}) {
  const last = recent.slice(-window);
  const out = [];
  for (const [name, re] of KEY_CLAIMS) {
    if (!re.test(String(text || '')) || re.test(String(topic || ''))) continue;
    const n = last.filter((t) => re.test(String(t || ''))).length;
    if (n >= limit) out.push(`최근 스레드 ${last.length}개 중 ${n}개에 쓴 말 "${name}" 반복 — 오늘 주제의 다른 사실을 써라`);
  }
  return out;
}

export function threadsPrompt({ info, topic, format, len, examplesBlock = '' }) {
  return `${info}
Threads 글 1개를 ${len}로 써줘.
[오늘 주제 — 이 사실 하나만 쓴다. 다른 조건·숫자(0원, 수수료 % 등)는 주제에 없으면 꺼내지 않는다]
${topic || '(주제 없음 — [확인된 사실] 중 하나만 고른다)'}
[오늘 형식] ${format.guide}
첫 문장이 곧 핵심. 해시태그 없이. 링크는 내가 끝에 붙일게.${examplesBlock}`;
}
