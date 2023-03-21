# Event Notifications Typescript library

JavaScript library to participate in a value-adding network using [Event Notifications](https://www.eventnotifications.net/) and Solid pods.

## Install

```
yarn install
yarn build 
yarn link
```

## Usage in NodeJS

### Receiving event notifications from an LDN inbox

```javascript
import { Receiver } from "evno"
const options = {
  name: "", email: "", password: "", idp: ""
}
const receiver = await Receiver.build(options);
receiver.start("https://localhost:3000/inbox","notification_id") // Use the notifcation strategy
receiver.on('notification', async (n) => {
  // print notification
  console.log(n)

  // stop the watcher
  receiver.stop()
})
```

### Initalizing an LDN inbox in a Solid pod

```javascript
import { Receiver } from "evno"
const options = {
  name: "", email: "", password: "", idp: ""
}
const receiver = await Receiver.build(options);
const inbox = await receiver.init("https://localhost:3000/", "inbox/");
console.log(inbox) // "https://localhost:3000/inbox/"
```

### Sending an event notification

#### one-way pattern

```javascript
import { Sender } from "evno"
const options = {
  name: "", email: "", password: "", idp: ""
}

const actor = {
  id: "http://example.org/me"
}

const sender = Sender.build(actor, options);

// Announce
sender.announce("https://acme.org/artifacts/alice/five_steps_to_success.html") 
sender.create("https://acme.org/artifacts/alice/five_steps_to_success.html")
sender.update("https://acme.org/artifacts/alice/five_steps_to_success.html")
sender.remove("https://acme.org/artifacts/alice/five_steps_to_success.html")
```

#### Request-response pattern

```javascript
import { Sender } from "evno"
const options = {
  name: "", email: "", password: "", idp: ""
}

const actor = {
  id: "http://example.org/me"
}

const sender = await Sender.build(actor, options);

// Announce
await sender.offer("https://acme.org/artifacts/alice/five_steps_to_success.html") 
```

```javascript
import { Sender, Receiver } from "evno"
const options = {
  name: "", email: "", password: "", idp: ""
}

const actor = {
  id: "http://example.org/me"
}

const sender = await Sender.build(actor, options);
const receiver = await Receiver.build

// Announce
sender.offer("https://acme.org/artifacts/alice/five_steps_to_success.html") 
```

## Usage in command-line

```
  _____                 _   _   _       _   _  __ _           _   _                 
 | ____|_   _____ _ __ | |_| \ | | ___ | |_(_)/ _(_) ___ __ _| |_(_) ___  _ __  ___ 
 |  _| \ \ / / _ \ '_ \| __|  \| |/ _ \| __| | |_| |/ __/ _` | __| |/ _ \| '_ \/ __|
 | |___ \ V /  __/ | | | |_| |\  | (_) | |_| |  _| | (_| (_| | |_| | (_) | | | \__ \
 |_____| \_/ \___|_| |_|\__|_| \_|\___/ \__|_|_| |_|\___\__,_|\__|_|\___/|_| |_|___/
                                                                                    
Usage: evno [options] [command]

A CLI for using Linked Data Notification in Solid Pods

Options:
  -V, --version                     output the version number
  -n, --name <username>             Username
  -e, --email <email>               Email
  -p, --password <password>         Password
  -i, --idp <idp>                   Identity provider (default: "http://localhost:3001/")
  -t, --tokenLocation               Client token storage location
  -h, --help                        display help for command

Commands:
  receive [options] <inboxUrl>      Watch an inbox for new notifications
  init <baseUrl> [inboxPath]        Initialize an inbox
  send [options] <inboxUrl> <path>  Send a notification to a inbox
  help [command]                    display help for command
```