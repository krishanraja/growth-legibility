// The source review's early warning in `npm run check` (docs/FAILURES.md F47). The clock lives in src/lib/review-due.mjs,
// which the runner shares for its dated hold (F49); this file only re-exports it.
export * from '../src/lib/review-due.mjs';
