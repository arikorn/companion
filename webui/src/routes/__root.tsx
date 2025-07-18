import React, { Suspense } from 'react'
import { createRootRoute, type ErrorComponentProps, Outlet } from '@tanstack/react-router'
import { ErrorFallback } from '~/Resources/Error.js'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../Resources/TRPC.js'

export const Route = createRootRoute({
	component: () => {
		return (
			<QueryClientProvider client={queryClient}>
				<Outlet />
				<Suspense>
					<TanStackRouterDevtools position="top-left" />
					<TanStackQueryDevtools />
				</Suspense>
			</QueryClientProvider>
		)
	},
	errorComponent: ({ error, reset }: ErrorComponentProps) => {
		return <ErrorFallback error={error} resetErrorBoundary={reset} />
	},
})

const TanStackRouterDevtools =
	process.env.NODE_ENV === 'production'
		? () => null // Render nothing in production
		: React.lazy(async () =>
				// Lazy load in development
				import('@tanstack/react-router-devtools').then((res) => ({
					default: res.TanStackRouterDevtools,
					// For Embedded Mode
					// default: res.TanStackRouterDevtoolsPanel
				}))
			)

const TanStackQueryDevtools =
	process.env.NODE_ENV === 'production'
		? () => null // Render nothing in production
		: React.lazy(async () =>
				// Lazy load in development
				import('@tanstack/react-query-devtools').then((res) => ({
					default: res.ReactQueryDevtools,
					// For Embedded Mode
					// default: res.TanStackRouterDevtoolsPanel
				}))
			)
