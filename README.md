# Event Notifications Typescript library

## Install

```
yarn install
yarn build 
yarn link
```

## Usage in NodeJS

### initalizing an inbox

```javascript
import { InboxWatcher } from "ldnlib"
const options = {
  name: "", email: "", password: "", idp: ""
}
const watcher = await InboxWatcher.create("https://localhost:3000/", options);
const inbox = await watcher.init("https://localhost:3000/", "inbox/");
console.log(inbox) // "https://localhost:3000/inbox/"
```

### Watching an inbox

```javascript
import { InboxWatcher } from "ldnlib"
const options = {
  name: "", email: "", password: "", idp: ""
}
const watcher = await InboxWatcher.create("https://localhost:3000/", options);
watcher.start("https://localhost:3000/inbox","notification") // Use the notifcation strategy
watcher.on('notification', async (n) => {
  // print notification
  console.log(n)

  // stop the watcher
  watcher.stop()
})
```

### Sending a nodification

```javascript
import { sendNotification, parseNotification } from "ldnlib"
const options = {
  name: "", email: "", password: "", idp: ""
}

const myParser = new JsonLdParser()
const myTextStream = fs.createReadStream(path)

// parse notification object from JSONLD
const notification = await parseNotification(myTextStream, myParser)

// send notification object
const { success, location } = await sendNotification(notification, "https://localhost:3000/inbox", options)
```

## Usage in command-line

```
  _     _       _ _ _     
 | | __| |_ __ | (_) |__  
 | |/ _` | '_ \| | | '_ \ 
 | | (_| | | | | | | |_) |
 |_|\__,_|_| |_|_|_|_.__/ 
                          
Usage: ldn [options] [command]

A CLI for using Linked Data Notification in Solid Pods

Options:
  -V, --version                         output the version number
  -n, --name <username>                 Username
  -e, --email <email>                   Email
  -p, --password <password>             Password
  -i, --idp <idp>                       Identity provider (default: "http://localhost:3000/")
  -h, --help                            display help for command

Commands:
  watch [options] <baseUrl> <inboxUrl>  Watch an inbox for new notifications
  init <baseUrl> [inboxPath]            Initialize an inbox.
  send [options] <inboxUrl> <path>      Send a notification to a inbox
  help [command]                        display help for command
```