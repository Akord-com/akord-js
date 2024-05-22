AkordJS <> Ethereum Signer

## Usage

### Install dependencies

```sh
yarn add @akord/akord-js @akord/akord-js-ethereum-signer
```

### Signup with Ethereum signer

```js
import { EthereumSigner } from "@akord/akord-js-ethereum-signer"
import { Akord, Auth } from "@akord/akord-js";
import { ethers } from "ethers";

// generate new Ethereum wallet or use an existing one
const wallet = ethers.Wallet.createRandom();
const signer = new EthereumSigner({ privateKey: wallet.privateKey });
await Auth.signUpWithWallet({ wallet: signer, walletType: "ETHEREUM" });
```

### Use AkordJS with Ethereum signer

```js
import { EthereumSigner } from "@akord/akord-js-ethereum-signer"
import { Akord, Auth } from "@akord/akord-js";

await Auth.signInWithWallet({ wallet: signer });
const akord = new Akord({ signer: signer });
const { vaultId } = await akord.vault.create("Vault created with Ethereum", { public: true });
```

## Development

### Install dependencies

```sh
yarn install
```

### Test

```sh
node --inspect node_modules/.bin/jest ./src/__tests__/ethereum.test.ts
```