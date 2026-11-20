import { PlacementStroke, pointerToArena, type ArenaPoint, type PlacementCommand } from "./deployment.ts";
import type { SpellKind } from "./spells.ts";
import { UNIT_DEFINITIONS, type UnitKind } from "./units.ts";

interface BrushCallbacks {
  canDraw(): boolean;
  selectedKind?(): UnitKind;
  preview?(points: readonly ArenaPoint[], kind: UnitKind): void;
  commit?(command: PlacementCommand): void;
  livePlace?(points: readonly ArenaPoint[], kind: UnitKind, first: boolean): void;
  useLive?(): boolean;
}

export function attachSpellBrush(canvas: HTMLCanvasElement, selected: () => SpellKind | undefined, cast: (spell: SpellKind, point: ArenaPoint) => void) {
  canvas.addEventListener("pointerdown", event => {
    const spell = selected();
    if (!spell || !event.isPrimary || event.button !== 0) return;
    cast(spell, pointerToArena(event.clientX, event.clientY, canvas.getBoundingClientRect()));
  });
}

export function attachDeploymentBrush(canvas: HTMLCanvasElement, callbacks: BrushCallbacks) {
  let active: { pointerId: number; stroke: PlacementStroke; kind: UnitKind; delivered: number; live: boolean } | null = null;

  function deliver() {
    if (!active) return;
    const { stroke, kind, delivered } = active;
    if (!active.live || !callbacks.livePlace) { callbacks.preview?.(stroke.positions, kind); return; }
    if (stroke.positions.length > delivered) {
      callbacks.livePlace(stroke.positions.slice(delivered), kind, delivered === 0);
      active.delivered = stroke.positions.length;
    }
  }

  function cancel() {
    if (!active) return;
    const { pointerId, kind } = active;
    active = null;
    if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    callbacks.preview?.([], kind);
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (!callbacks.canDraw() || active || !event.isPrimary || event.button !== 0) return;
    const start = pointerToArena(event.clientX, event.clientY, canvas.getBoundingClientRect());
    canvas.setPointerCapture(event.pointerId);
    active = { pointerId: event.pointerId, stroke: new PlacementStroke(start), kind: callbacks.selectedKind?.() ?? "warrior", delivered: 0, live: !!callbacks.livePlace && (callbacks.useLive?.() ?? true) };
    deliver();
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
      const live = active.live;
      if (live) deliver();
      cancel();
      if (!live) callbacks.commit?.({ type: UNIT_DEFINITIONS[kind].command, positions: stroke.positions });
    } else {
      deliver();
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
