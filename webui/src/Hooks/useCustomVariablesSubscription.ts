import { useState } from 'react'
import type { VariablesStore } from '~/Stores/VariablesStore.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/TRPC'

export function useCustomVariablesSubscription(
	store: VariablesStore,
	setLoadError?: ((error: string | null) => void) | undefined
): boolean {
	const [ready, setReady] = useState(false)

	useSubscription(
		trpc.customVariables.watch.subscriptionOptions(undefined, {
			onStarted: () => {
				setLoadError?.(null)
				store.updateCustomVariables(null)
				setReady(false)
			},
			onData: (data) => {
				setLoadError?.(null)
				store.updateCustomVariables(data)
				setReady(true)
			},
			onError: (error) => {
				setLoadError?.(`Failed to load custom-variables list: ${error.message}`)
				console.error('Failed to load custom-variables list:', error)
				store.updateCustomVariables(null)
			},
		})
	)

	return ready
}
