#! /usr/bin/env node --experimental-specifier-resolution=node
import { IAuthOptions } from "./interfaces.js"
import { Command, InvalidArgumentError } from "commander"
import figlet from "figlet"
import Receiver from "./receiver.js"
import Sender from "./sender.js"
import EventNotification from './notification.js'
import * as fs from 'fs'
import { JsonLdParser } from "jsonld-streaming-parser"
import { getId } from "./util.js"
import parse from 'parse-duration';


const program = new Command()

console.log(figlet.textSync("EventNotifications"))

function parseDuration(value: string) {
  // Parse accepts milliseconds or a wide range of
  // human reable inputs, e.g 1h30m10s
  const parsedValue = parse(value);
  if (isNaN(parsedValue)) {
    throw new InvalidArgumentError('Not a number.')
  }
  return parsedValue
}

program
  .name("evno")
  .version("1.0.0")
  .description("A CLI for using Linked Data Notification in Solid Pods")
  .option("-n, --name <username>", "Username")
  .option("-e, --email <email>", "Email")
  .option("-p, --password <password>", "Password")
  .option("-i, --idp <idp>", "Identity provider")
  .option("-t, --tokenLocation <tokenLocation>", "Client token storage location")
  .option("-v, --verbose", "Output verbose logging", false)

program.command('receive')
  .description("Watch an inbox for new notifications")
  .argument("<inboxUrl>", 'Inbox URL to watch')
  .argument("[path]", "Output path")
  .option("-c, --cachePath  [value]", "Path to cache database", ".cache/cache.dsb")
  .option("-s, --strategy <notification_id|activity_id>", "Strategy filter by notification_id or by activity_id", "activity_id")
  .option("-, --stdout", "Pipe output to stdout")
  .option("-n, --nocache", "Don't persist cache")
  .option("-f, --pollingFrequency  <duration>", "The frequency to poll the inbox", parseDuration, 1000)
  .option("-o, --out <value>", "Output directory (the content of the resource)")
  // @ts-ignore
  .action(async (inboxUrl, path?, options) => {
    const { name, email, password, idp, tokenLocation, verbose} = program.opts()
    const receiver = await Receiver.build({
      name, email, password, idp, tokenLocation, cache: !options.nocache, cachePath: options.cachePath, pollingFrequency: options.pollingFrequency
    });

    (!options.stdout) && console.log('Logged with id %s', receiver.webId)

    receiver.start(inboxUrl, options.strategy)
    receiver.on('notification', async (n: EventNotification) => {
      if (path) {
        const id = getId().value;
        const file = `${path}/${id}`;
        if (verbose) {
          console.log(`Generating ${file}`);
        }
        fs.writeFileSync(file,await n.serialize())
      }
      else {
        console.log(await n.serialize())
      }
    })
    receiver.on('error', e => {
      if (verbose) {
        console.error(e)
      }
    });
  })

program.command('init')
  .description('Initialize an inbox')
  .argument("<baseUrl>", 'Base URL of the Solid pod')
  .argument("[inboxPath]", 'Path to inbox')
  .action(async (baseUrl, inboxPath, options) => {
    const { name, email, password, idp, tokenLocation } = program.opts()
    const receiver = await Receiver.build({
      name, email, password, idp, tokenLocation
    });

    (!options.stdout) && console.log('Logged in as \'%s\' with id %s', name, receiver.webId)

    const inbox: string = await receiver.init(baseUrl, inboxPath);

    (!options.stdout) && console.log('Initalized inbox at %s', inbox)
  })

program.command('grant')
  .description('Grant an agent access to inbox')
  .argument("<inboxUrl>", 'URL of the LDN inbox')
  .argument("<agentUri>", 'URI or WebID of the Agent')
  .action(async (inboxUrl, agentUri, options) => {
    const { name, email, password, idp, tokenLocation } = program.opts()
    const receiver = await Receiver.build({
      name, email, password, idp, tokenLocation
    });
    (!options.stdout) && console.log('Logged in as \'%s\' with id %s', name, receiver.webId)
    await receiver.grantAccess(inboxUrl, agentUri)
  })

program.command('login')
  .description('Generate a login token at the specified location')
  .action(async (options) => {
    const { name, email, password, idp, tokenLocation } = program.opts()
    const receiver = await Receiver.build({
      name, email, password, idp, tokenLocation
    });
    (!options.stdout) && console.log('Logged in as \'%s\' with id %s', name, receiver.webId);
    (!options.stdout) && console.log('Token is stored at \'%s\'', tokenLocation)
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
    const response = await sender.send(notification, inboxUrl)
    if (response.ok) {
      return console.log('Notification %s delivered at %s', notification.id, response.headers.get('location'))
    }
    console.log('Failed to deliver notification %s', notification.id)
  })

program.parse(process.argv)