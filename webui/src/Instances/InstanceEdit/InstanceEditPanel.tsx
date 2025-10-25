import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { CCol, CButton, CFormSelect, CAlert, CForm, CFormLabel, CFormSwitch } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faCircleExclamation, faGear, faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import type { ClientInstanceConfigBase, InstanceVersionUpdatePolicy } from '@companion-app/shared/Model/Instance.js'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { InstanceEditField } from '~/Instances/InstanceEdit/InstanceEditField.js'
import type { ClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { InstanceVersionChangeButton } from '../../Instances/InstanceEdit/InstanceVersionChangeButton.js'
import { doesInstanceVersionExist } from '~/Instances/VersionUtil.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { InstanceSecretField } from '~/Instances/InstanceEdit/InstanceSecretField.js'
import { InstanceEditPanelStore, isConfigFieldSecret } from '~/Instances/InstanceEdit/InstanceEditPanelStore.js'
import { observable } from 'mobx'
import { TextInputField } from '~/Components/TextInputField.js'
import classNames from 'classnames'
import { InlineHelp } from '~/Components/InlineHelp.js'
import { getModuleVersionInfo } from '~/Instances/Util.js'
import type { InstanceEditPanelService } from '~/Instances/InstanceEdit/InstanceEditPanelService.js'
import { capitalize } from 'lodash-es'

interface InstanceGenericEditPanelProps<TConfig extends ClientInstanceConfigBase> {
	instanceInfo: TConfig
	service: InstanceEditPanelService<TConfig>
	changeModuleDangerMessage: React.ReactNode
}

export const InstanceGenericEditPanel = observer(function InstanceGenericEditPanel<
	TConfig extends ClientInstanceConfigBase,
>({ instanceInfo, service, changeModuleDangerMessage }: InstanceGenericEditPanelProps<TConfig>) {
	const { modules } = useContext(RootAppStoreContext)

	const panelStore = useMemo(() => new InstanceEditPanelStore(service, instanceInfo), [service, instanceInfo])

	// Ensure a reload happens each time the version changes
	useEffect(() => {
		panelStore.triggerReload()
	}, [panelStore, instanceInfo.moduleId, instanceInfo.moduleVersionId])

	const moduleInfo = modules.getModuleInfo(panelStore.instanceInfo.moduleType, panelStore.instanceInfo.moduleId)

	const instanceVersionExists = doesInstanceVersionExist(moduleInfo, panelStore.instanceInfo.moduleVersionId)
	const instanceShouldBeRunning =
		panelStore.instanceInfo.enabled &&
		instanceVersionExists &&
		service.isCollectionEnabled(panelStore.instanceInfo.collectionId)

	const isSaving = observable.box(false)
	const [saveError, setSaveError] = useState<string | null>(null)
	const performSave = useCallback(() => {
		if (isSaving.get()) return
		setSaveError(null)

		// Bail early if the form is not dirty
		if (!panelStore.isDirty()) return

		isSaving.set(true)

		Promise.resolve()
			.then(async () => {
				const error = await service.saveConfig(instanceShouldBeRunning, panelStore)

				setSaveError(error)
				isSaving.set(false)
			})
			.catch((error) => {
				isSaving.set(false)
				setSaveError(`Failed to save ${capitalize(service.moduleTypeDisplayName)}: ${error.message || error}`)
				console.error('Failed to save instance:', error)
			})
	}, [service, panelStore, isSaving, instanceShouldBeRunning])

	// Trigger a reload/unload of the instance config when the instance transitions to be running
	useEffect(() => {
		if (instanceShouldBeRunning) {
			panelStore.triggerReload()
		} else {
			panelStore.unloadConfigAndSecrets()
		}
	}, [panelStore, instanceShouldBeRunning])

	return (
		<>
			<CForm
				className="secondary-panel-simple-body d-flex flex-column pb-0"
				onSubmit={(e) => {
					e.preventDefault()
					e.stopPropagation()
					performSave()
				}}
			>
				<div className="flex-fill">
					<div className="row edit-connection">
						{saveError && (
							<CCol className="fieldtype-textinput" sm={12}>
								<CAlert color="danger">{saveError}</CAlert>
							</CCol>
						)}

						<InstanceLabelInputField panelStore={panelStore} />
						<InstanceEnabledInputField panelStore={panelStore} />

						<InstanceModuleVersionInputField
							panelStore={panelStore}
							moduleInfo={moduleInfo}
							changeModuleDangerMessage={changeModuleDangerMessage}
						/>

						<InstanceVersionUpdatePolicyInputField panelStore={panelStore} />

						{!instanceShouldBeRunning && (
							<CCol xs={12}>
								<NonIdealState icon={faGear}>
									<p>
										{capitalize(service.moduleTypeDisplayName)} configuration cannot be edited while it is disabled. The
										fields above can be edited.
									</p>
								</NonIdealState>
							</CCol>
						)}

						{instanceShouldBeRunning && (panelStore.isLoading || panelStore.loadError) && (
							<CCol xs={12}>
								<LoadingRetryOrError
									error={panelStore.loadError}
									dataReady={!panelStore.isLoading}
									doRetry={panelStore.triggerReload}
									design="pulse"
								/>
							</CCol>
						)}

						{instanceShouldBeRunning && !panelStore.isLoading && <InstanceConfigFields panelStore={panelStore} />}
					</div>
				</div>

				<InstanceFormButtons
					panelStore={panelStore}
					instanceShouldBeRunning={instanceShouldBeRunning}
					isSaving={isSaving.get()}
				/>
			</CForm>
		</>
	)
})

function InstanceFieldLabel({ fieldInfo }: { fieldInfo: SomeCompanionInputField }) {
	return (
		<>
			{fieldInfo.label}
			{fieldInfo.tooltip && (
				<InlineHelp help={fieldInfo.tooltip}>
					<FontAwesomeIcon style={{ marginLeft: '5px' }} icon={faQuestionCircle} />
				</InlineHelp>
			)}
		</>
	)
}

const InstanceLabelInputField = observer(function InstanceLabelInputField<TConfig extends ClientInstanceConfigBase>({
	panelStore,
}: {
	panelStore: InstanceEditPanelStore<TConfig>
}): React.JSX.Element {
	return (
		<>
			<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">Label</CFormLabel>
			<CCol className={`fieldtype-textinput`} sm={8}>
				<TextInputField
					setValue={panelStore.setLabelValue}
					checkValid={panelStore.checkLabelIsValid}
					value={panelStore.labelValue}
				/>
			</CCol>
		</>
	)
})

const InstanceModuleVersionInputField = observer(function InstanceModuleVersionInputField<
	TConfig extends ClientInstanceConfigBase,
>({
	panelStore,
	moduleInfo,
	changeModuleDangerMessage,
}: {
	panelStore: InstanceEditPanelStore<TConfig>
	moduleInfo: ClientModuleInfo | undefined
	changeModuleDangerMessage: React.ReactNode
}): React.JSX.Element {
	const moduleVersion = getModuleVersionInfo(moduleInfo, panelStore.instanceInfo.moduleVersionId)

	return (
		<>
			<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">Module Version</CFormLabel>
			<CCol className={`fieldtype-textinput`} sm={8}>
				<div className="d-flex align-items-center gap-2">
					<span className="fw-medium">{moduleVersion?.displayName ?? panelStore.instanceInfo.moduleVersionId}</span>

					<InstanceVersionChangeButton
						service={panelStore.service}
						currentModuleId={panelStore.instanceInfo.moduleId}
						currentVersionId={panelStore.instanceInfo.moduleVersionId}
						changeModuleDangerMessage={changeModuleDangerMessage}
					/>
				</div>
			</CCol>
		</>
	)
})

const InstanceEnabledInputField = observer(function InstanceEnabledInputField<
	TConfig extends ClientInstanceConfigBase,
>({ panelStore }: { panelStore: InstanceEditPanelStore<TConfig> }): React.JSX.Element {
	return (
		<>
			<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">Enabled</CFormLabel>
			<CCol className={`fieldtype-textinput`} sm={8}>
				<CFormSwitch checked={panelStore.enabled} onChange={(e) => panelStore.setEnabled(e.target.checked)} size="xl" />
			</CCol>
		</>
	)
})

const InstanceVersionUpdatePolicyInputField = observer(function InstanceVersionUpdatePolicyInputField<
	TConfig extends ClientInstanceConfigBase,
>({ panelStore }: { panelStore: InstanceEditPanelStore<TConfig> }): React.JSX.Element {
	return (
		<>
			<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">
				Update Policy
				<InlineHelp
					help={`How to check whether there are updates available for this ${panelStore.service.moduleTypeDisplayName}`}
				>
					<FontAwesomeIcon style={{ marginLeft: '5px' }} icon={faQuestionCircle} />
				</InlineHelp>
			</CFormLabel>
			<CCol className={`fieldtype-textinput`} sm={8}>
				<CFormSelect
					name="colFormUpdatePolicy"
					value={panelStore.updatePolicy}
					onChange={(e) => panelStore.setUpdatePolicy(e.currentTarget.value as InstanceVersionUpdatePolicy)}
				>
					<option value="manual">Disabled</option>
					<option value="stable">Stable</option>
					<option value="beta">Stable and Beta</option>
				</CFormSelect>
			</CCol>
		</>
	)
})

const InstanceConfigFields = observer(function InstanceConfigFields<TConfig extends ClientInstanceConfigBase>({
	panelStore,
}: {
	panelStore: InstanceEditPanelStore<TConfig>
}): React.JSX.Element {
	const configData = panelStore.configAndSecrets

	if (!configData) {
		return <NonIdealState icon={faCircleExclamation}>No config data loaded</NonIdealState>
	}

	if (configData.fields.length === 0) {
		return (
			<NonIdealState icon={faCheck}>
				{capitalize(panelStore.service.moduleTypeDisplayName)} has no configuration
			</NonIdealState>
		)
	}

	return (
		<>
			<hr className="my-3" />
			{configData.fields.map((fieldInfo) => {
				const isVisible = panelStore.isVisible(fieldInfo)
				if (!isVisible) return null

				const isSecret = isConfigFieldSecret(fieldInfo)
				if (isSecret) {
					return (
						<CCol
							className={`fieldtype-${fieldInfo.type}`}
							sm={fieldInfo.width}
							style={{ display: !isVisible ? 'none' : undefined }}
						>
							<CFormLabel>
								<InstanceFieldLabel fieldInfo={fieldInfo} />
							</CFormLabel>
							<InstanceSecretField
								definition={fieldInfo}
								value={configData.secrets[fieldInfo.id]}
								setValue={(value) => panelStore.setConfigValue(fieldInfo.id, value)}
							/>
							{fieldInfo.description && <div className="form-text">{fieldInfo.description}</div>}
						</CCol>
					)
				} else {
					// Hide certain fields when in 'xs' column size, to avoid unexpected padding
					const hideInXs = fieldInfo.type === 'static-text' && !fieldInfo.label && !fieldInfo.value

					return (
						<CCol
							className={classNames(`fieldtype-${fieldInfo.type}`, { 'd-none': hideInXs, 'd-sm-block': hideInXs })}
							sm={fieldInfo.width}
							style={{ display: !isVisible ? 'none' : undefined }}
						>
							<CFormLabel>
								<InstanceFieldLabel fieldInfo={fieldInfo} />
							</CFormLabel>
							<InstanceEditField
								definition={fieldInfo}
								value={configData.config[fieldInfo.id]}
								setValue={(value) => panelStore.setConfigValue(fieldInfo.id, value)}
								moduleType={panelStore.instanceInfo.moduleType}
								instanceId={panelStore.service.instanceId}
							/>
							{fieldInfo.description && <div className="form-text">{fieldInfo.description}</div>}
						</CCol>
					)
				}
			})}
		</>
	)
})

const InstanceFormButtons = observer(function InstanceFormButtons<TConfig extends ClientInstanceConfigBase>({
	panelStore,
	isSaving,
	instanceShouldBeRunning,
}: {
	panelStore: InstanceEditPanelStore<TConfig>
	isSaving: boolean
	instanceShouldBeRunning: boolean
}): React.JSX.Element {
	const isValid = panelStore.isValid()

	const isLoading = instanceShouldBeRunning && panelStore.isLoading

	const doDelete = useCallback(() => panelStore.service.deleteInstance(panelStore.labelValue), [panelStore])

	return (
		<div className="row connection-form-buttons border-top">
			<CCol sm={12}>
				<div className="flex flex-row">
					<div className="grow">
						<CButton
							color="success"
							className="me-md-1"
							disabled={isLoading || isSaving || !isValid || !panelStore.isDirty()}
							type="submit"
							title={!isValid ? 'Please fix the errors before saving' : undefined}
						>
							Save {isSaving ? '...' : ''}
						</CButton>

						<CButton color="secondary" onClick={panelStore.service.closePanel} disabled={isSaving || isLoading}>
							Cancel
						</CButton>
					</div>

					<div>
						<CButton color="danger" onClick={doDelete} disabled={isSaving || isLoading}>
							Delete
						</CButton>
					</div>
				</div>
			</CCol>
		</div>
	)
})
