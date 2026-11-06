// Shared helpers for the validator scripts.

/** [ok]/[fail] reporter that counts failures for the final exit code. */
export function createReporter() {
  let failures = 0
  return {
    ok: m => console.log('[ok] ' + m),
    fail: m => {
      failures++
      console.log('[fail] ' + m)
    },
    get failCount() {
      return failures
    }
  }
}
