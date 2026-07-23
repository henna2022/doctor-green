# -*- coding: utf-8 -*-
"""Generate the Doctor Green edu (virtual lab) screen-flow SVGs.
Matches the existing doctor-green service-flow design system exactly
(same palette tokens, box classes, marker, typography)."""
import os

OUT = os.path.dirname(os.path.abspath(__file__))

# ---- palette / style blocks (verbatim from the service-flow reference) ----
FONT = ("text{font-family:'Apple SD Gothic Neo','AppleGothic','Helvetica Neue',sans-serif}"
        ".m{font-family:'Menlo','SF Mono',monospace}")
LIGHT = (".box-auth{fill:#E1EEFE;stroke:#B4D2F7}.box-tab{fill:#2F6BF0}.box-feat{fill:#EEF5FF;stroke:#A9C7F5}"
         ".box-ext{fill:#F1F5FA;stroke:#C7D3E4}.tt-auth{fill:#274B8E}.ts-auth{fill:#7492C2}.tt-tab{fill:#FFFFFF}"
         ".ts-tab{fill:#D2E1FF}.tt-feat{fill:#1C4AB8}.ts-feat{fill:#6E8CC0}.tt-ext{fill:#45587A}.ts-ext{fill:#8492AB}"
         ".h-title{fill:#16357A}.h-sub{fill:#6C86B4}.h-accent{fill:#2F6BF0}.lg{fill:#45587A}.cap{fill:#7C97C6}"
         ".conn{stroke:#A6BEE0}.dash{stroke:#BFD5F3}")
DARK = (".box-auth{fill:#1C2B49;stroke:#3E5C8F}.box-tab{fill:#3B7BF5}.box-feat{fill:#1B2A48;stroke:#3A5C93}"
        ".box-ext{fill:#222C44;stroke:#45536F}.tt-auth{fill:#BBCFF2}.ts-auth{fill:#7E96C0}.tt-tab{fill:#FFFFFF}"
        ".ts-tab{fill:#CFE0FF}.tt-feat{fill:#A6C6FF}.ts-feat{fill:#7288B6}.tt-ext{fill:#AEBBD3}.ts-ext{fill:#8492AB}"
        ".h-title{fill:#E6EDFB}.h-sub{fill:#93A8CC}.h-accent{fill:#4C86F5}.lg{fill:#AEBFDC}.cap{fill:#7E93BC}"
        ".conn{stroke:#566E9E}.dash{stroke:#3C4F79}")

STYLE = {
    "light": FONT + LIGHT,
    "dark":  FONT + DARK,
    "auto":  FONT + LIGHT + "@media (prefers-color-scheme:dark){" + DARK + "}",
}

DEFS = ('<defs><marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" '
        'orient="auto-start-reverse"><path d="M2 1.5L8 5L2 8.5" fill="none" stroke="context-stroke" '
        'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>')

VB_W, VB_H = 760, 622

# ---- geometry ----
CX = [145, 302, 459, 616]          # 4 station / db columns (mid = 380.5)
CENTER = 380
COLW = 150

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def box(cx, y, w, h, boxcls, main, sub, ttcls, tscls, main_sz=14, sub_sz=11.5,
        main_mono=False, sub_mono=True, sw=1.2):
    x = cx - w / 2
    stroke = f' stroke-width="{sw}"' if boxcls != "box-tab" else ""
    my = y + round(h * 0.45)
    sy = y + round(h * 0.80)
    mm = " m" if main_mono else ""
    sm = " m" if sub_mono else ""
    parts = [f'<rect x="{x:g}" y="{y}" width="{w}" height="{h}" rx="10" class="{boxcls}"{stroke}/>']
    parts.append(f'<text x="{cx}" y="{my}" font-size="{main_sz:g}" font-weight="500" '
                 f'text-anchor="middle" class="{ttcls}{mm}">{esc(main)}</text>')
    if sub:
        parts.append(f'<text x="{cx}" y="{sy}" font-size="{sub_sz:g}" text-anchor="middle" '
                     f'class="{tscls}{sm}">{esc(sub)}</text>')
    return "".join(parts)

def path(d, arrow=True, sw=1.3):
    a = ' marker-end="url(#ar)"' if arrow else ""
    return f'<path d="{d}" fill="none" class="conn" stroke-width="{sw}"{a}/>'

