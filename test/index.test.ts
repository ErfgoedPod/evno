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
    describe('parseNotification', () => {
        it('parses notification response', async () => {

            const myParser = new JsonLdParser()

            const myTextStream = getAssetStream('./assets/notification.jsonld')

            const notification = await EventNotification.parse(myTextStream, myParser)

            expect(notification).toHaveProperty('id.id', "https://acme.org/events/alice/0F402B08-F676-40EE-9D4B-480B3F985B65")
            expect(notification).toHaveProperty('actor.id.id', 'https://orcid.org/0000-0007-01219-312199')
        })
    })
    describe('create()', () => {
        it('creates notification object', () => {
            const notification = EventNotification.create(
                namedNode("https://www.w3.org/ns/activitystreams#Announce"),
                namedNode("https://orcid.org/0000-0007-01219-312199"),
                namedNode("https://acme.org/artifacts/alice/five_steps_to_success.html")
            )

            expect(notification).toHaveProperty('actor.id.id', 'https://orcid.org/0000-0007-01219-312199')
            expect(notification).toHaveProperty('object.id.id', 'https://acme.org/artifacts/alice/five_steps_to_success.html')
        })
        it('creates notification object with id', () => {
            const notification = EventNotification.create(
                namedNode("https://www.w3.org/ns/activitystreams#Announce"),
                namedNode("https://orcid.org/0000-0007-01219-312199"),
                namedNode("https://acme.org/artifacts/alice/five_steps_to_success.html"),
                undefined, 
                undefined, 
                namedNode("https://acme.org/events/alice/0F402B08-F676-40EE-9D4B-480B3F985B65") 
            )
            expect(notification).toHaveProperty('id.id', "https://acme.org/events/alice/0F402B08-F676-40EE-9D4B-480B3F985B65")
            expect(notification).toHaveProperty('actor.id.id', 'https://orcid.org/0000-0007-01219-312199')
            expect(notification).toHaveProperty('object.id.id', 'https://acme.org/artifacts/alice/five_steps_to_success.html')
        })
    })
})

