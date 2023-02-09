import { EventEmitter } from 'events'
import { poll } from 'poll'
import { JsonLdParser } from "jsonld-streaming-parser"
import { list, makeDirectory, authenticateToken, generateCSSToken, changePermissions } from "solid-bashlib"
//import { ReadableWebToNodeStream } from 'readable-web-to-node-stream'
import { Quad } from "@rdfjs/types"
import { Readable } from 'readable-stream'
import { PermissionOperation } from 'solid-bashlib/dist/commands/solid-perms'
import { SessionInfo } from 'solid-bashlib/dist/authentication/CreateFetch'
import Store from 'krieven-data-file'
import * as fs from 'fs'
import { dirname } from 'path'
import EventNotification from './notification'
import {AS } from './util'

export interface INotification {
    quads: Quad[],
    id: string
}

export async function sendNotification(notification: EventNotification, inboxUrl: string, options: {
    name: string,
    email: string,
    password: string,
    idp: string,
    authUrl?: string,
    clientCredentialsTokenStorageLocation?: string
}): Promise<{ success: boolean, location: string | null }> {

    // login 
    const authFetch = (await login(options.authUrl || options.idp || inboxUrl, options)).fetch

    const result = await notification.serialize()
    const response = await authFetch(inboxUrl, {
        method: "POST",
        body: result,
        headers: { "content-type": "application/ld+json" }
    })

    return { success: response.ok, location: response.headers.get('location') }
}

export async function accept(notification: EventNotification) {

    if (!!notification.type.find((type) => type.equals(AS('Offer'))))
        throw new Error('Can only accept Offer activities')

    const response = { 
        "@context": [ 
          "https://www.w3.org/ns/activitystreams" ,
          {"schema": "https://schema.org/"}
        ], 
        "id": "urn:uuid:9C0ED771-B7F3-4A50-8A92-72DF63215BCB",
        "type": "Accept",
        "actor": {
           "id": "https://data.archive.xyz.net/",
           "inbox": "https://data.archive.xyz.net/inbox/",
           "name": "Data Archive XYZ",
           "type": "Organization"
        },
        "origin": {
           "id": "https://data.archive.xyz.net/system",
           "name": "XYZ Archiving Department",
           "type": "Application"
        },
        "inReplyTo" : "urn:uuid:6E5FAF88-A7F1-47A4-B087-77345EBFF495" ,
        "context" : "http://acme.org/artifacts/alice/data-set-2022-01-19.zip" ,
        "object": {
            "id": "urn:uuid:6E5FAF88-A7F1-47A4-B087-77345EBFF495",
            "type": "Offer",
            "actor": {
               "id": "https://acme.org/profile/card#us",
               "inbox": "https://acme.org/inbox/",
               "name": "ACME Research Institute",
               "type": "Organization"
            },
            "origin": {
               "id": "https://acme.org/system",
               "name": "ACME Research Institute System",
               "type": "Application"
            },
            "object": {
               "id": "http://acme.org/artifacts/alice/data-set-2022-01-19.zip",
               "type": [ "Document" , "schema:Dataset" ]
            },
            "target": {     
               "id": "https://data.archive.xyz.net/",
               "inbox": "https://data.archive.xyz.net/inbox/",
               "name": "Data Archive XYZ",
               "type": "Organization"
            }
        },
        "target": {     
           "id": "https://acme.org/profile/card#us",
           "inbox": "https://acme.org/inbox/",
           "name": "ACME Research Institute",
           "type": "Organization"
        }
      }



}

export async function reject(notification: EventNotification) {

}


async function login(baseUrl: string, options: {
    name: string,
    email: string,
    password: string,
    idp: string,
    clientCredentialsTokenStorageLocation?: string
}
): Promise<SessionInfo> {
    /**
     *  Create authenticated fetch
     */

    let token = await generateCSSToken(options)
    let { fetch, webId } = await authenticateToken(token, baseUrl)

    //console.log(`Logged in as ${webId}`)

    return { fetch, webId }
}

export class InboxWatcher extends EventEmitter {

    private webId: string | undefined
    private fetch: undefined | typeof fetch
    private freq: number = 1000;
    private stopPolling = false;

    private db?: Store<boolean>

    private constructor(session: SessionInfo, options: { cache?: boolean, cachePath?: string, inboxPath?: string } = {}) {
        super()

        this.fetch = session.fetch
        this.webId = session.webId

        if (options.cache) {
            const cachePath = options.cachePath || './.cache/cache.dsb'
            const cacheDir = dirname(cachePath)

            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true })
            }

            this.db = new Store(cachePath, 512)
        }
    }

    public static async create(baseUrl: string, options: {
        name: string,
        email: string,
        password: string,
        idp: string,
        clientCredentialsTokenStorageLocation?: string,
        cachePath?: string,
    }) {
        const session = await login(baseUrl, options)

        return new InboxWatcher(session)
    }

    public async init(baseUrl: string, inboxPath: string = 'inbox/'): Promise<string> {
        const fetchOptions = {
            fetch: this.fetch,         // an (authenticated) fetch function
            verbose: true
        }

        const containers = await list(baseUrl, fetchOptions)

        const inboxUrl = baseUrl + inboxPath

        if (!containers.find(el => el.url == inboxUrl)) {
            try {
                await makeDirectory(inboxUrl, fetchOptions)

            }
            catch (e) {
                throw e
            }
        }

        const permission: PermissionOperation = { type: 'agent', append: true, read: true, id: this.webId }
        await changePermissions(inboxUrl, [permission], fetchOptions)
        return inboxUrl
    }

    public stop() {
        this.stopPolling = true
    }

    public start(inboxUrl: string, strategy: string = 'activity') {

        const fetchOptions = {
            fetch: this.fetch,         // an (authenticated) fetch function
            verbose: true
        }

        this.stopPolling = false

        poll(async () => {
            //console.log("Polling %s at %s", this.inboxUrl, new Date().toISOString())
            const items = await list(inboxUrl, fetchOptions)
            for (const item of items) {
                if (this.fetch) {
                    const response: Response = await this.fetch(item.url)

                    // parse the notification
                    const jsonldParser = JsonLdParser.fromHttpResponse(
                        response.url,
                        response.headers.get('content-type') || "application/ld+json"
                    )

                    // transform bodystream
                    //const bodyStream = new ReadableWebToNodeStream(response.body || new ReadableStream())

                    // TODO: Fix this when NodeJS vs. Stream API chaos is over
                    const bodyStream = new Readable()
                    bodyStream.push(await response.text())
                    bodyStream.push(null)

                    // parse the notification
                    const notification = await EventNotification.parse(bodyStream, jsonldParser)

                    // emit an event with notification
                    const idToCheck = strategy == 'notification_id' ? item.url : notification.id
                    if (this.db && !this.db.get(idToCheck)) {
                        this.emit('notification', notification)
                        this.db.put(idToCheck, true)
                    }
                }
            }
        }, this.freq, () => this.stopPolling)
        return this
    }

}
