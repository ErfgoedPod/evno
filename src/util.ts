import { v4 as uuidv4 } from 'uuid'
import { DataFactory, NamedNode, Term } from 'n3'
const { namedNode } = DataFactory

const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
const AS_NS = 'https://www.w3.org/ns/activitystreams#'
const LDP_NS = 'http://www.w3.org/ns/ldp#'

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

export function isNamedNode(term: any): term is NamedNode {
    return term instanceof NamedNode
}

export function isAllowedActivityType(term: Term): boolean {
    return isNamedNode(term) && !!ACTIVITY_TYPES.find((type) => type.equals(term))
}

export function isAllowedAgentType(term: Term): boolean {
    return isNamedNode(term) && !!AGENT_TYPES.find((type) => type.equals(term))
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



