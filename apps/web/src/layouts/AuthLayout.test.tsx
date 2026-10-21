// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { AuthLayout } from '@/layouts/AuthLayout'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  document.body.removeChild(container)
})

it('keeps the split feature panel in the DOM and hides it below lg', async () => {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <AuthLayout
          variant="split"
          eyebrow="Sign in"
          title="Welcome back"
          sidePanel={<p>Delivery console</p>}
        >
          <form aria-label="Sign in">Sign in</form>
        </AuthLayout>
      </MemoryRouter>,
    )
  })

  const copy = container.querySelector('.auth-split-copy')
  const wrap = copy?.closest('.overflow-hidden')
  const main = container.querySelector('#main-content')

  expect(copy?.textContent).toContain('Delivery console')
  expect(wrap?.className.split(/\s+/)).toEqual(
    expect.arrayContaining(['hidden', 'lg:flex', 'lg:flex-col', 'lg:w-1/2']),
  )
  expect(wrap?.className.split(/\s+/)).not.toContain('flex')
  expect(main?.className).toContain('items-start')
  expect(main?.className).toContain('px-6')
  expect(container.textContent).toContain('Home')
  expect(container.querySelector('form[aria-label="Sign in"]')).not.toBeNull()
})
