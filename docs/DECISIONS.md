# Arkitekturbeslut

Detta dokument förklarar viktiga designbeslut i declarative-worker-api.

## DTO-mönster: Interna vs publika typer

Vi har medvetet separata typer för intern och publik användning:

| Paket | Syfte | Exempel |
|-------|-------|---------|
| `@dwa/core` | Intern orchestrator/backend | `TaskResult { id, status: "pending" }` |
| `@dwa/client` | Publik SDK | `TaskResult { taskId, status: "queued" }` |

### Varför?

- **Stabilitet**: Publik API förblir stabil även när intern implementation ändras
- **Semantik**: `taskId` är tydligare än generiskt `id` för SDK-användare
- **Filtrering**: Interna fält (`stepResults`, `startedAt`) läcker inte till publik API
- **Användarvänlighet**: "queued" är mer intuitivt än "pending" för slutanvändare

### Regel

Servern måste ALLTID mappa intern → publik innan response:

```typescript
// I server.ts
function toApiResponse(internal: TaskResult): ApiTaskResult {
  return {
    taskId: internal.id,
    status: internal.status === "pending" ? "queued" : internal.status,
    result: internal.result,
    error: internal.error,
    progress: internal.progress,
  };
}
```

## Varför inte tRPC?

SDK:n (`@dwa/client`) ger redan typer till TypeScript-konsumenter. tRPC skulle kräva:

1. Zod-scheman parallellt med TypeScript-typer (duplicering)
2. tRPC-specifik client setup i varje konsument
3. Begränsning till TypeScript-konsumenter i samma ekosystem

Med nuvarande setup:
- TypeScript-användare får typer via SDK
- Icke-TS användare (Python, Go, etc.) använder REST direkt
- Inga extra dependencies

## Varför inte OpenAPI?

Systemet har 5 endpoints. OpenAPI-spec skulle innebära:

1. YAML-filer att underhålla synkroniserat med kod
2. Kodgenerering för klienter (klumpigare än manuell SDK)
3. Overhead som inte motiveras av systemets storlek

README med endpoint-dokumentation räcker för detta scope.

## DAUI: Hybrid data + funktioner

DAUI (Declarative Atomic UI) är primärt data-driven ("pages are data"), men tillåter funktioner som escape hatch:

```typescript
// Ren data (90% av fallen)
{ atom: "button", text: "Click me", variant: "primary" }

// Funktioner som escape hatch (10% av fallen)
{
  organism: "table",
  data: () => fetchUsers(),           // dynamisk data
  columns: [
    { field: "status", render: (v) => ({ atom: "badge", text: v }) }
  ]
}
```

### Varför hybrid?

- Ren data täcker de flesta användningsfall
- Funktioner hanterar edge cases utan workarounds
- Användare väljer själva abstraktionsnivå
- Ingen påtvingad komplexitet för enkla sidor
