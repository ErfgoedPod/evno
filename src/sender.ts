import EventNotification, { IEventAgent } from './notification'
import { authenticateToken, generateCSSToken } from "solid-bashlib"
import { SessionInfo } from 'solid-bashlib/dist/authentication/CreateFetch'
import { NamedNode } from 'n3'


// below can be replaced with bashlib IClientCredentialsTokenGenerationOptions?
export interface IAuthOptions {
    name: string,
    email: string,
    password: string,
    idp: string,
    clientCredentialsTokenStorageLocation?: string
}

interface IResult { success: boolean, location: string | null }

export default class Sender {

    private actor: IEventAgent

    constructor(actor: IEventAgent) {
        this.actor = actor
    }

    public async send(notification: EventNotification, inboxUrl: string, options: IAuthOptions): Promise<IResult> {

        // log into inbox
        const authFetch = (await this.login(options)).fetch

        const result = await notification.serialize()
        const response = await authFetch(inboxUrl, {
            method: "POST",
            body: result,
            headers: { "content-type": "application/ld+json" }
        })

        return { success: response.ok, location: response.headers.get('location') }
    }

    private async login(options: IAuthOptions): Promise<SessionInfo> {
        /**
         *  Create authenticated fetch
         */

        let token = await generateCSSToken(options)
        let { fetch, webId } = await authenticateToken(token, options.idp)

        //console.log(`Logged in as ${webId}`)

        return { fetch, webId }
    }

    public announce(object: NamedNode, context: NamedNode | EventNotification | undefined, inboxUrl: string, options: IAuthOptions): Promise<IResult> {
        const notification = EventNotification.announce(object, this.actor, context)
        return this.send(notification, inboxUrl, options)
    }

    public create(object: NamedNode, inboxUrl: string, options: IAuthOptions): Promise<IResult> {
        const notification = EventNotification.create(object, this.actor)
        return this.send(notification, inboxUrl, options)
    }

    public remove(object: NamedNode, inboxUrl: string, options: IAuthOptions): Promise<IResult> {
        const notification = EventNotification.remove(object, this.actor)
        return this.send(notification, inboxUrl, options)
    }

    public update(object: NamedNode, inboxUrl: string, options: IAuthOptions): Promise<IResult> {
        const notification = EventNotification.update(object, this.actor)
        return this.send(notification, inboxUrl, options)
    }

    public offer(object: NamedNode, inboxUrl: string, options: IAuthOptions): Promise<IResult> {
        const notification = EventNotification.offer(object, this.actor)
        return this.send(notification, inboxUrl, options)
    }

    public accept(offer: EventNotification, inboxUrl: string, options: IAuthOptions): Promise<IResult> {
        const notification = EventNotification.accept(offer, this.actor)
        return this.send(notification, offer.actor.inbox?.id || inboxUrl, options)
    }

    public reject(offer: EventNotification, inboxUrl: string, options: IAuthOptions): Promise<IResult> {
        const notification = EventNotification.reject(offer, this.actor)
        return this.send(notification, offer.actor.inbox?.id || inboxUrl, options)
    }

    public undo(object: EventNotification, inboxUrl: string, options: IAuthOptions): Promise<IResult> {
        const notification = EventNotification.undo(object, this.actor)
        return this.send(notification, inboxUrl, options)
    }


}


