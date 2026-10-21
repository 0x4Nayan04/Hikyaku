# Security

Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/0x4Nayan04/Hikyaku/security/advisories/new). Do not open a public issue for an unfixed vulnerability.

This file records current boundaries. It is not a promise of a response SLA.

## Known limits (not bugs)

- Endpoint signing secrets are stored so the worker can sign POSTs; they are not hashed like API keys. Protect the database and backups.
- Signing-secret rotation replaces the secret immediately. There is no dual-secret window.
- Redis down: auth rate limits and ingest enqueue return **503**. The outbox can recover committed deliveries; login cannot.
- Invites and password resets are copy-paste links. There is no email delivery.
- HTTP delivery is **at-least-once**. Subscribers must dedupe on `X-Webhook-Id`.

More operational notes live in [deploy/README.md](./deploy/README.md). Product docs cover the same limits under [Known limits](https://hikyaku.nayanswarnkar.com/docs#known-limits).
