# @dwa/orchestrator

Fastify-baserad orchestrator för declarative-worker-api. Hanterar task-köer, backend-routing och DAG-execution.

## Starta

```bash
# Development
pnpm dev

# Production
pnpm build && pnpm start
```

## Miljövariabler

| Variabel | Default | Beskrivning |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `HOST` | 0.0.0.0 | Server host |
| `REDIS_URL` | redis://localhost:6379 | Redis för BullMQ |
| `CORS_ORIGIN` | * | Tillåtna origins |
| `MODAL_URL` | - | Modal backend URL |
| `MODAL_TOKEN` | - | Modal auth token |
| `RAY_URL` | - | Ray backend URL |

## API Endpoints

| Endpoint | Method | Beskrivning |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/tasks` | POST | Skapa task |
| `/api/tasks/:id` | GET | Hämta status |
| `/api/tasks` | GET | Lista tasks |
| `/api/tasks/:id` | DELETE | Avbryt task |
| `/api/visualize` | POST | Generera DAG-diagram |

### POST /api/tasks

Skapa en ny task.

**Request:**
```json
{
  "type": "text.chat",
  "payload": { "prompt": "Hello!" },
  "queue": "default",
  "priority": 0
}
```

**Response:**
```json
{
  "taskId": "abc123",
  "status": "queued",
  "queue": "default"
}
```

### GET /api/tasks/:id

Hämta task-status.

**Query params:**
- `queue` (optional): Specifik kö att söka i

**Response:**
```json
{
  "taskId": "abc123",
  "status": "running",
  "progress": 45,
  "result": null,
  "error": null
}
```

Status-värden: `queued`, `running`, `completed`, `failed`

### GET /api/tasks

Lista tasks i en kö.

**Query params:**
- `queue`: Könamn (default: "default")
- `status`: Filtrera på status
- `limit`: Max antal (default: 50)

**Response:**
```json
{
  "queue": "default",
  "count": 3,
  "tasks": [...]
}
```

### DELETE /api/tasks/:id

Avbryt en väntande/körande task.

**Response:**
```json
{
  "taskId": "abc123",
  "cancelled": true
}
```

### POST /api/visualize

Generera Mermaid-diagram för pipeline DAG.

**Request:**
```json
{
  "type": "video-analysis",
  "steps": [
    { "id": "download", "task": "data.download" },
    { "id": "process", "task": "video.process", "dependsOn": ["download"] }
  ]
}
```

**Response:**
```json
{
  "mermaid": "graph TD\n  download --> process",
  "url": "https://mermaid.live/edit#..."
}
```

## Se även

- [DECISIONS.md](../../docs/DECISIONS.md) - Arkitekturbeslut
- [@dwa/client](../client/README.md) - TypeScript SDK
- [@dwa/core](../core/README.md) - Delade typer
