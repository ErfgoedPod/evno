import { EventEmitter } from 'events'
import { JsonLdParser } from "jsonld-streaming-parser"
import SerializerJsonld from '@rdfjs/serializer-jsonld-ext'
import { Store, Quad, NamedNode, Term, DataFactory } from 'n3'
const { quad } = DataFactory
import { Context } from 'jsonld/jsonld-spec'
import { RDF, isAllowedActivityType, isAllowedAgentType, AS, LDP, getId } from './util.js'

export interface IEventNotification {
    id: NamedNode,
    type: NamedNode[]
    actor: IEventAgent,
    target?: IEventAgent,
    origin?: IEventAgent,
    object: IEventObject,
    inReplyTo?: NamedNode,
    context?: NamedNode
}

export interface IEventObject {
    id: NamedNode,
    type: NamedNode[],
    [key: string]: any
}

export interface IEventAgent {
    id: NamedNode,
    inbox?: NamedNode,
    name?: String,
    type?: NamedNode[]
}

export default class EventNotification implements IEventNotification {
    private store: Store = new Store();
    private activity_id: NamedNode

    private constructor(quads: Quad[]) {
        this.store.addQuads(quads)

        // Get ID when undefined
        let activity_id
        for (const quad of this.store.match(null, RDF('type'), null, null)) {
            if (isAllowedActivityType(quad.object as Term)) {
                activity_id = quad.subject as NamedNode
                break
            }
        }
        if (!activity_id)
            throw Error("The activity has no identifier.")
        this.activity_id = activity_id
    }

    static create(options: {type: NamedNode, actor: IEventAgent, object: IEventObject, target?: IEventAgent, origin?: IEventAgent, inReplyTo?:NamedNode, context?: NamedNode, id?: NamedNode}): EventNotification {
        const activity_id = options.id || getId()

        const quads = [
            quad(activity_id, RDF('type'), options.type),
            quad(activity_id, AS('actor'), options.actor.id),
            quad(activity_id, AS('object'), options.object.id)
        ]

        options.target && quads.push(quad(activity_id, AS('target'), options.target.id))
        options.origin && quads.push(quad(activity_id, AS('origin'), options.origin.id))
        options.inReplyTo && quads.push(quad(activity_id, AS('inReplyTo'), options.inReplyTo))
        options.context && quads.push(quad(activity_id, AS('inReplyTo'), options.context))

        return new EventNotification(quads)
    }

    static parse(stream: EventEmitter, jsonldParser: JsonLdParser): Promise<EventNotification> {
        return new Promise((resolve, reject) => {
            const quads: Quad[] = []

            jsonldParser
                .import(stream)
                .on('data', (q) => quads.push(q))
                .on('error', (e: Error) => reject(e))
                .on('end', () => { resolve(new EventNotification(quads)) })
        })
    }

    public serialize(): Promise<string> {
        // serialize to JSON-LD
        const context: Context = { "@context": "https://www.w3.org/ns/activitystreams" }

        const serializerJsonld = new SerializerJsonld({ context, compact: true, encoding: 'string' })

        // Write quads to stream
        const output = serializerJsonld.import(this.store.match())

        return new Promise((resolve, reject) => {
            let result = ''
            output.on('data', jsonld => {
                result += jsonld
            })
            output.on('error', (e) => reject(e))
            output.on('end', async () => {
                resolve(result)
            })
        })
    }

    public isType(type: NamedNode) {
        return !!this.type.find((t) => t.equals(type))
    }

    private getAgentByPredicate(predicate: NamedNode) {
        const agent_id = this.store.getObjects(this.activity_id, predicate, null)[0]

        const inboxArr = this.store.getObjects(agent_id, LDP('inbox'), null)
        const nameArr = this.store.getObjects(agent_id, AS('name'), null)

        return {
            id: agent_id as NamedNode,
            inbox: !inboxArr.length ? undefined : inboxArr[0] as NamedNode,
            name: !nameArr.length ? undefined : nameArr[0].value,
            type: this.store.getObjects(agent_id, RDF('type'), null).filter(isAllowedAgentType) as NamedNode[]
        }
    }

    get type(): NamedNode[] {
        const objects = this.store
            .getObjects(this.activity_id, RDF('type'), null)
            .filter(isAllowedActivityType)

        return objects as NamedNode[]
    }

    get id(): NamedNode {
        return this.activity_id
    }

    get actor(): IEventAgent {
        return this.getAgentByPredicate(AS('actor'))
    }

    get target(): IEventAgent {
        return this.getAgentByPredicate(AS('target'))
    }

    get origin(): IEventAgent {
        return this.getAgentByPredicate(AS('origin'))
    }

    get object(): IEventObject {
        const object_id = this.store.getObjects(this.activity_id, AS('object'), null)[0]
        return {
            id: object_id as NamedNode,
            type: this.store.getObjects(object_id, RDF('type'), null).filter(isAllowedAgentType) as NamedNode[]
        }
    }

    get inReplyTo(): NamedNode | undefined {
        const arr = this.store.getObjects(this.activity_id, AS('inReplyTo'), null)
        return !arr.length ? undefined : arr[0] as NamedNode
    }
}