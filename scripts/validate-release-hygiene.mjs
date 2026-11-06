// Usage: node scripts/validate-release-hygiene.mjs [root]
// Fails (exit 1) on: machine-specific absolute paths,
// and credential-shaped strings in tracked files.
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.argv[2] ? resolve(process.argv[2]) : process.cwd()
const errors = []
const fail = msg => errors.push(msg)

const tracked = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
if (tracked.status !== 0) {
  console.error('[fail] git ls-files failed; run inside the repository')
  process.exit(1)
}
const files = tracked.stdout.split('\n').filter(Boolean)

// 1. Machine-specific absolute paths must not ship in a reusable template.
// /home/runner is a documented GitHub Actions CI path in CLI references, not a user path.
const HOME_RE = /\/(home|Users)\/(?!runner(?:\/|$))[^/\s]+(?:\/|$)/
for (const f of files) {
  const full = join(root, f)
  if (!existsSync(full)) continue // tracked-but-deleted working-tree files (unstaged cleanup)
  const text = readFileSync(full, 'utf8')
  const m = text.match(HOME_RE)
  if (m) fail(`machine-specific absolute path ${m[0].trim()} in ${f}`)
}

// 2. Credential-shaped strings must not ship.
const SECRET_RE =
  /(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA|OPENSSH|EC|DSA) PRIVATE KEY-----)/
for (const f of files) {
  if (!existsSync(join(root, f))) continue
  const text = readFileSync(join(root, f), 'utf8')
  if (SECRET_RE.test(text)) fail(`credential-shaped string in ${f}`)
}

if (errors.length) {
  console.error('[fail] release-hygiene violations:')
  for (const e of errors) console.error('  - ' + e)
  process.exit(1)
}
console.log(`[ok] tracked=${files.length} secrets=0 machinePaths=0`)
