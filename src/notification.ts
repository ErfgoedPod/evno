import { IEventNotification, IEventAgent, IEventObject } from "./interfaces.js"
import { EventEmitter } from 'events'
import SerializerJsonld from '@rdfjs/serializer-jsonld-ext'
import { Store, Quad, NamedNode, Term, DataFactory, Literal } from 'n3'
const { quad } = DataFactory
import { Context } from 'jsonld/jsonld-spec'
import { RDF, isAllowedActivityType, isAllowedAgentType, isAllowedObjectProperty, AS, LDP, getId, isNamedNode } from './util.js'
import { Sink, Stream } from 'rdf-js'

function agentToQuads(agent: IEventAgent): Quad[] {
    const quads: Quad[] = []
    agent.inbox && quads.push(quad(agent.id, LDP('inbox'), agent.inbox))
    agent.name && quads.push(quad(agent.id, AS('name'), agent.name))
    agent.type && agent.type.forEach((t) => quads.push(quad(agent.id, RDF('type'), t)))
    return quads
}

function objectToQuads(object: IEventObject): Quad[] {
    const quads: Quad[] = []
    object.type.forEach((t) => quads.push(quad(object.id, RDF('type'), t)))

    for (const property in object) {
        const object_property = AS(property)
        if (isAllowedObjectProperty(object_property) && isNamedNode(object[property])) {
            quads.push(quad(object.id, object_property, object[property]))
        }
    }

    return quads
}

export default class EventNotification implements IEventNotification {
    private store: Store = new Store();
    private activity_id: NamedNode

    private constructor(quads: Quad[]) {
        this.store.addQuads(quads)

        // Get ID when undefined
        let activity_id
        for (const quad of this.store.match(null, RDF('type'), null, null)) {
            if (this.store.getSubjects(AS('object'), quad.subject, null).length == 0 && isAllowedActivityType(quad.object as Term)) {
                activity_id = quad.subject as NamedNode
                break
            }
        }
        if (!activity_id)
            throw Error("The activity has no identifier.")
        this.activity_id = activity_id
    }

    static build(options: { type: NamedNode, actor: NamedNode | IEventAgent, object: IEventObject, target?: NamedNode | IEventAgent, origin?: NamedNode | IEventAgent, inReplyTo?: NamedNode, context?: NamedNode, id?: NamedNode }): EventNotification {
        const activity_id = options.id || getId()

        const quads = [
            quad(activity_id, RDF('type'), options.type)
        ]

        const object = options.object
        quads.push(quad(activity_id, AS('object'), object.id))
        quads.push(...objectToQuads(object))

        const actor = options.actor
        if (isNamedNode(actor)) {
            quads.push(quad(activity_id, AS('actor'), actor as NamedNode))
        } else {
            quads.push(quad(activity_id, AS('actor'), actor.id))
            quads.push(...agentToQuads(actor))
        }

        if (options.target) {
            const target = options.target
            if (isNamedNode(target)) {
                quads.push(quad(activity_id, AS('target'), target as NamedNode))
            } else {
                quads.push(quad(activity_id, AS('target'), target.id))
                quads.push(...agentToQuads(target))
            }
        }

        if (options.origin) {
            const origin = options.origin
            if (isNamedNode(origin)) {
                quads.push(quad(activity_id, AS('origin'), origin as NamedNode))
            } else {
                quads.push(quad(activity_id, AS('origin'), origin.id))
                quads.push(...agentToQuads(origin))
            }
        }

        options.inReplyTo && quads.push(quad(activity_id, AS('inReplyTo'), options.inReplyTo))
        options.context && quads.push(quad(activity_id, AS('context'), options.context))

        return new EventNotification(quads)
    }

    static announce(object: NamedNode | IEventObject, actor: NamedNode | IEventAgent, context?: NamedNode | EventNotification): EventNotification {

        return EventNotification.build({
            type: AS('Announce'),
            actor: actor,
            object: isNamedNode(object) ? { id: object, type: [AS('Object')] } : object,
            ...(isNamedNode(context) && { context: context }),
            ...((context instanceof EventNotification) && { inReplyTo: context.id, context: context.object.id }),
        })
    }

