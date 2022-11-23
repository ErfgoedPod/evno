import { EventEmitter } from 'events';
import { poll } from 'poll'
import { join } from 'path'
import { JsonLdParser } from "jsonld-streaming-parser";
import { authenticateToken } from "../../Bashlib/dist/authentication/AuthenticationToken"
import { list, makeDirectory } from "../../Bashlib/dist"

export class InboxEmitter extends EventEmitter {

    private baseUrl: string;
    private inbox: string;
    private fetch: undefined | typeof fetch;
    private freq = 1000;

    constructor(baseUrl: string) {
        super()

        this.baseUrl = baseUrl;
        this.inbox = `${baseUrl}inbox/`
    }

    async login(): Promise<InboxEmitter> {
        /**
         *  Create authenticated fetch
         */

        let options = {
            idp: this.baseUrl,                            // (optional) Solid identity provider - this value is stored in the generated token
            clientCredentialsTokenStorageLocation: join(__dirname, "./.css-auth-token"),  // (optional) Storage location of the stored client credentials token (defaults to ~/.solid/.css-auth-token).
            sessionInfoStorageLocation: join(__dirname, "./.session-info-token"),             // (optional) Storage location of session information to reuse in subsequent runs of the application (defaults to ~/.solid/.session-info-token).
            verbose: true,                               // (optional) Log authentication errors
        }

        let { fetch, webId } = await authenticateToken(options);

        console.log(`Logged in as ${webId}`)
        this.fetch = fetch
        return this
    }

    async init(): Promise<string> {
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
            for (const info of await list(this.inbox, fetchOptions)) {
                if (this.fetch) {
                    const response: Response = await this.fetch(info.url)

                    // parse
                    const jsonldParser = JsonLdParser.fromHttpResponse(
                        response.url,
                        response.headers.get('content-type') || "application/ld+json"
                    );

                    const body = response.body;

                    if (body != null) {
                        jsonldParser
                            .import(body)
                            .on('data', (quad) => {

                                // if (notification.modified < start)
                                // continue;

                            })
                            .on('error', console.error)
                            .on('end', () => console.log('All triples were parsed!'));
                    }

                    // do something with notification
                    this.emit('notification', {})
                }
            }
        }, this.freq)

    }

}