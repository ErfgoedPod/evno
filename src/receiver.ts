import { EventEmitter } from 'events'
import { poll } from 'poll'
import { JsonLdParser } from "jsonld-streaming-parser"
import { list, makeDirectory, changePermissions, authenticateToken, generateCSSToken } from "solid-bashlib"
//import { ReadableWebToNodeStream } from 'readable-web-to-node-stream'
import { Readable } from 'readable-stream'
import { PermissionOperation } from 'solid-bashlib/dist/commands/solid-perms'
import { SessionInfo } from 'solid-bashlib/dist/authentication/CreateFetch'
import Store from 'krieven-data-file'
import * as fs from 'fs'
import { dirname } from 'path'
import EventNotification from './notification.js'

export default class Receiver extends EventEmitter {

    private _webId?: string
    private fetch: undefined | typeof fetch
    private freq: number = 1000;
    private stopPolling = false;

    private db?: Store<boolean>

    private constructor(session: SessionInfo, options: { cache?: boolean, cachePath?: string, inboxPath?: string } = {}) {
        super()

        this.fetch = session.fetch
        this._webId = session.webId

        if (options.cache) {
            const cachePath = options.cachePath || './.cache/cache.dsb'
            const cacheDir = dirname(cachePath)

            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true })
            }

            this.db = new Store(cachePath, 512)
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
        cachePath?: string,
    }) {
        let token = await generateCSSToken(options)
        const session = await authenticateToken(token, options.idp)

        return new Receiver(session)
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
                    const idToCheck = strategy == 'notification_id' ? item.url : notification.id.value
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
