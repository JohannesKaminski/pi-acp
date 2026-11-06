import test from 'node:test'
import assert from 'node:assert/strict'
import { PideaAgent } from '../../src/acp/agent.js'
import { FakeAgentSideConnection, asAgentConn } from '../helpers/fakes.js'

const NOTICE = 'pidea 0.2.0 is available (you have 0.1.0). Run `pidea update` in a terminal.'

function fakeSession(sessionId: string) {
  return {
    sessionId,
    cwd: process.cwd(),
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

async function runSessions(updateCheck: () => Promise<string[]>, count = 2) {
  const conn = new FakeAgentSideConnection()
  const agent = new PideaAgent(asAgentConn(conn), { updateCheck })
  let n = 0
  ;(agent as any).sessions = { create: async () => fakeSession(`s${++n}`) }
  for (let i = 0; i < count; i++) await agent.newSession({ cwd: process.cwd(), mcpServers: [] } as any)
  await new Promise(resolve => setTimeout(resolve, 50))
  // The fake sessions emit nothing themselves, so every chat message here comes from the notice.
  return conn.updates.filter(u => u.update.sessionUpdate === 'agent_message_chunk')
}

async function withUpdateCheckEnv<T>(value: string, fn: () => Promise<T>): Promise<T> {
  const prev = process.env.PIDEA_UPDATE_CHECK
  process.env.PIDEA_UPDATE_CHECK = value
  try {
    return await fn()
  } finally {
    if (prev === undefined) delete process.env.PIDEA_UPDATE_CHECK
    else process.env.PIDEA_UPDATE_CHECK = prev
  }
}

test('a newer release is announced once per adapter process, in the first session', async () => {
  await withUpdateCheckEnv('1', async () => {
    const notices = await runSessions(async () => [NOTICE])
    assert.equal(notices.length, 1)
    assert.equal(notices[0].sessionId, 's1')
    assert.deepEqual(notices[0].update, {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: `${NOTICE}\n` }
    })
  })
})

test('PIDEA_UPDATE_CHECK=0 skips the check entirely', async () => {
  await withUpdateCheckEnv('0', async () => {
    let called = false
    const notices = await runSessions(async () => {
      called = true
      return [NOTICE]
    })
    assert.equal(called, false)
    assert.equal(notices.length, 0)
  })
})

test('no notice when nothing is newer or the check fails', async () => {
  await withUpdateCheckEnv('1', async () => {
    assert.equal((await runSessions(async () => [])).length, 0)
    const failing = await runSessions(async () => {
      throw new Error('offline')
    })
    assert.equal(failing.length, 0)
  })
})
