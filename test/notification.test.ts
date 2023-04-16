import { describe, expect } from '@jest/globals'
import EventNotification from '../src/notification.js'
import * as fs from 'fs'
import { join } from "path"
import { JsonLdParser } from "jsonld-streaming-parser"
import { DataFactory } from 'n3'
const { namedNode } = DataFactory
import "jest-rdf"


function getAssetStream(path: string): fs.ReadStream {
    return fs.createReadStream(join(__dirname, path))
}

describe('EventNotification', () => {
    describe('parse()', () => {
        it('parses notification response', async () => {

            const myParser = new JsonLdParser()

            const myTextStream = getAssetStream('./assets/notification.jsonld')

            const notification = await EventNotification.parse(myTextStream, myParser)

            expect(notification).toHaveProperty('id.id', "https://acme.org/events/alice/0F402B08-F676-40EE-9D4B-480B3F985B65")
            expect(notification).toHaveProperty('actor.id.id', 'https://orcid.org/0000-0007-01219-312199')
        })
    })
    // describe('parseFromResponse()', () => {
    //     it('parses JSON-LD response', async () => {

    //         const myParser = new JsonLdParser()

    //         const myTextStream = getAssetStream('./assets/notification.jsonld')
    //         const headers = new Headers()
    //         headers.set("Content-Type", "application/ld+json")
    //         const notification = await EventNotification.parseFromResponse()

    //         expect(notification).toHaveProperty('id.id', "https://acme.org/events/alice/0F402B08-F676-40EE-9D4B-480B3F985B65")
    //         expect(notification).toHaveProperty('actor.id.id', 'https://orcid.org/0000-0007-01219-312199')
    //     })
    // })

    describe('build()', () => {
        describe('with mandatory parameters', () => {
            const notification = EventNotification.build({
                type: namedNode("https://www.w3.org/ns/activitystreams#Announce"),
                actor: namedNode("https://orcid.org/0000-0007-01219-312199"),
                object: {
                    id: namedNode("https://acme.org/artifacts/alice/five_steps_to_success.html"),
                    type: [namedNode("https://www.w3.org/ns/activitystreams#Article")]
                }
            }
            )

            it('has id', () => {
                expect(notification.id).toBeDefined()
            })

            it('has correct actor and object id', () => {
                expect(notification).toHaveProperty('actor.id.id', 'https://orcid.org/0000-0007-01219-312199')
                expect(notification).toHaveProperty('object.id.id', 'https://acme.org/artifacts/alice/five_steps_to_success.html')
            })

            it('has correct types', () => {
                expect(notification.type).toContainEqual(namedNode("https://www.w3.org/ns/activitystreams#Announce"))
            })
        })
        describe('with id', () => {
            const notification = EventNotification.build({
                type: namedNode("https://www.w3.org/ns/activitystreams#Announce"),
                actor: namedNode("https://orcid.org/0000-0007-01219-312199"),
                object: {
                    id: namedNode("https://acme.org/artifacts/alice/five_steps_to_success.html"),
                    type: [namedNode("https://www.w3.org/ns/activitystreams#Article")]
                },
                id: namedNode("https://acme.org/events/alice/0F402B08-F676-40EE-9D4B-480B3F985B65")
            })

            it('has correct id', () => {
                expect(notification).toHaveProperty('id.id', "https://acme.org/events/alice/0F402B08-F676-40EE-9D4B-480B3F985B65")
            })

            it('creates notification object with id', () => {
                expect(notification).toHaveProperty('actor.id.id', 'https://orcid.org/0000-0007-01219-312199')
                expect(notification).toHaveProperty('object.id.id', 'https://acme.org/artifacts/alice/five_steps_to_success.html')
            })

            it('has correct types', () => {
                expect(notification.type).toContainEqual(namedNode("https://www.w3.org/ns/activitystreams#Announce"))
            })

            // TODO: there's an incompatibility between Jest and the latest jsonld package wrt resolving remote contexts
            // it('serialises', async () => {
            //     const result = await notification.serialize()

            //     expect(result).toEqual(JSON.stringify({
            //         "@context": "https://www.w3.org/ns/activitystreams",
            //         "@id": "https://acme.org/events/alice/0F402B08-F676-40EE-9D4B-480B3F985B65",
            //         "@type": "Announce",
            //         "actor": {
            //             "@id": "https://orcid.org/0000-0007-01219-312199"
            //         },
            //         "object": {
            //             "@id": "https://acme.org/artifacts/alice/five_steps_to_success.html"
            //         }
            //     }))
            // })
        })
    })
    describe('announce()', () => {
        describe('without context', () => {
            const notification = EventNotification.announce(
                namedNode("https://acme.org/artifacts/alice/five_steps_to_success.html"),
                namedNode("https://orcid.org/0000-0007-01219-312199")
            )

            it('must be of type as:Announce', () => {
                expect(notification.type).toContainEqual(namedNode("https://www.w3.org/ns/activitystreams#Announce"))
            })

            it('must not have context', () => {
                expect(notification).toHaveProperty('context', undefined)
            })

            it('must not have inReplyTo', () => {
                expect(notification).toHaveProperty('inReplyTo', undefined)
            })
        })
    })
    describe('create()', () => {

        const notification = EventNotification.create(
            namedNode("https://acme.org/artifacts/alice/five_steps_to_success.html"),
            namedNode("https://orcid.org/0000-0007-01219-312199")
        )

        it('must be of type as:Create', () => {
            expect(notification.type).toContainEqual(namedNode("https://www.w3.org/ns/activitystreams#Create"))
        })

        it('must not have context', () => {
            expect(notification).toHaveProperty('context', undefined)
        })

        it('must not have inReplyTo', () => {
            expect(notification).toHaveProperty('inReplyTo', undefined)
        })

    })
    describe('update()', () => {
        const notification = EventNotification.update(
            namedNode("https://acme.org/artifacts/alice/five_steps_to_success.html"),
            namedNode("https://orcid.org/0000-0007-01219-312199")
        )

        it('must be of type as:Update', () => {
            expect(notification.type).toContainEqual(namedNode("https://www.w3.org/ns/activitystreams#Update"))
        })

        it('must not have context', () => {
            expect(notification).toHaveProperty('context', undefined)
        })

        it('must not have inReplyTo', () => {
            expect(notification).toHaveProperty('inReplyTo', undefined)
        })
    })

    describe('offer()', () => {
        const notification = EventNotification.offer(
            namedNode("https://acme.org/artifacts/alice/five_steps_to_success.html"),
            namedNode("https://orcid.org/0000-0007-01219-312199")
        )

        it('must be of type as:Offer', () => {
            expect(notification.type).toContainEqual(namedNode("https://www.w3.org/ns/activitystreams#Offer"))
        })

        it('must not have context', () => {
            expect(notification).toHaveProperty('context', undefined)
        })

        it('must not have inReplyTo', () => {
            expect(notification).toHaveProperty('inReplyTo', undefined)
        })
    })

    describe('accept()', () => {
        const offer = EventNotification.offer(
            namedNode("https://acme.org/artifacts/alice/five_steps_to_success.html"),
            namedNode("https://orcid.org/0000-0007-01219-312199")
        )

        const notification = EventNotification.accept(
            offer,
            namedNode("https://orcid.org/0000-0007-01219-312200")
        )

        it('must be of type as:Accept', () => {
            expect(notification.type).toContainEqual(namedNode("https://www.w3.org/ns/activitystreams#Accept"))
        })

        it('must have context', () => {
            expect(notification).toHaveProperty('context')
            expect(notification.context).toBeDefined()
            expect(notification.context).toEqualRdfTerm(namedNode("https://acme.org/artifacts/alice/five_steps_to_success.html"))
        })

        it('must have inReplyTo', () => {
            expect(notification).toHaveProperty('inReplyTo', offer.id)
        })
    })

    describe('reject()', () => {
        const offer = EventNotification.offer(
            namedNode("https://acme.org/artifacts/alice/five_steps_to_success.html"),
            namedNode("https://orcid.org/0000-0007-01219-312199")
        )

        const notification = EventNotification.reject(
            offer,
            namedNode("https://orcid.org/0000-0007-01219-312200")
        )

        it('must be of type as:Reject', () => {
            expect(notification.type).toContainEqual(namedNode("https://www.w3.org/ns/activitystreams#Reject"))
        })

        it('must have context', () => {
            expect(notification).toHaveProperty('context')
            expect(notification.context).toBeDefined()
            expect(notification.context).toEqualRdfTerm(namedNode("https://acme.org/artifacts/alice/five_steps_to_success.html"))
        })

        it('must have inReplyTo', () => {
            expect(notification).toHaveProperty('inReplyTo', offer.id)
        })
    })
})
