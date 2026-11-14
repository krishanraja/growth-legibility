// The protocol copy is Control Center's bundle, byte for byte (integration plan I-11, 2026-11-14).
// docs/control-center/ holds Control Center's public-safe protocol bundle and bundle.json, which names each file's
// sha256 and one bundle_sha256. Refresh the copy from Control Center's docs/app/growth/protocol-bundle/; never edit it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(import.meta.dirname, '..', 'docs', 'control-center')
const sha = (b) => createHash('sha256').update(b).digest('hex')

test('every file of the protocol copy matches its sha256 in bundle.json', () => {
  const bundle = JSON.parse(readFileSync(join(DIR, 'bundle.json'), 'utf8'))
  assert.ok(Object.keys(bundle.files).length, 'a bundle with no files proves nothing')
  for (const [name, want] of Object.entries(bundle.files)) assert.equal(sha(readFileSync(join(DIR, name))), want, `${name} differs from Control Center's bundle; refresh it, never edit it`)
})

test('the bundle hash is the documented recipe', () => {
  const bundle = JSON.parse(readFileSync(join(DIR, 'bundle.json'), 'utf8'))
  const text = `version ${bundle.version}\n` + Object.keys(bundle.files).sort().map(p => `${p} ${bundle.files[p]}\n`).join('')
  assert.equal(sha(text), bundle.bundle_sha256)
  assert.match(readFileSync(join(DIR, 'ENGINE-PROTOCOL.md'), 'utf8').split('\n')[0], new RegExp(`version ${bundle.version.replace(/\./g, '\\.')}`))
})
