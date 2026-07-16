type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

type DocsApiRouteProps = {
  method: HttpMethod
  path: string
}

export function DocsApiRoute({ method, path }: DocsApiRouteProps) {
  return (
    <span className="docs-v2-api-route">
      <span className={`docs-v2-method docs-v2-method--${method.toLowerCase()}`}>{method}</span>
      <code className="docs-v2-api-route-path">{path}</code>
    </span>
  )
}
