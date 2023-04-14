import { IAuthOptions, IEventAgent } from './interfaces.js'
import EventNotification from './notification.js'
import { authenticateToken, generateCSSToken } from "solid-bashlib"
import { SessionInfo } from 'solid-bashlib/dist/authentication/CreateFetch'
import { NamedNode } from 'n3'

export default class Sender {

    private actor: IEventAgent
    private authOptions: IAuthOptions

    private constructor(actor: IEventAgent, authOptions: IAuthOptions) {
        this.actor = actor
        this.authOptions = authOptions
    }

    public static async build(actor: IEventAgent, authOptions: IAuthOptions): Promise<Sender> {
        return new Sender(actor, authOptions)
    }

    public async send(notification: EventNotification, inboxUrl?: string, options?: IAuthOptions): Promise<Response> {

        // merge options
        const merged:IAuthOptions = {
            ...this.authOptions,
            ...options
        }
        // log into inbox
        const authFetch = (await this.login(merged)).fetch

        const result = await notification.serialize()
        return authFetch( inboxUrl || (await this.discoverInbox(notification)), {
            method: "POST",
            body: result,
            headers: { "content-type": "application/ld+json" }
        })
    }

    private async discoverInbox(notification:EventNotification): Promise<string> {
        if (notification.target.inbox)
            return notification.target.inbox.id

        // TODO Dereference target
        
        // TODO Dereference inbox
        
        throw new Error('Failed to discover inbox.')
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

    public async announce(object: NamedNode, context: NamedNode | EventNotification | undefined, inboxUrl?: string, options?: IAuthOptions): Promise<Response> {
        return this.send(EventNotification.announce(object, this.actor, context), inboxUrl, options)
    }

    public async create(object: NamedNode, inboxUrl?: string, options?: IAuthOptions): Promise<Response> {
        return this.send(EventNotification.create(object, this.actor), inboxUrl, options)
    }

    public async remove(object: NamedNode, inboxUrl?: string, options?: IAuthOptions): Promise<Response> {
        return this.send(EventNotification.remove(object, this.actor), inboxUrl, options)
    }

    public async update(object: NamedNode, inboxUrl?: string, options?: IAuthOptions): Promise<Response> {
        return this.send(EventNotification.update(object, this.actor), inboxUrl, options)
    }

    public async offer(object: NamedNode, inboxUrl?: string, options?: IAuthOptions): Promise<Response> {
        return this.send(EventNotification.offer(object, this.actor), inboxUrl, options)
    }

    public async accept(offer: EventNotification, inboxUrl?: string, options?: IAuthOptions): Promise<Response> {
        return this.send(EventNotification.accept(offer, this.actor), inboxUrl, options)
    }

    public async reject(offer: EventNotification,  inboxUrl?: string, options?: IAuthOptions): Promise<Response> {
        return this.send(EventNotification.reject(offer, this.actor), inboxUrl, options)
    }

    public async undo(object: EventNotification, inboxUrl?: string, options?: IAuthOptions): Promise<Response> {
        return this.send(EventNotification.undo(object, this.actor), inboxUrl, options)
    }
}


