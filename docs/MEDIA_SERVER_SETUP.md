# 자체 미디어 서버 (브라우저 → YouTube) 셋업 가이드

> 🎯 **목표**: 셀러가 외부 앱(Larix/OBS) 없이 브라우저에서 바로 라이브 송출.
>
> **아키텍처**: 셀러 브라우저 (WebRTC + WHIP) → OvenMediaEngine on Oracle Cloud → YouTube RTMP.
>
> **기존 RTMP 플로우는 유지** — 자체 송출 실패 시 Larix/OBS 가이드로 자동 fallback.

---

## Phase 1: Oracle Cloud Always Free 인스턴스 발급

### 1-1. 계정 생성

1. https://cloud.oracle.com/ 접속 → "Start for free"
2. 이메일 / 신용카드 등록 (과금 안 됨, 본인 인증용 — 결제 자동화 절대 발생 안 함)
3. **홈 리전(Home Region) 선택 시 주의**:
   - 1순위: **South Korea Central (Chuncheon)** — 한국 셀러 지연 최적 (~10ms)
   - 2순위: **Japan East (Tokyo)** — 한국에서 ~30ms, capacity 잘 잡힘
   - 한 번 선택하면 변경 불가. 한국 capacity 안 잡히면 도쿄로.

### 1-2. ARM 인스턴스 생성

콘솔 → **Compute** → **Instances** → **Create Instance**

| 항목 | 값 |
|---|---|
| Name | `ur-live-stream-1` |
| Image | **Canonical Ubuntu 22.04** (Always Free 호환) |
| Shape | **Ampere A1** — 4 OCPU / 24GB RAM (Always Free 한도 풀로 사용) |
| Networking | 새 VCN 자동 생성, Public IPv4 할당 ON |
| SSH Key | 본인 PC의 ed25519 공개키 업로드 |
| Boot volume | 200GB (Always Free 한도) |

**"Out of capacity" 에러 발생 시**:
- 다른 가용 영역(AD-1, AD-2, AD-3) 시도
- 다른 Shape (A1 1 OCPU/6GB라도 일단 발급 받아두면 나중에 스케일업)
- 1시간마다 retry 자동화: `for i in {1..24}; do oci compute instance launch ...; sleep 3600; done`

### 1-3. 방화벽(Security List) 오픈

VCN → Security Lists → Default Security List → **Ingress Rules** 추가:

