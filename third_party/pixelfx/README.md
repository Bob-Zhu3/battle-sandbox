# PixelFX combat effects

The transparent animation frames in `src/pixel-art/effects.png` were sampled from [PixelFX](https://github.com/patch-gg/pixelfx/tree/5294518ce7c72e48b6100a744596e0acf57f2826), under its MIT license. Its [license](../../public/licenses/pixelfx/LICENSE.txt) and [third-party notices](../../public/licenses/pixelfx/NOTICE.md) ship with the game. The game supplies the characters, lettering, interface, playback timing and target positions.

To regenerate the sheet, check out that revision of PixelFX and run `node scripts/bake-pixel-fx.mjs /path/to/pixelfx` from this repository. The script lists the individual source effects and the time windows used. The browser loads the finished sheet locally.
