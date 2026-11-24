import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { loadavg, availableParallelism } from 'node:os'
import pg from 'pg'

const target = new URL(process.env.TEST_DATABASE_URL ?? '')
assert(['postgres:', 'postgresql:'].includes(target.protocol), 'PostgreSQL URL required')
assert(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'Local database required')
assert(target.pathname.endsWith('_test'), 'Disposable *_test database required')
const client = new pg.Client({ connectionString: target.href })
const tenant = '11111111-1111-4111-8111-111111111111'
const queries = {
  events: `select id,idempotency_key,type,status,created_at from events where tenant_id=$1 order by created_at desc,id desc limit 51`,
  events_failed: `select id,idempotency_key,type,status,created_at from events where tenant_id=$1 and status='failed' order by created_at desc,id desc limit 51`,
  deliveries: `select d.id,d.event_id,d.endpoint_id,e.url,d.status,d.attempt_count,d.replay_count,d.next_retry_at,d.last_error,d.created_at,d.updated_at from deliveries d join endpoints e on d.endpoint_id=e.id where d.tenant_id=$1 order by d.created_at desc,d.id desc limit 51`,
  deliveries_failed: `select d.id,d.event_id,d.endpoint_id,e.url,d.status,d.attempt_count,d.replay_count,d.next_retry_at,d.last_error,d.created_at,d.updated_at from deliveries d join endpoints e on d.endpoint_id=e.id where d.tenant_id=$1 and d.status='failed' order by d.created_at desc,d.id desc limit 51`,
  stats_events: `select count(*) from events where tenant_id=$1 and created_at>=date_trunc('day',now() at time zone 'utc') at time zone 'utc'`,
  stats_active: `select count(*) from deliveries where tenant_id=$1 and status in ('pending','in_progress')`,
  stats_terminal: `select count(*) filter(where status='succeeded') as succeeded, count(*) filter(where status='failed') as failed from deliveries where tenant_id=$1 and status in ('succeeded','failed') and updated_at>=now()-interval '24 hours'`,
}
const baselineIndexes = `
  drop index events_tenant_id_status_created_at_idx;
  drop index events_tenant_id_created_at_idx;
  create index events_tenant_id_created_at_idx on events(tenant_id,created_at);
  drop index deliveries_tenant_id_created_at_idx;
  create index deliveries_tenant_id_created_at_idx on deliveries(tenant_id,created_at);
  drop index deliveries_tenant_id_status_created_at_idx;
  create index deliveries_tenant_id_status_created_at_idx on deliveries(tenant_id,status,created_at);
`
const report = {
  scope: 'Warm local SQL only; not HTTP latency or production capacity',
  load: loadavg(),
  cores: availableParallelism(),
  rowsPerTable: 200000,
  dataset: {
    seed: 'hikyaku-query-v1',
    tenants: 10,
    rowsPerTenant: 20000,
    endpointsPerTenant: 4,
    historyDays: 30,
    distribution:
      'Balanced tenants; independent seeded random timestamps, statuses, endpoints and payload sizes',
  },
  queries,
  samples: { baseline: {}, current: {} },
}
const expected = {}
const migrationSql = await readFile(
  new URL('../../drizzle/0026_list_query_indexes.sql', import.meta.url),
  'utf8',
)
const indexDefinitions = `select indexname,indexdef from pg_indexes where schemaname='public' and tablename in ('events','deliveries') order by indexname`

function planNodes(plan) {
  return [plan, ...(plan.Plans ?? []).flatMap(planNodes)]
}

