// Shared ramps tie cloth, metal, bark and magic together at battlefield scale.
const colors = [
  "#242339","#38415a","#516077","#668392","#91acb4","#bad2c8","#e4eee4","#fff5db","#ffffff",
  "#4e384c","#684856","#916155","#aa6654","#bd7746","#d79a63","#e79c73","#ffcf93","#fff2c4",
  "#642e49","#a63549","#e05050","#ff9270","#ff793d","#ffc660",
  "#293e6d","#365f9b","#468bd4","#83c9f2","#c6edf4",
  "#523763","#754b96","#a974c5","#e1b7f1","#754c30","#b98334","#eeb447","#ffe59a",
  "#304d57","#3c7181","#389995","#74d0ce","#426453","#6c9976","#a5c590",
];
const rgb = (hex: string) => [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const entries = colors.map(hex=>({hex, channels:rgb(hex)}));
// The meteor's white-hot core is a distinct highlight against both ice and white ground.
const cache = new Map<string,string>([["#fffce8","#fffce8"]]);
export function pixelColor(color: string) {
  const known=cache.get(color);
  if (known) return known;
  if (!/^#[a-f\d]{6}([a-f\d]{2})?$/i.test(color)) { cache.set(color,color); return color; }
  const [r,g,b]=rgb(color);
  let distance=Infinity, best=color;
  for (const {hex,channels} of entries) {
    const [rr,gg,bb]=channels;
    const delta=(r-rr)**2*.9+(g-gg)**2*1.15+(b-bb)**2;
    if (delta<distance) { best=hex; distance=delta; }
  }
  best+=color.slice(7); cache.set(color,best); return best;
}

// Index blended edges once at the native sprite size. The same colors are reused
// across rigs and frames. Neither the arena nor the effects sheet is read back.
const indexed = new Uint32Array(32768);
export function indexPixels(image: ImageData) {
  const data=image.data;
  for (let i=0;i<data.length;i+=4) {
    const opacity=data[i+3];
    if (opacity<56) { data[i+3]=0; continue; }
    const r=data[i],g=data[i+1],b=data[i+2];
    const key=(r>>3)<<10 | (g>>3)<<5 | (b>>3);
    let packed=indexed[key];
    if (!packed) {
      const rr=(r&248)+4, gg=(g&248)+4, bb=(b&248)+4;
      let distance=Infinity;
      for (const {channels:[cr,cg,cb]} of entries) {
        const delta=(rr-cr)**2*.9+(gg-cg)**2*1.15+(bb-cb)**2;
        if (delta<distance) { distance=delta; packed=cr<<16 | cg<<8 | cb; }
      }
      indexed[key]=packed;
    }
    data[i]=packed>>16; data[i+1]=packed>>8&255; data[i+2]=packed&255;
    data[i+3]=opacity<132?128:255;
  }
}
