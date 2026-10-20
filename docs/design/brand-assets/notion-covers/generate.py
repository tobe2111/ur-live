#!/usr/bin/env python3
"""유어팀 Notion 커버 생성기 — 외부 의존 0 (zlib + struct 만)."""
import zlib, struct, math, os, sys

W, H = 1500, 600
OUT = os.path.dirname(os.path.abspath(__file__))


def png(path, rows):
    raw = b"".join(b"\x00" + bytes(r) for r in rows)
    comp = zlib.compress(raw, 9)

    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    hdr = struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0)  # 8-bit RGB
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", hdr) + chunk(b"IDAT", comp) + chunk(b"IEND", b""))


def lerp(a, b, t):
    return a + (b - a) * t


def make(name, c1, c2, accent=None, style="diagonal"):
    """c1→c2 그라데이션 + 은은한 광원. accent 는 곡선 하이라이트 색."""
    rows = []
    cx, cy = W * 0.72, H * 0.30          # 광원 위치
    maxd = math.hypot(W, H)
    for y in range(H):
        row = bytearray()
        for x in range(W):
            if style == "diagonal":
                t = (x / W) * 0.72 + (y / H) * 0.28
            elif style == "vertical":
                t = y / H
            else:                          # radial
                t = min(1.0, math.hypot(x - cx, y - cy) / (maxd * 0.62))
            t = t * t * (3 - 2 * t)        # smoothstep

            r = lerp(c1[0], c2[0], t)
            g = lerp(c1[1], c2[1], t)
            b = lerp(c1[2], c2[2], t)

            # 부드러운 광원 (좌상단으로 살짝 밝게)
            d = math.hypot(x - cx, y - cy) / maxd
            glow = max(0.0, 1.0 - d * 1.9) ** 2 * 0.20
            r += (255 - r) * glow
            g += (255 - g) * glow
            b += (255 - b) * glow

            # accent: 완만한 사인 곡선 띠
            if accent:
                band = math.sin(x / W * math.pi * 1.15 + 0.4) * H * 0.20 + H * 0.63
                dist = abs(y - band)
                if dist < H * 0.30:
                    w = (1 - dist / (H * 0.30)) ** 2 * 0.28
                    r = lerp(r, accent[0], w)
                    g = lerp(g, accent[1], w)
                    b = lerp(b, accent[2], w)

            # 하단 비네트 (제목 글자 가독성)
            if y > H * 0.55:
                v = ((y - H * 0.55) / (H * 0.45)) ** 2 * 0.22
                r *= 1 - v
                g *= 1 - v
                b *= 1 - v

            row += bytes((int(max(0, min(255, r))), int(max(0, min(255, g))), int(max(0, min(255, b)))))
        rows.append(row)
    p = os.path.join(OUT, name + ".png")
    png(p, rows)
    print(f"{p}  {os.path.getsize(p)//1024}KB")


PALETTE = {
    # 이름            시작색          끝색            accent
    "cover-urteam":   ((26, 44, 66), (12, 18, 30),  (224, 82, 107)),   # 유어팀 — 잉크+브랜드로즈
    "cover-urdeal":   ((224, 82, 107), (140, 38, 66), (255, 176, 158)),  # 유어딜 — 로즈
    "cover-mall":     ((22, 122, 108), (10, 52, 58), (126, 214, 174)),   # 공구 — 그린
    "cover-urads":    ((88, 62, 168), (34, 24, 74),  (170, 150, 255)),   # 유어애즈 — 퍼플
    "cover-closed":   ((92, 96, 104), (44, 47, 54),  (150, 155, 165)),   # 종료 — 그레이
    "cover-ops":      ((30, 74, 122), (14, 30, 54),  (120, 180, 230)),   # 운영 — 블루
    "cover-growth":   ((196, 104, 42), (92, 42, 26), (255, 190, 120)),   # 마케팅/세일즈 — 오렌지
    "cover-finance":  ((26, 96, 84), (12, 40, 42),  (140, 210, 180)),    # 재무 — 틸
    "cover-people":   ((150, 70, 130), (58, 26, 60), (240, 160, 220)),   # 인사 — 마젠타
    "cover-docs":     ((70, 78, 92), (30, 34, 44),  (160, 170, 190)),    # 자료 — 뉴트럴
    "cover-brand":    ((30, 32, 40), (60, 40, 52),  (224, 82, 107)),     # 브랜드 — 다크+로즈
}

if __name__ == "__main__":
    only = sys.argv[1:] or list(PALETTE)
    for n in only:
        c1, c2, ac = PALETTE[n]
        make(n, c1, c2, ac, "radial" if n == "cover-urteam" else "diagonal")
