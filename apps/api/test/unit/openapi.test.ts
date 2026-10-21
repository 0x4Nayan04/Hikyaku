import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { parseDocument } from 'yaml'
import { describe, expect, it } from 'vitest'
import { DELIVERY_STATUSES, ENDPOINT_STATUSES, EVENT_STATUSES } from '@hikyaku/shared/constants'

type Operation = {
  operationId: string
  security: Array<Record<string, never[]>>
  parameters?: Array<{ name?: string; in?: string; required?: boolean; $ref?: string }>
  responses: Record<string, unknown>
}
type Spec = {
  openapi: string
  paths: Record<string, Record<string, Operation>>
  components: {
    schemas: Record<string, { properties: Record<string, { enum?: string[] }> }>
    securitySchemes: Record<string, { name?: string }>
  }
}

const root = fileURLToPath(new URL('../../../../', import.meta.url))
const source = readFileSync(path.join(root, 'docs/openapi.yaml'), 'utf8')
const document = parseDocument(source, { uniqueKeys: true })
const spec = document.toJS() as Spec

function readSource(filename: string): ts.SourceFile {
  return ts.createSourceFile(filename, readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true)
}

function visit(node: ts.Node, callback: (node: ts.Node) => void): void {
  callback(node)
  ts.forEachChild(node, (child) => visit(child, callback))
}

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(dir, entry.name)
    return entry.isDirectory() ? routeFiles(filename) : filename.endsWith('.ts') ? [filename] : []
  })
}

/** Read registrations without importing the app, opening DB/Redis, or executing handlers. */
function registeredOperations() {
  const mounts = new Map<string, string>()
  const server = readSource(path.join(root, 'apps/api/src/server.ts'))
  visit(server, (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return
    if (node.expression.expression.getText(server) !== 'app' || node.expression.name.text !== 'use')
      return
    const [prefix, router] = node.arguments
    if (prefix && ts.isStringLiteral(prefix) && router && ts.isIdentifier(router)) {
      mounts.set(router.text, prefix.text)
    }
  })

  const operations: Array<{ method: string; pathname: string; middleware: string[] }> = []
  const seenRouters = new Set<string>()
  for (const filename of routeFiles(path.join(root, 'apps/api/src/routes'))) {
    const file = readSource(filename)
    const routers = new Set<string>()
    visit(file, (node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        ts.isCallExpression(node.initializer) &&
        node.initializer.expression.getText(file) === 'Router'
      )
        routers.add(node.name.text)
    })
    for (const router of routers) {
      expect(mounts.has(router), `Mount for ${router}`).toBe(true)
      seenRouters.add(router)
    }
    visit(file, (node) => {
      if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return
      const router = node.expression.expression.getText(file)
      if (!routers.has(router)) return
      const method = node.expression.name.text
      // Fail explicitly if a new registration uses a pattern this guard cannot inspect.
      expect(['get', 'post', 'patch', 'put', 'delete', 'head', 'options']).toContain(method)
      const [route, ...handlers] = node.arguments
      if (!route || !ts.isStringLiteral(route)) throw new Error(`Non-literal route in ${filename}`)
      operations.push({
        method,
        pathname: `${mounts.get(router)}${route.text}`.replace(/:([A-Za-z_][\w]*)/g, '{$1}'),
        middleware: handlers.map((handler) => handler.getText(file)),
      })
    })
  }
  expect([...seenRouters].sort()).toEqual([...mounts.keys()].sort())
  return operations
}

describe('OpenAPI contract', () => {
  it('parses without duplicate YAML keys and resolves all local references', () => {
    expect(document.errors).toEqual([])
    expect(spec.openapi).toBe('3.1.0')
    const inspect = (value: unknown): void => {
      if (!value || typeof value !== 'object') return
      for (const [key, child] of Object.entries(value)) {
        if (key === '$ref') {
          expect(typeof child).toBe('string')
          const pointer = String(child)
          expect(pointer.startsWith('#/')).toBe(true)
          const target = pointer
            .slice(2)
            .split('/')
            .reduce<unknown>((current, segment) => {
              if (!current || typeof current !== 'object') return undefined
              return Reflect.get(current, segment.replaceAll('~1', '/').replaceAll('~0', '~'))
            }, spec)
          expect(target, pointer).toBeDefined()
        } else inspect(child)
      }
    }
    inspect(spec)
  })

  it('covers exactly the mounted route methods, including multiline registrations', () => {
    const actual = registeredOperations().map(({ method, pathname }) => `${method} ${pathname}`)
    const documented = Object.entries(spec.paths).flatMap(([pathname, item]) =>
      Object.keys(item).map((method) => `${method} ${pathname}`),
    )
    expect(documented.sort()).toEqual(actual.sort())
    const ids = Object.values(spec.paths).flatMap((item) =>
      Object.values(item).map((op) => op.operationId),
    )
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('preserves the registered auth boundary and documents mutation origins and path parameters', () => {
    for (const { method, pathname, middleware } of registeredOperations()) {
      const operation = spec.paths[pathname][method]
      let expectedSecurity: Operation['security'] = []
      if (middleware.includes('requireTenantAuth')) {
        expectedSecurity = [{ ingestBearer: [] }, { sessionCookie: [] }]
      } else if (
        middleware.some((name) =>
          ['requireTenantSessionAuth', 'requireSession', 'requireSuperAdmin'].includes(name),
        )
      ) {
        expectedSecurity = [{ sessionCookie: [] }]
      } else if (pathname === '/v1/auth/bootstrap') {
        expectedSecurity = [{ bootstrapSecret: [] }]
      }
      expect(operation.security, `${method} ${pathname}`).toEqual(expectedSecurity)
      if (method !== 'get') {
        expect(operation.parameters).toContainEqual({ $ref: '#/components/parameters/Origin' })
      }
      for (const [, name] of pathname.matchAll(/\{([^}]+)\}/g)) {
        expect(operation.parameters).toContainEqual(
          expect.objectContaining({ name, in: 'path', required: true }),
        )
      }
      expect(operation.responses.default).toBeDefined()
      if (middleware.includes('requireSuperAdmin')) expect(operation.responses['403']).toBeDefined()
    }
    expect(spec.components.securitySchemes.sessionCookie.name).toBe('sid')
    expect(spec.components.securitySchemes.bootstrapSecret.name).toBe('X-Admin-Secret')
  })

  it('keeps status enums aligned with the shared API constants', () => {
    const schemas = spec.components.schemas
    expect(schemas.Event.properties.status.enum).toEqual([...EVENT_STATUSES])
    expect(schemas.Delivery.properties.status.enum).toEqual([...DELIVERY_STATUSES])
    expect(schemas.Endpoint.properties.status.enum).toEqual([...ENDPOINT_STATUSES])
  })
})
