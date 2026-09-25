from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "previews"
OUT.mkdir(parents=True, exist_ok=True)

MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
SANS = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"

THEMES = {
    "rebellion": {
        "title": "#100D15", "activity": "#100D15", "sidebar": "#15111B",
        "tabs": "#100D15", "editor": "#1B1621", "panel": "#141018",
        "line": "#241B2A", "border": "#2D2335", "text": "#E9E3EE",
        "muted": "#7D7487", "keyword": "#F05A82", "string": "#C9A8F2",
        "number": "#F0BD57", "function": "#E7BC5D", "type": "#9FC4F0",
        "property": "#80CEB0", "status": "#741D3B", "accent": "#CF416F",
        "sidebar_text": "#CFC5D8", "tab_muted": "#8D8398", "title_text": "#EDE6F2",
    },
    "britannia": {
        "title": "#37233E", "activity": "#37233E", "sidebar": "#F1EAEE",
        "tabs": "#E9E0E5", "editor": "#FFFDF9", "panel": "#F8F3F5",
        "line": "#F7F1F3", "border": "#D2C5D4", "text": "#312B35",
        "muted": "#817681", "keyword": "#A51F4B", "string": "#67458F",
        "number": "#8B6008", "function": "#75520A", "type": "#315F91",
        "property": "#24705B", "status": "#7F2141", "accent": "#A72F55",
        "sidebar_text": "#4B3E50", "tab_muted": "#756A79", "title_text": "#FFF9FC",
    },
}


def font(path, size):
    return ImageFont.truetype(path, size)


F_TITLE = font(SANS, 14)
F_UI = font(SANS, 13)
F_SMALL = font(SANS, 11)
F_CODE = font(MONO, 18)
F_LINE = font(MONO, 14)
F_TERM = font(MONO, 14)


CODE = [
    [("class", "keyword"), (" ", "text"), ("ZeroRequiem", "type"), (" {", "text")],
    [("  constructor", "keyword"), ("(", "text"), ("objective", "property"), (") {", "text")],
    [("    this", "keyword"), (".", "text"), ("objective", "property"), (" = ", "text"), ("objective", "property"), (";", "text")],
    [("    this", "keyword"), (".", "text"), ("pieces", "property"), (" = [];", "text")],
    [("  }", "text")],
    [],
    [("  async", "keyword"), (" ", "text"), ("execute", "function"), ("() {", "text")],
    [("    // The only ones who should kill are those prepared to be killed.", "muted")],
    [("    const", "keyword"), (" result = ", "text"), ("await", "keyword"), (" ", "text"), ("changeTheWorld", "function"), ("({", "text")],
    [("      ", "text"), ("codename", "property"), (": ", "text"), ("'Zero'", "string"), (",", "text")],
    [("      ", "text"), ("resolve", "property"), (": ", "text"), ("100", "number"), (",", "text")],
    [("      ", "text"), ("strategy", "property"), (": ", "text"), ("`absolute victory`", "string")],
    [("    });", "text")],
    [],
    [("    return", "keyword"), (" result", "property"), (".", "text"), ("future", "property"), (";", "text")],
    [("  }", "text")],
    [("}", "text")],
]


def text(draw, xy, value, fill, used_font=F_UI):
    draw.text(xy, value, font=used_font, fill=fill)


