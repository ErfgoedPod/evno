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

### Listening to errors

```javascript
import { Receiver } from "evno"
const options = {
  name: "", email: "", password: "", idp: ""
}
const receiver = await Receiver.build(options);
receiver.start("https://localhost:3000/inbox","notification_id") // Use the notifcation strategy
receiver.on('error.parsing', async (e) => {
  console.log(e)
})
receiver.on('error.fetch', async (e) => {
  console.log(e)
})
receiver.on('error', async (e) => {
  console.log(e)
})
```

| Event | Description |
| ----- | ----------- |
| `error.fetch`| Fetching the notification resource failed |
| `error.parsing`| The notification was fetched, but failed to parse. |
| `error`| An error occurred with processing the notification.  |

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

### Grant an agent quick append access to an LDN inbox in a Solid pod

```javascript
import { Receiver } from "evno"
const options = {
  name: "", email: "", password: "", idp: ""
}
const receiver = await Receiver.build(options);
await receiver.grantAccess("https://localhost:3000/inbox/", "https://example.org/webid#me");
```

### Sending an event notification

```javascript
import { Sender } from "evno"
const options = {
  name: "", email: "", password: "", idp: ""
}

const actor = {
  id: "http://example.org/me"
}

const sender = Sender.build(actor, options);
const response = sender.send() // Returns a Fetch API Response object

if (response.ok) {
  console.log('The notification was sent successfully')
}
```


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

// Send an Announce
await sender.announce("https://acme.org/artifacts/alice/five_steps_to_success.html") 

// Send a Create 
await sender.create("https://acme.org/artifacts/alice/five_steps_to_success.html")

// Send an Update
await sender.update("https://acme.org/artifacts/alice/five_steps_to_success.html")

// Send a Remove
await sender.remove("https://acme.org/artifacts/alice/five_steps_to_success.html")
```

The previous examples assume [autodiscovery of the inbox](https://www.eventnotifications.net/#Discovery). 
You can also supply the inbox explicitely as follows:

```javascript
await sender.announce("https://acme.org/artifacts/alice/five_steps_to_success.html", "https://example.org/inbox/") 

// If the target inbox uses different credentials, you can override the default ones as well
await sender.announce("https://acme.org/artifacts/alice/five_steps_to_success.html", "https://example.org/inbox/", {
  name: "", email: "", password: "", idp: ""
}) 

```


#### Request-response pattern

Sending the request:

```javascript
import { Sender } from "evno"
const options = {
  name: "", email: "", password: "", idp: ""
}

const actor = {
  id: "http://example.org/agentA"
}

const sender = await Sender.build(actor, options);

// Announce
await sender.offer("https://acme.org/artifacts/alice/five_steps_to_success.html", "https://localhost:3000/inbox") 
```

Sending the response:

```javascript
import { Sender, Receiver } from "evno"

// Authentication options for target inbox
const optionsSender = {
  name: "", email: "", password: "", idp: ""
}

// Authentication options for own inbox
const optionsReceiver = {
  name: "", email: "", password: "", idp: ""
}

const actor = {
  id: "http://example.org/agentB"
}

const sender = await Sender.build(actor, optionsSender);
const receiver = await Receiver.build(optionsReceiver);
receiver.start("https://localhost:3000/inbox","notification_id") // Use the notifcation strategy
receiver.on('notification', async (n) => {
  // Do something with notification

  await sender.accept(n)
  // OR
  await sender.reject(n)
})
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
  -V, --version                        output the version number
  -n, --name <username>                Username
  -e, --email <email>                  Email
  -p, --password <password>            Password
  -i, --idp <idp>                      Identity provider (default: "http://localhost:3001/")
  -t, --tokenLocation <tokenLocation>  Client token storage location (default: "./")
  -v, --verbose                        Output verbose logging (default: false)
  -h, --help                           display help for command

Commands:
  receive [options] <inboxUrl> [path]  Watch an inbox for new notifications
  init <baseUrl> [inboxPath]           Initialize an inbox
  grant <inboxUrl> <agentUri>          Grant an agent access to inbox
  login                                Generate a login token at the specified location
  send [options] <inboxUrl> <path>     Send a notification to a inbox
  help [command]                       display help for command
```
