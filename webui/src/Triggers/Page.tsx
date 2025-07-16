import React, { useCallback, useContext, useMemo, useRef } from 'react'
import { CButton, CButtonGroup, CCol, CFormSwitch, CRow } from '@coreui/react'
import { makeAbsolutePath, useComputed } from '~/util.js'
import dayjs from 'dayjs'
import sanitizeHtml from 'sanitize-html'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	faAdd,
	faClone,
	faDownload,
	faFileExport,
	faLayerGroup,
	faList,
	faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { GenericConfirmModal, GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { CreateTriggerControlId, ParseControlId } from '@companion-app/shared/ControlId.js'
import { ConfirmExportModal, ConfirmExportModalRef } from '~/Components/ConfirmExportModal.js'
import { ClientTriggerData, TriggerCollection } from '@companion-app/shared/Model/TriggerModel.js'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { useTriggerCollectionsApi } from './TriggerCollectionsApi'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper'
import { CollectionsNestingTable } from '~/Components/CollectionsNestingTable/CollectionsNestingTable'
import { TriggersTableContextProvider, useTriggersTableContext } from './TriggersTableContext'
import { trpc, useMutationExt } from '~/TRPC'

export const TriggersPage = observer(function Triggers() {
	const { triggersList } = useContext(RootAppStoreContext)

	const navigate = useNavigate({ from: '/triggers' })

	const createMutation = useMutationExt(trpc.controls.triggers.create.mutationOptions())

	const doAddNew = useCallback(() => {
		createMutation
			.mutateAsync()
			.then(async (controlId) => {
				console.log('created trigger', controlId)

				const parsedId = ParseControlId(controlId)
				if (parsedId?.type !== 'trigger') return

				await navigate({ to: `/triggers/${parsedId.trigger}` })
			})
			.catch((e) => {
				console.error('failed to create trigger', e)
			})
	}, [createMutation, navigate])

	const exportModalRef = useRef<ConfirmExportModalRef>(null)
	const showExportModal = useCallback(() => {
		exportModalRef.current?.show(makeAbsolutePath(`/int/export/triggers/all`))
	}, [])

	const confirmModalRef = useRef<GenericConfirmModalRef>(null)
	const triggerGroupsApi = useTriggerCollectionsApi(confirmModalRef)

	const allTriggers = useComputed(() => {
		const allTriggers: TriggerDataWithId[] = []

		for (const [triggerId, trigger] of triggersList.triggers) {
			const parsedId = ParseControlId(triggerId)
			if (!parsedId || parsedId.type !== 'trigger') continue
			allTriggers.push({ ...trigger, id: parsedId.trigger, collectionId: trigger.collectionId || null })
		}

		return allTriggers
	}, [triggersList.triggers])

	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/triggers/$controlId' })
	const selectedTriggerId = routeMatch ? routeMatch.controlId : null

	const selectTrigger = useCallback(
		(triggerId: string | null) => {
			if (triggerId === null) {
				void navigate({ to: '/triggers' })
			} else {
				void navigate({
					to: `/triggers/$controlId`,
					params: {
						controlId: triggerId,
					},
				})
			}
		},
		[navigate]
	)

	return (
		<CRow className="triggers-page split-panels">
			<GenericConfirmModal ref={confirmModalRef} />
			<ConfirmExportModal ref={exportModalRef} title="Export Triggers" />

			<CCol xs={12} xl={6} className="primary-panel">
				<h4>Triggers</h4>
				<p style={{ marginBottom: '0.5rem' }}>
					Triggers allow you to automate Companion by running actions when certain events occur, such as feedback or
					variable updates.
				</p>

				<div className="mb-2">
					<CButtonGroup>
						<CButton color="primary" onClick={doAddNew} size="sm">
							<FontAwesomeIcon icon={faAdd} /> Add Trigger
						</CButton>
						<CreateCollectionButton />
					</CButtonGroup>

					<CButton color="secondary" className="right" size="sm" onClick={showExportModal}>
						<FontAwesomeIcon icon={faFileExport} /> Export all
					</CButton>
				</div>

				<PanelCollapseHelperProvider
					storageId="trigger-groups"
					knownPanelIds={triggersList.allCollectionIds}
					defaultCollapsed
				>
					<TriggersTableContextProvider deleteModalRef={confirmModalRef} selectTrigger={selectTrigger}>
						<CollectionsNestingTable<TriggerCollection, TriggerDataWithId>
							// Heading={TriggerListTableHeading}
							NoContent={TriggerListNoContent}
							ItemRow={TriggerItemRow}
							GroupHeaderContent={TriggerGroupHeaderContent}
							itemName="trigger"
							dragId="trigger"
							collectionsApi={triggerGroupsApi}
							collections={triggersList.rootCollections()}
							items={allTriggers}
							selectedItemId={selectedTriggerId}
						/>
					</TriggersTableContextProvider>
				</PanelCollapseHelperProvider>
			</CCol>

			<CCol xs={12} xl={6} className="secondary-panel">
				<Outlet />
			</CCol>
		</CRow>
	)
})

export interface TriggerDataWithId extends Omit<ClientTriggerData, 'collectionId'> {
	id: string
	collectionId: string | null
}

const tableDateFormat = 'MM/DD HH:mm:ss'

function TriggerListNoContent() {
	return <NonIdealState icon={faList} text="There are currently no triggers or scheduled tasks." />
}

function TriggerItemRow(item: TriggerDataWithId) {
	return <TriggersTableRow item={item} />
}

function TriggerGroupHeaderContent({ collection }: { collection: TriggerCollection }) {
	const setEnabledMutation = useMutationExt(trpc.controls.triggers.collections.setEnabled.mutationOptions())

	const setEnabled = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const enabled = e.target.checked

			setEnabledMutation.mutateAsync({ collectionId: collection.id, enabled }).catch((e: any) => {
				console.error('Failed to reorder collection', e)
			})
		},
		[setEnabledMutation, collection.id]
	)

	return (
		<CFormSwitch
			className="ms-1"
			color="success"
			checked={collection.metaData.enabled}
			onChange={setEnabled}
			title={collection.metaData.enabled ? 'Disable collection' : 'Enable collection'}
			size="xl"
		/>
	)
}

