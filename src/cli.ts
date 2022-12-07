#! /usr/bin/env node

import { Command } from "commander"
import figlet from "figlet"
import { InboxWatcher, sendNotification, parseNotification } from "./index.js"
import * as fs from 'fs'
import { JsonLdParser } from "jsonld-streaming-parser";

const program = new Command()

console.log(figlet.textSync("ldnlib"))

program
  .name("ldn")
  .version("1.0.0")
  .description("A CLI for using Linked Data Notification in Solid Pods")
  .requiredOption("-n, --name <username>", "Username")
  .requiredOption("-e, --email <email>", "Email")
  .requiredOption("-p, --password <password>", "Password")
  .option("-i, --idp <idp>", "Identity provider", "http://localhost:3000/")

program.command('watch', {})
  .description("Watch an inbox for new notifications")
  .argument("<base_url>", 'Base URL of the Solid pod')
  .option("-c, --cache  [value]", "Path to cache database", "~/.cache/")
  .option("-s, --strategy <notification_id|activity_id>", "Strategy filter by notification_id or by activity_id", "activity_id")
  .option("-o, --out <value>", "Output directory (the content of the resource)")
  // @ts-ignore
  .action(async (baseUrl, options) => {
    const watcher = new InboxWatcher(baseUrl)
    console.log('Logging in as %s', options.name)
    const inbox = await watcher.init(program.opts())

    console.log('Initalized inbox at %s', inbox)

    await watcher.start()
    watcher.on('notification', (n) => {
      console.log('received %s', n.id)
    })
  })

program.command('send')
.description("Send a notification to a inbox")
.argument("<inboxUrl>", 'Base URL of the Solid pod')
.argument("<path>", 'Path to JSON-LD notification')
.option("-i, --idp <idp>", "Identity provider", "http://localhost:3000/")
.action(async (inboxUrl, path) => {
  // read file and parse
  const myParser = new JsonLdParser();
  const myTextStream = fs.createReadStream(path)  
  const notification = await parseNotification(myTextStream, myParser);

  const success = await sendNotification(notification, inboxUrl, program.opts())
  console.log(success)
})

program.parse(process.argv)