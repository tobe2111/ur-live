/**
 * 🧬 주입 — **QR 은 메인 렌즈로 읽는다** (2026-10-07)
 *
 * 되돌리면 후면 렌즈가 여럿인 안드로이드에서 **초광각(근거리 초점 없음)** 으로 다시 열린다.
 * 카메라는 켜지고 에러도 안 나므로, 사장님은 자기가 잘못 비추는 줄 안다 — 그리고 **기종마다**
 * 다르게 나타나 재현이 안 되니 아무도 결함으로 신고하지 않는다.
 */
const CAM = 'src/components/voucher/scan-camera.ts'
const SRC = 'src/components/voucher/VoucherScanner.tsx'
const T = 'src/tests/unit/scan-lens-pick-2026-10-07.test.ts'

export default [
  {
    name: '렌즈선택 — 초점 능력을 안 보고 첫 렌즈를 쓴다 (종전 동작)',
    file: CAM,
    find: "      if (caps?.focusMode?.includes('continuous')) {",
    replace: '      if (true) {',
    test: T,
    why:
      '크롬이 **초광각을 먼저** 내놓는 기종에서 그대로 초광각을 쓴다 — 근거리 초점이 없어 20~30cm 의 ' +
      'QR 이 흐릿하게 맺힌다. 네이티브 카메라 앱은 메인 렌즈로 바꾸므로 "폰 카메라는 되는데" 가 된다.',
  },
  {
    name: '렌즈선택 — 이름으로 보조 렌즈를 안 거른다',
    file: CAM,
    find: '  const main = back.filter((d) => !isAuxLensLabel(d.label))',
    replace: '  const main = back',
    test: T,
    why:
      '아이폰처럼 이름이 렌즈를 알려 주는데도 초광각·망원까지 열어 본다 — 그 둘도 `continuous` 를 ' +
      '보고하는 기기가 있어 **망원이 골라질 수 있다**(피사체가 화면을 넘쳐 QR 이 잘린다).',
  },
  {
    name: '렌즈선택 — 검사하며 연 렌즈를 안 닫는다',
    file: CAM,
    find: '      stream?.getTracks().forEach((t) => t.stop())',
    replace: '      void stream',
    test: T,
    why:
      '카메라를 **하나만** 열 수 있는 기기가 있다. 검사용 스트림을 안 닫으면 그 뒤 본 스트림이 ' +
      '`NotReadableError` 로 거부돼 **카메라가 아예 안 켜진다**(좋게 만들려던 검사가 기능을 없앤다).',
  },
  {
    name: '렌즈선택 — 고른 렌즈를 기억하지 않는다',
    file: CAM,
    find: "      if (caps?.focusMode?.includes('continuous')) {\n        rememberCamera(d.deviceId)",
    replace: "      if (caps?.focusMode?.includes('continuous')) {\n        void 0",
    test: T,
    why:
      '계산대를 열 때마다 렌즈를 하나씩 다시 열어 본다 — 손님 앞에서 매번 0.5~1초가 더 걸리고 ' +
      '화면이 깜빡인다. 한 번 고르면 그 기기는 그 렌즈다.',
  },
  {
    name: '렌즈선택 — 기억한 렌즈가 사라져도 그대로 쓴다',
    file: CAM,
    find: '  if (cached && back.some((d) => d.deviceId === cached)) return cached',
    replace: '  if (cached) return cached',
    test: T,
    why:
      '다른 폰으로 바꿨거나 렌즈 id 가 바뀌면 **없는 렌즈**를 열려다 실패한다. 네이티브 경로는 ' +
      '기본으로 떨어지지만 그만큼 다시 고르지 못하고 초광각에 머물 수 있다.',
  },
  {
    name: '렌즈선택 — 첫 방문 재선택 전에 스트림을 안 놓는다',
    file: SRC,
    find: '        stream.getTracks().forEach((tr) => tr.stop())\n        chosen = await pickBestBackCamera()',
    replace: '        chosen = await pickBestBackCamera()',
    test: T,
    why:
      '첫 방문엔 권한 전이라 렌즈를 못 고르고 기본으로 연다. 그 스트림을 쥔 채 렌즈를 검사하면 ' +
      '카메라를 하나만 여는 기기에서 **검사가 전부 실패**하고, 처음 연 그 렌즈(초광각일 수 있다)에 머문다.',
  },
  {
    name: '렌즈선택 — wasm 경로는 렌즈를 안 고른다',
    file: SRC,
    find: "          preferredCamera: chosen ?? 'environment',",
    replace: "          preferredCamera: 'environment',",
    test: T,
    why:
      '아이폰과 "네이티브가 못 읽는 안드로이드" 는 wasm 경로를 탄다. 거기서만 렌즈를 안 고르면 ' +
      '**바로 그 기기들**에서 초광각 문제가 남는다 — 두 경로가 같은 판정을 써야 한다.',
  },
  {
    name: '렌즈선택 — 렌즈를 정해도 facingMode 를 같이 보낸다',
    file: SRC,
    find: '            ? { deviceId: { exact: id }, width: SCAN_VIDEO_CONSTRAINTS.width, height: SCAN_VIDEO_CONSTRAINTS.height }',
    replace: '            ? { ...SCAN_VIDEO_CONSTRAINTS, deviceId: { exact: id } }',
    test: T,
    why:
      '"해상도도 같이 보내려고" 로 보이지만 `facingMode` 가 함께 가면 그 렌즈와 충돌하는 기기가 있다 — ' +
      '`OverconstrainedError` 로 거부되고, 기본으로 떨어져 **고른 렌즈가 무시된다**.',
  },
  {
    name: '렌즈선택 — 전환 버튼을 카메라 위에 늘 띄운다',
    file: SRC,
    find: '        {busy && (',
    replace: "        {cameraOn && backCams.length > 1 && <button type=\"button\" onClick={() => { void switchCamera() }}>전환</button>}\n        {busy && (",
    test: T,
    why:
      '평소엔 자동으로 메인 렌즈를 고르므로 늘 떠 있는 버튼은 소음이다(대표 "그런게 필요해?"). ' +
      '7초 동안 한 건도 못 읽었을 때의 도움말 안에서만 나와야 한다.',
  },
]
