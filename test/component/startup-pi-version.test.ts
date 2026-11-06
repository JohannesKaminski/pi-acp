import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PideaAgent } from '../../src/acp/agent.js'
import { FakeAgentSideConnection, asAgentConn } from '../helpers/fakes.js'

function fakeSession(sessionId: string, cwd: string) {
  return {
    sessionId,
    cwd,
    proc: {
      async getAvailableThinkingLevels() {
        return ['off', 'medium']
      },
      async getAvailableModels() {
        return { models: [{ provider: 'test', id: 'model', name: 'model' }] }
      },
      async getState() {
        return { thinkingLevel: 'medium', model: { provider: 'test', id: 'model' } }
      },
      async getCommands() {
        return { commands: [] }
      }
    },
    setStartupInfo() {},
    sendStartupInfoIfPending() {},
    async publishContextUsage() {}
  }
}

async function startupInfos(piVersion: () => Promise<string>, count: number) {
  // Empty agent dir: no user settings, so quietStartup is off and the startup block is built.
  const prevAgentDir = process.env.PI_CODING_AGENT_DIR
  process.env.PI_CODING_AGENT_DIR = mkdtempSync(join(tmpdir(), 'pidea-agent-'))
  const cwd = mkdtempSync(join(tmpdir(), 'pidea-cwd-'))
  try {
    const agent = new PideaAgent(asAgentConn(new FakeAgentSideConnection()), { piVersion })
    let n = 0
    ;(agent as any).sessions = { create: async () => fakeSession(`s${++n}`, cwd) }
    const infos: string[] = []
    for (let i = 0; i < count; i++) {
      const response = await agent.newSession({ cwd, mcpServers: [] } as any)
      infos.push(String(response._meta?.pidea?.startupInfo ?? ''))
    }
    return infos
  } finally {
    if (prevAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR
    else process.env.PI_CODING_AGENT_DIR = prevAgentDir
  }
}

test('the startup block shows the pi version, looked up once per adapter process', async () => {
  let lookups = 0
  const infos = await startupInfos(async () => {
    lookups++
    return '9.9.9'
  }, 2)
  assert.equal(lookups, 1)
  for (const info of infos) assert.match(info, /^pi v9\.9\.9$/m)
})

test('a failed pi version lookup leaves the version line out', async () => {
  const [info] = await startupInfos(async () => {
    throw new Error('pi not found')
  }, 1)
  assert.match(info, /^pidea /)
  assert.doesNotMatch(info, /^pi v/m)
})
