import { describe, expect } from '@jest/globals'
import EventNotification from '../src/notification'
import * as fs from 'fs'
import { join } from "path"
import { JsonLdParser } from "jsonld-streaming-parser"
import { DataFactory } from 'n3'
const { namedNode } = DataFactory


function getAssetStream(path: string): fs.ReadStream {
    return fs.createReadStream(join(__dirname, path))
}

describe('EventNotification', () => {
    describe('parseNotification()', () => {
        it('parses notification response', async () => {

            const myParser = new JsonLdParser()

            const myTextStream = getAssetStream('./assets/notification.jsonld')

            const notification = await EventNotification.parse(myTextStream, myParser)

            expect(notification).toHaveProperty('id.id', "https://acme.org/events/alice/0F402B08-F676-40EE-9D4B-480B3F985B65")
            expect(notification).toHaveProperty('actor.id.id', 'https://orcid.org/0000-0007-01219-312199')
        })
    })
    describe('create()', () => {
        describe('with mandatory parameters', () => {
            const notification = EventNotification.create({
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
            const notification = EventNotification.create({
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
})
