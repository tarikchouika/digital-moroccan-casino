#!/usr/bin/env python3
"""إعادة توليد أوراق اللعب الـ52 + الجوكر بأصول احترافية موحّدة:
- أرقام/حروف واضحة سميكة (DejaVu Sans Bold) بلون أحمر أو أسود حسب الرمز
- موضع موحّد للأرقام (أعلى يسار + أسفل يمين معكوس)
- عدد الرموز (pips) صحيح لكل رتبة بترتيب البطاقة القياسي
- شعار المنصة (card-emblem) بالمنتصف بحجم متناسق صغير
"""
from PIL import Image, ImageDraw, ImageFont
import os

BASE = '/root/casino-work/dmc-branch'
CARDS_DIR = os.path.join(BASE, 'assets/cards')
os.makedirs(CARDS_DIR, exist_ok=True)

W, H = 864, 1216  # نفس أبعاد الأصول القديمة
FONT_PATH = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

# الشعار المستخرج من favicon (دائرة شفافة)
EMBLEM = Image.open(os.path.join(BASE, 'assets/logo/card-emblem.png')).convert('RGBA')

RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
SUITS = {
    'hearts':   {'glyph': '♥', 'color': (220, 30, 40), 'red': True},
    'diamonds': {'glyph': '♦', 'color': (220, 30, 40), 'red': True},
    'spades':   {'glyph': '♠', 'color': (20, 22, 28),  'red': False},
    'clubs':    {'glyph': '♣', 'color': (20, 22, 28),  'red': False},
}

# مواضع الرموز القياسية لكل رتبة (نسب من مساحة الرموز المركزية)
PIP_LAYOUTS = {
    'A':  [(0.5, 0.5)],
    '2':  [(0.5, 0.18), (0.5, 0.82)],
    '3':  [(0.5, 0.18), (0.5, 0.5), (0.5, 0.82)],
    '4':  [(0.3, 0.18), (0.7, 0.18), (0.3, 0.82), (0.7, 0.82)],
    '5':  [(0.3, 0.18), (0.7, 0.18), (0.5, 0.5), (0.3, 0.82), (0.7, 0.82)],
    '6':  [(0.3, 0.18), (0.7, 0.18), (0.3, 0.5), (0.7, 0.5), (0.3, 0.82), (0.7, 0.82)],
    '7':  [(0.3, 0.18), (0.7, 0.18), (0.5, 0.34), (0.3, 0.5), (0.7, 0.5), (0.3, 0.82), (0.7, 0.82)],
    '8':  [(0.3, 0.14), (0.7, 0.14), (0.5, 0.27), (0.3, 0.42), (0.7, 0.42), (0.5, 0.58), (0.3, 0.73), (0.7, 0.73)],
    '9':  [(0.3, 0.14), (0.7, 0.14), (0.3, 0.33), (0.7, 0.33), (0.5, 0.5), (0.3, 0.67), (0.7, 0.67), (0.3, 0.86), (0.7, 0.86)],
    '10': [(0.3, 0.12), (0.7, 0.12), (0.5, 0.26), (0.3, 0.38), (0.7, 0.38), (0.5, 0.5), (0.3, 0.62), (0.7, 0.62), (0.3, 0.88), (0.7, 0.88)],
    'J':  [(0.5, 0.5)],   # رمز واحد كبير للوجه
    'Q':  [(0.5, 0.5)],
    'K':  [(0.5, 0.5)],
}

def rounded_rect(draw, box, radius, fill, outline, width):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

