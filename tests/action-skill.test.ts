import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SkillRuntime,
  skillContains,
  type SkillDefinition,
} from "@dewlight/action-skill";

const SKILLS: Record<"thrust" | "spin" | "jab", SkillDefinition> = {
  thrust: {
    id: "thrust",
    cost: 20,
    cooldown: 3,
    duration: 0.4,
    release: 0.1,
    recovery: 0.26,
    cancelInto: ["dash"],
    hitCancel: { after: 0.15, into: ["*", "jump"] },
    hits: [{ at: 0.1, end: 0.24, reach: 110, height: 80 }],
    movement: { start: 0.1, end: 0.26, distance: 160 },
  },
  spin: {
    id: "spin",
    cost: 30,
    cooldown: 6,
    duration: 0.7,
    release: 0.14,
    recovery: 0.5,
    airOnly: true,
    bothSides: true,
    hits: [0.14, 0.3, 0.46].map((at) => ({
      at,
      end: at,
      reach: 120,
      height: 100,
    })),
    gravity: { end: 0.48, scale: 0.2 },
  },
  jab: {
    id: "jab",
    cost: 0,
    cooldown: 0,
    duration: 0.3,
    release: 0.06,
    recovery: 0.2,
    hits: [{ at: 0.08, end: 0.08, reach: 90, height: 80 }],
  },
};
const air = { energy: 100, grounded: false, facing: 1 };
const ground = { ...air, grounded: true };

test("a cast is paid once, refused when it cannot start, and frozen at zero time", () => {
  const s = new SkillRuntime(SKILLS);
  assert.equal(s.request("spin", ground), false);
  assert.equal(s.reason("spin", ground), "air-only");
  assert.equal(s.reason("thrust", { ...ground, energy: 5 }), "energy");
  assert.equal(s.request("thrust", ground), true);
  const before = s.snapshot();
  assert.equal(s.tick(0, ground).cost, 0);
  assert.deepEqual(s.snapshot(), before);
  assert.equal(s.tick(0.05, ground).cost, 20);
  assert.equal(s.tick(0.05, ground).cost, 0);
  assert.equal(s.reason("thrust", ground), "cooldown");
});

test("hits, travel and gravity are the same at 10, 30 and 120 steps per second", () => {
  for (const id of ["thrust", "spin"] as const) {
    const results = [10, 30, 120].map((fps) => {
      const s = new SkillRuntime(SKILLS);
      s.request(id, air);
      let dx = 0,
        gravity = 0;
      const sections = new Set<number>();
      for (let n = 0; n < fps; n++) {
        const step = s.tick(1 / fps, air);
        dx += step.dx;
        gravity += (1 - step.gravity) / fps;
        for (const hit of step.hits) sections.add(hit.section);
      }
      return {
        dx: Math.round(dx * 1e6),
        gravity: Math.round(gravity * 1e6),
        sections: [...sections].sort(),
      };
    });
    assert.deepEqual(results[1], results[0]);
    assert.deepEqual(results[2], results[0]);
    assert.equal(results[0].sections.length, SKILLS[id].hits.length);
  }
});

test("presses wait in the buffer and through a hold; a stun drops them", () => {
  const s = new SkillRuntime(SKILLS);
  s.request("jab", ground);
  s.tick(0.1, ground);
  s.request("thrust", ground);
  s.tick(0.06, ground);
  assert.equal(s.active?.skill, "jab");
  s.tick(0.06, ground);
  assert.equal(s.active?.skill, "thrust");
  s.reset();
  s.request("jab", ground);
  s.tick(0.1, { ...ground, hold: true });
  assert.equal(s.active, null);
  assert.equal(s.pending, "jab");
  s.tick(0.02, { ...ground, blocked: true });
  assert.equal(s.pending, null);
});

test("only a confirmed hit opens the early cancel", () => {
  const whiff = new SkillRuntime(SKILLS);
  whiff.request("thrust", ground);
  whiff.tick(0.18, ground);
  assert.equal(whiff.allows("jump"), false);
  assert.equal(whiff.canStart("jab"), false);
  const hit = new SkillRuntime(SKILLS);
  hit.request("thrust", ground);
  const step = hit.tick(0.18, ground);
  assert.equal(hit.claim(step.hits[0], "target"), true);
  assert.equal(hit.claim(step.hits[0], "target"), false);
  hit.confirm(step.hits[0].instance);
  assert.equal(hit.allows("jump"), true);
  hit.request("jab", ground);
  const next = hit.tick(0.02, ground);
  assert.equal(hit.active?.skill, "jab");
  assert.equal(next.events[0].type, "cancel");
});

test("hit bands face one way unless told otherwise, and bad data is refused", () => {
  const forward = {
    instance: 1,
    skill: "thrust",
    section: 0,
    facing: 1,
    reach: 110,
    height: 80,
  };
  const root = { x: 100, y: 200 };
  assert.equal(skillContains(forward, root, { id: "a", x: 180, y: 200 }), true);
  assert.equal(skillContains(forward, root, { id: "b", x: 20, y: 200 }), false);
  assert.equal(
    skillContains({ ...forward, bothSides: true }, root, {
      id: "b",
      x: 20,
      y: 200,
    }),
    true,
  );
  assert.throws(
    () =>
      new SkillRuntime({
        bad: {
          ...SKILLS.thrust,
          id: "bad",
          movement: { start: 0.2, end: 0.2, distance: 10 },
        },
      }),
    RangeError,
  );
});
