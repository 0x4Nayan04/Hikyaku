# Architecture diagrams

Mermaid sources describe the current API, worker and database contracts. The public docs use matching, manually authored SVG diagrams so visitors do not need a diagram runtime.

## System context

```mermaid
flowchart LR
  P[Producer] -->|Bearer key: ingest| H[Hikyaku API and worker]
  U[Console user] -->|Session: manage or ingest| H
  H -->|Signed HTTP; at-least-once| R[Receiver]
```

## Components

```mermaid
flowchart LR
  C[Console] -->|Session requests| A[API]
  A -->|Events, deliveries, outbox| D[(PostgreSQL)]
  A -->|Publish jobs| Q[(Redis / BullMQ)]
  W[Worker] -->|Recover and record| D
  W -->|Consume and recover jobs| Q
  W -->|Signed HTTP| R[Receiver]
```

## Ingest and recovery

```mermaid
sequenceDiagram
  participant C as Client
  participant A as API
  participant D as PostgreSQL
  participant Q as Redis / BullMQ
  participant W as Worker
  participant R as Receiver
  C->>A: POST /v1/events (key or session)
  A->>D: Transaction: event, deliveries, outbox
  Note over D: No active endpoints: no_recipients, zero deliveries
  A->>Q: Publish jobs after commit
  alt Queue accepts
    A->>D: Delete outbox rows
    A-->>C: 202 accepted
  else Publish fails
    A-->>C: 503; transaction may be committed
    W->>D: Sweeper reads outbox
    W->>Q: Republish jobs
    W->>D: Delete outbox after enqueue
  end
  Q->>W: Delivery job
  W->>R: Signed HTTP (at-least-once)
  W->>D: Record outcome / attempt
```

## Data model

```mermaid
erDiagram
  tenants ||--o{ users : "optional tenant_id"
  tenants ||--o{ api_keys : tenant_id
  tenants ||--o{ endpoints : tenant_id
  tenants ||--o{ events : tenant_id
  tenants ||--o{ deliveries : tenant_id
  tenants ||--o{ delivery_outbox : tenant_id
  events ||--o{ deliveries : "event_id and tenant_id"
  endpoints ||--o{ deliveries : "endpoint_id and tenant_id"
  deliveries ||--o| delivery_outbox : delivery_id
  deliveries ||--o{ delivery_attempts : delivery_id
  tenants ||--o{ invites : "optional tenant_id"
  users ||--o{ invites : "optional created_by_user_id"
  sessions { string sid PK
    json sess
    timestamp expire
  }
```

