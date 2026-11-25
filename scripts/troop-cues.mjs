// Original effects for two attacks with arena-shaped areas. They use PixelFX's
// native painter at bake time. No geometry is tessellated during a battle.
export function bellWave({band,hex}) {
  const radius=44, amber=["#77443d","#aa6343","#dc9952","#ffd779"];
  const bronze=hex("#92583d"),yellow=hex("#ffdf8b");
  const meta={size:[96,96],origin:[48,48],duration:1};
  return {meta, radius, draw(p,t) {
    for (const [delay,weight] of [[0,1],[.15,.82],[.31,.55]]) {
      const u=(t-delay)/(1-delay);
      if (u<0 || u>=1) continue;
      const r=3+(radius-3)*(1-(1-u)**2.3);
      const strength=weight*Math.min(1,(1-u)*3.4);
      // A dark leading edge carries the wave across the white floor. The echo
      // breaks into shorter arcs as its energy dies away.
      const gaps=a=>Math.cos(5*a+delay*8)>-1.2+u*.56;
      band(p,0,0,r,1,3.7-1.25*u,strength,amber,gaps);
      for (let j=0;j<Math.ceil(r*7);j++) {
        const a=j*2*Math.PI/Math.ceil(r*7);
        if (!gaps(a)) continue;
        const x=Math.cos(a),y=Math.sin(a);
        p.blend(x*r,y*r,bronze,strength*.89);
        p.blend(x*(r-1),y*(r-1),yellow,strength*.87);
      }
      if (delay===0) {
        for (let i=0;i<8;i++) {
          const a=Math.PI*(i+.5)/4, x=Math.cos(a),y=Math.sin(a);
          p.line(x*(r-2),y*(r-2),x*(r+1),y*(r+1),bronze,strength);
          p.dot(x*r,y*r,yellow,strength);
        }
      }
    }
  }};
}

export function stoneGaze({hex}) {
  const span=72, halfSpread=28;
  const [jade,pale,shade,rim,olive,sage,ivory,gold]=
    ["#456d64","#c1d18f","#488678","#315a54","#c6d389","#85af7c","#efe8a5","#e8ad51"].map(c=>hex(c));
  const meta={size:[84,64],origin:[5,32],duration:1};
  return {meta,span,halfSpread,draw(p,t) {
    // A thin jade wash behind the moving ridges separates the struck ground
    // from the white arena without hiding petrified troops inside the cone.
    const fade=Math.min(1,(1-t)*4);
    const front=span*Math.min(1,.15+t*3.4);
    for (let x=2;x<front;x++) {
      const y=Math.round(halfSpread*x/span);
      for (let i=-y;i<=y;i++) {
        const facet=Math.abs(i)/(y||1);
        p.blend(x,i,facet>.63 ? sage : pale,fade*(facet>.63 ? .26 : .17));
      }
      for (const side of [-1,1]) {
        if ((x+Math.floor(t*16))%15<12) p.blend(x,y*side,jade,fade*.83);
        p.blend(x,(y-1)*side,pale,fade*.84);
      }
    }
    for (const delay of [0,.29]) {
      const u=(t-delay)/(1-delay);
      if (u<0 || u>=1) continue;
      const r=span*(.10+.90*(1-(1-u)**1.65)), w=r/span*halfSpread;
      for (let y=-Math.floor(w);y<=w;y++) {
        const edge=Math.abs(y)/w, x=Math.round(r-5*edge*edge);
        for (let trail=2;trail<=5;trail++) p.blend(x-trail,y,shade,fade*(6-trail)*.14);
        p.blend(x-1,y,rim,fade*.95);
        p.blend(x,y,edge>.75 ? olive : sage,fade);
        p.blend(x+1,y,ivory,fade*.9);
        if ((Math.abs(y)+Math.floor(r))%11<3) p.dot(x-4,y,olive,fade);

      }
    }
    if (t<.72) {
      const k=Math.min(1,(.72-t)*4);
      p.line(-2,0,0,-2,rim,k); p.line(0,-2,4,0,rim,k);
      p.line(-2,0,1,2,jade,k); p.line(1,2,4,0,jade,k);
      p.line(0,0,3,0,gold,k); p.dot(1,0,rim,k);
    }
  }};
}