def render(name, colors):
    width, height = 1440, 900
    image = Image.new("RGB", (width, height), colors["editor"])
    draw = ImageDraw.Draw(image)

    title_h, status_h, activity_w, sidebar_w, tabs_h, panel_h = 38, 24, 52, 252, 38, 205
    content_top, content_bottom = title_h, height - status_h
    editor_x = activity_w + sidebar_w
    editor_y = content_top + tabs_h
    panel_y = content_bottom - panel_h

    draw.rectangle((0, 0, width, title_h), fill=colors["title"])
    for x, color in zip((18, 37, 56), ("#FF5F57", "#FEBC2E", "#28C840")):
        draw.ellipse((x, 14, x + 11, 25), fill=color)
    title_name = "geass-requiem — Visual Studio Code"
    title_box = draw.textbbox((0, 0), title_name, font=F_TITLE)
    text(draw, ((width - (title_box[2] - title_box[0])) / 2, 10), title_name, colors["title_text"], F_TITLE)

    draw.rectangle((0, content_top, activity_w, content_bottom), fill=colors["activity"])
    draw.rectangle((activity_w, content_top, editor_x, content_bottom), fill=colors["sidebar"])
    draw.line((activity_w, content_top, activity_w, content_bottom), fill=colors["border"])
    draw.line((editor_x, content_top, editor_x, content_bottom), fill=colors["border"])

    for i in range(5):
        y = content_top + 18 + i * 48
        if i == 0:
            draw.rectangle((0, y - 3, 2, y + 27), fill=colors["accent"])
        ink = colors["title_text"] if i == 0 else colors["tab_muted"]
        if i == 0:
            draw.rectangle((17, y, 31, y + 18), outline=ink, width=2)
            draw.rectangle((21, y + 5, 35, y + 23), outline=ink, width=2)
        elif i == 1:
            draw.ellipse((17, y, 31, y + 14), outline=ink, width=2)
            draw.line((29, y + 12, 36, y + 20), fill=ink, width=2)
        elif i == 2:
            draw.line((20, y + 2, 20, y + 20), fill=ink, width=2)
            draw.line((20, y + 8, 32, y + 8), fill=ink, width=2)
            draw.ellipse((17, y - 1, 23, y + 5), outline=ink, width=2)
            draw.ellipse((29, y + 5, 35, y + 11), outline=ink, width=2)
            draw.ellipse((17, y + 17, 23, y + 23), outline=ink, width=2)
        elif i == 3:
            draw.polygon(((18, y), (18, y + 20), (34, y + 10)), outline=ink)
        else:
            for dx, dy in ((17, 0), (27, 0), (17, 10), (27, 10)):
                draw.rectangle((dx, y + dy, dx + 7, y + dy + 7), outline=ink, width=1)
    gear_y = content_bottom - 28
    draw.ellipse((17, gear_y, 35, gear_y + 18), outline=colors["tab_muted"], width=2)
    draw.ellipse((23, gear_y + 6, 29, gear_y + 12), outline=colors["tab_muted"], width=1)

    text(draw, (activity_w + 18, content_top + 15), "EXPLORER", colors["function"], F_SMALL)
    text(draw, (activity_w + 10, content_top + 55), "v  GEASS-REQUIEM", colors["sidebar_text"], F_SMALL)
    text(draw, (activity_w + 22, content_top + 84), "v  src", colors["sidebar_text"])
    draw.rectangle((activity_w, content_top + 108, editor_x, content_top + 136), fill=colors["line"])
    text(draw, (activity_w + 25, content_top + 114), "JS", colors["function"], F_SMALL)
    text(draw, (activity_w + 53, content_top + 112), "strategy.js", colors["text"])
    text(draw, (activity_w + 25, content_top + 144), "{ }", colors["string"], F_SMALL)
    text(draw, (activity_w + 53, content_top + 142), "package.json", colors["sidebar_text"])
    text(draw, (activity_w + 25, content_top + 172), "M↓", colors["property"], F_SMALL)
    text(draw, (activity_w + 53, content_top + 170), "README.md", colors["sidebar_text"])

    draw.rectangle((editor_x, content_top, width, content_top + tabs_h), fill=colors["tabs"])
    draw.rectangle((editor_x, content_top, editor_x + 210, content_top + tabs_h), fill=colors["editor"])
    draw.rectangle((editor_x, content_top, editor_x + 210, content_top + 2), fill=colors["accent"])
    draw.line((editor_x + 210, content_top, editor_x + 210, content_top + tabs_h), fill=colors["border"])
    text(draw, (editor_x + 16, content_top + 11), "JS", colors["function"], F_SMALL)
    text(draw, (editor_x + 45, content_top + 10), "strategy.js   ×", colors["text"])
    text(draw, (editor_x + 230, content_top + 11), "{ }", colors["string"], F_SMALL)
    text(draw, (editor_x + 265, content_top + 10), "package.json", colors["tab_muted"])

    draw.rectangle((editor_x, editor_y, width, panel_y), fill=colors["editor"])
    line_h, first_y = 28, editor_y + 16
    draw.rectangle((editor_x, first_y + 8 * line_h - 2, width, first_y + 9 * line_h + 2), fill=colors["line"])
    for idx, segments in enumerate(CODE, start=1):
        y = first_y + (idx - 1) * line_h
        num = str(idx)
        num_w = draw.textlength(num, font=F_LINE)
        text(draw, (editor_x + 48 - num_w, y + 3), num, colors["function"] if idx == 9 else colors["muted"], F_LINE)
        x = editor_x + 70
        for value, key in segments:
            text(draw, (x, y), value, colors[key], F_CODE)
            x += draw.textlength(value, font=F_CODE)

    draw.rectangle((editor_x, panel_y, width, content_bottom), fill=colors["panel"])
    draw.line((editor_x, panel_y, width, panel_y), fill=colors["border"])
    headings = [("TERMINAL", editor_x + 20), ("OUTPUT", editor_x + 112), ("DEBUG CONSOLE", editor_x + 182)]
    for label, x in headings:
        text(draw, (x, panel_y + 13), label, colors["text"] if label == "TERMINAL" else colors["muted"], F_SMALL)
    draw.rectangle((editor_x + 20, panel_y + 36, editor_x + 83, panel_y + 38), fill=colors["accent"])
    text(draw, (editor_x + 20, panel_y + 62), "➜", colors["property"], F_TERM)
    text(draw, (editor_x + 45, panel_y + 62), "geass-requiem git:(main) npm run package", colors["text"], F_TERM)
    text(draw, (editor_x + 20, panel_y + 91), "✓", colors["function"], F_TERM)
    text(draw, (editor_x + 45, panel_y + 91), "Packaged: geass-requiem-theme-0.1.1.vsix", colors["text"], F_TERM)
    text(draw, (editor_x + 20, panel_y + 120), "➜", colors["property"], F_TERM)
    text(draw, (editor_x + 45, panel_y + 120), "geass-requiem git:(main)  ▌", colors["text"], F_TERM)

    draw.rectangle((0, content_bottom, width, height), fill=colors["status"])
    text(draw, (12, content_bottom + 4), "main*      0 errors      0 warnings", "#FFF9FB", F_SMALL)
    right = "Ln 9, Col 42      Spaces: 2      UTF-8      JavaScript"
    right_w = draw.textlength(right, font=F_SMALL)
    text(draw, (width - right_w - 14, content_bottom + 4), right, "#FFF9FB", F_SMALL)

    image.save(OUT / f"{name}.png", optimize=True)


for theme_name, palette in THEMES.items():
    render(theme_name, palette)
