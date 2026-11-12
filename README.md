# ACTION-A

Two small TypeScript libraries for 2D action games, extracted from the game
[Dewlight Gate](https://github.com/Sekai6/dewlight-gate).

- **[`@dewlight/action-a`](packages/action-a)** — layered, procedural skeletal
  animation. Authored clips are blended on locomotion, combat and reaction
  layers, then corrected by solvers: planted feet and balance, a weapon hand on
  rigid arm bones, body impulses, attention, a hit ragdoll and the get-up after
  it. The core has no dependencies and no renderer;
  `@dewlight/action-a/phaser` draws it in Phaser 3 (Canvas).
- **[`@dewlight/action-skill`](packages/action-skill)** — frame-rate independent
  simulation of moves and skills: three phases, hit windows, forced movement,
  launches, gravity scaling, cooldowns, input buffering, hit-confirmed cancels
  and per-target hit de-duplication. Pure logic, no dependencies.

The two packages do not depend on each other. Use either one alone.

## Status

Pre-release.

- **Not on npm yet.** Clone the repository to try it. The package names may
  change before the first publish.
- The API may change without notice.
- `action-a` rigs are bipeds with two arms. Other body plans are not supported.
- The only renderer is Phaser 3 with the Canvas renderer. `ActorView` is the
  seam for writing another.

## Using it

Each package has its own README with a minimal example:

- [packages/action-a/README.md](packages/action-a/README.md)
- [packages/action-skill/README.md](packages/action-skill/README.md)

Neither package ships game content. You supply the rig (bones, sprites, which
bone plays which role), the clips, the action traits and the skill
definitions; the engines never name a bone, an action or a skill themselves.
Dewlight Gate's `src/content` directory is a complete, working set of
definitions for four characters and is the best reference for now.

## Development

Requires Node 22.

```sh
npm install
npm run build # compiles both packages to packages/*/dist
npm test      # runs tests/*.test.ts against the TypeScript source
npm run typecheck
npm run format:check
```

```
packages/
  action-a/ animation engine
    src/stages/    one file per pipeline stage
    src/phaser/    Phaser 3 adapter
  action-skill/    move and skill runtime
tests/      engine-only tests, no game content
```

Inside this repository the packages resolve to their TypeScript source through
the `source` export condition; published builds resolve to `dist`.

## License

[MIT](LICENSE)
