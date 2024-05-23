# PubSub Plugin

Simple showcase of pubsub plugin usage in browser app (React) & on server (Node)

# Steps

1. Install the plugin

`npm install @akord/akord-js-pubsub-plugin`

2. Import the plugin and instationate Akord SDK

```javascript 
import { PubSubPlugin } from "@akord/akord-js-pubsub-plugin"
import { Akord, Auth } from "@akord/akord-js";

const { wallet } = await Auth.signIn('your_username', 'your_password');
const akord = new Akord(wallet, { plugins: [new PubSubPlugin()] });
```

3. Use un/-subscribe methods

```javascript 
await akord.current.zip.subscribe((notification) => console.log(notification), (err) => console.error(err))
```

4. Trigger the corresponding pub/sub

```javascript 
await akord.current.zip.upload('some_vault_id', zipFileArrayBuffer)
```

5. Wait for pubsub to trigger your subscribe function...
