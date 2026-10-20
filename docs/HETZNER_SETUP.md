# Hetzner Cloud 미디어 서버 셋업 가이드

> 🎯 Oracle Cloud 가입 안 될 때 대안. ₩6,500/월 (€4.51) 으로 셀러 100명까지 처리.
>
> Oracle 셋업 가이드(`docs/MEDIA_SERVER_SETUP.md`)와 거의 동일. 차이점은 Phase 1 (인스턴스 발급) 만.

---

## Phase 1: Hetzner 계정 + 서버 발급 (5-10분)

### 1-1. 계정 가입

1. **https://www.hetzner.com/cloud** 접속
2. 우상단 **"Sign Up"** 또는 **"Try Now"**
3. 입력 사항:
   - 이름 / 이메일
   - 신용카드 (한국 카드 정상 작동) — 첫 결제 ~$2 인증 (이후 환불)
   - 또는 PayPal
4. 이메일 인증 → 로그인
5. 첫 로그인 시 **"New Project"** 만들기 → 이름 `ur-live` (아무거나)

### 1-2. 서버 생성

1. 좌측 메뉴 → **Servers** → **Add Server** (또는 **+ New Server**)
2. 설정 페이지:

| 항목 | 값 |
|---|---|
| **Location** | **Falkenstein (Germany)** 또는 **Helsinki (Finland)** — 둘 다 OK |
| **Image** | **Ubuntu 22.04** |
| **Type** | **Shared vCPU** 탭 → **CX22** (€4.51/월) ⭐ |
| **Networking** | 기본값 (IPv4 + IPv6 자동 할당) |
| **SSH Keys** | 본인 PC ed25519 공개키 추가 (또는 다음 단계에서 root 비밀번호 받음) |
| **Volumes / Firewalls / Backups** | 모두 건너뜀 (필요 없음) |
| **Name** | `ur-live-stream-1` |

3. 우하단 **"Create & Buy now"** 클릭
4. 30초 후 인스턴스 발급 완료 — 메일로 root 비밀번호 발송 (SSH key 없을 시)
5. **Public IP 주소 메모** (예: `116.203.123.45`)

### 1-3. 방화벽 (이미 자동 OPEN)

Hetzner는 기본적으로 모든 포트가 OPEN — Oracle처럼 Security Lists 설정 불필요.

`setup.sh` 가 자동으로 ufw + iptables 으로 막을 것만 막음.

> ⚠️ DDoS 방어는 Cloudflare Workers 앞단에서 하니까 추가 firewall 정책 불필요.

---

## Phase 2-5: Oracle 가이드와 동일

`docs/MEDIA_SERVER_SETUP.md` 의 Phase 2 부터 그대로 진행. 한 줄도 안 바뀜.

### 빠른 요약

```bash
# 2. DNS: Cloudflare에서 stream.ur-team.com → 116.203.123.45 (DNS only)

# 3. SSH 접속 + 자동 셋업
ssh root@116.203.123.45
sudo bash -c "$(curl -sSL https://raw.githubusercontent.com/tobe2111/ur-live/main/infra/setup.sh)"

# 4. 출력된 값 Cloudflare Pages env 등록:
#    OME_HOST=stream.ur-team.com
#    OME_API_TOKEN=xxx
#    OME_WEBHOOK_SECRET=xxx

# 5. Windows PC에서 npm run deploy:pages
```

---

## 비용 / 사용량 모니터링

### Hetzner Console
1. https://console.hetzner.cloud → 본인 프로젝트
2. **Graphs** 탭에서 CPU / 트래픽 / 메모리 실시간 확인
3. **Billing** 탭에서 월 누적 비용 확인 (CX22 정액 €4.51만)

### 트래픽 한도 (20TB/월)

월 20TB 초과 시 €1/TB 추가 부과 — 셀러 200명+ 단계 전엔 도달 안 함.

알림 설정:
1. Console 우상단 본인 이름 → **Settings** → **Notifications**
2. **Traffic threshold** 80% (16TB) 도달 시 이메일

---

## 업그레이드 / 다운그레이드

셀러 늘어서 부족해지면:

1. Servers → 본인 인스턴스 → **Rescale**
2. 새 플랜 선택 (CX32, CX42, CCX13 등)
3. **Rescale** 클릭
4. ~30초 다운타임 후 자동 재부팅 → IP / 데이터 모두 유지

> ⚠️ 다운그레이드는 디스크 사이즈가 작아지지 않으면 가능. 일반적으로 **업그레이드만** 하게 됨.

---

## 다른 Hetzner 플랜 비교 (참고)

| 플랜 | vCPU | RAM | SSD | 트래픽 | 월 비용 | 동시 송출 (720p) |
|---|---|---|---|---|---|---|
| **CX22** ⭐ 시작 | 2 (shared) | 4GB | 40GB | 20TB | ₩6,500 | 8-12 |
| CX32 | 4 (shared) | 8GB | 80GB | 20TB | ₩10,500 | 20-30 |
| CX42 | 8 (shared) | 16GB | 160GB | 20TB | ₩19,500 | 50-60 |
| CCX13 (전용) | 2 (dedicated) | 8GB | 80GB | 20TB | ₩22,500 | 30-40 (안정) |

CX 시리즈는 다른 사용자와 공유 vCPU. CCX (Dedicated) 는 단독 vCPU — 트래픽 폭증 시 안정적이지만 가격 차이 큼.

---

## Hetzner vs Oracle 마이그레이션

나중에 Oracle ARM capacity 잡혀서 옮기고 싶을 때:

```bash
# Oracle 인스턴스에 setup.sh 동일 실행
ssh ubuntu@<oracle-ip>
sudo bash -c "$(curl -sSL https://raw.githubusercontent.com/tobe2111/ur-live/main/infra/setup.sh)"

# DNS 변경: Cloudflare에서 stream.ur-team.com A 레코드 → Oracle IP
# 5분 기다리면 자동 전환

# Hetzner 인스턴스 삭제 (월 ₩6,500 절약)
# Hetzner Console → Servers → 인스턴스 → Delete
```

OME 설정 / RTMP 키 / 셀러 데이터는 모두 Cloudflare D1(DB) + R2 에 있으니 마이그레이션 시 손실 없음.

---

## 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| `Create & Buy now` 버튼이 회색 | SSH key 또는 password 미선택 — 둘 중 하나 필수 |
| SSH 접속 거부 | root 로그인 활성화됨 → 비밀번호 또는 SSH key 사용. `ssh root@<ip>` |
| setup.sh 중 SSL 발급 실패 | DNS 전파 안 됨 → 5분 대기 후 재실행 |
| 트래픽 사용량 빠르게 증가 | OME 가 무한 루프 송출 중일 가능성 — `docker logs ome` 확인 |
| 매월 €4.51 외 비용 청구 | 트래픽 20TB 초과 또는 추가 IP — Console → Billing 에서 확인 |

---

## 결제 / 환불

- Hetzner는 **시간 단위 (hourly) 청구**. CX22 = €0.006/hour. 한 달 안 채워도 일별 비용만 청구.
- 인스턴스 삭제 즉시 청구 중지.
- 환불 정책: 일반적으로 환불 안 해줌 (이미 사용한 시간만 청구).
- 카드 결제 실패 시 7일 grace → 인스턴스 자동 정지.

---

## 한 줄 요약

```
가입 5분 + DNS 5분 + setup.sh 8분 + Cloudflare env 3분 = 약 20분 만에 자체 미디어 서버 가동.
```

