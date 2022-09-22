# akord-js

Akord Client for interacting with Akord.

### Usage

#### Import
**with email & password**
```js
import Akord from "@akord/akord-js";
const akord = Akord.signIn(email, password);
```
**with Akord Wallet & JWT**
```js
import Akord from "@akord/akord-js";
const akord = Akord.init({}, akordWallet, jwtToken);
```

#### Create vault
```js
const { vaultId } = await akord.vaultCreate("my first vault");
```

#### Upload file to the vault by creating new stack
```js
const { stackId } = await akord.stackCreate(vaultId, file, "my first file stack");
```

#### Download latest file version of the stack
```js
const decryptedFile = await akord.getStackFile(stackId);
```

#### Query user vaults
```js
const vaults = await akord.getVaults();
```

### Examples
See our [demo app tutorial](https://akord-js-tutorial.akord.com) and learn how to create,
contribute and access an Akord Vault.\
We also have some example flows in our [tests](src/__tests__) repository.

### Development
> requires Node.js 16

```
yarn install
yarn build
```

To run all tests:
```
yarn test
```

To run single test file:
```
yarn test <path-to-test-file>

yarn test ./src/__tests__/memo.test.ts
```

To run single test file with direct log output:
```
node --inspect node_modules/.bin/jest <path-to-test-file>

node --inspect node_modules/.bin/jest ./src/__tests__/folder.test.ts
```

### Deployment

After merging your PR to `main`:
- go to [Actions Tab](https://github.com/Akord-com/akord-js/actions)
- select `Start new build` [workflow](https://github.com/Akord-com/akord-js/actions/workflows/version-bump.yml)
- run `Workflow` for branch `main`
  - it will update package version
  - will create a release
  - will build and publish it to NPM