def build(text):
    T = text
    s = [f'<svg width="{VB_W}" height="{VB_H}" viewBox="0 0 {VB_W} {VB_H}" xmlns="http://www.w3.org/2000/svg">']
    s.append(DEFS)
    s.append("__STYLE__")

    # ---- header ----
    s.append('<rect x="40" y="34" width="4" height="32" rx="2" class="h-accent"/>')
    s.append(f'<text x="56" y="50" font-size="20" font-weight="500" class="h-title">{esc(T["title"])}</text>')
    s.append(f'<text x="56" y="68" font-size="12.5" class="h-sub">{esc(T["subtitle"])}</text>')

    # ---- legend (top-right, 4 rows) ----
    lg = T["legend"]
    lx, tx = 566, 585
    rows = [("box-tab", lg[0]), ("box-feat", lg[1]), ("box-auth", lg[2]), ("box-ext", lg[3])]
    for i, (cls, label) in enumerate(rows):
        ry = 34 + i * 19
        extra = "" if cls == "box-tab" else ' stroke-width="1.2"'
        s.append(f'<rect x="{lx}" y="{ry}" width="13" height="13" rx="3" class="{cls}"{extra}/>')
        s.append(f'<text x="{tx}" y="{ry + 11}" font-size="11.5" class="lg">{esc(label)}</text>')

    # ---- connectors (draw before boxes so boxes sit on top) ----
    # entry -> hub
    s.append(path("M380 164 V192"))
    # hub -> 4 stations (stub + bus + drops)
    s.append(path("M380 242 V266", arrow=False))
    s.append(path(f"M{CX[0]} 266 H{CX[3]}", arrow=False))
    for cx in CX:
        s.append(path(f"M{cx} 266 V288"))
    # stations -> db tables (1:1, each STEP writes its table)
    for cx in CX:
        s.append(path(f"M{cx} 336 V376"))
    # db tables -> app (stubs + bus + into app)
    for cx in CX:
        s.append(path(f"M{cx} 420 V446", arrow=False))
    s.append(path(f"M{CX[0]} 446 H{CX[3]}", arrow=False))
    s.append(path("M380 446 V472"))
    # app -> device
    s.append(path("M380 524 V554"))

    # ---- dashed group boxes + labels (labels centered in arrow-free mid gap) ----
    s.append('<rect x="54" y="278" width="644" height="66" rx="13" fill="none" class="dash" '
             'stroke-width="1" stroke-dasharray="5 4"/>')
    s.append(f'<text x="380" y="273" font-size="11" text-anchor="middle" class="cap">{esc(T["grp_step"])}</text>')
    s.append('<rect x="54" y="366" width="644" height="62" rx="13" fill="none" class="dash" '
             'stroke-width="1" stroke-dasharray="5 4"/>')
    s.append(f'<text x="380" y="360" font-size="11" text-anchor="middle" class="cap">{esc(T["grp_db"])}</text>')

    # ---- nodes ----
    # entry
    s.append(box(CENTER, 120, 264, 44, "box-ext", T["entry"][0], T["entry"][1],
                 "tt-ext", "ts-ext", sub_sz=11, sub_mono=True))
    # hub (filled)
    s.append(box(CENTER, 192, 300, 50, "box-tab", T["hub"][0], T["hub"][1],
                 "tt-tab", "ts-tab", main_sz=15, sub_sz=11, sub_mono=False))
    # stations
    for cx, st in zip(CX, T["steps"]):
        s.append(box(cx, 288, COLW, 48, "box-feat", st[0], st[1], "tt-feat", "ts-feat",
                     main_sz=13.5, sub_sz=11, sub_mono=True))
    # db tables (box-auth, mono names)
    for cx, db in zip(CX, T["dbs"]):
        s.append(box(cx, 376, COLW, 44, "box-auth", db, "INSERT +1", "tt-auth", "ts-auth",
                     main_sz=12.5, sub_sz=10, main_mono=True, sub_mono=True))
    # app complete (filled)
    s.append(box(CENTER, 472, 320, 52, "box-tab", T["app"][0], T["app"][1],
                 "tt-tab", "ts-tab", main_sz=15, sub_sz=11, sub_mono=False))
    # device (optional)
    s.append(box(CENTER, 554, 288, 44, "box-ext", T["device"][0], T["device"][1],
                 "tt-ext", "ts-ext", sub_sz=10.5, sub_mono=False))

    s.append("</svg>")
    return "".join(s)

# ---- content ----
KO = {
    "title": "닥터그린 · 스마트팜 가상 실습실",
    "subtitle": "AI 작물진단 교육 · 4-스테이션 실습 흐름",
    "legend": ["허브 · 앱 완성", "STEP 스테이션", "DB 테이블 (가상 Supabase)", "진입 · 실물 시연"],
    "grp_step": "4개 STEP · 순차 진행",
    "grp_db": "가상 Supabase 적재",
    "entry": ("실습실 접속", "doctor-green-edu.vercel.app"),
    "hub": ("실습실 허브", "방 1–15 선택 · 진행도 0/4 → 4/4"),
    "steps": [("공공데이터 날씨", "STEP 1"), ("AI 비전 학습", "STEP 2"),
              ("IoT 센서", "STEP 3"), ("카메라 라이브", "STEP 4")],
    "dbs": ["weather_cache", "diagnoses", "sensor_readings", "camera_frames"],
    "app": ("내 앱 완성", "오늘 날씨 · AI 진단 · 실시간 분석 · LIVE"),
    "device": ("실물 디바이스 시연", "선택 · ESP32 헥사보드 딸기 디바이스"),
}
EN = {
    "title": "Doctor Green · Smart-Farm Virtual Lab",
    "subtitle": "AI crop-doctor education · 4-station lab flow",
    "legend": ["Hub · App complete", "STEP stations", "DB tables (virtual Supabase)", "Entry · Live demo"],
    "grp_step": "4 STEPs · in order",
    "grp_db": "Virtual Supabase",
    "entry": ("Open the Lab", "doctor-green-edu.vercel.app"),
    "hub": ("Lab Hub", "pick room 1–15 · progress 0/4 → 4/4"),
    "steps": [("Public Weather", "STEP 1"), ("AI Vision (YOLO)", "STEP 2"),
              ("IoT Sensors", "STEP 3"), ("Camera Live", "STEP 4")],
    "dbs": ["weather_cache", "diagnoses", "sensor_readings", "camera_frames"],
    "app": ("App Complete", "weather · AI · live analytics · camera"),
    "device": ("Live Device Demo", "optional · ESP32 hexa-board device"),
}

for lang, text in [("ko", KO), ("en", EN)]:
    body = build(text)
    for mode in ("light", "dark", "auto"):
        svg = body.replace("__STYLE__", f"<style>{STYLE[mode]}</style>")
        fn = os.path.join(OUT, f"doctorgreen-edu-flow-{lang}-{mode}.svg")
        with open(fn, "w", encoding="utf-8") as f:
            f.write(svg)
        print("wrote", os.path.basename(fn), len(svg), "bytes")
