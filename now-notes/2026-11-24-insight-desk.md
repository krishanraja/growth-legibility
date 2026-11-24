# Insight desk adapter

Status: the ai-harness insight-desk skill is wired into this engine as a thin adapter (config/insight-desk.json), a Node checker for insight sheets (src/lib/insight-sheet.mjs, `npm run insight`), and an optional `--insight <sheet>` on the reader check that adds `insight:<idea id>` angles beside the three fixed ones. A sheet whose repo or venture is not this engine's is refused, by both the checker and the reader. Without the flag the reader behaves exactly as before. The engine stays held, so a sheet stays local and puts no ask on Krish's list.
Next: once Krish releases the engine and ai-harness admits the skill, run the first sheet in runtime/insight/ and brief the reader check with it.
North Star check (2026-11-24): holds.
