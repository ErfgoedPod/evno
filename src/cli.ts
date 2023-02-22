#! /usr/bin/env node

import { Command } from "commander"
import figlet from "figlet"
import Receiver from "./receiver.js"
import Sender from "./sender.js"
import EventNotification from './notification.js'
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
  .option("-i, --idp <idp>", "Identity provider", "http://localhost:3000/")

program.command('watch')
  .description("Watch an inbox for new notifications")
  .argument("<baseUrl>", 'Base URL of the Solid pod')
  .argument("<inboxUrl>", 'Base URL of the Solid pod')
  .option("-c, --cache  [value]", "Path to cache database", "~/.cache/cache.dsb")
  .option("-s, --strategy <notification_id|activity_id>", "Strategy filter by notification_id or by activity_id", "activity_id")
  .option("-, --stdout", "Pipe output to stdout", false)
  .option("-o, --out <value>", "Output directory (the content of the resource)")
  // @ts-ignore
  .action(async (baseUrl, inboxUrl, options) => {

    const receiver = await Receiver.create(baseUrl, options);

    (!options.stdout) && console.log('Logging in as %s', options.name)

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
    const gOptions = program.opts()
    const watcher = await Receiver.create(baseUrl, {
      name: gOptions.name, email: gOptions.email, password: gOptions.password, idp: gOptions.idp
    });

    (!options.stdout) && console.log('Logging in as %s', gOptions.name)

    const inbox: string = await watcher.init(baseUrl, inboxPath);

    (!options.stdout) && console.log('Initalized inbox at %s', inbox)
  })

program.command('send')
  .description("Send a notification to a inbox")
  .argument("<inboxUrl>", 'URL of the LDN inbox')
  .argument("<path>", 'Path to JSON-LD notification')
  .option("-i, --idp <idp>", "Identity provider", "http://localhost:3000/")
  .action(async (inboxUrl, path) => {
    // read file and parse
    const myParser = new JsonLdParser()
    const myTextStream = fs.createReadStream(path)
    const notification = await EventNotification.parse(myTextStream, myParser)

    const sender = new Sender(notification.actor.id)
    const { success, location } = await sender.send(notification, inboxUrl, program.opts())
    if (success) {
      return console.log('Notification %s delivered at %s', notification.id, location)
    }
    console.log('Failed to deliver notification %s', notification.id)
  })

program.parse(process.argv)