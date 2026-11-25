import { stamp } from "./stamps.ts";

// Twin standards fly over one gate, the same red and blue as the starting armies.
const fortress = [
  "..............KK.............",".............KYYK............",".....KKKKKKKKKyyKKKKKKK......",
  "..KKKhhcccccK.yy.KaaaaaKKK...","KccchhccccddK.yy.KaaaajjjaaKK",".KcccccddddK..yy..KjaaaaaaaK.",
  "..KcccddKKK...yy...KKKjjaaK..",".KccKKKK......yy......KKKaaK.","KKKK..........yy.........KKKK",
  "..............yy.............","......KKK..KKKKKK..KKK.......","......KISK.KISISmK.KISK......",
  "......KISKKKISISmKKKISK......","......KIISSSIIIISSSSSmK......","......KSSSSSSSSSSSmmmmK......",
  ".......KmSSmmSSmmSSmmK.......",".......KSSSSSmmSSSSmmK.......",".......KSSSmKKKKSSSmmK.......",
  ".......KmmSKyyyyKmmmmK.......",".......KSSmKyybyKSSSmK.......",".......KSmSKyybyKSmSmK.......",
  "......KKmmSKyybyKmmmSKK......",".....KSSSmmKyybyKmmSSSmK.....",".....KKKKKKKKKKKKKKKKKKK.....",
];
export function paintCrest(canvas: HTMLCanvasElement) {
  const c=canvas.getContext("2d")!;
  stamp(c,"red",fortress,0,0);
}
