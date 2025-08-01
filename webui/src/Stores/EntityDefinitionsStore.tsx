import type {
	ClientEntityDefinition,
	EntityDefinitionUpdate,
} from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { ObservableMap, action, observable } from 'mobx'
import { ApplyDiffToStore } from './ApplyDiffToMap.js'
import { assertNever } from '~/Resources/util.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { RecentlyUsedIdsStore } from './RecentlyUsedIdsStore.js'

export class EntityDefinitionsStore {
	readonly feedbacks: EntityDefinitionsForTypeStore
	readonly actions: EntityDefinitionsForTypeStore

	readonly recentlyAddedActions: RecentlyUsedIdsStore
	readonly recentlyAddedFeedbacks: RecentlyUsedIdsStore

	constructor() {
		this.feedbacks = new EntityDefinitionsForTypeStore(EntityModelType.Feedback)
		this.actions = new EntityDefinitionsForTypeStore(EntityModelType.Action)

		this.recentlyAddedActions = new RecentlyUsedIdsStore('recent_actions', 20)
		this.recentlyAddedFeedbacks = new RecentlyUsedIdsStore('recent_feedbacks', 20)
	}

	getEntityDefinition(
		entityType: EntityModelType,
		connectionId: string,
		entityId: string
	): ClientEntityDefinition | undefined {
		return this.getEntityDefinitionsStore(entityType).connections.get(connectionId)?.get(entityId)
	}

	getEntityDefinitionsStore(entityType: EntityModelType): EntityDefinitionsForTypeStore {
		switch (entityType) {
			case EntityModelType.Action:
				return this.actions
			case EntityModelType.Feedback:
				return this.feedbacks
			default:
				assertNever(entityType)
				throw new Error(`Invalid entity type: ${entityType}`)
		}
	}

	getRecentlyUsedEntityDefinitionsStore(entityType: EntityModelType): RecentlyUsedIdsStore {
		switch (entityType) {
			case EntityModelType.Action:
				return this.recentlyAddedActions
			case EntityModelType.Feedback:
				return this.recentlyAddedFeedbacks
			default:
				assertNever(entityType)
				throw new Error(`Invalid entity type: ${entityType}`)
		}
	}
}

export class EntityDefinitionsForTypeStore {
	readonly connections = observable.map<string, ObservableMap<string, ClientEntityDefinition>>()

	readonly entityType: EntityModelType

	constructor(entityType: EntityModelType) {
		this.entityType = entityType
	}

	public updateStore = action((change: EntityDefinitionUpdate | null) => {
		if (!change) {
			this.connections.clear()
			return
		}

		const changeType = change.type
		switch (change.type) {
			case 'init':
				this.connections.clear()

				for (const [connectionId, entitySet] of Object.entries(change.definitions)) {
					if (!entitySet) continue

					this.#replaceConnection(connectionId, entitySet)
				}
				break
			case 'add-connection':
				this.#replaceConnection(change.connectionId, change.entities)
				break
			case 'forget-connection':
				this.connections.delete(change.connectionId)
				break
			case 'update-connection': {
				const connection = this.connections.get(change.connectionId)
				if (!connection) throw new Error(`Got update for unknown connection: ${change.connectionId}`)

				ApplyDiffToStore(connection, change)
				break
			}

			default:
				console.error(`Unknown entity definitions change: ${changeType}`)
				assertNever(change)
				break
		}
	})

	#replaceConnection(connectionId: string, entitySet: Record<string, ClientEntityDefinition | undefined>): void {
		const connectionEntityDefinitions = observable.map<string, ClientEntityDefinition>()
		this.connections.set(connectionId, connectionEntityDefinitions)

		for (const [entityId, entity] of Object.entries(entitySet)) {
			if (!entity) continue

			connectionEntityDefinitions.set(entityId, entity)
		}
	}
}
