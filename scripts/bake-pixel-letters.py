"""Rebuild the game's original five-column display lettering with fontTools."""
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib.tables.ttProgram import Program

# Seven five-bit rows, top to bottom. Descenders can use the two rows below the baseline.
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
patterns.update({
    "a": "00 00 0e 01 0f 11 0f", "b": "10 10 1e 11 11 11 1e",
    "c": "00 00 0f 10 10 10 0f", "d": "01 01 0f 11 11 11 0f",
    "e": "00 00 0e 11 1f 10 0f", "f": "03 04 0f 04 04 04 04",
    "g": "00 00 0f 11 11 11 0f 01 0e", "h": "10 10 1e 11 11 11 11",
    "i": "04 00 04 04 04 04 04", "j": "02 00 02 02 02 02 02 12 0c",
    "k": "10 10 12 14 18 14 12", "l": "06 02 02 02 02 02 03",
    "m": "00 00 1a 15 15 15 15", "n": "00 00 1e 11 11 11 11",
    "o": "00 00 0e 11 11 11 0e", "p": "00 00 1e 11 11 11 1e 10 10",
    "q": "00 00 0f 11 11 11 0f 01 01", "r": "00 00 0b 0c 08 08 08",
    "s": "00 00 0f 10 0e 01 1e", "t": "04 04 0e 04 04 04 03",
    "u": "00 00 11 11 11 11 0f", "v": "00 00 11 11 11 0a 04",
    "w": "00 00 11 11 15 15 0a", "x": "00 00 11 0a 04 0a 11",
    "y": "00 00 11 11 11 11 0f 01 0e", "z": "00 00 1f 02 04 08 1f",
    ".": "00 00 00 00 00 00 04", ",": "00 00 00 00 00 00 04 08",
    "'": "04 04 00 00 00 00 00", '"': "0a 0a 00 00 00 00 00",
    ":": "00 00 04 00 00 04 00", ";": "00 00 04 00 00 04 08",
    "!": "04 04 04 04 04 00 04", "?": "0e 11 01 02 04 00 04",
    "-": "00 00 00 0e 00 00 00", "+": "00 04 04 1f 04 04 00",
    "×": "00 11 0a 04 0a 11 00", "/": "01 02 02 04 08 08 10",
    "\\": "10 08 08 04 02 02 01", "#": "0a 1f 0a 0a 1f 0a 00",
    "(": "02 04 08 08 08 04 02", ")": "08 04 02 02 02 04 08",
    "[": "0c 08 08 08 08 08 0c", "]": "06 02 02 02 02 02 06",
    "·": "00 00 00 04 00 00 00", "…": "00 00 00 00 00 00 15",
    "=": "00 00 1f 00 1f 00 00", "∞": "00 00 0a 15 15 0a 00",
    "%": "19 19 02 04 08 13 13", "&": "0c 12 14 08 15 12 0d",
    "$": "04 0f 14 0e 05 1e 04", "@": "0e 11 17 15 17 10 0f",
    "_": "00 00 00 00 00 00 1f", "↶": "00 04 0e 17 02 02 0c",
    "▾": "00 00 1f 0e 04 00 00", "›": "00 08 04 02 04 08 00",
    "‹": "00 02 04 08 04 02 00", "•": "00 00 04 0e 04 00 00",
    "←": "00 04 08 1f 08 04 00", "→": "00 04 02 1f 02 04 00",
})
for symbol, same in {"’": "'", "‘": "'", "–": "-", "—": "-", "−": "-"}.items():
    patterns[symbol] = patterns[same]
metrics = {".notdef": (600, 0), "space": (300, 0)}
glyphs = {".notdef": TTGlyphPen(None).glyph(), "space": TTGlyphPen(None).glyph()}
for char, rows in patterns.items():
    pen = TTGlyphPen(None)
    filled = [col for col in range(5) if any(int(row, 16) & (16 >> col) for row in rows.split())]
    left = min(filled) if not char.isupper() and not char.isdigit() else 0
    advance = 6 if char.isupper() or char.isdigit() else max(filled) - left + 2
    metrics[char] = (advance * 100, 0)
    for i, row in enumerate(rows.split()):
        bits = f"{int(row, 16):05b}" + "0"
        start = None
        for j, bit in enumerate(bits):
            if bit == "1" and start is None:
                start = j
            elif bit == "0" and start is not None:
                x, end, y = (start - left) * 100, (j - left) * 100, (6 - i) * 100
                pen.moveTo((x, y)); pen.lineTo((x, y + 100))
                pen.lineTo((end, y + 100)); pen.lineTo((end, y)); pen.closePath()
                start = None
    glyph = pen.glyph()
    # Snap both ends of every ink run to the pixel grid at small interface sizes.
    instructions = []
    for axis in (0, 1):
        instructions.append(f"SVTCA[{axis}]")
        for point in range(len(glyph.coordinates)):
            instructions.extend(["PUSH[]", str(point), "MDAP[1]"])
    glyph.program = Program()
    glyph.program.fromAssembly(instructions)
    glyphs[char] = glyph

font = FontBuilder(1000, isTTF=True)
font.setupGlyphOrder(list(glyphs))
font.setupCharacterMap({32: "space", **{ord(ch): ch for ch in patterns}})
font.setupGlyf(glyphs)
font.setupHorizontalMetrics(metrics)
font.setupHorizontalHeader(ascent=800, descent=-200)
font.setupNameTable({"familyName": "Battle Bitmap", "styleName": "Regular",
                     "psName": "BattleBitmap-Regular", "fullName": "Battle Bitmap"})
font.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200)
font.setupPost(keepGlyphNames=False)
font.font["maxp"].maxStackElements = 1
font.font["maxp"].maxSizeOfInstructions = max(len(g.program.getBytecode()) for g in glyphs.values() if hasattr(g, "program"))
font.font.recalcTimestamp = False
font.font["head"].created = font.font["head"].modified = 3800000000
font.save(Path(__file__).resolve().parents[1] / "src" / "pixel-art" / "battle-bitmap.ttf")
