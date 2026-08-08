from PIL import Image

SIZE = 1024
LOGO = 'assets/turquz-brand.png'
EMBLEM_RATIO = 0.72
SCALE_LIGHT = 0.94
SCALE_ADAPTIVE = 0.90
BG_DARK = (22, 32, 46, 255)  # #16202e


def trim_content(img, threshold=30):
    px = img.convert('RGBA')
    w, h = px.size
    minx, miny, maxx, maxy = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            r, g, b, a = px.getpixel((x, y))
            if a < 10:
                continue
            if r < threshold and g < threshold and b < threshold:
                continue
            found = True
            minx = min(minx, x)
            miny = min(miny, y)
            maxx = max(maxx, x)
            maxy = max(maxy, y)
    if not found:
        return img
    return img.crop((minx, miny, maxx + 1, maxy + 1))


def load_emblem():
    logo = Image.open(LOGO).convert('RGBA')
    w, h = logo.size
    emblem = logo.crop((0, 0, w, int(h * EMBLEM_RATIO)))
    return trim_content(emblem)


def compose(canvas, img, scale):
    iw, ih = img.size
    max_side = int(SIZE * scale)
    ratio = min(max_side / iw, max_side / ih)
    nw, nh = int(iw * ratio), int(ih * ratio)
    img = img.resize((nw, nh), Image.Resampling.LANCZOS)
    x, y = (SIZE - nw) // 2, (SIZE - nh) // 2
    canvas.paste(img, (x, y), img)


def save(path, bg, emblem_only, scale):
    src = load_emblem() if emblem_only else trim_content(Image.open(LOGO).convert('RGBA'))
    canvas = Image.new('RGBA', (SIZE, SIZE), bg)
    compose(canvas, src, scale)
    canvas.save(path, 'PNG')
    print('wrote', path)


save('assets/icon.png', (255, 255, 255, 255), True, SCALE_LIGHT)
save('assets/icon-dark.png', BG_DARK, True, SCALE_LIGHT)
save('assets/adaptive-icon.png', (0, 0, 0, 0), True, SCALE_ADAPTIVE)
save('assets/splash-icon.png', (255, 255, 255, 255), False, 0.90)
full = Image.open('assets/icon.png').convert('RGBA')
full.resize((192, 192), Image.Resampling.LANCZOS).save('assets/favicon.png', 'PNG')
