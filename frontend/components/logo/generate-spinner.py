#!/usr/bin/env python3

import json
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
FPS = 30
DENSITIES = [1, 1.5, 2, 2.625, 3, 4]
GRID = 16

logo = json.loads((HERE / 'logo-16.json').read_text())
cells = logo['cells']
stagger, fade = logo['staggerMs'], logo['fadeMs']
fade_window = (len(cells) - 1) * stagger + fade
# The fade delays are zeroed so the logo pulses continuously; otherwise it
# would sit on the fully-visible and fully-hidden frames for a moment, which
# reads as the spinner freezing.
cycle = 2 * fade_window


def opacity(index: int, time: float) -> float:
    fade_in = index * stagger
    fade_out = fade_window + index * stagger
    if fade_in <= time <= fade_in + fade:
        return ((time - fade_in) / fade) ** 5
    if fade_in + fade < time < fade_out:
        return 1.0
    if fade_out <= time <= fade_out + fade:
        return 1 - ((time - fade_out) / fade) ** 5
    return 0.0


def frame(color: tuple[int, int, int], size_px: int, time: float) -> Image.Image:
    big = size_px * GRID
    alpha = Image.new('L', (big, big), 0)
    for i, (x, y) in enumerate(cells):
        a = round(255 * opacity(i, time))
        if a:
            alpha.paste(a, (x * size_px, y * size_px, (x + 1) * size_px, (y + 1) * size_px))
    image = Image.new('RGBA', (size_px, size_px), color + (0,))
    image.putalpha(alpha.reduce(GRID))
    return image


def write_spinner(color: tuple[int, int, int], size_px: int, path: Path) -> None:
    count = round(cycle * FPS / 1000)
    times = [fade_window + i * cycle / count for i in range(count)]
    frames = [frame(color, size_px, t % cycle) for t in times]
    durations = [round((i + 1) * cycle / count) - round(i * cycle / count) for i in range(count)]
    frames[0].save(
        path,
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        lossless=True,
        method=6,
        kmin=0,
        kmax=1,
    )


pixel_sizes = sorted({
    round(size * density)
    for size in logo['sizesPx'].values()
    for density in DENSITIES
})

for old in (HERE / 'spinner').glob('logo-spinner-*.webp'):
    old.unlink()

entries = []
for color in logo['spinnerColors']:
    rgb = tuple(int(color[i:i + 2], 16) for i in (1, 3, 5))
    for size_px in pixel_sizes:
        name = f'logo-spinner-{color[1:]}-{size_px}.webp'
        write_spinner(rgb, size_px, HERE / 'spinner' / name)
        entries.append(f"  ['{color}', {size_px}, require('./{name}')],\n")

(HERE / 'spinner' / 'index.ts').write_text(
    'const LOGO_SPINNERS: [string, number, number][] = [\n' +
    ''.join(entries) +
    '];\n\nexport { LOGO_SPINNERS };\n'
)
