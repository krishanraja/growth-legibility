import { validatePolicy,validateSnapshot,sha256 } from './guards/wire.mjs';

// This boundary receives a source-owned private export, never browser assertions.
export function capture(raw,rawPolicy,at) {
  const policy=validatePolicy(structuredClone(rawPolicy));
  const snapshot=validateSnapshot(structuredClone(raw),at);
  return {policy,snapshot,sourceHash:sha256(snapshot)};
}
