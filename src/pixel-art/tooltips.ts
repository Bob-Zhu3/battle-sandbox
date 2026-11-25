// The accessible description is also the text players see when hovering or tabbing.
export function attachTooltips() {
  const tip=document.createElement("div");
  tip.className="pixel-tip"; tip.hidden=true; tip.setAttribute("aria-hidden","true");
  document.body.append(tip);
  let anchor: HTMLElement | null=null, timer=0;

  function hide() {
    clearTimeout(timer);
    changes.disconnect();
    anchor=null; tip.hidden=true;
  }
  function paint() {
    if (!anchor?.isConnected || !anchor.getClientRects().length) { hide(); return; }
    tip.textContent=anchor.getAttribute("aria-description");
    tip.hidden=false;
    const box=anchor.getBoundingClientRect(), width=tip.offsetWidth, height=tip.offsetHeight;
    tip.style.left=Math.round(Math.max(6,Math.min(innerWidth-width-6,box.left+(box.width-width)/2)))+"px";
    tip.style.top=Math.round(box.top>height+12 ? box.top-height-7 : box.bottom+7)+"px";
  }
  const changes=new MutationObserver(paint);
  function show(el: HTMLElement,wait: number) {
    if (anchor===el) return;
    hide(); anchor=el;
    timer=window.setTimeout(()=>{
      paint();
      if (anchor) changes.observe(anchor,{attributes:true,attributeFilter:["aria-description","hidden"]});
    },wait);
  }
  const control=(node: EventTarget|null)=>node instanceof Element ? node.closest<HTMLElement>("[aria-description]") : null;
  document.addEventListener("pointerover",event=>{
    if (event.pointerType==="touch") return;
    const el=control(event.target); if (el) show(el,390);
  });
  document.addEventListener("pointerout",event=>{if (anchor!==control(event.relatedTarget)) hide();});
  document.addEventListener("focusin",event=>{
    const el=control(event.target); if (el?.matches(":focus-visible")) show(el,0);
  });
  document.addEventListener("focusout",hide);
  document.addEventListener("pointerdown",hide);
  document.addEventListener("keydown",event=>{ if (event.key==="Escape") hide(); });
  document.addEventListener("scroll",hide,true);
  window.addEventListener("resize",hide);
}
