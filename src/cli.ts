#! /usr/bin/env node --experimental-specifier-resolution=node

import { Command } from "commander"
import figlet from "figlet"
import Receiver from "./receiver"
import Sender, {IAuthOptions} from "./sender"
import EventNotification from './notification'
import * as fs from 'fs'
import { JsonLdParser } from "jsonld-streaming-parser"


const program = new Command()

console.log(figlet.textSync("EventNotifications"))

program
  .name("evno")
  .version("1.0.0")
  .description("A CLI for using Linked Data Notification in Solid Pods")
  .requiredOption("-n, --name <username>", "Username")
  .requiredOption("-e, --email <email>", "Email")
  .requiredOption("-p, --password <password>", "Password")
  .option("-i, --idp <idp>", "Identity provider", "http://localhost:3001/")
  .option("-t, --tokenLocation", "Client token storage location", "./")

program.command('receive')
  .description("Watch an inbox for new notifications")
  .argument("<inboxUrl>", 'Inbox URL to watch')
  .option("-c, --cachePath  [value]", "Path to cache database", ".cache/cache.dsb")
  .option("-s, --strategy <notification_id|activity_id>", "Strategy filter by notification_id or by activity_id", "activity_id")
  .option("-, --stdout", "Pipe output to stdout")
  .option("-n, --nocache", "Don't persist cache")
  .option("-o, --out <value>", "Output directory (the content of the resource)")
  // @ts-ignore
  .action(async (inboxUrl, options) => {
    const { name, email, password, idp, clientCredentialsTokenStorageLocation } = program.opts()
    const receiver = await Receiver.build({
      name, email, password, idp, clientCredentialsTokenStorageLocation, cache: !options.nocache, cachePath: options.cachePath
    });

    (!options.stdout) && console.log('Logged in as \'%s\' with id %s', name, receiver.webId)

    receiver.start(inboxUrl, options.strategy)
    receiver.on('notification', async (n: EventNotification) => {
      console.log(await n.serialize())
    })
  })

program.command('init')
  .description('Initialize an inbox')
  .argument("<baseUrl>", 'Base URL of the Solid pod')
  .argument("[inboxPath]", 'Path to inbox')
  .action(async (baseUrl, inboxPath, options) => {
    const { name, email, password, idp, clientCredentialsTokenStorageLocation } = program.opts()
    const receiver = await Receiver.build({
      name, email, password, idp, clientCredentialsTokenStorageLocation
    });

    (!options.stdout) && console.log('Logged in as \'%s\' with id %s', name, receiver.webId)

    const inbox: string = await receiver.init(baseUrl, inboxPath);

    (!options.stdout) && console.log('Initalized inbox at %s', inbox)
  })

program.command('send')
  .description("Send a notification to a inbox")
  .argument("<inboxUrl>", 'URL of the LDN inbox')
  .argument("<path>", 'Path to JSON-LD notification')
  .option("-i, --idp <idp>", "Identity provider", "http://localhost:3001/")
  .action(async (inboxUrl, path) => {
    // read file and parse
    const myParser = new JsonLdParser()
    const myTextStream = fs.createReadStream(path)
    const notification = await EventNotification.parse(myTextStream, myParser)

    const sender = await Sender.build(notification.actor, program.opts() as IAuthOptions)
    const { success, location } = await sender.send(notification, inboxUrl)
    if (success) {
      return console.log('Notification %s delivered at %s', notification.id, location)
    }
    console.log('Failed to deliver notification %s', notification.id)
  })

program.parse(process.argv)