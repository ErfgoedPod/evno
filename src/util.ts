
import { DataFactory, Store, Quad, NamedNode, Term } from 'n3'
const { namedNode, literal, defaultGraph, quad } = DataFactory

const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
const AS_NS = 'https://www.w3.org/ns/activitystreams#'
export const AS_types = [
    'Create',
    'Update',
    'Remove',
    'Announce',
    'Offer',
    'Accept',
    'Reject'].map(AS)

export function isNamedNode(term: Term): term is NamedNode {
    return (term as NamedNode) !== undefined
}

export function isAllowedType(term: Term): boolean {
    return isNamedNode(term) && !!AS_types.find((type) => type.equals(term))
}

export function AS(value: string): NamedNode {
    return namedNode(AS_NS + value)
}

export function RDF(value: string): NamedNode {
    return namedNode(RDF_NS + value)
} 

