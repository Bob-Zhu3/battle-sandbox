"""Rebuild the game's original five-column display lettering with fontTools."""
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

# Seven five-bit rows, top to bottom. Small UI labels use the regular text face.
patterns = {
    "A": "0e 1b 11 11 1f 11 11", "B": "1e 11 11 1e 11 11 1e",
    "C": "0f 18 10 10 10 18 0f", "D": "1c 16 13 11 13 16 1c",
    "E": "1f 10 10 1e 10 10 1f", "F": "1f 10 10 1e 10 10 10",
    "G": "0f 18 10 17 11 19 0f", "H": "11 11 11 1f 11 11 11",
    "I": "0e 04 04 04 04 04 0e", "J": "07 02 02 02 02 12 0c",
    "K": "13 16 1c 18 1c 16 13", "L": "10 10 10 10 10 10 1f",
    "M": "11 1b 1f 15 11 11 11", "N": "11 19 1d 17 13 11 11",
    "O": "0e 1b 11 11 11 1b 0e", "P": "1e 13 11 13 1e 10 10",
    "Q": "0e 1b 11 11 15 1a 0d", "R": "1e 13 11 1e 1c 16 13",
    "S": "0f 18 10 0e 01 03 1e", "T": "1f 04 04 04 04 04 04",
    "U": "11 11 11 11 11 1b 0e", "V": "11 11 11 11 1b 0e 04",
    "W": "11 11 11 15 15 1f 0a", "X": "11 1b 0e 04 0e 1b 11",
    "Y": "11 11 1b 0e 04 04 04", "Z": "1f 03 06 0c 18 10 1f",
    "0": "0e 1b 13 15 19 1b 0e", "1": "04 0c 04 04 04 04 0e",
    "2": "1e 03 01 06 0c 18 1f", "3": "1e 03 01 0e 01 03 1e",
    "4": "02 06 0e 1a 1f 02 02", "5": "1f 10 10 1e 01 03 1e",
    "6": "0e 18 10 1e 11 1b 0e", "7": "1f 03 06 04 0c 08 08",
    "8": "0e 1b 11 0e 11 1b 0e", "9": "0e 1b 11 0f 01 03 0e",
}
glyphs = {".notdef": TTGlyphPen(None).glyph(), "space": TTGlyphPen(None).glyph()}
for char, rows in patterns.items():
    pen = TTGlyphPen(None)
    for i, row in enumerate(rows.split()):
        bits = f"{int(row, 16):05b}" + "0"
        start = None
        for j, bit in enumerate(bits):
            if bit == "1" and start is None:
                start = j
            elif bit == "0" and start is not None:
                x, end, y = start * 100, j * 100, (6 - i) * 100
                pen.moveTo((x, y)); pen.lineTo((x, y + 100))
                pen.lineTo((end, y + 100)); pen.lineTo((end, y)); pen.closePath()
                start = None
    glyphs[char] = pen.glyph()

font = FontBuilder(1000, isTTF=True)
font.setupGlyphOrder(list(glyphs))
font.setupCharacterMap({32: "space", **{ord(ch): ch for ch in patterns}})
font.setupGlyf(glyphs)
font.setupHorizontalMetrics({ch: (350 if ch == "space" else 600, 0) for ch in glyphs})
font.setupHorizontalHeader(ascent=800, descent=-200)
font.setupNameTable({"familyName": "Battle Bitmap", "styleName": "Regular",
                     "psName": "BattleBitmap-Regular", "fullName": "Battle Bitmap"})
font.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200)
font.setupPost()
font.font.recalcTimestamp = False
font.font["head"].created = font.font["head"].modified = 3800000000
font.save(Path(__file__).resolve().parents[1] / "src" / "pixel-art" / "battle-bitmap.ttf")
