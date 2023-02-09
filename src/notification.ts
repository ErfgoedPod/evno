import { EventEmitter } from 'events'
import { JsonLdParser } from "jsonld-streaming-parser"
import SerializerJsonld from '@rdfjs/serializer-jsonld-ext'
import { Store, Quad, NamedNode, Term } from 'n3'
import { Context } from 'jsonld/jsonld-spec'
import { RDF, isAllowedType } from './util'


export default class EventNotification {
    private store: Store = new Store();
    private activity_id: NamedNode

    private constructor(quads: Quad[]) {
        this.store.addQuads(quads)

        // Get ID when undefined
        let activity_id
        for (const quad of this.store.match(null, RDF('type'), null, null)) {
            if (isAllowedType(quad.object as Term)) {
                activity_id = quad.subject as NamedNode
                break
            }
        }
        if (!activity_id)
            throw Error("The activity has no identifier.")
        this.activity_id = activity_id
    }

    static parse(stream: EventEmitter, jsonldParser: JsonLdParser): Promise<EventNotification> {
        return new Promise((resolve, reject) => {
            const quads: Quad[] = []
            
            jsonldParser
                .import(stream)
                .on('data', (q) => quads.push(q))
                .on('error', (e: Error) => reject(e))
                .on('end', () => {resolve(new EventNotification(quads))})
        })
    }

    serialize(): Promise<string> {
        // serialize to JSON-LD
        const context: Context = { "@vocab": "https://www.w3.org/ns/activitystreams" }

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

    get type(): NamedNode[] {
        const objects = this.store
            .getObjects(this.activity_id, RDF('type'), null)
            .filter(isAllowedType)

        return objects as NamedNode[]
    }

    get id(): NamedNode {
        return this.activity_id
    }
}