def make_card(rank, suit_key):
    suit = SUITS[suit_key]
    color = suit['color']
    glyph = suit['glyph']
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # خلفية بيضاء بحواف دائرية + إطار أنيق
    margin = 10
    rounded_rect(d, (margin, margin, W - margin, H - margin), 36,
                 fill=(252, 250, 244, 255), outline=(200, 190, 170, 255), width=4)
    # إطار داخلي رفيع ذهبي خفيف
    inner = margin + 14
    rounded_rect(d, (inner, inner, W - inner, H - inner), 26,
                 fill=None, outline=(210, 180, 110, 90), width=2)

    # ── خطوط البطاقة ──
    f_rank = ImageFont.truetype(FONT_PATH, 150)   # رقم الركن كبير سميك
    f_suit = ImageFont.truetype(FONT_PATH, 95)    # رمز الركن
    f_center = ImageFont.truetype(FONT_PATH, 460) # رمز الآس/الوجه الكبير

    def corner(x, y, flip=False):
        """رسم الركن: الرقم فوق الرمز — أو معكوس أسفل اليمين"""
        bbox = d.textbbox((0, 0), rank, font=f_rank)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        bbox_s = d.textbbox((0, 0), glyph, font=f_suit)
        sw, sh = bbox_s[2] - bbox_s[0], bbox_s[3] - bbox_s[1]
        if flip:
            # أسفل اليمين معكوس 180°: نرسم ثم ندير
            sub = Image.new('RGBA', (tw + 8, th + sh + 26), (0, 0, 0, 0))
            sd = ImageDraw.Draw(sub)
            sd.text((sub.width // 2, 0), rank, font=f_rank, fill=color, anchor='ma')
            sd.text((sub.width // 2, th + 18), glyph, font=f_suit, fill=color, anchor='ma')
            sub = sub.rotate(180)
            img.paste(sub, (x - sub.width, y - sub.height), sub)
        else:
            d.text((x, y), rank, font=f_rank, fill=color, anchor='la')
            d.text((x + (tw - sw) // 2 + bbox_s[0], y + th + 14), glyph, font=f_suit, fill=color)

    # موضع موحّد للركنين: أعلى اليسار / أسفل اليمين
    pad = 44
    corner(pad, pad, flip=False)
    corner(W - pad, H - pad, flip=True)

    # ── الرموز المركزية (pips) بالعدد الصحيح ──
    is_face = rank in ('J', 'Q', 'K')
    is_ace = rank == 'A'
    if is_ace or is_face:
        # رمز واحد كبير بالمنتصف مع الشعار خلفه بشفافية خفيفة
        emb = EMBLEM.copy()
        emb_size = 340 if is_face else 400
        emb = emb.resize((emb_size, int(emb_size * EMBLEM.height / EMBLEM.width)))
        if is_ace:
            # الشعار أوضح قليلاً في الآس + الرمز الكبير فوقه
            emb.putalpha(110)
            img.paste(emb, (W // 2 - emb.width // 2, H // 2 - emb.height // 2), emb)
            d.text((W // 2, H // 2), glyph, font=f_center, fill=color, anchor='mm',
                   stroke_width=6, stroke_fill=color)
        else:
            # أوراق الوجه: حرف + رمز بتدرج ذهبي فوق الشعار
            emb.putalpha(100)
            img.paste(emb, (W // 2 - emb.width // 2, H // 2 - emb.height // 2), emb)
            f_face = ImageFont.truetype(FONT_PATH, 330)
            d.text((W // 2, H // 2 - 80), rank, font=f_face, fill=(185, 135, 35), anchor='mm',
                   stroke_width=8, stroke_fill=(255, 240, 200))
            d.text((W // 2, H // 2 + 130), glyph, font=ImageFont.truetype(FONT_PATH, 210),
                   fill=color, anchor='mm', stroke_width=5, stroke_fill=color)
    else:
        # الشعار كعلامة مائية خفيفة بالمنتصف (لا يغطي الرموز)
        emb = EMBLEM.copy()
        emb_size = 330
        emb = emb.resize((emb_size, int(emb_size * EMBLEM.height / EMBLEM.width)))
        emb.putalpha(42)
        img.paste(emb, (W // 2 - emb.width // 2, H // 2 - emb.height // 2), emb)
        # منطقة الرموز المركزية (بين الركنين)
        area_x0, area_y0 = pad + 150, pad + 210
        area_x1, area_y1 = W - pad - 150, H - pad - 210
        pip_size = 170 if rank in ('8','9','10') else 200
        f_pip = ImageFont.truetype(FONT_PATH, pip_size)
        for (fx, fy) in PIP_LAYOUTS[rank]:
            cx = area_x0 + fx * (area_x1 - area_x0)
            cy = area_y0 + fy * (area_y1 - area_y0)
            d.text((cx, cy), glyph, font=f_pip, fill=color, anchor='mm',
                   stroke_width=3, stroke_fill=color)

    bg = Image.new('RGBA', (W, H), (252, 250, 244, 255))
    bg.paste(img, (0, 0), img)
    return bg.convert('RGB')

# توليد الـ52 + الجوكر
for suit_key in SUITS:
    for rank in RANKS:
        card = make_card(rank, suit_key)
        card.save(os.path.join(CARDS_DIR, f'{rank}-{suit_key}.webp'), 'WEBP', quality=92)
        print(f'{rank}-{suit_key}.webp')

# الجوكر (يُبقي الأصل الحالي إن وجد — نتحقق فقط من وجوده)
if not os.path.exists(os.path.join(CARDS_DIR, 'joker1.webp')):
    # جوكر بسيط بنفس الهوية: نجمة + شعار
    joker = make_card('J', 'hearts')
    joker.save(os.path.join(CARDS_DIR, 'joker1.webp'), 'WEBP', quality=92)
    print('joker1.webp (generated)')

print('DONE: 52 cards regenerated with unified ranks, correct pips, and platform emblem')