interface TriggersTableRowProps {
	item: TriggerDataWithId
}

const TriggersTableRow = observer(function TriggersTableRow2({ item }: TriggersTableRowProps) {
	const tableContext = useTriggersTableContext()

	const deleteMutation = useMutationExt(trpc.controls.triggers.delete.mutationOptions())
	const cloneMutation = useMutationExt(trpc.controls.triggers.clone.mutationOptions())

	const setOptionsFieldMutation = useMutationExt(trpc.controls.setOptionsField.mutationOptions())

	const doEnableDisable = useCallback(() => {
		setOptionsFieldMutation
			.mutateAsync({
				controlId: CreateTriggerControlId(item.id),
				key: 'enabled',
				value: !item.enabled,
			})
			.catch((e) => {
				console.error('failed to toggle trigger state', e)
			})
	}, [setOptionsFieldMutation, item.id, item.enabled])
	const doDelete = useCallback(() => {
		tableContext.deleteModalRef.current?.show(
			'Delete trigger',
			'Are you sure you wish to delete this trigger?',
			'Delete',
			() => {
				deleteMutation.mutateAsync({ controlId: CreateTriggerControlId(item.id) }).catch((e) => {
					console.error('Failed to delete', e)
				})
			}
		)
	}, [deleteMutation, tableContext.deleteModalRef, item.id])
	const doEdit = useCallback(() => {
		tableContext.selectTrigger(item.id)
	}, [tableContext, item.id])
	const doClone = useCallback(() => {
		cloneMutation
			.mutateAsync({ controlId: CreateTriggerControlId(item.id) })
			.then((newControlId) => {
				console.log('cloned to control', newControlId)
			})
			.catch((e) => {
				console.error('Failed to clone', e)
			})
	}, [cloneMutation, item.id])

	const descriptionHtml = useMemo(
		() => ({
			__html: sanitizeHtml(item.description || 'No events', {
				allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
				disallowedTagsMode: 'escape',
			}),
		}),
		[item.description]
	)

	return (
		<div onClick={doEdit} className="flex flex-row align-items-center gap-2 hand">
			<div className="flex flex-column grow">
				<b>{item.name}</b>
				<br />
				<span dangerouslySetInnerHTML={descriptionHtml} />
				<br />
				{item.lastExecuted ? <small>Last run: {dayjs(item.lastExecuted).format(tableDateFormat)}</small> : ''}
			</div>

			<div className="action-buttons w-auto">
				<CButtonGroup>
					<CFormSwitch
						className="ms-1"
						color="success"
						checked={item.enabled}
						onChange={doEnableDisable}
						title={item.enabled ? 'Disable trigger' : 'Enable trigger'}
						size="xl"
					/>

					<CButton
						color="white"
						href={makeAbsolutePath(`/int/export/triggers/single/${item.id}`)}
						target="_blank"
						title="Export"
					>
						<FontAwesomeIcon icon={faDownload} />
					</CButton>
					<CButton color="white" onClick={doClone} title="Clone">
						<FontAwesomeIcon icon={faClone} />
					</CButton>
					<CButton color="gray" onClick={doDelete} title="Delete">
						<FontAwesomeIcon icon={faTrash} />
					</CButton>
				</CButtonGroup>
			</div>
		</div>
	)
})

function CreateCollectionButton() {
	const createMutation = useMutationExt(trpc.controls.triggers.collections.add.mutationOptions())

	const doCreateCollection = useCallback(() => {
		createMutation.mutateAsync({ collectionName: 'New Collection' }).catch((e) => {
			console.error('Failed to add collection', e)
		})
	}, [createMutation])

	return (
		<CButton color="info" size="sm" onClick={doCreateCollection}>
			<FontAwesomeIcon icon={faLayerGroup} /> Create Collection
		</CButton>
	)
}
