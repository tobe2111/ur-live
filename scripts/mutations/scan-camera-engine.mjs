/**
 * 🧬 주입 — **계산대 카메라가 QR 을 못 읽던 것** (2026-10-07 대표 신고, 안드로이드 실측)
 *
 * 되돌리면 전부 **조용히** 못 읽는다. 카메라는 켜지고 에러도 안 뜨므로 사장님은 자기가 잘못
 * 비추는 줄 안다 — 대표가 오늘 그렇게 겪었다(*"휴대폰 카메라는 되는데"*).
 *
 * 🔑 증거는 **카메라**를 가리킨다(대표가 바로잡아 준 것): 같은 QR 을 네이티브 카메라는 읽었다.
 *   그래서 이 묶음은 전부 *우리 파이프라인*의 결함이다 — 해상도 · 초점 · 엔진 · 스캔영역 · 폴백.
 */
const SRC = 'src/components/voucher/VoucherScanner.tsx'
const CAM = 'src/components/voucher/scan-camera.ts'
const T = 'src/tests/unit/scan-camera-engine-2026-10-07.test.ts'

export default [
  {
    name: '계산대카메라 — 해상도를 다시 안 요구한다 (종전 동작)',
    file: CAM,
    find: '  width: { ideal: 1920 },\n  height: { ideal: 1080 },',
    replace: '  // (해상도는 브라우저가 알아서)',
    test: T,
    why:
      '정확히 종전 코드다. 브라우저 기본 640×480 으로 떨어지고, 노트북 화면의 QR 은 그 해상도에서 ' +
      '모듈이 몇 픽셀밖에 안 돼 디코딩이 실패한다. 네이티브 카메라 앱과의 차이가 바로 이것이다.',
  },
  {
    name: '계산대카메라 — ideal 을 exact 로 바꾼다',
    file: CAM,
    find: '  width: { ideal: 1920 },\n  height: { ideal: 1080 },\n}',
    replace: '  width: { exact: 1920 },\n  height: { ideal: 1080 },\n}',
    test: T,
    why:
      '"더 확실하게" 로 보이지만 `exact` 는 지원 못 하는 기기에서 `getUserMedia` 를 **거부**시킨다 — ' +
      '해상도가 낮아지는 게 아니라 **카메라가 아예 안 열린다**. 구형 업소용 기기가 그 대상이다.',
  },
  {
    name: '계산대카메라 — 초점 제약을 떼어 낸다',
    file: CAM,
    find: "    await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] } as unknown as MediaTrackConstraints)",
    replace: '    /* (초점은 기기 자동에 맡긴다) */',
    test: T,
    why:
      '계산대 QR 은 20~40cm 근거리다. **초점이 안 맞으면 해상도가 아무리 높아도 못 읽는다** — ' +
      '해상도만 올리고 이걸 빼면 절반만 고친 것이고, 하필 노트북 화면처럼 먼 거리에서 더 나쁘다.',
  },
  {
    name: '계산대카메라 — 초점 실패를 삼키지 않는다',
    file: CAM,
    find: "  } catch { /* 초점 제약 미지원 — 자동 초점에 맡긴다 */ }",
    replace: '  }',
    test: T,
    why:
      '`advanced` 를 모르는 기기에서 이 호출이 던지면 **카메라가 통째로 안 열린다**(호출부의 catch 가 ' +
      '"카메라를 열 수 없어요" 로 떨어뜨린다). 좋게 만들려는 설정 하나가 기능을 없애는 모양이다.',
  },
  {
    name: '계산대카메라 — 한쪽 경로만 설정을 받는다',
    file: SRC,
    find: '      await applyBestCameraSettings(stream.getVideoTracks()[0])\n',
    replace: '',
    test: T,
    why:
      '네이티브 경로에서 빼면 **안드로이드에서만** 안 고쳐진다 — 대표가 겪은 바로 그 기기다. ' +
      '두 경로가 같은 헬퍼를 보는 것이 이 수리의 요점이고, 한쪽만 빠지면 그 사실이 조용히 깨진다.',
  },
  {
    name: '계산대카메라 — 확대를 기기 범위 무시하고 밀어 넣는다',
    file: CAM,
    find: '    const want = Math.min(z.max, Math.max(z.min, opts.zoom))',
    replace: '    const want = opts.zoom',
    test: T,
    why:
      '범위 밖 값은 `OverconstrainedError` 를 낸다 — 확대만 실패하는 게 아니라 그 호출이 통째로 ' +
      '거부돼, 같이 보낸 설정도 안 걸린다. 기기가 보고한 한계 안에서만 요구해야 한다.',
  },
  {
    name: '계산대카메라 — 확대를 못 하는 기기에도 요구한다',
    file: CAM,
    find: '    if (!z || !(z.max > z.min)) return  // 확대를 못 하는 기기 — 손으로 가까이 가야 한다',
    replace: '    const _unused = z  // (그래도 요구해 본다)',
    test: T,
    why:
      '`zoom` 기능이 없는 기기에 확대를 요구하면 거부된다. 위 항목과 같은 이유로 **다른 제약까지** ' +
      '함께 날아갈 수 있다 — 좋아지는 것은 없고 잃을 것만 있다.',
  },
  {
    name: '계산대카메라 — 지원 포맷을 안 묻는다',
    file: SRC,
    find: '    if (!supported) { await startWasm(); return }',
    replace: '    if (false) { await startWasm(); return }',
    test: T,
    why:
      '`BarcodeDetector` 가 **있는데 qr_code 를 지원하지 않는** 기기(Play 서비스 바코드 모듈 미설치)로 ' +
      '들어가 버린다. 그 경로는 빈 배열만 돌려주고 에러를 안 내므로 **영원히 조용히** 실패한다.',
  },
  {
    name: '계산대카메라 — 못 읽어도 wasm 으로 안 넘긴다',
    file: SRC,
    find: '        if (!sawAnything && (errs >= 5 || Date.now() - startedAt > DETECTOR_GRACE_MS)) { handOver(); return }',
    replace: '        // (네이티브가 못 읽으면 그냥 못 읽는다)',
    test: T,
    why:
      '포맷 조회가 `qr_code` 를 보고해도 실제로는 못 읽는 기기가 있다(모듈이 반쯤 깔린 경우). ' +
      '빈 배열은 "QR 이 화면에 없다" 와 구분이 안 되므로 **시간**으로만 그 실패를 관측할 수 있다. ' +
      '이 줄이 없으면 그 기기의 사장님은 영영 QR 을 못 찍는다.',
  },
  {
    name: '계산대카메라 — 읽는 중에도 엔진을 갈아탄다',
    file: SRC,
    find: '          if (found.length) { sawAnything = true; sawAnyRef.current = true; errs = 0 }',
    replace: '          if (found.length) { errs = 0 }',
    test: T,
    why:
      '멀쩡히 읽고 있는데도 6초마다 카메라를 재시작한다 — 손님 줄 앞에서 화면이 깜빡이고 ' +
      '그 순간의 스캔을 놓친다. 전환은 **실패를 관측했을 때만** 일어나야 한다.',
  },
  {
    name: '계산대카메라 — 폴링을 초당 3회로 되돌린다',
    file: CAM,
    find: 'export const SCAN_TICK_MS = 120',
    replace: 'export const SCAN_TICK_MS = 350',
    test: T,
    why:
      '종전 값이다. 손이 흔들리는 구간에서 좋은 프레임을 놓친다 — 노트북 화면처럼 반사가 있으면 ' +
      '"읽히는 프레임" 이 드물어서 이 간격이 그대로 체감 실패율이 된다.',
  },
  {
    name: '계산대카메라 — 스캔영역을 기본값(중앙 2/3)으로 되돌린다',
    file: SRC,
    find: '          calculateScanRegion: fullFrameScanRegion,',
    replace: '          // (기본 스캔영역)',
    test: T,
    why:
      'qr-scanner 기본값은 **중앙 정사각형(짧은 변의 2/3)** 만 보는데 `highlightScanRegion: false` 라 ' +
      '**그 영역이 화면에 안 보인다**. 사장님은 화면 전체로 조준하는데 가장자리는 통째로 무시된다.',
  },
  {
    name: '계산대카메라 — 다운스케일을 기본 400 으로 묶는다',
    file: CAM,
    find: '  const k = Math.min(1, 960 / Math.max(w, h))',
    replace: '  const k = Math.min(1, 400 / Math.max(w, h))',
    test: T,
    why:
      '해상도만 올리고 다운스케일을 안 올리면 **상쇄된다** — 1080p 로 받아서 400px 로 줄여 디코딩하면 ' +
      '올린 디테일을 도로 버린다. 둘은 짝이다.',
  },
  {
    name: '계산대카메라 — 프레임 크기 미확정 시 0 을 돌려준다',
    file: CAM,
    find: '  const w = v.videoWidth || 640',
    replace: '  const w = v.videoWidth',
    test: T,
    why:
      '`videoWidth` 는 메타데이터가 오기 전엔 **0** 이다. 0 짜리 스캔영역을 주면 디코더가 ' +
      '아무것도 안 보고 멎는데, 역시 에러가 안 난다(카메라만 켜져 있다).',
  },
  {
    name: '계산대카메라 — 못 읽어도 화면이 말하지 않는다 (종전 동작)',
    file: SRC,
    find: '    const id = window.setTimeout(() => { if (!sawAnyRef.current) setHelpOpen(true) }, SCAN_HELP_AFTER_MS)',
    replace: '    const id = window.setTimeout(() => { /* (조용히 기다린다) */ }, SCAN_HELP_AFTER_MS)',
    test: T,
    why:
      '정확히 종전 동작이다. 카메라만 켜져 있고 **아무 일도 안 일어난다** — 대표가 겪은 증상 그대로고, ' +
      '사장님은 자기가 잘못 비추는 줄 안다(손님 줄은 서 있다).',
  },
  {
    name: '계산대카메라 — 사진 입력에 capture 를 붙인다',
    file: SRC,
    find: '<input type="file" accept="image/*" className="hidden" onChange={onPickPhoto} disabled={photoBusy} />',
    replace: '<input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickPhoto} disabled={photoBusy} />',
    test: T,
    why:
      '"카메라로 바로 찍게" 로 보이지만 `capture` 는 **갤러리를 막는다** — 이미 찍어 둔 사진이나 ' +
      '노트북 스크린샷을 못 고른다. 이 폴백의 존재 이유가 *라이브 카메라가 안 되는 경우*인데 ' +
      '다시 라이브 카메라로 보내는 셈이다.',
  },
  {
    name: '계산대카메라 — 사진에서 못 찾으면 조용히 넘어간다',
    file: SRC,
    find: "      else setCameraError(t('seller.scan.photoNoQr',",
    replace: "      else void (t('seller.scan.photoNoQr',",
    test: T,
    why:
      '사진을 골랐는데 아무 일도 안 일어나면 사장님은 **버튼이 고장난 줄** 안다. 같은 사진을 ' +
      '몇 번이고 다시 고르게 된다 — 이 수리가 없애려던 "조용한 실패" 를 폴백 안에 다시 만드는 것이다.',
  },
]
