import { EventEmitter } from 'events'
import { poll } from 'poll'
import { list, makeDirectory, changePermissions, authenticateToken, generateCSSToken, remove } from "solid-bashlib"
import { IPermissionOperation } from 'solid-bashlib/dist/commands/solid-perms'
import { SessionInfo } from 'solid-bashlib/dist/authentication/CreateFetch'
import { ICachedStorage, factory } from '@qiwi/primitive-storage'
import * as fs from 'fs'
import { dirname } from 'path'
import EventNotification from './notification.js'
import { NamedNode, DataFactory, Quad } from 'n3'
import { IEventAgent } from './interfaces.js'
import { FOAF, LDP, RDF, isNamedNode, isString, parseResponse } from './util.js'

export default class Receiver extends EventEmitter {

    private _webId?: string
    private fetch: undefined | typeof fetch
    private freq: number
    private stopPolling = false;

    private db: ICachedStorage

    private constructor(session: SessionInfo, options: { cache?: boolean, cachePath?: string, pollingFrequency?: number } = {}) {
        super()

        this.fetch = session.fetch
        this._webId = session.webId
        this.freq = options.pollingFrequency || 1000

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

    public static async build(options: {
        name: string,
        email: string,
        password: string,
        idp: string,
        tokenLocation?: string,
        cache?: boolean,
        cachePath?: string,
        pollingFrequency?: number
    }): Promise<Receiver> {
        let token

        if (options.tokenLocation && fs.existsSync(options.tokenLocation)) {
            const stat = await fs.promises.lstat(options.tokenLocation)
            if (stat.isDirectory())
                throw new Error(`The token location ${options.tokenLocation} is a directory, not a file.`)

            const tokenString = await fs.promises.readFile(options.tokenLocation, 'utf8')
            token = JSON.parse(tokenString)

            const session = await authenticateToken(token, token.idp)
            return new Receiver(session, options)
        } else {
            token = await generateCSSToken(options)
            if (options.tokenLocation && fs.existsSync(options.tokenLocation) && !(await fs.promises.lstat(options.tokenLocation)).isDirectory()) {
                await fs.promises.writeFile(options.tokenLocation, JSON.stringify(token))
            }
        }

        const session = await authenticateToken(token, token.idp)

        return new Receiver(session, options)
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

        const permission: IPermissionOperation = { type: 'agent', append: true, read: true, id: this.webId }
        console.log(`Setting read and append permissions on container ${inboxUrl}`)
        await changePermissions(inboxUrl, [permission], fetchOptions)
        return inboxUrl
    }

    private agentIdToString(agent: string | NamedNode | IEventAgent): string {
        if (isString(agent))
            return agent

        return isNamedNode(agent) ? agent.id : (agent as IEventAgent).id.id
    }

    public async grantAccess(inboxUrl: string, agent: string | NamedNode | IEventAgent) {
        const agentId = this.agentIdToString(agent)
        const permission: IPermissionOperation = { type: 'agent', append: true, id: agentId }
        console.log(`Granting ${agentId} append permissions on container ${inboxUrl}`)
        await changePermissions(inboxUrl, [permission], { fetch: this.fetch, verbose: true })
    }

    public async fetchAgent(agent: string | NamedNode | IEventAgent): Promise<IEventAgent> {
        const agentId = this.agentIdToString(agent)
        if (!this.fetch) {
            if (isString(agent)) return { id: DataFactory.namedNode(agent) }
            return isNamedNode(agent) ? { id: agent } : (agent as IEventAgent)
        }

        const response = await this.fetch(agentId)
        const { bodyStream, parser } = await parseResponse(response)

        const result: any = {}
        return new Promise((resolve) => {
            parser
                .import(bodyStream)
                .on('data', (q: Quad) => {
                    if (q.predicate.equals(RDF('type')) && (q.object.equals(FOAF('Person')) || q.object.equals(FOAF('Organization')))) {
                        result.id = q.subject
                        result.type = [q.object]
                    }

                    if (q.predicate.equals(FOAF('name')) && q.object.termType == 'Literal') {
                        result.name = q.object
                    }

                    if (q.predicate.equals(LDP('inbox')) && isNamedNode(q.object)) {
                        result.inbox = q.object
                    }

                })
                .on('error', (e: Error) => { throw e })
                .on('end', () => {
                    resolve(result as IEventAgent)
                })
        })
    }

    public async prune(inboxUrl: string, notificationUrl?: string) {
        const fetchOptions = {
            fetch: this.fetch,         // an (authenticated) fetch function
            verbose: true
        }
        if (notificationUrl)
            return remove(notificationUrl, fetchOptions)

        const notifications = await list(inboxUrl, fetchOptions)
        return Promise.all(notifications.map(n => remove(n.url, fetchOptions)))
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
                    try {
                        const response: Response = await this.fetch(item.url)

                        try {
                            const { bodyStream, parser, hash } = await parseResponse(response)

                            // parse the notification
                            const notification = await EventNotification.parse(bodyStream, parser)

                            // emit an event with notification
                            const idToCheck = strategy == 'notification_id' ? item.url : notification.id.value

                            if (this.db && this.db.get(idToCheck) !== hash) {
                                console.log(`${idToCheck} is not in cache or cache is disabled; emitting`)
                                this.emit('notification', notification)
                                this.db.set(idToCheck, hash)
                            } else {
                                console.log(`Found ${idToCheck} in cache; skip!`)
                            }
                        }
                        catch (e) {
                            this.emit('error.parsing', e)
                            this.emit('error', e)
                        }
                    } catch (e) {
                        this.emit('error.fetch', e)
                        this.emit('error', e)
                    }
                }
            }
        }, this.freq, () => this.stopPolling)
        return this
    }

}
