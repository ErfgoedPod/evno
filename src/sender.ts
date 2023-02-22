import EventNotification, { IEventAgent } from './notification.js'
import { AS } from './util.js'
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

export default class Sender {

    private actor: IEventAgent

    constructor(actor: IEventAgent) {
        this.actor = actor
    }

    public async send(notification: EventNotification, inboxUrl: string, options: IAuthOptions): Promise<{ success: boolean, location: string | null }> {

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

    public announce(object: NamedNode, inboxUrl: string, options: IAuthOptions): Promise<{ success: boolean, location: string | null }> {

        const notification = EventNotification.create({
            type: AS('Announce'),
            actor: this.actor,
            object: { id: object, type: [AS('Object')] }
        })

        return this.send(notification, inboxUrl, options)
    }

    public offer(object: NamedNode, inboxUrl: string, options: IAuthOptions): Promise<{ success: boolean, location: string | null }> {
        const notification = EventNotification.create({
            type: AS('Offer'),
            actor: this.actor,
            object: { id: object, type: [AS('Object')] }
        })

        return this.send(notification, inboxUrl, options)
    }

    public accept(offer: EventNotification, inboxUrl: string, options: IAuthOptions) {
        if (!offer.isType(AS('Offer'))) {
            throw new Error('Acitvity is not of type Offer and cannot be accepted.')
        }

        const notification = EventNotification.create({
            type: AS('Accept'),
            actor: this.actor,
            object: offer,
            target: offer.actor,
            inReplyTo: offer.id,
            context: offer.object.id
        })

        return this.send(notification,offer.actor.inbox?.id || inboxUrl, options)
    }

    public reject(offer: EventNotification, inboxUrl: string, options: IAuthOptions) {
        if (!offer.isType(AS('Offer'))) {
            throw new Error('Acitvity is not of type Offer and cannot be rejected.')
        }

        const notification = EventNotification.create({
            type: AS('Reject'),
            actor: this.actor,
            object: offer,
            target: offer.actor,
            inReplyTo: offer.id,
            context: offer.object.id
        })

        return this.send(notification,offer.actor.inbox?.id || inboxUrl, options)
    }


}


