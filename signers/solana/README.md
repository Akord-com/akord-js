AkordJS <> Solana Signer

## Usage

### Install dependencies

```sh
yarn add @akord/akord-js @akord/akord-js-solana-signer
```

### Signup with Solana signer

```js
import { SolanaSigner } from "@akord/akord-js-solana-signer"
import { Akord, Auth } from "@akord/akord-js";
import solanaWeb3 from "@solana/web3.js"

// generate new Solana keypair or use an existing one
const keypair = solanaWeb3.Keypair.generate();
const signer = new SolanaSigner({ keypair: keypair });
await Auth.signUpWithWallet({ wallet: signer, walletType: "SOLANA" });
```

### Use AkordJS with Solana signer

```js
import { SolanaSigner } from "@akord/akord-js-solana-signer"
import { Akord, Auth } from "@akord/akord-js";

await Auth.signInWithWallet({ wallet: signer });
const akord = new Akord({ signer: signer });
const { vaultId } = await akord.vault.create("Vault created with Solana", { public: true });
```

## Development

### Install dependencies

```sh
yarn install
```

### Test

```sh
node --inspect node_modules/.bin/jest ./src/__tests__/solana.test.ts
```