    static create(object: NamedNode | IEventObject, actor: NamedNode | IEventAgent): EventNotification {

        return EventNotification.build({
            type: AS('Create'),
            actor: actor,
            object: isNamedNode(object) ? { id: object, type: [AS('Object')] } : object,
        })
    }

    static remove(object: NamedNode, actor: NamedNode | IEventAgent): EventNotification {

        return EventNotification.build({
            type: AS('Remove'),
            actor: actor,
            object: { id: object, type: [AS('Object')] }
        })
    }

    static update(object: NamedNode, actor: NamedNode | IEventAgent): EventNotification {

        return EventNotification.build({
            type: AS('Update'),
            actor: actor,
            object: { id: object, type: [AS('Object')] }
        })
    }

    static offer(object: NamedNode, actor: NamedNode | IEventAgent): EventNotification {
        return EventNotification.build({
            type: AS('Offer'),
            actor: actor,
            object: { id: object, type: [AS('Object')] }
        })
    }

    static accept(offer: EventNotification, actor?: NamedNode | IEventAgent): EventNotification {
        if (!offer.isType(AS('Offer'))) {
            throw new Error('Acitvity is not of type as:Offer and cannot be accepted.')
        }

        return EventNotification.build({
            type: AS('Accept'),
            actor: actor || offer.target,
            object: offer,
            target: offer.actor,
            inReplyTo: offer.id,
            context: offer.object.id
        })
    }

    static reject(offer: EventNotification, actor?: NamedNode | IEventAgent): EventNotification {
        if (!offer.isType(AS('Offer'))) {
            throw new Error('Acitvity is not of type as:Offer and cannot be rejected.')
        }

        return EventNotification.build({
            type: AS('Reject'),
            actor: actor || offer.target,
            object: offer,
            target: offer.actor,
            inReplyTo: offer.id,
            context: offer.object.id
        })
    }

    static undo(object: EventNotification, actor?: NamedNode | IEventAgent): EventNotification {
        if (!object.isType(AS('Offer')) || object.isType(AS('Accept')) || object.isType(AS('Reject')) || object.isType(AS('Announce'))) {
            throw new Error('Activity is not of type as:Offer, as:Accept, as:Reject, or as:Announce and cannot be undone.')
        }

        return EventNotification.build({
            type: AS('Undo'),
            actor: actor || object.actor,
            object: object,
            context: object.object.id
        })
    }

    static parse(stream: EventEmitter, parser: Sink<EventEmitter, Stream>): Promise<EventNotification> {
        return new Promise((resolve, reject) => {
            const quads: Quad[] = []

            parser
                .import(stream)
                .on('data', (q: Quad) => quads.push(q))
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
            name: !nameArr.length ? undefined : nameArr[0] as Literal,
            type: this.store.getObjects(agent_id, RDF('type'), null).filter(isAllowedAgentType) as NamedNode[]
        }
    }

    get type(): NamedNode[] {
        const objects = this.store
            .getObjects(this.activity_id, RDF('type'), null)
            .filter(isAllowedActivityType)

        return objects as NamedNode[]
    }

    get activityType(): NamedNode | undefined {
        return this.type.length > 0 ? this.type[0] : undefined
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
        const result:IEventObject = {
            id: object_id as NamedNode,
            type: this.store.getObjects(object_id, RDF('type'), null) as NamedNode[]
        }

        if (result.type.some(t => t.equals(AS('Relationship')))) {
            result.subject = this.store.getObjects(object_id, AS('subject'), null)[0] as NamedNode;
            result.relationship = this.store.getObjects(object_id, AS('relationship'), null)[0] as NamedNode;
            result.object = this.store.getObjects(object_id, AS('object'), null)[0] as NamedNode;
        }

        return result
    }

    get inReplyTo(): NamedNode | undefined {
        const arr = this.store.getObjects(this.activity_id, AS('inReplyTo'), null)
        return !arr.length ? undefined : arr[0] as NamedNode
    }

    get context(): NamedNode | undefined {
        const arr = this.store.getObjects(this.activity_id, AS('context'), null)
        return !arr.length ? undefined : arr[0] as NamedNode
    }
}