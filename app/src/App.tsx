import { Suspense } from 'react'
import { RouterProvider } from 'react-router'
import { createRouter } from '@/shell/router'

// Created at module level so that, in development, adding a screen folder rebuilds the routes.
const router = createRouter()

export function App() {
  return (
    <Suspense fallback={null}>
      <RouterProvider router={router} />
    </Suspense>
  )
}
