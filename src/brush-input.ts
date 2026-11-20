import { PlacementStroke, pointerToArena, type ArenaPoint, type PlacementCommand } from "./deployment.ts";
import type { UnitKind } from "./units.ts";

interface BrushCallbacks {
  canDraw(): boolean;
  selectedKind?(): UnitKind;
  preview(points: readonly ArenaPoint[], kind: UnitKind): void;
  commit(command: PlacementCommand): void;
}

export function attachDeploymentBrush(canvas: HTMLCanvasElement, callbacks: BrushCallbacks) {
  let active: { pointerId: number; stroke: PlacementStroke; kind: UnitKind } | null = null;

  function cancel() {
    if (!active) return;
    const { pointerId, kind } = active;
    active = null;
    if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    callbacks.preview([], kind);
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (!callbacks.canDraw() || active || !event.isPrimary || event.button !== 0) return;
    const start = pointerToArena(event.clientX, event.clientY, canvas.getBoundingClientRect());
    canvas.setPointerCapture(event.pointerId);
    active = { pointerId: event.pointerId, stroke: new PlacementStroke(start), kind: callbacks.selectedKind?.() ?? "warrior" };
    callbacks.preview(active.stroke.positions, active.kind);
  });

  function follow(event: PointerEvent) {
    if (!active || event.pointerId !== active.pointerId) return;
    const { stroke, kind } = active;
    const rect = canvas.getBoundingClientRect();
    for (const sample of event.getCoalescedEvents?.() ?? []) {
      stroke.extend(pointerToArena(sample.clientX, sample.clientY, rect));
    }
    stroke.extend(pointerToArena(event.clientX, event.clientY, rect));

    if (event.type === "pointerup") {
      cancel();
      callbacks.commit({ type: kind === "archer" ? "place-archers" : "place-warriors", positions: stroke.positions });
    } else {
      callbacks.preview(stroke.positions, kind);
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
