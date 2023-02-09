import { describe, expect } from '@jest/globals';
import EventNotification from '../src/notification';
import * as fs from 'fs'
import { join } from "path";
import { JsonLdParser } from "jsonld-streaming-parser";


function getAssetStream(path: string): fs.ReadStream {
    return fs.createReadStream(join(__dirname, path))
}

describe('parseNotification', () => {
    it('parses notification response', async () => {

        const myParser = new JsonLdParser();

        const myTextStream = getAssetStream('./assets/notification.jsonld');

        const notification = await EventNotification.parse(myTextStream, myParser);

        expect(notification).toHaveProperty('id.id', "https://acme.org/events/alice/0F402B08-F676-40EE-9D4B-480B3F985B65")
    });
});
