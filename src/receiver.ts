import { EventEmitter } from 'events'
import { poll } from 'poll'
import { JsonLdParser } from "jsonld-streaming-parser"
import { list, makeDirectory, changePermissions, authenticateToken, generateCSSToken } from "solid-bashlib"
//import { ReadableWebToNodeStream } from 'readable-web-to-node-stream'
import { Readable } from 'readable-stream'
import { PermissionOperation } from 'solid-bashlib/dist/commands/solid-perms'
import { SessionInfo } from 'solid-bashlib/dist/authentication/CreateFetch'
import { ICachedStorage, factory } from '@qiwi/primitive-storage'
import * as fs from 'fs'
import { dirname } from 'path'
import EventNotification from './notification'

export default class Receiver extends EventEmitter {

    private _webId?: string
    private fetch: undefined | typeof fetch
    private freq: number = 1000;
    private stopPolling = false;

    private db: ICachedStorage

    private constructor(session: SessionInfo, options: { cache?: boolean, cachePath?: string } = {}) {
        super()

        this.fetch = session.fetch
        this._webId = session.webId

        if (options.cache) {
            const cachePath = options.cachePath || './.cache/cache.db'
            const cacheDir = dirname(cachePath)

            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true })
            }

            if (!fs.existsSync(cachePath)) {
                fs.writeFileSync(cachePath, '{}')
            }

            console.log(`Using cache at: ${cachePath}`)
            this.db = factory({ path: cachePath })
        } else {
            console.log(`Using in memory cache`)
            this.db = factory()
        }
    }

    public get webId() {
        return this._webId
    }

    public static async create(options: {
        name: string,
        email: string,
        password: string,
        idp: string,
        clientCredentialsTokenStorageLocation?: string,
        cache?: boolean,
        cachePath?: string,
    }) {
        let token = await generateCSSToken(options)
        const session = await authenticateToken(token, options.idp)

        return new Receiver(session, { cache: !!options.cache, cachePath: options.cachePath })
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
                console.log(`Creating container at: ${inboxUrl}`)
                await makeDirectory(inboxUrl, fetchOptions)
            }
            catch (e) {
                throw e
            }
        } else {
            console.log(`Container ${inboxUrl} already exists.`)
        }

        const permission: PermissionOperation = { type: 'agent', append: true, read: true, id: this.webId }
        console.log(`Setting read and append permissions on container ${inboxUrl}`)
        await changePermissions(inboxUrl, [permission], fetchOptions)
        return inboxUrl
    }

    public stop() {
        this.stopPolling = true
    }

    public start(inboxUrl: string, strategy: string = 'activity_id') {

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
                    try {
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
                        const idToCheck = strategy == 'notification_id' ? item.url : notification.id.value

                        if (this.db && !this.db.get(idToCheck)) {
                            this.emit('notification', notification)
                            this.db.set(idToCheck, true)
                        }
                    } catch (e) {
                        this.emit('error', e)
                    }
                }
            }
        }, this.freq, () => this.stopPolling)
        return this
    }

}