| Source | Protocol | Port | 용도 |
|---|---|---|---|
| 0.0.0.0/0 | TCP | 22 | SSH |
| 0.0.0.0/0 | TCP | 80 | HTTP (Let's Encrypt 인증) |
| 0.0.0.0/0 | TCP | 443 | HTTPS / WHIP |
| 0.0.0.0/0 | UDP | 10000-10100 | WebRTC ICE |
| 0.0.0.0/0 | TCP | 3478 | TURN/STUN |

추가로 인스턴스 내부에서 `iptables` 가 막혀 있을 수 있음 — Ubuntu 22.04 ARM 이미지는 이게 종종 발생. 인스턴스 SSH 후 다음 실행:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p udp --dport 10000:10100 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3478 -j ACCEPT
sudo netfilter-persistent save
```

---

## Phase 2: 도메인 + SSL

### 2-1. DNS 설정

Cloudflare DNS (이미 `ur-team.com` 관리 중) 에서:

| Type | Name | Value | Proxy |
|---|---|---|---|
| A | `stream` | `<Oracle 인스턴스 Public IP>` | **DNS only** (Proxy 끄기 — WebRTC UDP 가 Cloudflare 통과 못 함) |

→ `stream.ur-team.com` 으로 접근 가능.

### 2-2. SSL 인증서 (Let's Encrypt)

인스턴스 SSH 후:

```bash
sudo apt update && sudo apt install -y certbot
sudo certbot certonly --standalone -d stream.ur-team.com --agree-tos --register-unsafely-without-email
```

→ `/etc/letsencrypt/live/stream.ur-team.com/{fullchain.pem, privkey.pem}` 생성됨.

자동 갱신 cron 추가:

```bash
echo "0 3 * * * root certbot renew --quiet --post-hook 'docker restart ome'" | sudo tee /etc/cron.d/certbot-renew
```

---

## Phase 3: OvenMediaEngine 배포

### 3-1. Docker 설치

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# 로그아웃 → 재로그인 (그룹 적용)
```

### 3-2. OME 설정 파일 다운로드

```bash
sudo mkdir -p /opt/ome/conf
cd /opt/ome
sudo curl -O https://raw.githubusercontent.com/tobe2111/ur-live/main/infra/ome/Server.xml
sudo curl -O https://raw.githubusercontent.com/tobe2111/ur-live/main/infra/ome/Logger.xml
```

> ℹ️ 설정 파일은 본 리포 `infra/ome/` 폴더에 git 으로 관리됨. 변경 시 위 URL 로 fetch.

### 3-3. Docker Compose 시작

```bash
cd /opt/ome
sudo curl -O https://raw.githubusercontent.com/tobe2111/ur-live/main/infra/ome/docker-compose.yml
sudo nano docker-compose.yml  # OME_HOST_IP 와 OME_API_TOKEN 환경변수 입력
docker compose up -d
docker logs -f ome  # "Started Origin module" 확인
```

### 3-4. 동작 확인

```bash
# Healthcheck
curl https://stream.ur-team.com:8081/v1/stats/current

# WHIP endpoint 응답 (POST 만 받음 — 405 가 정상)
curl -I https://stream.ur-team.com:3334/app/test
```

---

## Phase 4: UR Live 백엔드 연결

### 4-1. Cloudflare Pages secrets 등록

Cloudflare Dashboard → Workers & Pages → ur-live → Settings → Variables:

| Variable | Value |
|---|---|
| `OME_HOST` | `stream.ur-team.com` |
| `OME_API_TOKEN` | (Server.xml 에 설정한 access_token 과 동일) |
| `OME_WEBHOOK_SECRET` | 임의의 32자 hex (`openssl rand -hex 32`) |

### 4-2. OME → 우리 백엔드 webhook 등록

OME `Server.xml` 의 `<AdmissionWebhooks>` 섹션이 다음으로 설정되어야 함:

```xml
<AdmissionWebhooks>
  <ControlServerUrl>https://live.ur-team.com/api/internal/ome/admission</ControlServerUrl>
  <SecretKey>${OME_WEBHOOK_SECRET}</SecretKey>
  <Timeout>3000</Timeout>
  <Enables>
    <Providers>webrtc</Providers>
    <Publishers>rtmppush</Publishers>
  </Enables>
</AdmissionWebhooks>
```

→ 셀러가 publish 시작하면 OME 가 우리 백엔드에 webhook → 백엔드가 토큰 검증 + YouTube RTMP key 매핑 응답.

---

## Phase 5: 모니터링

### 5-1. Healthcheck

Cloudflare Workers Cron 으로 1분마다 OME `/v1/stats/current` 폴링. 다운 시 셀러 페이지에 자동 fallback (Larix/OBS 가이드 표시).

### 5-2. 사용량 모니터링

Oracle Cloud Console → Bandwidth → Outbound traffic. 월 10TB 초과 임박 시 알림.

### 5-3. 로그

```bash
docker logs ome --tail 200 -f
docker exec ome cat /opt/ovenmediaengine/logs/ome_*.log
```

---

## Rollback

자체 송출에 문제 발생 시:

1. Cloudflare Pages 환경변수 `STREAMING_BROWSER_PUBLISH_ENABLED` 를 `false` 로
2. 셀러 페이지 자동으로 Larix/OBS 가이드만 표시 (코드 deploy 없이 즉시 적용)

---

## 비용 모니터링 (월 1회 체크)

| 항목 | 한도 | 알림 |
|---|---|---|
| Oracle Always Free | 영구 무료 | 없음 |
| 트래픽 | 10TB/월 | 7TB 도달 시 알림 추가 |
| Oracle 인스턴스 reclaim | 60일 0% CPU 시 회수 가능 | OME 항상 가동 중이라 위험 없음 |

---

## 참고

- OvenMediaEngine 공식 docs: https://airensoft.gitbook.io/ovenmediaengine
- WHIP 표준: RFC 9725
- Oracle Cloud Always Free 정책: https://www.oracle.com/cloud/free/
