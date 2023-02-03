import { Quad } from "@rdfjs/types"
import { EventEmitter } from 'events'
import { JsonLdParser } from "jsonld-streaming-parser"
import SerializerJsonld from '@rdfjs/serializer-jsonld-ext'
import { DataFactory, Store } from 'n3'
const { namedNode, literal, defaultGraph, quad } = DataFactory;
import { Context } from 'jsonld/jsonld-spec'

const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
const AS_NS = 'https://www.w3.org/ns/activitystreams#'
const AS_types = [
    'Create',
    'Update',
    'Remove',
    'Announce',
    'Offer',
    'Accept',
    'Reject'].map((k) => namedNode(AS_NS + k))

export default class EventNotification {
    private store = new Store(); 
    id: string;

    private constructor(quads: Quad[]) {
        this.store.addQuads(quads)

        // Get ID when undefined
        let id
        for (const quad of this.store.readQuads(null, namedNode(RDF_NS + 'type'), null, null)) {
            if (AS_types.includes(quad.object)) {
                id = quad.subject.value
                break
            }
        }
        if (!id)
            throw Error()
        this.id = id;
    }

    static async parse(stream: EventEmitter, jsonldParser: JsonLdParser): Promise<EventNotification> {
        return new Promise((resolve, reject) => {
            const quads: Quad[] = []
            jsonldParser
                .import(stream)
                .on('data', quads.push)
                .on('error', (e: Error) => reject(e))
                .on('end', () => resolve(new EventNotification(quads)))
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
}