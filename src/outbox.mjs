import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { canonical, validateEngineReport } from './guards/wire.mjs';

// A transport journal only, holding sealed protocol envelopes. Control Center owns all business state and approvals.
export class Outbox {
  constructor(path) {
    mkdirSync(dirname(path), {recursive:true,mode:0o700});
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS reports (
      run_id TEXT PRIMARY KEY, payload TEXT NOT NULL, digest TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending',
      last_error TEXT, receipt TEXT, lease_until INTEGER NOT NULL DEFAULT 0);`);
    if (!this.db.prepare('PRAGMA table_info(reports)').all().some(c=>c.name==='lease_until')) this.db.exec('ALTER TABLE reports ADD COLUMN lease_until INTEGER NOT NULL DEFAULT 0');
  }
  close() { this.db.close(); }
  put(report) {
    validateEngineReport(report);
    const old = this.get(report.run_id);
    if (old && old.digest !== report.payload_sha256) throw new Error('outbox_identity_conflict');
    this.db.prepare('INSERT OR IGNORE INTO reports(run_id,payload,digest) VALUES(?,?,?)').run(report.run_id,canonical(report),report.payload_sha256);
    return this.get(report.run_id);
  }
  get(id) { return this.db.prepare('SELECT * FROM reports WHERE run_id=?').get(id); }
  reserve(id, now=Date.now()) {
    const r = this.db.prepare("UPDATE reports SET attempts=attempts+1,status='uncertain',last_error=NULL,lease_until=? WHERE run_id=? AND attempts<3 AND (status IN ('pending','retryable') OR (status='uncertain' AND lease_until<=?)) RETURNING attempts").get(now+120000,id,now);
    if (!r) throw new Error('outbox_attempt_budget_or_reconciliation_required');
    return r.attempts;
  }
  error(id, code, generation) { return this.db.prepare("UPDATE reports SET last_error=?,lease_until=0 WHERE run_id=? AND attempts=? AND status='uncertain'").run(code,id,generation).changes===1; }
  delivered(id, receipt, generation=null) {
    const result = generation===null
      ? this.db.prepare("UPDATE reports SET status='delivered',receipt=?,last_error=NULL,lease_until=0 WHERE run_id=?").run(canonical(receipt),id)
      : this.db.prepare("UPDATE reports SET status='delivered',receipt=?,last_error=NULL,lease_until=0 WHERE run_id=? AND attempts=? AND status='uncertain'").run(canonical(receipt),id,generation);
    return result.changes===1;
  }
}
