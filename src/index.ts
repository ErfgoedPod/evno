import { EventEmitter } from 'events';
import { poll } from 'poll'
import { JsonLdParser } from "jsonld-streaming-parser";
import { list, makeDirectory, authenticateToken, generateCSSToken } from "solid-bashlib";
import { ReadableWebToNodeStream } from 'readable-web-to-node-stream';
import { Level } from "level";
import { Quad } from "@rdfjs/types";
import SerializerJsonld from '@rdfjs/serializer-jsonld-ext'
import { Context } from 'jsonld/jsonld-spec';
import {Readable } from 'readable-stream'

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
        let id: string;
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
            });
    })

}

export async function sendNotification(notification: INotification, inboxUrl: string, options: {
    name: string,
    email: string,
    password: string,
    idp: string,
    clientCredentialsTokenStorageLocation?: string
}) {
    // serialize to JSON-LD
    const context:Context = { "@vocab": "https://www.w3.org/ns/activitystreams" }
    
    const serializerJsonld = new SerializerJsonld({ context, compact: true })

    // Write quads to stream
    const input = new Readable({ objectMode: true })
    notification.quads.forEach((quad) => input.push(quad))
    input.push(null)

    // login 
    const authFetch = await login(inboxUrl, options)

    // send 
    const output = serializerJsonld.import(input)

    return new Promise((resolve) => {
        output.on('data', jsonld => {
            authFetch(inboxUrl, { 
                method: "POST", 
                body: jsonld, 
                headers: { "content-type": "application/ld+json" } 
            })
            resolve(true)
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
): Promise<(input: RequestInfo | URL, init?: RequestInit | undefined) => Promise<Response>> {
    /**
     *  Create authenticated fetch
     */

    let token = await generateCSSToken(options)
    let { fetch, webId } = await authenticateToken(token, baseUrl);

    console.log(`Logged in as ${webId}`)

    return fetch
}

export class InboxWatcher extends EventEmitter {

    private baseUrl: string;
    private inbox: string;
    private fetch: undefined | typeof fetch;
    private freq: number = 1000;

    private db: Level<string, any>;

    constructor(baseUrl: string) {
        super()

        this.baseUrl = baseUrl;
        this.inbox = `${baseUrl}inbox/`
        this.db = new Level<string, any>('./db', { valueEncoding: 'json' })
    }

    async init(options: {
        name: string,
        email: string,
        password: string,
        idp: string,
        clientCredentialsTokenStorageLocation?: string
    }): Promise<string> {
        this.fetch = await login(this.baseUrl, options)

        const fetchOptions = {
            fetch: this.fetch,         // an (authenticated) fetch function
            verbose: true
        }

        const containers = await list(this.baseUrl, fetchOptions)

        if (!containers.find(el => el.url == this.inbox)) {
            try {
                await makeDirectory(this.inbox, fetchOptions)
            }
            catch (e) {
                throw e
            }
        }
        return this.inbox
    }

    async start() {

        const fetchOptions = {
            fetch: this.fetch,         // an (authenticated) fetch function
            verbose: true
        }

        poll(async () => {
            console.log("Polling at %s", new Date().toISOString())
            const items = await list(this.inbox, fetchOptions)
            console.log(items)
            for (const info in items) {

                if (this.fetch) {
                    const response: Response = await this.fetch(info)

                    // parse the notification
                    const jsonldParser = JsonLdParser.fromHttpResponse(
                        response.url,
                        response.headers.get('content-type') || "application/ld+json"
                    );

                    // transform bodystream
                    const bodyStream = new ReadableWebToNodeStream(response.body || new ReadableStream());

                    // parse the notification
                    const notification = await parseNotification(bodyStream, jsonldParser)

                    // emit an event with notification
                    if (await this.db.get(notification.id)) {
                        //this.emit('notification', notification)
                        this.db.put(notification.id, true)
                    }
                }
            }
        }, this.freq)
        return this;
    }

}
