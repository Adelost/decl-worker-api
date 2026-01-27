# Architecture: Type Safety Strategy

## Overview

```
┌─────────────┐      tRPC       ┌──────────────┐     BullMQ      ┌─────────────┐
│   Frontend  │ ◄─────────────► │ Orchestrator │ ◄─────────────► │   Workers   │
│  (Svelte)   │    end-to-end   │   (Node.js)  │      JSON       │  (Python)   │
│             │    type-safe    │              │                 │             │
└─────────────┘                 └──────────────┘                 └─────────────┘
      TS                              TS                              Python
      │                               │                                  │
      └───────── tRPC ────────────────┘                                  │
                (no codegen!)                                            │
                                      │                                  │
                                      └──── Small overlap ───────────────┘
                                           (10-15 payload types)
                                           (manual sync is fine)
```

## Why This Architecture

### Frontend ↔ Orchestrator: tRPC

**Why not OpenAPI/generated types?**
- OpenAPI adds YAML files to maintain
- Generated clients feel clunky
- Three places to update: code, spec, clients

**Why tRPC?**
- End-to-end type safety
- Zero code generation
- Change backend → TypeScript errors in frontend immediately
- Best DX that exists for TS-to-TS

```typescript
// Orchestrator: Define router
export const tasksRouter = router({
  submit: publicProcedure
    .input(z.object({
      task: z.enum(["openai.chat", "qwen.chat", "yolo.detect", ...]),
      payload: z.record(z.unknown()),
    }))
    .mutation(async ({ input }) => {
      return await submitToQueue(input.task, input.payload);
    }),

  status: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ input }) => {
      return await getTaskStatus(input.taskId);
    }),
});

// Frontend: Use it (full autocomplete!)
const result = await trpc.tasks.submit.mutate({
  task: "openai.chat",
  payload: { messages: [{ role: "user", content: "Hello" }] }
});
```

### Orchestrator ↔ Workers: Pydantic + Manual Sync

**Why not generate Python from TypeScript?**
- Adds complexity
- Python workers have their own needs (GPU, chunking, ML-specific)
- The overlap is small (just task payloads)

**Why manual sync works?**
- Only 10-15 payload types to keep in sync
- Changes are infrequent
- Easier to debug than generated code

```python
# Python: Define payload (mirrors TypeScript)
class ChatPayload(BaseModel):
    messages: list[Message]
    temperature: float = 0.7
    max_tokens: int | None = None

# TypeScript: Define same structure
interface ChatPayload {
  messages: Message[];
  temperature?: number;
  max_tokens?: number | null;
}
```

### When to add code generation

Add generators **only if**:
1. You have 50+ payload types
2. Multiple teams working on different parts
3. Types change frequently and sync errors become a problem

Until then: manual sync is simpler and faster.

## Summary

| Boundary | Solution | Why |
|----------|----------|-----|
| Frontend ↔ Orchestrator | **tRPC** | Same language, best DX |
| Orchestrator ↔ Workers | **Manual sync** | Small surface, simple |
| Python validation | **Pydantic** | Fast, great errors |

## When is OpenAPI worth it?

- Public APIs where external developers integrate
- Large organizations with many teams consuming same API
- Regulatory requirements for documentation

For internal systems? Almost never worth the overhead.
