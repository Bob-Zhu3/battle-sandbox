# PixelFX combat effects

The transparent animation frames in `src/pixel-art/effects.png` were sampled from [PixelFX](https://github.com/patch-gg/pixelfx/tree/5294518ce7c72e48b6100a744596e0acf57f2826), under its MIT license. Its [license](../../public/licenses/pixelfx/LICENSE.txt) and [third-party notices](../../public/licenses/pixelfx/NOTICE.md) ship with the game. The game supplies the characters, lettering, interface, playback timing and target positions.

To regenerate the sheet, check out that revision of PixelFX and run `node scripts/bake-pixel-fx.mjs /path/to/pixelfx` from this repository. The script lists the individual source effects and the time windows used. The browser loads the finished sheet locally.

The spell frames keep the effects' impact anchors. Lightning preserves extra vertical detail for tall screens. Healing Rain uses the source's foreground droplets and splash crowns. The brighter ice, glass, water and rune effects have a single shaded pixel along their lit edges for the white battlefield. Spent casts use a quiet ground frame or an original floor tile until the battle clock fades it.

The Storm Kirin uses the last hop from PixelFX's `lightning/chain-lightning`, baked with two seeds. The renderer fits the middle of each arc between the enemies hit by the simulation. The sparks at each end retain their size.

The Sun Lens and Prism Tower use amber and violet versions of `arcane/arcane-beam`. Their apertures and impact sparks keep their size as targets move. The campfire sequence is cropped above its logs for the Phoenix's trail and burning troops. Poison uses the bubbles from `nature/toxic-puddle`, and the Freeze shell is baked around an empty mask so the game's troop stays visible. The bell wave and Medusa's gaze are original sequences in `scripts/troop-cues.mjs` drawn with the same pixel painter.
