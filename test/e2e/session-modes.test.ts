import test from 'node:test'
import assert from 'node:assert/strict'
import { E2EClient } from './harness.js'

test('e2e: session/set_mode is not handled; thinking is set through the thought_level config option', async () => {
  const c = E2EClient.start({ script: { responses: [] } })
  try {
    const { sessionId } = await c.newSession()
    await assert.rejects(c.conn.setSessionMode({ sessionId, modeId: 'high' }), { code: -32601 })
  } finally {
    await c.close()
  }
})
