import { PubSubPlugin } from "@akord/akord-js-pubsub-plugin"
import { Akord, Auth } from "@akord/akord-js";

const USERNAME = "michal+deploy@akord.com"
const PASSWORD = "michal kaliszewski"

async function main() {
  const { wallet } = await Auth.signIn(USERNAME!, PASSWORD!);
  const akord = new Akord(wallet, { env: 'dev',  plugins: [new PubSubPlugin()] });
  await akord.zip.subscribe((notification) => console.log(notification))
}

main().catch((e) => console.error(e));
