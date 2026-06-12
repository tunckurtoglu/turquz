#!/usr/bin/env python3
# compress_flags.py
# SENİN bayrak PNG'lerini küçültür. Görseli ve çözünürlüğü KORUR.
# Hiçbir çizim/değiştirme yok — sadece dosya boyutunu düşürür.
#
# Kullanım:
#   python3 compress_flags.py assets/flags
#
# Üç yöntemi sırayla dener (en kalitelisi önce):
#   1) pngquant (varsa)        -> görsel neredeyse birebir, ~%60-70 küçülme
#   2) oxipng/optipng (varsa)  -> KAYIPSIZ (görsel %100 aynı), ~%10-30 küçülme
#   3) Pillow optimize          -> KAYIPSIZ yeniden paketleme, ~%5-15 küçülme
#
# En iyi sonuç için pngquant kurman önerilir (opsiyonel):
#   macOS:  brew install pngquant
#   Ubuntu: sudo apt install pngquant
#
# NOT: Çalıştırmadan önce yedek al (script dosyaların üzerine yazar):
#   cp -r assets/flags assets/flags_yedek

import os, sys, shutil, subprocess

folder = sys.argv[1] if len(sys.argv) > 1 else 'assets/flags'

def human(n): return f"{n/1024:.1f}KB"

def try_pngquant(path):
    subprocess.run(
        ['pngquant', '--force', '--skip-if-larger', '--quality', '70-95',
         '--speed', '1', '--output', path, path],
        check=True
    )
    return 'pngquant'

def try_oxipng(path):
    subprocess.run(['oxipng', '-o', '4', '--strip', 'safe', path], check=True)
    return 'oxipng (kayipsiz)'

def try_optipng(path):
    subprocess.run(['optipng', '-o5', '-quiet', path], check=True)
    return 'optipng (kayipsiz)'

def try_pillow(path):
    from PIL import Image
    im = Image.open(path)
    im.save(path, optimize=True, compress_level=9)
    return 'Pillow (kayipsiz)'

methods = []
if shutil.which('pngquant'): methods.append(try_pngquant)
if shutil.which('oxipng'):   methods.append(try_oxipng)
elif shutil.which('optipng'): methods.append(try_optipng)
methods.append(try_pillow)

files = sorted(f for f in os.listdir(folder) if f.lower().endswith('.png'))
if not files:
    print(f"'{folder}' icinde PNG yok."); sys.exit(1)

print(f"Klasor: {folder}  |  {len(files)} dosya\n")
tot_b = tot_a = 0
for f in files:
    p = os.path.join(folder, f)
    before = os.path.getsize(p); tot_b += before
    used = None
    for m in methods:
        try:
            used = m(p); break
        except Exception:
            continue
    after = os.path.getsize(p); tot_a += after
    pct = 100*(before-after)//before if before else 0
    print(f"  {f:10} {human(before):>9} -> {human(after):>9}  (-{pct}%)  [{used}]")

print(f"\nTOPLAM: {human(tot_b)} -> {human(tot_a)}  (-{100*(tot_b-tot_a)//tot_b if tot_b else 0}%)")
print("Cozunurluk ve gorsel korundu; sadece dosya boyutu dustu.")
