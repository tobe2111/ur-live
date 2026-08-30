#!/usr/bin/env bash
# 🔎 배포 후 SEO 판정 — 이 PR 이 넣은 것이 라이브에서 실제로 사는지 (2026-08-26)
#
# 왜 스크립트로 두나: HTMLRewriter(서버 메타)와 시드 재동기화는 **단위테스트 밖**이라
# 배포 후 curl 이 유일한 판정이다. 다음 세션이 명령을 다시 조립하지 않게 여기 박아 둔다.
#
# 사용: bash scripts/verify-seo-deploy.sh [https://urdeal.kr]
set -uo pipefail
BASE="${1:-https://urdeal.kr}"
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
fail=0

echo "== ① 새로 사이트맵에 넣은 8개 표면이 200 인가 =="
# 🩸 3xx/404 가 하나라도 있으면 **그 줄을 sitemap 에서 빼야 한다.**
#    죽은 URL 제출은 크롤 예산을 먹고 soft-404 로 집계되며, 그 손해는 배포로 되돌아오지 않는다.
for p in /stays /experience /new-openings /area-report /business /influencer /introduce /faq; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" "$BASE$p")
  [ "$code" = "200" ] && echo "  ok   $p ($code)" || { echo "  FAIL $p ($code)"; fail=1; }
done

echo "== ② 서버 메타가 표면별로 실제 다른가 (홈 복제본이 아닌가) =="
# 클라 <SEO>(react-helmet)는 JS 렌더 후라 네이버 Yeti 가 못 본다 — 서빙 HTML 을 봐야 한다.
for p in / /vouchers /map /stays; do
  t=$(curl -s -A "$UA" "$BASE$p" | grep -o '<title>[^<]*</title>' | head -1)
  echo "  $p → $t"
done
echo "  (넷이 서로 달라야 한다. 같으면 head rewrite 가 안 걸린 것)"

echo "== ③ canonical 이 붙는가 =="
for p in /vouchers /browse /stays; do
  c=$(curl -s -A "$UA" "$BASE$p" | grep -o 'rel="canonical" href="[^"]*"' | head -1)
  [ -n "$c" ] && echo "  ok   $p → $c" || { echo "  FAIL $p — canonical 없음"; fail=1; }
done

echo "== ④ 사라진 상품은 404 + noindex 인가 (soft-404 방지, 2026-07-29 결정) =="
code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" "$BASE/group-buy/99999999")
[ "$code" = "404" ] && echo "  ok   ($code)" || { echo "  FAIL ($code) — 200 이면 홈 메타 복제본이 색인된다"; fail=1; }

echo "== ⑤ 블로그 시드 v12 반영 — 유어샵을 '쇼핑몰'로 부르지 않는가 =="
n=$(curl -s -A "$UA" "$BASE/api/blog/public" | grep -o '쇼핑몰' | wc -l)
[ "$n" = "0" ] && echo "  ok   (0건)" || { echo "  FAIL ($n 건 — 시드 버전이 안 올랐거나 재시드 미발동)"; fail=1; }

echo "== ⑥ robots.txt 가 레포 규칙을 서빙하는가 =="
# 🩸 2026-07-29 실측: Cloudflare Managed robots.txt 가 통째로 **대체**해 레포 규칙 50줄이 안 나갔다.
#    그러면 check-robots-private-routes 는 초록인데 크롤러는 다른 파일을 본다(가드가 지키는 대상이
#    현실에 없는 경우). ✅ 2026-08-26 재실측: 지금은 **덧붙이는(prepend)** 방식이라 레포 규칙이 살아 있다
#    (Content-Signal 머리말 + 우리 규칙 185줄). 그래도 검사는 남긴다 — 정책은 또 바뀔 수 있다.
r=$(curl -s -A "$UA" "$BASE/robots.txt")
# ⚠️ **이 PR 이 새로 넣은 줄로 판정하지 말 것.** 배포 전에는 당연히 없어서 "대체됨"으로 오진한다
#    (실제로 그렇게 한 번 잘못 짰다). 오래된 규칙으로 '레포 파일이 서빙되는가'를 본다.
for rule in "Disallow: /store/scan" "Disallow: /interest-list" "Sitemap: https://urdeal.kr/sitemap.xml"; do
  echo "$r" | grep -qF "$rule" || { echo "  FAIL — 레포 robots 규칙 누락: $rule (Managed robots 대체 의심)"; fail=1; }
done
echo "  ok   (레포 규칙 서빙 중)"
# 이 PR 이 넣은 줄은 **배포 확인용**이라 실패로 세지 않는다.
echo "$r" | grep -qF "Disallow: /store/new" \
  && echo "  ok   /store/new 차단 반영됨" \
  || echo "  (아직) /store/new 차단 미반영 — 이 PR 배포 전이면 정상" 

echo
[ "$fail" = "0" ] && echo "✅ 전부 통과" || echo "❌ 위 FAIL 항목 확인 — 특히 ①은 sitemap 에서 빼는 것이 옳다"
exit $fail
