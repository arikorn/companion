import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { CButtonGroup, CButton } from '@coreui/react'
import { faPlay, faUndo, faRedo } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback } from 'react'
import { trpc, useMutationExt } from '~/TRPC'
import { MyErrorBoundary } from '~/util.js'

export function ControlHotPressButtons({
	location,
	showRotaries,
}: {
	location: ControlLocation
	showRotaries: boolean
}): React.JSX.Element {
	const hotPressMutation = useMutationExt(trpc.controls.hotPressControl.mutationOptions())
	const hotRotateMutation = useMutationExt(trpc.controls.hotRotateControl.mutationOptions())

	const hotPressDown = useCallback(() => {
		hotPressMutation
			.mutateAsync({ location, direction: true, surfaceId: 'edit' })
			.catch((e) => console.error(`Hot press failed: ${e}`))
	}, [hotPressMutation, location])
	const hotPressUp = useCallback(() => {
		hotPressMutation
			.mutateAsync({ location, direction: false, surfaceId: 'edit' })
			.catch((e) => console.error(`Hot press failed: ${e}`))
	}, [hotPressMutation, location])
	const hotRotateLeft = useCallback(() => {
		hotRotateMutation
			.mutateAsync({ location, direction: false, surfaceId: 'edit' })
			.catch((e) => console.error(`Hot rotate failed: ${e}`))
	}, [hotRotateMutation, location])
	const hotRotateRight = useCallback(() => {
		hotRotateMutation
			.mutateAsync({ location, direction: true, surfaceId: 'edit' })
			.catch((e) => console.error(`Hot rotate failed: ${e}`))
	}, [hotRotateMutation, location])

	return (
		<>
			<CButtonGroup>
				<CButton
					className="ms-1"
					color="warning"
					onMouseDown={hotPressDown}
					onMouseUp={hotPressUp}
					style={{ color: 'white' }}
					title="Test press button"
				>
					<FontAwesomeIcon icon={faPlay} />
					&nbsp;Test
				</CButton>
			</CButtonGroup>
			{showRotaries && (
				<MyErrorBoundary>
					<CButton
						className="ms-1"
						color="warning"
						onMouseDown={hotRotateLeft}
						style={{ color: 'white' }}
						title="Test rotate left"
					>
						<FontAwesomeIcon icon={faUndo} />
					</CButton>

					<CButton
						className="ms-1"
						color="warning"
						onMouseDown={hotRotateRight}
						style={{ color: 'white' }}
						title="Test rotate right"
					>
						<FontAwesomeIcon icon={faRedo} />
					</CButton>
				</MyErrorBoundary>
			)}
		</>
	)
}
