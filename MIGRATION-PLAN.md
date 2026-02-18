# Migration Plan: decl-worker-api tests → bdd-vitest

## Goal
Rewrite all tests to use `bdd-vitest` instead of raw `describe/it/expect`.

## Install
```bash
pnpm add -D bdd-vitest@file:../../bdd-vitest
```

## Pattern

### Before (current)
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("E2E: Task Execution", () => {
  let mockBackend: MockBackend;
  beforeEach(() => { clearBackends(); mockBackend = new MockBackend("modal"); registerBackend(mockBackend); });
  afterEach(() => { mockBackend.reset(); clearBackends(); });

  it("should execute llm.chat task", async () => {
    const task: Task = { type: "llm.chat", backend: "modal", payload: { prompt: "Hello", model: "gpt-4" } };
    const result = await processTask(task);
    expect(result).toEqual({ response: "Mock response to: Hello", model: "gpt-4" });
  });
});
```

### After (bdd-vitest)
```ts
import { component, feature, rule, expect } from "bdd-vitest";

const withBackend = () => {
  clearBackends();
  const backend = new MockBackend("modal");
  registerBackend(backend);
  return backend;
};

feature("Task Execution", () => {
  rule("LLM Tasks", () => {
    component("executes llm.chat task", {
      given: ["a registered mock backend", withBackend],
      when:  ["processing a chat task",    () => processTask({ type: "llm.chat", backend: "modal", payload: { prompt: "Hello", model: "gpt-4" } })],
      then:  ["returns mock response",     (result) => expect(result).toEqual({ response: "Mock response to: Hello", model: "gpt-4" })],
      cleanup: () => clearBackends(),
    });
  });
});
```

## Key Rules

1. **Pick the right level:**
   - `packages/core/tests/` → `unit` (pure logic, types, registry)
   - `packages/dashboard/tests/transforms.test.ts` → `unit` (pure functions, no deps)
   - `packages/dashboard/tests/client.test.ts` → `component` (client with mocks)
   - `packages/orchestrator/tests/dispatcher.test.ts` → `unit` (pure dispatch/routing logic, in-memory mocks)
   - `packages/orchestrator/tests/effects.test.ts` → `component` (mocks fetch + event emitters)
   - `tests/e2e/` → `component` (uses MockBackend, not real services)

2. **`describe` → `feature` / `rule`:**
   - Top-level `describe` → `feature`
   - Nested `describe` → `rule`

3. **`beforeEach/afterEach` → `given/cleanup`:**
   - Extract shared setup into a helper function (like `withBackend` above)
   - Each test gets its own `given` that calls the helper
   - `afterEach` cleanup moves to `cleanup` on each test

4. **`it` → level function:**
   - `it("should X", () => { setup; action; assert })` → split into `given/when/then`
   - Given = setup/arrange
   - When = the action being tested
   - Then = assertions
   - Descriptions are required on each phase — make them readable

5. **`vi.fn()` / `vi.stubGlobal` stay as-is** — bdd-vitest doesn't replace vitest mocking, just test structure

6. **Table-driven:** Where tests repeat with different inputs (e.g. task types), use `.outline`:
   ```ts
   component.outline("task types", [
     { name: "llm.chat",      type: "llm.chat",      expected: "response" },
     { name: "llm.embed",     type: "llm.embed",      expected: "embedding" },
     { name: "llm.summarize", type: "llm.summarize",  expected: "summary" },
   ], {
     given: (row) => ({ backend: withBackend(), type: row.type as string, expected: row.expected as string }),
     when:  (ctx) => processTask({ type: ctx.type, backend: "modal", payload: {} }),
     then:  (result, ctx) => expect(result).toHaveProperty(ctx.expected),
     cleanup: () => clearBackends(),
   });
   ```

## Files to migrate (in order)

1. `packages/core/tests/types.test.ts` (154 lines, unit — simplest, start here)
2. `packages/core/tests/registry.test.ts` (203 lines, unit)
3. `packages/dashboard/tests/transforms.test.ts` (247 lines, unit — pure functions)
4. `packages/dashboard/tests/client.test.ts` (314 lines, component)
5. `packages/orchestrator/tests/effects.test.ts` (200 lines, component — mocks fetch + emitters)
6. `packages/orchestrator/tests/dispatcher.test.ts` (412 lines, unit — pure dispatch logic)
7. `tests/e2e/effects-integration.test.ts` (246 lines, component — uses mocked emitters)
8. `tests/e2e/task-execution.test.ts` (282 lines, component — uses MockBackend)
9. `tests/e2e/parallel-pipeline.test.ts` (504 lines, component — uses MockBackend)
10. `tests/e2e/pipelines.test.ts` (738 lines, component — uses MockBackend, biggest, do last)

## Config: exclude e2e by default

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    exclude: ['**/e2e/**', '**/node_modules/**'],
  },
})
```

```bash
vitest                    # allt utom e2e
vitest --dir tests/e2e    # bara e2e (nightly/manuellt)
```

bdd-vitest's `e2e` level enforcar 120s timeout. Filtreringen av vilka filer som körs är vitests jobb.

## Verification
After each file: `pnpm test` — all tests must still pass. Don't change test logic, only structure.

## Don't
- Don't change what's being tested — same assertions, same mocks
- Don't remove `vi.fn()` or `vi.mock()` calls — those stay
- Don't add new tests — this is a structural migration only
- Don't touch `mock-backend.ts` or other test utilities
