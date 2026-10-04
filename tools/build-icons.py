"""
Gera js/icons.js: um sprite SVG com os ícones Phosphor (MIT, https://phosphoricons.com)
usados pelo jogo. O sprite é injetado no DOM em tempo de execução, então os ícones
funcionam offline e também abrindo o index.html direto do disco.

Uso: python tools/build-icons.py
"""
import json
import pathlib
import re
import urllib.request

VERSION = "2.1.1"
BASE = f"https://cdn.jsdelivr.net/npm/@phosphor-icons/core@{VERSION}/assets"

# id do símbolo -> (peso, nome no Phosphor)
ICONS = {
    "crown": ("duotone", "crown"),
    "crown-solid": ("fill", "crown-simple"),
    "music": ("duotone", "music-notes"),
    "speaker": ("duotone", "speaker-high"),
    "speaker-off": ("duotone", "speaker-slash"),
    "perspective": ("duotone", "perspective"),
    "sliders": ("duotone", "sliders-horizontal"),
    "undo": ("bold", "arrow-counter-clockwise"),
    "hint": ("duotone", "lightbulb-filament"),
    "restart": ("bold", "arrow-clockwise"),
    "feed": ("duotone", "list-numbers"),
    "rules": ("duotone", "book-open-text"),
    "timer": ("duotone", "timer"),
    "close": ("bold", "x"),
    "trophy": ("duotone", "trophy"),
    "skull": ("duotone", "skull"),
    "handshake": ("duotone", "handshake"),
    "sword": ("duotone", "sword"),
    "lightning": ("duotone", "lightning"),
    "footprints": ("duotone", "footprints"),
    "sparkle": ("duotone", "sparkle"),
    "cpu": ("duotone", "cpu"),
    "user": ("duotone", "user"),
    "users": ("duotone", "users"),
    "robot": ("duotone", "robot"),
    "palette": ("duotone", "palette"),
    "vibrate": ("duotone", "vibrate"),
    "keyboard": ("duotone", "keyboard"),
    "medal": ("duotone", "medal"),
    "warning": ("duotone", "warning-diamond"),
    "crosshair": ("duotone", "crosshair"),
    "scales": ("duotone", "scales"),
    "gauge": ("duotone", "gauge"),
    "check": ("bold", "check"),
    "eye": ("duotone", "eye"),
    "hourglass": ("duotone", "hourglass-medium"),
    "game": ("duotone", "game-controller"),
    "fire": ("duotone", "fire"),
    "info": ("duotone", "info"),
    "arrow-right": ("bold", "arrow-right"),
    "seal": ("duotone", "seal-check"),
}


def fetch(weight, name):
    suffix = "" if weight == "regular" else f"-{weight}"
    url = f"{BASE}/{weight}/{name}{suffix}.svg"
    with urllib.request.urlopen(url, timeout=20) as resp:
        return resp.read().decode("utf-8")


def to_symbol(symbol_id, svg):
    inner = re.search(r"<svg[^>]*>(.*)</svg>", svg, re.S).group(1)
    # A camada secundária do duotone passa a obedecer variáveis CSS,
    # que atravessam a shadow tree do <use>.
    inner = inner.replace(
        'opacity="0.2"',
        'style="fill:var(--icon-duo,currentColor);opacity:var(--icon-duo-opacity,.28)"',
    )
    return f'<symbol id="i-{symbol_id}" viewBox="0 0 256 256">{inner}</symbol>'


def main():
    root = pathlib.Path(__file__).resolve().parent.parent
    symbols, missing = [], []
    for symbol_id, (weight, name) in ICONS.items():
        try:
            symbols.append(to_symbol(symbol_id, fetch(weight, name)))
        except Exception as exc:  # noqa: BLE001
            missing.append(f"{symbol_id} ({weight}/{name}): {exc}")

    sprite = (
        '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" '
        'style="position:absolute;width:0;height:0;overflow:hidden">'
        "<defs>"
        '<linearGradient id="g-gold" x1="0" y1="0" x2="0" y2="1">'
        '<stop offset="0" stop-color="#fff4d1"/><stop offset=".45" stop-color="#f2c46d"/>'
        '<stop offset="1" stop-color="#a8742a"/></linearGradient>'
        "</defs>"
        + "".join(symbols)
        + "</svg>"
    )
    js = (
        "/**\n"
        " * Sprite de ícones Phosphor Icons (MIT) — gerado por tools/build-icons.py.\n"
        " * Não edite à mão: ajuste a lista no script e rode-o de novo.\n"
        " */\n"
        f"document.body.insertAdjacentHTML('afterbegin', {json.dumps(sprite)});\n"
    )
    (root / "js" / "icons.js").write_text(js, encoding="utf-8")
    print(f"{len(symbols)} ícones gravados em js/icons.js")
    for m in missing:
        print("FALTANDO:", m)


if __name__ == "__main__":
    main()
