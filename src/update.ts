import crossSpawn from 'cross-spawn'
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildInfo } from './build-info.js'
import { compareSemver } from './semver.js'
import { isEphemeralInstall } from './setup.js'

export interface Release {
  version: string
  tarballUrl: string
}

export interface UpdateDeps {
  installedVersion: string
  /** Path of the running adapter script. */
  scriptPath: string
  /** npm's global node_modules folder, or null when npm cannot tell. */
  globalRoot: () => string | null
  latestRelease: () => Promise<Release>
  npmInstall: (tarballUrl: string) => { status: number | null; stderr: string }
  out: (text: string) => void
}

const LATEST_RELEASE_URL = 'https://api.github.com/repos/JohannesKaminski/pidea/releases/latest'

/** Latest published GitHub release (drafts and prereleases are excluded by the endpoint). */
export async function fetchLatestRelease(fetchImpl: typeof fetch = fetch): Promise<Release> {
  const response = await fetchImpl(LATEST_RELEASE_URL, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'pidea' },
    signal: AbortSignal.timeout(10_000)
  })
  if (!response.ok) throw new Error(`GitHub answered ${response.status} for ${LATEST_RELEASE_URL}`)
  const body = (await response.json()) as {
    tag_name?: string
    assets?: { name?: string; browser_download_url?: string }[]
  }
  const version = String(body.tag_name ?? '').replace(/^v/, '')
  const asset = body.assets?.find(a => a.name?.endsWith('.tgz'))
  if (!asset?.browser_download_url) throw new Error(`release ${body.tag_name} has no .tgz asset`)
  return { version, tarballUrl: asset.browser_download_url }
}

/** The real environment: the npm next to the running node, so installs land in the same global prefix. */
export function defaultUpdateDeps(): UpdateDeps {
  const bundled = join(dirname(process.execPath), process.platform === 'win32' ? 'npm.cmd' : 'npm')
  const npm = existsSync(bundled) ? bundled : 'npm'
  return {
    installedVersion: buildInfo.packageVersion,
    scriptPath: fileURLToPath(import.meta.url),
    globalRoot: () => {
      const result = crossSpawn.sync(npm, ['root', '-g'], { encoding: 'utf8' })
      return result.status === 0 ? String(result.stdout).trim() || null : null
    },
    latestRelease: () => fetchLatestRelease(),
    npmInstall: url => {
      const result = crossSpawn.sync(npm, ['install', '-g', url], {
        encoding: 'utf8',
        stdio: ['ignore', 'inherit', 'pipe']
      })
      return { status: result.status, stderr: String(result.stderr ?? '') }
    },
    out: text => process.stdout.write(text)
  }
}

export async function runUpdate(argv: string[], deps: UpdateDeps): Promise<number> {
  let latest: Release
  try {
    latest = await deps.latestRelease()
  } catch (e) {
    deps.out(`pidea update: could not look up the latest release: ${(e as Error).message}\n`)
    return 1
  }
  const newer = compareSemver(latest.version, deps.installedVersion) > 0
  deps.out(`installed: ${deps.installedVersion}\nlatest:    ${latest.version}\n`)
  if (!newer) {
    deps.out('pidea is up to date.\n')
    return 0
  }
  if (argv.includes('--check')) {
    deps.out(`pidea ${latest.version} is available. Run \`pidea update\` to install it.\n`)
    return 0
  }
  if (isEphemeralInstall(deps.scriptPath)) {
    deps.out(
      'pidea update: running from the npx cache, which can be deleted at any time. Install pidea globally (see the README) instead.\n'
    )
    return 1
  }
  const root = deps.globalRoot()
  const rel = root ? relative(root, deps.scriptPath) : '..'
  if (rel.startsWith('..') || isAbsolute(rel)) {
    deps.out(
      `pidea update: ${deps.scriptPath} is not a global npm install, so npm would update a different copy. Install the release tarball where you installed pidea, or reinstall globally (see the README).\n`
    )
    return 1
  }
  deps.out(`Installing ${latest.tarballUrl}\n`)
  const result = deps.npmInstall(latest.tarballUrl)
  if (result.status !== 0) {
    deps.out(`pidea update: npm install failed:\n${result.stderr}`)
    if (result.stderr.includes('EACCES')) {
      // Never escalate with sudo; point at the two fixes npm documents instead.
      deps.out(
        '\nnpm may not write to its global folder. To install without sudo, either install Node.js with a version manager such as nvm (recommended), or set a user prefix (not on Windows): `npm config set prefix ~/.local` and add ~/.local/bin to your PATH. Then install pidea again.\nhttps://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally\n'
      )
    }
    return 1
  }
  deps.out(`Installed pidea ${latest.version}. Restart the IDE to use pidea ${latest.version}.\n`)
  return 0
}
