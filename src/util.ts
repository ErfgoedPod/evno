import { v4 as uuidv4 } from 'uuid'
import { DataFactory, NamedNode, Term, StreamParser } from 'n3'
import { JsonLdParser } from "jsonld-streaming-parser"
import { Readable } from 'stream'
import * as md5 from 'md5'
const { namedNode } = DataFactory

const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
const AS_NS = 'https://www.w3.org/ns/activitystreams#'
const LDP_NS = 'http://www.w3.org/ns/ldp#'
const FOAF_NS = 'http://xmlns.com/foaf/0.1/'

export const ACTIVITY_TYPES = [
    'Create',
    'Update',
    'Remove',
    'Announce',
    'Offer',
    'Accept',
    'Reject'].map(AS)

export const AGENT_TYPES = [
    'Person',
    'Organization',
    'Application', 'Group', 'Service'
].map(AS)

export const OBJECT_PROPERTIES = [
    'subject', 'relationship', 'object', 
].map(AS)

export function isNamedNode(term: any): term is NamedNode {
    return term instanceof NamedNode
}

export function isAllowedActivityType(term: Term): boolean {
    return isNamedNode(term) && !!ACTIVITY_TYPES.find((type) => type.equals(term))
}

export function isAllowedAgentType(term: Term): boolean {
    return isNamedNode(term) && !!AGENT_TYPES.find((type) => type.equals(term))
}

export function isAllowedObjectProperty(property: NamedNode): boolean {
    return !!OBJECT_PROPERTIES.find((p) => p.equals(property))
}

export function isString(data: any): data is string {
    return typeof data === 'string'
};

export function getId(): NamedNode {
    return namedNode(`urn:uuid:${uuidv4()}`)
}

export function AS(value: string): NamedNode {
    return namedNode(AS_NS + value)
}

export function RDF(value: string): NamedNode {
    return namedNode(RDF_NS + value)
}

export function LDP(value: string): NamedNode {
    return namedNode(LDP_NS + value)
}

export function FOAF(value: string): NamedNode {
    return namedNode(FOAF_NS + value)
}

export async function parseResponse(response: Response) {
    const contentType = response.headers.get('content-type')
    let parser
    switch (contentType) {
        case "text/turtle":
        case "application/n-triples": {
            parser = new StreamParser({ format: contentType })
            break
        }
        default: {
            parser = JsonLdParser.fromHttpResponse(
                response.url,
                contentType || "application/ld+json"
            )
        }
    }
    // parse the notification
    // transform bodystream
    //const bodyStream = new ReadableWebToNodeStream(response.body || new ReadableStream())

    // TODO: Fix this when NodeJS vs. Stream API chaos is over
    const responseText = await response.text()
    const bodyStream = new Readable()
    bodyStream.push(responseText)
    bodyStream.push(null)

    const hash = md5.default(responseText)
    
    return {bodyStream, parser, hash}
}


