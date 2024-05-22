AkordJS <> Arweave Signer

## Usage

### Install dependencies

```sh
yarn add @akord/akord-js @akord/akord-js-arweave-signer
```

### Signup with Arweave signer

```js
import { ArweaveSigner } from "@akord/akord-js-arweave-signer"
import { Akord, Auth } from "@akord/akord-js";
import Arweave from "arweave";

// generate new Arweave wallet or use an existing one
const arweave = Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https'
});
const jwk = await arweave.wallets.generate();
const signer = new ArweaveSigner(jwk);
await Auth.signUpWithWallet({ wallet: signer, walletType: "ARWEAVE" });
```

### Use AkordJS with Arweave signer

```js
import { ArweaveSigner } from "@akord/akord-js-arweave-signer"
import { Akord, Auth } from "@akord/akord-js";

await Auth.signInWithWallet({ wallet: signer });
const akord = new Akord({ signer: signer });
const { vaultId } = await akord.vault.create("Vault created with Arweave", { public: true });
```

## Development

### Install dependencies

```sh
yarn install
```

### Test

```sh
node --inspect node_modules/.bin/jest ./src/__tests__/arweave.test.ts
```