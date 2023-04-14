import { NamedNode } from 'n3'

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

export interface IEventNotification extends IEventObject {
    actor: IEventAgent,
    target?: IEventAgent,
    origin?: IEventAgent,
    object: IEventObject,
    inReplyTo?: NamedNode,
    context?: NamedNode
}

// below can be replaced with bashlib IClientCredentialsTokenGenerationOptions?
export interface IAuthOptions {
    name: string,
    email: string,
    password: string,
    idp: string,
    tokenLocation?: string
}