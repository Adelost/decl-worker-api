# Claude Code Context

See [AGENTS.md](../AGENTS.md) for full context.

## Quick Reference

**Pattern:** Tasks are typed objects, not code. Dispatcher interprets them.

**Template syntax:** `{{payload.field}}`, `{{steps.id.result}}`, `{{item}}`, `{{index}}`

**Structure:**
- `packages/core/src/types/` - Task, Step, Effect, Backend types
- `packages/orchestrator/src/engine/` - Dispatcher, Effects, Visualize
- `backends/modal/app.py` - 72 task handlers
- `shared/tasks/` - Shared Python logic
- `tests/component/` - Component tests with MockBackend

**DAG execution:**
```typescript
{
  steps: [
    { id: "a", task: "download" },
    { id: "b", task: "process", dependsOn: ["a"] },
    { id: "c", task: "process", dependsOn: ["a"] },  // b and c run in parallel
    { id: "d", task: "merge", dependsOn: ["b", "c"] }
  ]
}
```

**forEach pattern:**
```typescript
{
  id: "process_items",
  task: "vision.describe",
  forEach: "{{steps.prev.items}}",
  forEachConcurrency: 4,
  input: { image: "{{item.path}}" }
}
```

**Effects:** `toast`, `webhook`, `notify`, `invalidate`, `enqueue`, `emit`

**Don't:**
- Add callbacks/functions to tasks
- Use `steps.0.result` in DAG mode (use `steps.id.result`)
- Forget `dependsOn` for data dependencies
- Add unrequested features
