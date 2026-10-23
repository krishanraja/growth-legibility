# North Star

Status: Current
Owner: Krish Raja
Last verified: 2026-10-18

> By 31 December 2026, the Founding 200 targets are met for real: 75 builders with a first trusted read and 30 returning, each earned by a useful product test or a rich named invitation, never a list.
>
> By March 2027, this engine can trace every production agent behind Legibility's North Star to the channel that earned it, and puts the next week's effort where settled mainnet revenue comes from.

Set by Krish on 18 October 2026. It is not reached yet. It is what every session in this repository works toward.

This repository serves [Legibility's North Star](https://github.com/krishanraja/legibility/blob/main/docs/NORTH_STAR.md). The lines above are this repository's part of it.

## The number

**Builders making trusted reads every week**: 300 by 28 December 2026, on a front-loaded weekly ladder. Checkpoints: 16 Nov 2026: 19; 14 Dec 2026: 135; 28 Dec 2026: 300.

```yaml north-star-metric
metric: "Builders making trusted reads every week"
unit: count
direction: up
target: 300
deadline: 2026-12-28
ladder_shape: front-loaded
source: "Supabase legibility: weekly active keys with a trusted read, excluding Krish's own"
status: active
ladder:
  - [2026-10-26, 1]
  - [2026-11-02, 5]
  - [2026-11-09, 10]
  - [2026-11-16, 19]
  - [2026-11-23, 33]
  - [2026-11-30, 55]
  - [2026-12-07, 88]
  - [2026-12-14, 135]
  - [2026-12-21, 203]
  - [2026-12-28, 300]
```

Urgency (U1 to U5) is worked out every week from where the number stands against that week's target, by [the harness contract](https://github.com/krishanraja/ai-harness/blob/main/contract/north-star-metric.md). Set by Krish on 23 October 2026.

## How to use it

- Read it before any work, every session.
- Before you start, say which part of it the task moves. If the task moves nothing toward it, say so first and let Krish decide.
- Prefer the work that moves it furthest, and close each session by noting what moved.
- Only Krish changes this file. Record his ruling in the commit body as `Ruling (Krish, YYYY-MM-DD): ...`.
- When it is reached, say so and ask Krish for the next one.
