import EventNotification from './notification.js'
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
    authUrl?: string,
    clientCredentialsTokenStorageLocation?: string
}

export default class Sender {

    private webid: NamedNode

    constructor(webid: NamedNode) {
        this.webid = webid
    }

    public async send(notification: EventNotification, inboxUrl: string, options: IAuthOptions): Promise<{ success: boolean, location: string | null }> {

        // log into inbox
        const authFetch = (await this.login(options.authUrl || options.idp || inboxUrl, options)).fetch

        const result = await notification.serialize()
        const response = await authFetch(inboxUrl, {
            method: "POST",
            body: result,
            headers: { "content-type": "application/ld+json" }
        })

        return { success: response.ok, location: response.headers.get('location') }
    }

    private async login(baseUrl: string, options: IAuthOptions): Promise<SessionInfo> {
        /**
         *  Create authenticated fetch
         */

        let token = await generateCSSToken(options)
        let { fetch, webId } = await authenticateToken(token, baseUrl)

        //console.log(`Logged in as ${webId}`)

        return { fetch, webId }
    }

    public announce(object: NamedNode, inboxUrl: string, options: IAuthOptions): Promise<{ success: boolean, location: string | null }> {

        const notification = EventNotification.create(
            AS('Announce'),
            this.webid,
            object
        )

        return this.send(notification, inboxUrl, options)
    }

    public offer(object: NamedNode, inboxUrl: string, options: IAuthOptions): Promise<{ success: boolean, location: string | null }> {
        const notification = EventNotification.create(
            AS('Offer'),
            this.webid,
            object
        )

        return this.send(notification, inboxUrl, options)
    }


}


