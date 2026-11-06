import crossSpawn from 'cross-spawn'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { getPideaDir } from './acp/paths.js'
import { buildInfo } from './build-info.js'
import { getPiCommand } from './pi-rpc/command.js'
import { compareSemver, isSemver } from './semver.js'
import { fetchLatestRelease } from './update.js'

export interface UpdateCheckDeps {
  cachePath: string
  now: () => number
  installedPidea: string
  installedPi: () => Promise<string | null>
  latestPidea: () => Promise<string>
  latestPi: () => Promise<string>
  timeoutMs: number
}

/** First line a command prints, without a leading "v"; rejects when it cannot run or fails. */
function versionOutput(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = crossSpawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout?.on('data', chunk => (out += chunk))
    child.stderr?.on('data', chunk => (out += chunk))
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) resolve(out.trim().split('\n')[0].replace(/^v/i, ''))
      else reject(new Error(`${command} exited with ${code}`))
    })
  })
}

export function defaultUpdateCheckDeps(): UpdateCheckDeps {
  return {
    cachePath: join(getPideaDir(), 'update-check.json'),
    now: Date.now,
    installedPidea: buildInfo.packageVersion,
    installedPi: () => versionOutput(getPiCommand(process.env.PIDEA_PI_COMMAND), ['--version']),
    latestPidea: async () => (await fetchLatestRelease()).version,
    latestPi: () => versionOutput('npm', ['view', '@earendil-works/pi-coding-agent', 'version']),
    timeoutMs: 3000
  }
}

function isNewer(latest: string | undefined, installed: string | null): latest is string {
  return !!latest && !!installed && isSemver(latest) && isSemver(installed) && compareSemver(latest, installed) > 0
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

interface CachedLatest {
  checkedAt: number
  pidea?: string
  pi?: string
}

function readCache(path: string): CachedLatest | null {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as CachedLatest
    return typeof parsed.checkedAt === 'number' ? parsed : null
  } catch {
    return null
  }
}

/** Resolves undefined when the lookup fails or outlasts the timeout. */
function settle<T>(lookup: () => Promise<T>, timeoutMs: number): Promise<T | undefined> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(undefined), timeoutMs)
    timer.unref?.()
    lookup().then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        clearTimeout(timer)
        resolve(undefined)
      }
    )
  })
}

/** Notice lines for newer pidea / pi releases. Never throws; a failed lookup just gives no notice. */
export async function checkForUpdates(deps: UpdateCheckDeps): Promise<string[]> {
  let cached = readCache(deps.cachePath)
  if (!cached || deps.now() - cached.checkedAt >= CACHE_TTL_MS) {
    const [pidea, pi] = await Promise.all([
      settle(deps.latestPidea, deps.timeoutMs),
      settle(deps.latestPi, deps.timeoutMs)
    ])
    cached = { checkedAt: deps.now(), pidea, pi }
    // Cache only a complete answer, so a failed lookup is retried at the next start.
    if (pidea && pi) {
      try {
        mkdirSync(dirname(deps.cachePath), { recursive: true })
        writeFileSync(deps.cachePath, JSON.stringify(cached) + '\n')
      } catch {
        // An unwritable cache only costs a lookup next time.
      }
    }
  }
  const { pidea: latestPidea, pi: latestPi } = cached
  const installedPi = (await settle(deps.installedPi, deps.timeoutMs)) ?? null
  const lines: string[] = []
  if (isNewer(latestPidea, deps.installedPidea)) {
    lines.push(
      `pidea ${latestPidea} is available (you have ${deps.installedPidea}). Run \`pidea update\` in a terminal.`
    )
  }
  if (isNewer(latestPi, installedPi)) {
    lines.push(
      `New version available: v${latestPi} (installed v${installedPi}). Run: \`npm i -g @earendil-works/pi-coding-agent\``
    )
  }
  return lines
}