await client.connect()
try {
  report.postgres = (
    await client.query(
      "select version(),current_setting('shared_buffers') as shared_buffers,current_setting('work_mem') as work_mem",
    )
  ).rows[0]
  const {
    rows: [counts],
  } = await client.query(
    'select (select count(*) from tenants)::int as tenants, (select count(*) from events)::int as events, (select count(*) from deliveries)::int as deliveries',
  )
  assert.deepEqual(
    counts,
    { tenants: 0, events: 0, deliveries: 0 },
    'Use an empty disposable database',
  )
  for (const table of ['events', 'deliveries', 'endpoints', 'tenants']) {
    await client.query(`vacuum (analyze) ${table}`)
  }
  await client.query('begin')
  await client.query("set local lock_timeout='5s'; set local statement_timeout='60s'")
  await client.query(`
    insert into tenants(id,name,created_at)
    select case when n=0 then '${tenant}'::uuid else md5('tenant-'||n)::uuid end,'query benchmark '||n,now()-interval '30 days'
    from generate_series(0,9) n;
    insert into endpoints(id,tenant_id,url,secret,created_at)
    select md5(t.id::text||'-endpoint-'||n)::uuid,t.id,'https://example.com/'||n,'test',now()-interval '30 days'
    from tenants t cross join generate_series(0,3) n;
    insert into events(id,tenant_id,idempotency_key,type,payload,status,created_at)
    select md5(n::text)::uuid,
      case when n%10=0 then '${tenant}'::uuid else md5('tenant-'||(n%10))::uuid end,
      n::text,'test',jsonb_build_object('reference',n,'message',repeat('x',32+(('x'||substr(md5('hikyaku-query-v1-payload-'||n),1,4))::bit(16)::int%481))),
      case when (('x'||substr(md5('hikyaku-query-v1-event-status-'||n),1,4))::bit(16)::int%100)<2 then 'failed'
        when (('x'||substr(md5('hikyaku-query-v1-event-status-'||n),1,4))::bit(16)::int%100)<17 then 'pending' else 'completed' end,
      now()-interval '1 second'*(('x'||substr(md5('hikyaku-query-v1-date-'||n),1,8))::bit(32)::bigint%2592000)
    from generate_series(1,200000) n;
    insert into deliveries(id,tenant_id,event_id,endpoint_id,status,created_at,updated_at)
    select md5('delivery-'||e.idempotency_key)::uuid,e.tenant_id,e.id,
      md5(e.tenant_id::text||'-endpoint-'||(('x'||substr(md5('hikyaku-query-v1-endpoint-'||e.idempotency_key),1,4))::bit(16)::int%4))::uuid,
      case when (('x'||substr(md5('hikyaku-query-v1-delivery-status-'||e.idempotency_key),1,4))::bit(16)::int%100)<5 then 'failed'
        when (('x'||substr(md5('hikyaku-query-v1-delivery-status-'||e.idempotency_key),1,4))::bit(16)::int%100)<15 then 'pending'
        when (('x'||substr(md5('hikyaku-query-v1-delivery-status-'||e.idempotency_key),1,4))::bit(16)::int%100)<20 then 'in_progress' else 'succeeded' end,
      e.created_at,least(now(),e.created_at+interval '1 hour'*(('x'||substr(md5('hikyaku-query-v1-updated-'||e.idempotency_key),1,4))::bit(16)::int%72))
    from events e;
    analyze events; analyze deliveries; analyze endpoints;
  `)
  await client.query(baselineIndexes)
  await client.query(migrationSql)
  for (const [name, query] of Object.entries(queries)) {
    expected[name] = (await client.query(query, [tenant])).rows
    if (!name.startsWith('stats_')) assert.equal(expected[name].length, 51)
  }
  const { rows: fixtureCounts } = await client.query(
    'select tenant_id,count(*)::int as count from events group by tenant_id',
  )
  assert.equal(fixtureCounts.length, 10)
  assert(fixtureCounts.every((row) => row.count === 20000))
  report.dataset.eventStatuses = (
    await client.query(
      'select status,count(*)::int as count from events where tenant_id=$1 group by status order by status',
      [tenant],
    )
  ).rows
  report.dataset.deliveryStatuses = (
    await client.query(
      'select status,count(*)::int as count from deliveries where tenant_id=$1 group by status order by status',
      [tenant],
    )
  ).rows
  report.dataset.stats = Object.fromEntries(
    Object.entries(expected).filter(([name]) => name.startsWith('stats_')),
  )
  const currentIndexes = (await client.query(indexDefinitions)).rows
  await client.query('savepoint migration_check')
  await client.query(baselineIndexes)
  const oldIndexes = (await client.query(indexDefinitions)).rows
  await client.query('savepoint before_upgrade')
  await client.query(migrationSql.split('--> statement-breakpoint')[0])
  await assert.rejects(client.query('select 1/0'), { code: '22012' })
  await client.query('rollback to savepoint before_upgrade')
  assert.deepEqual((await client.query(indexDefinitions)).rows, oldIndexes)
  await client.query(migrationSql)
  assert.deepEqual((await client.query(indexDefinitions)).rows, currentIndexes)
  for (const [name, query] of Object.entries(queries)) {
    assert.deepEqual((await client.query(query, [tenant])).rows, expected[name])
  }
  await client.query('rollback to savepoint before_upgrade')
  assert.deepEqual((await client.query(indexDefinitions)).rows, oldIndexes)
  await client.query('rollback to savepoint migration_check')
  await client.query('release savepoint migration_check')
  report.migration = {
    partialFailureRolledBack: true,
    retryPassed: true,
    rollbackPassed: true,
    resultsPreserved: true,
  }
  for (let run = 0; run < 6; run++) {
    for (const side of run % 2 === 0 ? ['baseline', 'current'] : ['current', 'baseline']) {
      await client.query('savepoint comparison')
      if (side === 'baseline') await client.query(baselineIndexes)
      for (const [name, query] of Object.entries(queries)) {
        const started = performance.now()
        const result = await client.query(query, [tenant])
        const roundTripMs = performance.now() - started
        assert.deepEqual(result.rows, expected[name], `${side} ${name} results differ`)
        const { rows } = await client.query(`explain (analyze,buffers,format json) ${query}`, [
          tenant,
        ])
        if (run > 0)
          (report.samples[side][name] ??= []).push({
            ...rows[0]['QUERY PLAN'][0],
            clientRoundTripMs: roundTripMs,
          })
      }
      await client.query('rollback to savepoint comparison')
      await client.query('release savepoint comparison')
    }
  }
  for (const name of ['events', 'events_failed', 'deliveries', 'deliveries_failed']) {
    for (const sample of report.samples.current[name]) {
      assert(
        !planNodes(sample.Plan).some((node) => node['Node Type'].includes('Sort')),
        `${name} still sorts`,
      )
    }
  }
  for (const sample of report.samples.current.events_failed) {
    const scan = planNodes(sample.Plan).find(
      (node) => node['Index Name'] === 'events_tenant_id_status_created_at_idx',
    )
    assert(scan, 'Filtered events must use the status index')
    assert.equal(scan['Actual Rows'], 51)
    assert.equal(scan['Rows Removed by Filter'] ?? 0, 0)
  }
  report.resultsIdentical = true
  report.summary = {}
  for (const name of Object.keys(queries)) {
    report.summary[name] = {}
    for (const side of ['baseline', 'current']) {
      const times = report.samples[side][name]
        .map((sample) => sample['Execution Time'])
        .sort((a, b) => a - b)
      const roundTrips = report.samples[side][name]
        .map((sample) => sample.clientRoundTripMs)
        .sort((a, b) => a - b)
      report.summary[name][side] = {
        medianMs: times[2],
        minMs: times[0],
        maxMs: times[4],
        clientRoundTripMedianMs: roundTrips[2],
        clientRoundTripMinMs: roundTrips[0],
        clientRoundTripMaxMs: roundTrips[4],
      }
    }
  }
} finally {
  try {
    await client.query('rollback')
  } finally {
    await client.end()
  }
}
console.log(JSON.stringify(report, null, 2))
