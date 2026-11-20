import { PlacementStroke, pointerToArena, type ArenaPoint, type PlacementCommand } from "./deployment.ts";

interface BrushCallbacks {
  canDraw(): boolean;
  preview(points: readonly ArenaPoint[]): void;
  commit(command: PlacementCommand): void;
}

export function attachDeploymentBrush(canvas: HTMLCanvasElement, callbacks: BrushCallbacks) {
  let active: { pointerId: number; stroke: PlacementStroke } | null = null;

  function cancel() {
    if (!active) return;
    const { pointerId } = active;
    active = null;
    if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    callbacks.preview([]);
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (!callbacks.canDraw() || active || !event.isPrimary || event.button !== 0) return;
    const start = pointerToArena(event.clientX, event.clientY, canvas.getBoundingClientRect());
    canvas.setPointerCapture(event.pointerId);
    active = { pointerId: event.pointerId, stroke: new PlacementStroke(start) };
    callbacks.preview(active.stroke.positions);
  });

  function follow(event: PointerEvent) {
    if (!active || event.pointerId !== active.pointerId) return;
    const { stroke } = active;
    const rect = canvas.getBoundingClientRect();
    for (const sample of event.getCoalescedEvents?.() ?? []) {
      stroke.extend(pointerToArena(sample.clientX, sample.clientY, rect));
    }
    stroke.extend(pointerToArena(event.clientX, event.clientY, rect));

    if (event.type === "pointerup") {
      cancel();
      callbacks.commit({ type: "place-warriors", positions: stroke.positions });
    } else {
      callbacks.preview(stroke.positions);
    }
  }
  canvas.addEventListener("pointermove", follow);
  canvas.addEventListener("pointerup", follow);

  function lostPointer(event: PointerEvent) {
    if (event.pointerId === active?.pointerId) cancel();
  }
  canvas.addEventListener("pointercancel", lostPointer);
  canvas.addEventListener("lostpointercapture", lostPointer);
  return cancel;
}
