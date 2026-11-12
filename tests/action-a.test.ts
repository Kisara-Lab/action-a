import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DollHitController,
  limbError,
  sampleTrack,
  solveLimb,
  type DollHitProfile,
  type Track,
} from "@dewlight/action-a";

test("a two-bone limb keeps its segment lengths wherever the target is", () => {
  const out = { jointX: 0, jointY: 0, x: 0, y: 0 };
  for (const [tx, ty] of [
    [10, 20],
    [0, 31],
    [80, -40],
    [0.001, 0.001],
    [-25, 5],
  ])
    for (const bend of [-1, 1]) {
      solveLimb(0, 0, tx, ty, 19, 15, bend, out);
      assert.ok(limbError(0, 0, out, 19, 15) < 1e-9);
      assert.ok(Number.isFinite(out.x + out.y + out.jointX + out.jointY));
    }
  // A reachable target is reached.
  solveLimb(0, 0, 10, 20, 19, 15, 1, out);
  assert.ok(Math.hypot(out.x - 10, out.y - 20) < 1e-6);
});

test("tracks hold their ends and pass through their keys", () => {
  const track: Track = {
    bone: "arm",
    channel: "rotation",
    keys: [
      { time: 0, value: 1 },
      { time: 0.5, value: 3, ease: "smooth" },
      { time: 1, value: -2 },
    ],
  };
  assert.equal(sampleTrack(track, -1), 1);
  assert.equal(sampleTrack(track, 0.5), 3);
  assert.equal(sampleTrack(track, 9), -2);
  const mid = sampleTrack(track, 0.25);
  assert.ok(mid > 1 && mid < 3);
});

const PROFILES: Record<"light" | "heavy", DollHitProfile> = {
  light: {
    horizontal: 180,
    upward: 120,
    lock: 0.18,
    bounces: 0,
    spin: 1.5,
    restitution: [0.3, 0.15],
    lie: false,
  },
  heavy: {
    horizontal: 600,
    upward: 400,
    lock: 0.3,
    bounces: 2,
    spin: 13,
    restitution: [0.36, 0.2],
    lie: true,
  },
};
/** Throw a body with the controller and a plain floor at y = 0. */
function tumble(kind: "light" | "heavy", fps: number, stay = false) {
  const doll = new DollHitController(PROFILES);
  assert.equal(
    doll.start({ kind, sourceX: 0, sourceY: 0, direction: 1, instance: "a" }),
    true,
  );
  if (stay) {
    doll.reset();
    doll.start(
      { kind, sourceX: 0, sourceY: 0, direction: 1, instance: "b" },
      true,
    );
  }
  let y = 0,
    vy = -doll.profile.upward,
    vx = doll.profile.horizontal;
  const phases: string[] = [];
  for (let n = 0; n < 4 * fps && doll.state.active; n++) {
    const grounded = y >= 0;
    doll.tick(1 / fps, grounded, vx);
    vx = doll.drag(vx, 1 / fps, grounded);
    vy += 1350 / fps;
    y += vy / fps;
    if (y >= 0 && vy >= 0) {
      y = 0;
      vy = doll.land(vy);
    }
    if (phases.at(-1) !== doll.state.phase) phases.push(doll.state.phase);
    assert.ok(Number.isFinite(doll.state.angle));
    if (stay && doll.state.phase === "down") break;
  }
  return { doll, phases };
}

test("a hit ragdoll runs its phases, gets up by itself, and can stay down", () => {
  for (const fps of [20, 60, 120]) {
    const light = tumble("light", fps);
    assert.equal(light.doll.state.active, false);
    assert.ok(!light.phases.includes("bounce"));
    const heavy = tumble("heavy", fps);
    assert.equal(heavy.doll.state.active, false);
    assert.ok(heavy.phases.includes("bounce"));
    assert.ok(heavy.phases.includes("roll"));
  }
  const corpse = tumble("heavy", 60, true);
  assert.equal(corpse.doll.state.phase, "down");
  assert.equal(corpse.doll.state.active, true);
  assert.throws(
    () =>
      new DollHitController(PROFILES).start({
        kind: "unknown" as "light",
        sourceX: 0,
        sourceY: 0,
        direction: 1,
        instance: "c",
      }),
    RangeError,
  );
});
