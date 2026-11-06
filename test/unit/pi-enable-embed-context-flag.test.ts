import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { PideaAgent } from '../../src/acp/agent.js'
import { FakeAgentSideConnection, asAgentConn } from '../helpers/fakes.js'

beforeEach(() => {
  delete process.env.PIDEA_ENABLE_EMBEDDED_CONTEXT
})

afterEach(() => {
  delete process.env.PIDEA_ENABLE_EMBEDDED_CONTEXT
})

async function initializeWithEmbeddedContext(value?: string) {
  if (value != null) process.env.PIDEA_ENABLE_EMBEDDED_CONTEXT = value

  const agent = new PideaAgent(asAgentConn(new FakeAgentSideConnection()))
  const res = await agent.initialize({ protocolVersion: 1 } as any)

  assert.ok(res.agentCapabilities)
  assert.ok(res.agentCapabilities.promptCapabilities)
  return res.agentCapabilities.promptCapabilities.embeddedContext
}

test('PIDEA_ENABLE_EMBEDDED_CONTEXT: defaults embeddedContext to false when undefined', async () => {
  assert.equal(await initializeWithEmbeddedContext(), false)
})

test("PIDEA_ENABLE_EMBEDDED_CONTEXT: 'false' keeps embeddedContext disabled", async () => {
  assert.equal(await initializeWithEmbeddedContext('false'), false)
})

test("PIDEA_ENABLE_EMBEDDED_CONTEXT: 'true' enables embeddedContext", async () => {
  assert.equal(await initializeWithEmbeddedContext('true'), true)
})
