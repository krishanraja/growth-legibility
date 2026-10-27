# Session ledger

What the Claude Code sessions that build this engine cost, in counts only: one row per measured session, newest last. It is the baseline the 20x target is read against ([ENGINE-ARCHITECTURE.md](../ENGINE-ARCHITECTURE.md), sections 11 and 12, Phase 1C). No row carries a message, a path, a session, message or tool id, or a price: only instants, SHA-256 digests and counts.

`scripts/session-ledger.mjs` writes each row and reproduces it:

```
node scripts/session-ledger.mjs --until <cut-off> --row <session transcript> <its subagents folder>
```

- **Cut-off.** Only lines stamped at or before it count. Each transcript is cut after its last such line, so a row comes back unchanged however much the files grow afterwards.
- **Transcript SHA-256.** The session's own transcript, over exactly the bytes it held at the cut-off.
- **Subagents.** How many subagent transcripts had lines by the cut-off, and the SHA-256 of their digests (one per line, in file-name order). Their usage is in the totals.
- **API calls and tokens.** Counted once per `message.id`: a transcript writes one line per content block, and each repeats the response's usage. Lines from the stand-in model `<synthetic>` are not API calls and are skipped. Input excludes cache reads and cache creation, which have their own columns.
- **First and last call.** The first and last API response counted.

| Cut-off (UTC) | Transcript SHA-256 | Subagents (digest of digests) | API calls | Input | Output | Cache read | Cache creation | First call | Last call |
|---|---|---|---:|---:|---:|---:|---:|---|---|
| 2026-10-27T19:40:00.000Z | `2dea4c04b3bfeaab9b5263a0f578305dff80e98ebfca7e0c27a09b7949b48ccc` | 30 (`bece9c08f8cea092c0989b87b95a5b384ea1dc9b3c84e88debd49b83c36e5604`) | 1,157 | 2,352 | 1,689,509 | 324,389,918 | 7,960,073 | 2026-10-27T11:04:23.576Z | 2026-10-27T19:39:59.762Z |
