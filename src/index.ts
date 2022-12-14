import { EventEmitter } from 'events'
import { poll } from 'poll'
import { JsonLdParser } from "jsonld-streaming-parser"
import { list, makeDirectory, authenticateToken, generateCSSToken, changePermissions } from "solid-bashlib"
//import { ReadableWebToNodeStream } from 'readable-web-to-node-stream'
import { Quad } from "@rdfjs/types"
import SerializerJsonld from '@rdfjs/serializer-jsonld-ext'
import { Context } from 'jsonld/jsonld-spec'
import { Readable } from 'readable-stream'
import { PermissionOperation } from 'solid-bashlib/dist/commands/solid-perms'
import { SessionInfo } from 'solid-bashlib/dist/authentication/CreateFetch'
import Store from 'krieven-data-file'

const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
const AS_NS = 'https://www.w3.org/ns/activitystreams#'
const AS_types = [
    'Create',
    'Update',
    'Remove',
    'Announce',
    'Offer',
    'Accept',
    'Reject'].map((k) => AS_NS + k)

export interface INotification {
    quads: Quad[],
    id: string,
}

export async function parseNotification(stream: EventEmitter, jsonldParser: JsonLdParser): Promise<INotification> {
    return new Promise((resolve, reject) => {
        const quads: Quad[] = []
        let id: string
        jsonldParser
            .import(stream)
            .on('data', async (quad: Quad) => {
                quads.push(quad)

                if (!id &&
                    quad.predicate.value == RDF_NS + 'type' &&
                    AS_types.includes(quad.object.value)) {
                    id = quad.subject.value
                }
            })
            .on('error', (e: Error) => reject(e))
            .on('end', () => {
                resolve({
                    id, quads
                })
            })
    })

}

export async function sendNotification(notification: INotification, inboxUrl: string, options: {
    name: string,
    email: string,
    password: string,
    idp: string,
    authUrl?: string,
    clientCredentialsTokenStorageLocation?: string
}): Promise<{ success: boolean, location: string | null }> {

    // login 
    const authFetch = (await login(options.authUrl || options.idp || inboxUrl, options)).fetch

    const result = await serialize(notification);
    const response = await authFetch(inboxUrl, {
        method: "POST",
        body: result,
        headers: { "content-type": "application/ld+json" }
    })

    return { success: response.ok, location: response.headers.get('location') }
}

export function serialize(notification:INotification): Promise<string> {
    // serialize to JSON-LD
    const context: Context = { "@vocab": "https://www.w3.org/ns/activitystreams" }

    const serializerJsonld = new SerializerJsonld({ context, compact: true, encoding: 'string' })

    // Write quads to stream
    const input = new Readable({ objectMode: true })
    notification.quads.forEach((quad) => input.push(quad))
    input.push(null)

    const output = serializerJsonld.import(input)

    return new Promise((resolve, reject) => {
        let result = ''
        output.on('data', jsonld => {
            result += jsonld
        })
        output.on('error', (e) => reject(e))
        output.on('end', async () => {
            resolve(result)
        })
    })
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

    private baseUrl: string
    private inboxUrl: string
    private fetch: undefined | typeof fetch
    private freq: number = 1000;

    private db: Store<boolean>;

    constructor(baseUrl: string, options: { cachePath?: string, inboxPath?: string } = {}) {
        super()

        this.baseUrl = baseUrl
        this.inboxUrl = baseUrl + (options.inboxPath || 'inbox/')
        this.db = new Store(options.cachePath || './.cache/cache.dsb', 512);
    }

    async init(options: {
        name: string,
        email: string,
        password: string,
        idp: string,
        clientCredentialsTokenStorageLocation?: string
    }): Promise<string> {
        const { fetch, webId } = await login(this.baseUrl, options)
        this.fetch = fetch

        const fetchOptions = {
            fetch,         // an (authenticated) fetch function
            verbose: true
        }

        const containers = await list(this.baseUrl, fetchOptions)

        if (!containers.find(el => el.url == this.inboxUrl)) {
            try {
                await makeDirectory(this.inboxUrl, fetchOptions)

            }
            catch (e) {
                throw e
            }
        }

        const permission: PermissionOperation = { type: 'agent', append: true, read: true, id: webId }
        await changePermissions(this.inboxUrl, [permission], fetchOptions)
        return this.inboxUrl
    }

    async start(strategy:string) {

        const fetchOptions = {
            fetch: this.fetch,         // an (authenticated) fetch function
            verbose: true
        }

        poll(async () => {
            //console.log("Polling %s at %s", this.inboxUrl, new Date().toISOString())
            const items = await list(this.inboxUrl, fetchOptions)
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
                    const notification = await parseNotification(bodyStream, jsonldParser)

                    // emit an event with notification
                    const idToCheck = strategy == 'notification_id' ? item.url : notification.id;
                    if (!this.db.get(idToCheck)) {
                        this.emit('notification', notification)
                        this.db.put(idToCheck, true)
                    }
                }
            }
        }, this.freq)
        return this
    }

}
