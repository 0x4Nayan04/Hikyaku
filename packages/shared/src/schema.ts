import { sql } from 'drizzle-orm'
import {
  boolean,
  foreignKey,
  index,
  integer,
  json,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import type { DeliveryStatus, EndpointStatus, EventStatus } from './constants.js'

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    isSuperAdmin: boolean('is_super_admin').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_email_ci_uidx').on(sql`lower(${t.email})`),
    index('users_tenant_id_idx')
      .on(t.tenantId)
      .where(sql`${t.tenantId} IS NOT NULL`),
  ],
)

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    keyHash: text('key_hash').notNull().unique(),
    prefix: text('prefix').notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('api_keys_tenant_id_idx').on(t.tenantId)],
)

export const endpoints = pgTable(
  'endpoints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    secret: text('secret').notNull(),
    description: text('description'),
    status: text('status').notNull().default('active').$type<EndpointStatus>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('endpoints_tenant_id_id_uidx').on(t.tenantId, t.id),
    index('endpoints_tenant_id_status_idx').on(t.tenantId, t.status),
  ],
)

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    idempotencyKey: text('idempotency_key').notNull(),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status').notNull().default('pending').$type<EventStatus>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('events_tenant_idempotency_key_idx').on(t.tenantId, t.idempotencyKey),
    uniqueIndex('events_tenant_id_id_uidx').on(t.tenantId, t.id),
    index('events_tenant_id_created_at_idx').on(t.tenantId, t.createdAt),
  ],
)

export const deliveries = pgTable(
  'deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    endpointId: uuid('endpoint_id')
      .notNull()
      .references(() => endpoints.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending').$type<DeliveryStatus>(),
    attemptCount: integer('attempt_count').notNull().default(0),
    replayCount: integer('replay_count').notNull().default(0),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('deliveries_event_id_endpoint_id_idx').on(t.eventId, t.endpointId),
    index('deliveries_tenant_id_created_at_idx').on(t.tenantId, t.createdAt),
    index('deliveries_tenant_id_status_created_at_idx').on(t.tenantId, t.status, t.createdAt),
    index('deliveries_tenant_id_status_updated_at_idx').on(t.tenantId, t.status, t.updatedAt),
    index('deliveries_tenant_id_endpoint_id_created_at_idx').on(
      t.tenantId,
      t.endpointId,
      sql`${t.createdAt} DESC`,
    ),
    index('deliveries_status_updated_at_idx')
      .on(t.status, t.updatedAt)
      .where(sql`${t.status} IN ('pending', 'in_progress')`),
    foreignKey({
      columns: [t.tenantId, t.eventId],
      foreignColumns: [events.tenantId, events.id],
      name: 'deliveries_tenant_id_event_id_events_tenant_id_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.tenantId, t.endpointId],
      foreignColumns: [endpoints.tenantId, endpoints.id],
      name: 'deliveries_tenant_id_endpoint_id_endpoints_tenant_id_id_fk',
    }).onDelete('cascade'),
  ],
)

/** Enqueue intent written in the same Postgres transaction as the delivery. */
export const deliveryOutbox = pgTable(
  'delivery_outbox',
  {
    deliveryId: uuid('delivery_id')
      .primaryKey()
      .references(() => deliveries.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('delivery_outbox_created_at_idx').on(t.createdAt)],
)

export const deliveryAttempts = pgTable(
  'delivery_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deliveryId: uuid('delivery_id')
      .notNull()
      .references(() => deliveries.id, { onDelete: 'cascade' }),
    attemptNumber: integer('attempt_number').notNull(),
    runNumber: integer('run_number').notNull().default(0),
    httpStatus: integer('http_status'),
    responseBody: text('response_body'),
    error: text('error'),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('delivery_attempts_delivery_run_attempt_idx').on(
      t.deliveryId,
      t.runNumber,
      t.attemptNumber,
    ),
  ],
)

export const sessions = pgTable(
  'sessions',
  {
    sid: varchar('sid').primaryKey(),
    sess: json('sess').notNull(),
    expire: timestamp('expire', { withTimezone: true, precision: 6 }).notNull(),
  },
  (t) => [index('sessions_expire_idx').on(t.expire)],
)

export const invites = pgTable(
  'invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tokenHash: text('token_hash').notNull().unique(),
    kind: text('kind').notNull(),
    email: text('email').notNull(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    tenantName: text('tenant_name'),
    invitedName: text('invited_name'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('invites_email_idx').on(t.email)],
)
