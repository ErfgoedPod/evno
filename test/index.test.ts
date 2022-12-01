import { describe, expect } from '@jest/globals';
import { parseNotification } from '../src';
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

        const notification = await parseNotification(myTextStream, myParser);

        expect(notification).toHaveProperty('id', "https://acme.org/events/alice/0F402B08-F676-40EE-9D4B-480B3F985B65")
    });
});
