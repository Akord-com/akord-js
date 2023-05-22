# akord-js

Akord Client - a set of core js functions to interact with [Akord](https://docs.akord.com/).\
This package can be used in both browser and Node.js environments.

- [Usage](#usage)
  - [Import](#import)
  - [Quick Start](#quick-start)
  - [Examples](#examples)
- [Modules](#modules)
  - [Auth](#authentication)
  - [Vault](#vault)
  - [Membership](#membership)
  - [Memo](#memo)
  - [Stack](#stack)
  - [File](#file)
  - [Folder](#folder)
  - [Note](#note)
  - [Manifest](#manifest)
  - [Contract](#contract)
  - [Profile](#profile)
  - [Batch](#batch)
- [Development](#development)
- [Deployment](#deployment)

## Usage
> requires Node.js 16

### Import
```js
import { Akord } from "@akord/akord-js";
```
or
```js
const { Akord } = require("@akord/akord-js");
```

### Quick start

#### Init Akord
```js
import { Akord, Auth } from "@akord/akord-js";
const { wallet } = await Auth.signIn(email, password);
const akord = await Akord.init(wallet);
```

#### Create vault
```js
const { vaultId } = await akord.vault.create("my first vault");
```

#### Upload file to the vault by creating new stack
```js
const { stackId } = await akord.stack.create(vaultId, file, "my first file stack");
```

#### Download latest file version of the stack
```js
const { data: fileBuffer, name: fileName } = await akord.stack.getVersion(stackId);
```

#### Query user vaults
```js
const vaults = await akord.vault.listAll();
```

### Examples
- See our [demo app tutorial](https://akord-js-tutorial.akord.com) and learn how to create,
contribute and access an Akord Vault from.

- See example flows in our [tests repo](src/__tests__).

- See different setups on [recipes repo](https://github.com/Akord-com/recipes).

## Authentication
Use `Auth` module to handle authentication.

```js
import { Auth } from "@akord/akord-js";
```

- By default `Auth` is using SRP authentication
- `Auth` stores tokens in `Storage` implementation 
- `Storage` defaults to localStorage on web & memoryStorage on nodeJs
- `Storage` implementation can be configured with `Auth.configure({ storage: window.sessionStorage })`
- `Auth` is automatically refreshing tokens in SRP mode
- On server side it is recommended to use API keys: `Auth.configure({ apiKey: 'your_api_key' })`
- API key: can be generated over web app & over CLI

##### use short living token with refresh
```js
import { Auth } from "@akord/akord-js";
Auth.configure({ storage: window.sessionStorage }); // optionally - configure tokens store
```
##### use API key
```js
import { Auth } from "@akord/akord-js";
Auth.configure({ apiKey: "api_key" });
```
##### use self-managed auth token
```js
import { Akord, Auth } from "@akord/akord-js";
Auth.configure({ authToken: "auth_token" });
```

#### `signIn(email, password)`

- `email` (`string`, required)
- `password` (`string`, required)
- returns `Promise<{ wallet, jwt }>` - Promise with JWT token & Akord Wallet

<details>
  <summary>example</summary>

```js
const { wallet } = await Auth.signIn("winston@gmail.com", "1984");
```
</details>

#### `signUp(email, password)`

- `email` (`string`, required)
- `password` (`string`, required)
- `clientMetadata` (`any`, optional) - JSON client metadata, ex: { clientType: "CLI" }
- returns `Promise<{ wallet }>` - Promise with Akord Wallet

<details>
  <summary>example</summary>

```js
const { wallet } = await Auth.signUp("winston@gmail.com", "1984");
```
</details>

#### `verifyAccount(email, code)`

- `email` (`string`, required)
- `code` (`string`, required)
- returns `Promise<void>`

<details>
  <summary>example</summary>

```js
await Auth.verifyAccount("winston@gmail.com", 123456);
```
</details>


## Modules

### vault

#### `create(name, options)`

- `name` (`string`, required) - new vault name
- `options` (`VaultCreateOptions`, optional) - public/private, terms of access, etc.
- returns `Promise<{ vaultId, membershipId, transactionId }>` - Promise with new vault id, owner membership id & corresponding transaction id

<details>
  <summary>example</summary>

```js
// create a private vault
const { vaultId, membershipId } = await akord.vault.create("my first private vault");

// create a public vault with terms of access
const { vaultId, membershipId } = await akord.vault.create(
  "my first public vault",
  { public: true, termsOfAccess: "terms of access here - if the vault is intended for professional or legal use, you can add terms of access and they must be digitally signed before accessing the vault" }
);

// create a public vault with description & tags for easier lookup
const { vaultId, membershipId } = await akord.vault.create("Arty podcast", {
    public: true,
    description: "A permanent podcast dedicated to art history",
    tags: ["art", "podcast", "archive"]
  });
```
</details>

#### `update(vaultId, options)`

- `vaultId` (`string`, required)
- `options` (`VaultUpdateOptions`, required) - name, description & tags
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.vault.update(vaultId, {
  name: "color palette",
  description: "color inspiration for design and art projects",
  tags: ["taupe", "burgundy", "mauve"]
});
```
</details>

#### `rename(vaultId, name)`

- `vaultId` (`string`, required)
- `name` (`string`, required) - new vault name
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.vault.rename(vaultId, "updated name");
```
</details>

#### `addTags(vaultId, tags)`

- `vaultId` (`string`, required)
- `tags` (`string[]`, required) - tags to be added
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.vault.addTags(vaultId, ["taupe", "burgundy"]);
```
</details>

#### `removeTags(vaultId, tags)`

- `vaultId` (`string`, required)
- `tags` (`string[]`, required) - tags to be removed
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.vault.removeTags(vaultId, ["taupe", "burgundy"]);
```
</details>

#### `archive(vaultId)`

- `vaultId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.vault.archive(vaultId);
```
</details>

#### `restore(vaultId)`

- `vaultId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.vault.restore(vaultId);
```
</details>

#### `delete(vaultId)`

- `vaultId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.vault.delete(vaultId);
```
</details>

#### `get(vaultId, options)`

- `vaultId` (`string`, required)
- `options` ([`VaultGetOptions`][vault-get-options], optional)
- returns `Promise<Vault>` - Promise with the vault object

<details>
  <summary>example</summary>

```js
const vault = await akord.vault.get(vaultId);
```
</details>

#### `listAll(options)`

- `options` ([`ListOptions`][list-options], optional)
- returns `Promise<Array<Vault>>` - Promise with currently authenticated user vaults

<details>
  <summary>example</summary>

```js
const vaults = await akord.vault.listAll();
```
</details>

#### `list(listOptions)`

- `options` ([`ListOptions`][list-options], optional)
- returns `Promise<{ items, nextToken }>` - Promise with paginated user vaults

<details>
  <summary>example</summary>

```js
// retrieve first 100 user vaults
const { items } = await akord.vault.list();

// retrieve first 20 user vaults
const { items } = await akord.vault.list({ limit: 20 });

// iterate through all user vaults
let token = null;
let vaults = [];
do {
  const { items, nextToken } = await akord.vault.list({ nextToken: token });
  vaults = vaults.concat(items);
  token = nextToken;
} while (token);
```
</details>

### membership

#### `invite(vaultId, email, role)`

Invite user with an Akord account

- `vaultId` (`string`, required)
- `email` (`string`, required) - invitee's email
- `role` ([`RoleType`][role-type], required) - VIEWER/CONTRIBUTOR/OWNER
- `options` (`MembershipCreateOptions`, optional) - invitation email message, etc.
- returns `Promise<{ membershipId, transactionId }>` - Promise with new membership id & corresponding transaction id

<details>
  <summary>example</summary>

```js
const { membershipId } = await akord.membership.invite(vaultId, "winston@gmail.com", "VIEWER");
```
</details>

#### `inviteNewUser(vaultId, email, role)`

Invite user without an Akord account

- `vaultId` (`string`, required)
- `email` (`string`, required) - invitee's email
- `role` ([`RoleType`][role-type], required) - VIEWER/CONTRIBUTOR/OWNER
- `options` (`MembershipCreateOptions`, optional) - invitation email message, etc.
- returns `Promise<{ transactionId }>` - Promise with new membership id & corresponding transaction id

<details>
  <summary>example</summary>

```js
const { membershipId } = await akord.membership.inviteNewUser(vaultId, "winston@gmail.com", "VIEWER");
```
</details>

#### `airdrop(vaultId, members)`

Airdrop access to the vault to the batch of public keys. New members can access/contribute the vault using their private/public key pair. \
NOTE: If the new members are contributors, what they contribute is under the domain of the vault owner.

<details>
  <summary>example</summary>

```js
import { Akord, Auth } from "@akord/akord-js";
import { AkordWallet } from "@akord/crypto";

const wallet1 = await AkordWallet.create();
const wallet2 = await AkordWallet.create();

await akord.membership.airdrop(vaultId, [
   { publicSigningKey: wallet1.signingPublicKey(), publicKey: wallet1.publicKey(), role: "VIEWER" },
   { publicSigningKey: wallet2.signingPublicKey(), publicKey: wallet2.publicKey(), role: "CONTRIBUTOR" }
]);

// access the vault as user 1
await Auth.signInWithWallet(wallet1);
const akord1 = new Akord(wallet1);
console.log(await akord1.vault.get(vaultId));

// access the vault as user 2
await Auth.signInWithWallet(wallet2);
const akord2 = new Akord(wallet2);
console.log(await akord2.vault.get(vaultId));
```
</details>

#### `accept(membershipId)`

- `membershipId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.membership.accept(membershipId);
```
</details>

#### `confirm(membershipId)`

- `membershipId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.membership.confirm(membershipId);
```
</details>

#### `reject(membershipId)`

Reject pending invitation

- `membershipId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.membership.reject(membershipId);
```
</details>

#### `leave(membershipId)`

Reject already accepted invitation

- `membershipId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.membership.leave(membershipId);
```
</details>

#### `revoke(membershipId)`

Revoke a membership, update also each valid membership with new rotated keys

- `membershipId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.membership.revoke(membershipId);
```
</details>

#### `changeRole(membershipId, role)`

- `membershipId` (`string`, required)
- `role` ([`RoleType`][role-type], required) - VIEWER/CONTRIBUTOR/OWNER
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.membership.changeRole(membershipId, "CONTRIBUTOR");
```
</details>

#### `inviteResend(membershipId)`

Resend email invitation

- `membershipId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.membership.inviteResend(membershipId);
```
</details>

#### `get(membershipId, options)`

- `membershipId` (`string`, required)
- `options` ([`GetOptions`][get-options], optional)
- returns `Promise<Membership>` - Promise with the membership object

<details>
  <summary>example</summary>

```js
const membership = await akord.membership.get(membershipId);
```
</details>

#### `listAll(vaultId, options)`

- `vaultId` (`string`, required)
- `options` ([`ListOptions`][list-options], optional)
- returns `Promise<Array<Membership>>` - Promise with all memberships within given vault

<details>
  <summary>example</summary>

```js
const memberships = await akord.membership.listAll(vaultId);
```
</details>

#### `list(vaultId, options)`

- `vaultId` (`string`, required)
- `options` ([`ListOptions`][list-options], optional)
- returns `Promise<{ items, nextToken }>` - Promise with paginated memberships within given vault

<details>
  <summary>example</summary>

```js
// retrieve first 100 memberships for the vault
const { items } = await akord.membership.list(vaultId);

// retrieve first 20 memberships for the vault
const { items } = await akord.membership.list(vaultId, { limit: 20 });

// iterate through all memberships
let token = null;
let memberships = [];
do {
  const { items, nextToken } = await akord.membership.list(vaultId, { nextToken: token });
  memberships = memberships.concat(items);
  token = nextToken;
} while (token);
```
</details>

### memo

#### `create(vaultId, message)`

- `vaultId` (`string`, required)
- `message` (`string`, required) - memo content
- `options` (`NodeCreateOptions`, optional) - parent id, etc.
- returns `Promise<{ memoId, transactionId }>` - Promise with new memo id & corresponding transaction id

<details>
  <summary>example</summary>

```js
const { memoId } = await akord.memo.create(vaultId, "Suspendisse ut lorem vitae lectus faucibus lacinia");
```
</details>

#### `addReaction(memoId, reaction)`

- `memoId` (`string`, required)
- `reaction` (`reactionEmoji`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
import { Akord } from "@akord/akord-js"
// valid values: [JOY, ASTONISHED, CRY, HEART, FIRE, THUMBS_UP, THUMBS_DOWN, PRAY]
const { transactionId } = await akord.memo.addReaction(memoId, Akord.reactionEmoji.FIRE);
```
</details>

#### `removeReaction(memoId, reaction)`

- `memoId` (`string`, required)
- `reaction` (`reactionEmoji`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
import { Akord } from "@akord/akord-js"
// valid values: [JOY, ASTONISHED, CRY, HEART, FIRE, THUMBS_UP, THUMBS_DOWN, PRAY]
const { transactionId } = await akord.memo.removeReaction(memoId, Akord.reactionEmoji.FIRE);
```
</details>

#### `get(memoId, options)`

- `memoId` (`string`, required)
- `options` ([`GetOptions`][get-options], optional)
- returns `Promise<Memo>` - Promise with the memo object

<details>
  <summary>example</summary>

```js
const memo = await akord.memo.get(memoId);
```
</details>

#### `listAll(vaultId, options)`

- `vaultId` (`string`, required)
- `options` ([`ListOptions`][list-options], optional)
- returns `Promise<Array<Memo>>` - Promise with all memos within given vault

<details>
  <summary>example</summary>

```js
const memos = await akord.memo.listAll(vaultId);
```
</details>

#### `list(vaultId, options)`

- `vaultId` (`string`, required)
- `options` ([`ListOptions`][list-options], optional)
- returns `Promise<{ items, nextToken }>` - Promise with paginated memos within given vault

<details>
  <summary>example</summary>

```js
// retrieve first 100 memos for the vault
const { items } = await akord.memo.list(vaultId);

// retrieve first 20 memos for the vault
const { items } = await akord.memo.list(vaultId, { limit: 20 });

// iterate through all memos
let token = null;
let memos = [];
do {
  const { items, nextToken } = await akord.memo.list(vaultId, { nextToken: token });
  memos = memos.concat(items);
  token = nextToken;
} while (token);
```
</details>

### stack

#### `create(vaultId, file, name)`

- `vaultId` (`string`, required)
- `file` ([`FileLike`][file-like], required) - file object - web: File, node: NodeJs.File (Blob implementation; web like File) 
- `name` (`string`, required) - stack name
- `options` (`StackCreateOptions`, optional)
- returns `Promise<{ stackId, transactionId }>` - Promise with new stack id & corresponding transaction id

<details>
  <summary>example</summary>

```js
import { NodeJs } from "@akord/akord-js/lib/types/file";
const file = await NodeJs.File.fromPath("path to your file");

// create a stack with custom arweave tags
const { stackId } = await akord.stack.create(vaultId, file, "jam session vol. 1", {
   arweaveTags: [
      { name: "Type", value: "music" },
      { name: "Genre", value: "rock" },
      { name: "Genre", value: "new wave" }
   ]
});
```
> [See Next.js file upload showcase here][file-upload-example]
</details>

#### `import(vaultId, fileTxId)`

Create new stack from an existing arweave file transaction

- `vaultId` (`string`, required)
- `fileTxId` (`string`, required) - arweave file transaction id reference
- `options` (`NodeCreateOptions`, optional) - parent id, etc.
- returns `Promise<{ stackId, transactionId }>` - Promise with new stack id & corresponding transaction id

<details>
  <summary>example</summary>

```js
const { stackId } = await akord.stack.import(vaultId, "kzGxbFW_oJ3PyYneRs9cPrChQ-k-8Fym5k9PCZNJ_HA");
```
</details>

#### `rename(stackId, name)`

- `stackId` (`string`, required)
- `name` (`string`, required) - new stack name
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.stack.rename(stackId, "new name for your stack");
```
</details>

#### `uploadRevision(stackId, file)`

- `stackId` (`string`, required)
- `file` ([`FileLike`][file-like], required) - file object
- `options` (`FileUploadOptions`, optional)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
import { NodeJs } from "@akord/akord-js/lib/types/file";
const file = await NodeJs.File.fromPath("path to your file");
const { transactionId } = await akord.stack.uploadRevision(stackId, file);
```
</details>

#### `revoke(stackId)`

- `stackId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.stack.revoke(stackId);
```
</details>

#### `move(stackId, parentId)`

- `stackId` (`string`, required)
- `parentId` (`string`, required) - new parent folder id
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
// create new folder
const { folderId } = await akord.folder.create(vaultId, "new folder");
// move the stack to newly created folder
const { transactionId } = await akord.stack.move(stackId, folderId);
```
</details>

#### `restore(stackId)`

- `stackId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.stack.restore(stackId);
```
</details>

#### `delete(stackId)`

- `stackId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.stack.delete(stackId);
```
</details>

#### `get(stackId, options)`

- `stackId` (`string`, required)
- `options` ([`GetOptions`][get-options], optional)
- returns `Promise<Stack>` - Promise with the stack object

<details>
  <summary>example</summary>

```js
const stack = await akord.stack.get(stackId);
```
</details>

#### `listAll(vaultId, options)`

- `vaultId` (`string`, required)
- `options` ([`ListOptions`][list-options], optional)
- returns `Promise<Array<Stack>>` - Promise with all stacks within given vault

<details>
  <summary>example</summary>

```js
const stacks = await akord.stack.listAll(vaultId);
```
</details>

#### `list(vaultId, options)`

- `vaultId` (`string`, required)
- `options` ([`ListOptions`][list-options], optional)
- returns `Promise<{ items, nextToken }>` - Promise with paginated stacks within given vault

<details>
  <summary>example</summary>

```js
// retrieve first 100 stacks for the vault
const { items } = await akord.stack.list(vaultId);

// retrieve first 20 stacks for the vault
const { items } = await akord.stack.list(vaultId, { limit: 20 });

// iterate through all stacks
let token = null;
let stacks = [];
do {
  const { items, nextToken } = await akord.stack.list(vaultId, { nextToken: token });
  stacks = stacks.concat(items);
  token = nextToken;
} while (token);
```
</details>

#### `getVersion(stackId, index)`

Get file stack version by index, return the latest version by default

- `stackId` (`string`, required)
- `index` (`number`, optional) - file version index
- returns `Promise<{ name: string, data: ArrayBuffer }>` - Promise with file name & data buffer

<details>
  <summary>example</summary>

```js
// get the latest stack version
const { name: fileName, data: fileBuffer } = await akord.stack.getVersion(stackId);

// get the first stack version
const { name: fileName, data: fileBuffer } = await akord.stack.getVersion(stackId, 0);
```
</details>

#### `getUri(stackId, type, index)`

Get stack file uri by index, return the latest arweave uri by default

- `stackId` (`string`, required)
- `type` ([`StorageType`][storage-type], optional) - storage type, default to arweave
- `index` (`number`, optional) - file version index, default to latest
- returns `Promise<string>` - Promise with stack file uri

<details>
  <summary>example</summary>

```js
// get the arweave uri for the latest file version
const arweaveUri = await akord.stack.getUri(stackId);

// get the arweave uri for the first file version
const arweaveUri = await akord.stack.getUri(stackId, 0);
```
</details>

### file

#### `get(id, vaultId, options)`

Returns file as ArrayBuffer. Puts the whole file into memory.
For downloading without putting whole file to memory use [download()](#download)

- `id` (`string`, required) - file resource url
- `vaultId` (`string`, required)
- `options` (`DownloadOptions`, optional)
- returns `Promise<ArrayBuffer>` - Promise with file buffer

#### `download(id, vaultId, options)`

Downloads the file keeping memory consumed (RAM) under defined level: options.chunkSize.
In browser, streaming of the binary requires self hosting of mitm.html and sw.js
See: https://github.com/jimmywarting/StreamSaver.js#configuration

- `id` (`string`, required) - file resource url
- `vaultId` (`string`, required)
- `options` (`DownloadOptions`, optional)
- returns `Promise<ArrayBuffer>` - Promise with file buffer

#### `getPublic(id, options)`

- `id` (`string`, required) - file resource url
- `options` (`DownloadOptions`, optional)
- returns `Promise<ArrayBuffer>` - Promise with file buffer

### folder

#### `create(vaultId, name)`

- `vaultId` (`string`, required)
- `name` (`string`, required) - folder name
- `options` (`NodeCreateOptions`, optional) - parent id, etc.
- returns `Promise<{ folderId, transactionId }>` - Promise with new folder id & corresponding transaction id

<details>
  <summary>example</summary>

```js
const { folderId } = await akord.folder.create(vaultId, "my first folder");
```
</details>

#### `rename(folderId, name)`

- `folderId` (`string`, required)
- `name` (`string`, required) - new folder name
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.folder.rename(folderId, "my first folder");
```
</details>

#### `move(folderId, parentId)`

Move the given folder along with its content to a different folder (parent)

- `folderId` (`string`, required)
- `parentId` (`string`, required) - new parent folder id
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
// create root folder
const rootFolderId = (await akord.folder.create(vaultId, "root folder")).folderId;
// move the folder to newly created root folder
const { transactionId } = await akord.folder.move(folderId, rootFolderId);
```
</details>

#### `revoke(folderId)`

Revoke the given folder along with the sub-tree of stacks and folders

- `folderId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.folder.revoke(folderId);
```
</details>

#### `restore(folderId)`

Restore the given folder along with the sub-tree of stacks and folders

- `folderId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.folder.restore(folderId);
```
</details>

#### `delete(folderId)`

Remove the folder along with the sub-tree of stacks and folders from the vault

- `folderId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.folder.delete(folderId);
```
</details>

#### `get(folderId, options)`

- `folderId` (`string`, required)
- `options` ([`GetOptions`][get-options], optional)
- returns `Promise<Folder>` - Promise with the folder object

<details>
  <summary>example</summary>

```js
const folder = await akord.folder.get(folderId);
```
</details>

#### `listAll(vaultId, options)`

- `vaultId` (`string`, required)
- `options` ([`ListOptions`][list-options], optional)
- returns `Promise<Array<Folder>>` - Promise with all folders within given vault

<details>
  <summary>example</summary>

```js
const folders = await akord.folder.listAll(vaultId);
```
</details>

#### `list(vaultId, options)`

- `vaultId` (`string`, required)
- `options` ([`ListOptions`][list-options], optional)
- returns `Promise<{ items, nextToken }>` - Promise with paginated folders within given vault

<details>
  <summary>example</summary>

```js
// retrieve first 100 folders for the vault
const { items } = await akord.folder.list(vaultId);

// retrieve first 20 folders for the vault
const { items } = await akord.folder.list(vaultId, { limit: 20 });

// iterate through all folders
let token = null;
let folders = [];
do {
  const { items, nextToken } = await akord.folder.list(vaultId, { nextToken: token });
  folders = folders.concat(items);
  token = nextToken;
} while (token);
```
</details>

### note

#### `create(vaultId, content, name)`

- `vaultId` (`string`, required)
- `content` (`string`, required) - note text content, ex: stringified JSON
- `name` (`string`, required) - note name
- `options` (`NoteCreateOptions`, optional) - parent id, mime type, etc.
- returns `Promise<{ noteId, transactionId }>` - Promise with new note id & corresponding transaction id

<details>
  <summary>example</summary>

```js
const { noteId } = await akord.note.create(vaultId, "# Hello World", "Hello World note");

const { noteId } = await akord.note.create(
  vaultId,
  JSON.stringify({ name: "My first JSON note" }),
  "My first JSON note",
  { parentId: parentId, mimeType: "application/json" }
);
```
</details>

#### `uploadRevision(noteId, name, content)`

- `noteId` (`string`, required)
- `content` (`string`, required) - note text content, ex: stringified JSON
- `name` (`string`, required) - note name
- `options` (`NoteOptions`, optional) - mime type, etc.
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.note.uploadRevision(noteId, "# Hello World bis", "Hello World note bis");
```
</details>

#### `move(noteId, parentId)`

- `noteId` (`string`, required)
- `parentId` (`string`, optional) - new parent folder id
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
// create new folder
const { folderId } = await akord.folder.create(vaultId, "new folder");
// move the note to newly created folder
const { transactionId } = await akord.note.move(noteId, folderId);
```
</details>

#### `revoke(noteId)`

- `noteId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.note.revoke(noteId);
```
</details>

#### `restore(noteId)`

- `noteId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.note.restore(noteId);
```
</details>

#### `delete(noteId)`

- `noteId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.note.delete(noteId);
```
</details>

#### `get(noteId, options)`

- `noteId` (`string`, required)
- `options` ([`GetOptions`][get-options], optional)
- returns `Promise<Note>` - Promise with the note object

<details>
  <summary>example</summary>

```js
const note = await akord.note.get(noteId);
```
</details>

#### `listAll(vaultId, options)`

- `vaultId` (`string`, required)
- `options` ([`ListOptions`][list-options], optional)
- returns `Promise<Array<Note>>` - Promise with all notes within given vault

<details>
  <summary>example</summary>

```js
const notes = await akord.note.listAll(vaultId);
```
</details>

#### `list(vaultId, options)`

- `vaultId` (`string`, required)
- `options` ([`ListOptions`][list-options], optional)
- returns `Promise<{ items, nextToken }>` - Promise with paginated notes within given vault

<details>
  <summary>example</summary>

```js
// retrieve first 100 notes for the vault
const { items } = await akord.note.list(vaultId);

// retrieve first 20 notes for the vault
const { items } = await akord.note.list(vaultId, { limit: 20 });

// iterate through all notes
let token = null;
let notes = [];
do {
  const { items, nextToken } = await akord.note.list(vaultId, { nextToken: token });
  notes = notes.concat(items);
  token = nextToken;
} while (token);
```
</details>

#### `getVersion(noteId, index)`

Get note text version by index, return the latest version by default

- `noteId` (`string`, required)
- `index` (`number`, optional) - note version index
- returns `Promise<{ name: string, data: string }>` - Promise with note name & data string text

<details>
  <summary>example</summary>

```js
// get the latest note version
const { name: fileName, data: noteText } = await akord.note.getVersion(noteId);

// get the first note version
const { name: fileName, data: noteText } = await akord.note.getVersion(noteId, 0);
```
</details>

### manifest

Manifest is a special case of Stack that is unique per vault and follows [Arweave Path Manifest standard](https://github.com/ArweaveTeam/arweave/wiki/Path-Manifests).

#### `generate(vaultId, manifest)`

If there is no manifest for the vault, a new manifest stack will be created, otherwise a new version of the manifest will be generated and uploaded.

If no input JSON is provided by the user, manifest will be genarated automatically from the current vault state.

- `vaultId` (`string`, required)
- `manifest` (`JSON`, optional) - manifest JSON
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.manifest.generate(vaultId);
```
</details>

#### `get(vaultId)`

- `vaultId` (`string`, required)
- returns `Promise<Stack>` - Promise with the vault manifest object

<details>
  <summary>example</summary>

```js
const manifestNode = await akord.manifest.get(vaultId);
```
</details>

#### `getVersion(vaultId, index)`

Get vault manifest version by index, return the latest version by default

- `vaultId` (`string`, required)
- `index` (`number`, optional) - file version index
- returns `Promise<JSON>` - Promise with JSON manifest

<details>
  <summary>example</summary>

```js
// get the latest vault manifest
const manifest = await akord.manifest.getVersion(vaultId);

// get the first version of the vault manifest
const manifestV1 = await akord.manifest.getVersion(vaultId, 0);
```
</details>

### contract

#### `getState()`

- `id` (`string`, required) - vault contract id
- returns `Promise<Contract>` - Promise with the current contract state

<details>
  <summary>example</summary>

```js
const currentState = await akord.contract.getState(vaultId);
```
</details>

### profile

#### `get()`

Fetch currently authenticated user's profile details

- returns `Promise<ProfileDetails>` - Promise with profile details

#### `update(name, avatar)`

Update user profile along with all active memberships

- `name` (`string`, required) - new profile name
- `avatar` (`ArrayBuffer`, required) - new avatar buffer
- returns `Promise<Array<{ transactionId }>>` - Promise with corresponding transaction ids

### batch

#### `revoke(items)`

- `items` (`Array<{ id: string, type: `[`NodeType`][node-type]` }>`, required)
- returns `Promise<Array<{ transactionId }>>` - Promise with corresponding transaction ids

#### `restore(items)`

- `items` (`Array<{ id: string, type: `[`NodeType`][node-type]` }>`, required)
- returns `Promise<Array<{ transactionId }>>` - Promise with corresponding transaction ids

#### `delete(items)`

- `items` (`Array<{ id: string, type: `[`NodeType`][node-type]` }>`, required)
- returns `Promise<Array<{ transactionId }>>` - Promise with corresponding transaction ids

#### `move(items, parentId)`

- `items` (`Array<{ id: string, type: `[`NodeType`][node-type]` }>`, required)
- `parentId` (`string`, optional)
- returns `Promise<Array<{ transactionId }>>` - Promise with corresponding transaction ids

#### `membershipChangeRole(items)`

- `items` (`Array<{ id: string, role: `[`RoleType`][role-type]` }>`, required)
- returns `Promise<Array<{ transactionId }>>` - Promise with corresponding transaction ids

#### `stackCreate(vaultId, items)`

- `vaultId` (`string`, required)
- `items` (`Array<{ file: `[`FileLike`][file-like]`, name: string, options: StackCreateOptions>`, required)
- `options` (`BatchStackCreateOptions`, optional)
- returns `Promise<`[`BatchStackCreateResponse`][batch-stack-create-response]`>` - Promise with new stack ids & their corresponding transaction ids

#### `membershipInvite(vaultId, items)`

- `vaultId` (`string`, required)
- `items` (`Array<{ email: string, role: `[`RoleType`][role-type]` }>`, required)
- `options` (`MembershipCreateOptions`, optional) - invitation email message, etc.
- returns `Promise<`[`BatchMembershipInviteResponse`][batch-membership-invite-response]`>` - Promise with new membership ids & their corresponding transaction ids

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


[list-options]: https://github.com/Akord-com/akord-js/blob/193062c541ad06c186d5b872ecf9066d15806b43/src/types/query-options.ts#L1
[get-options]: https://github.com/Akord-com/akord-js/blob/193062c541ad06c186d5b872ecf9066d15806b43/src/types/query-options.ts#L9
[vault-get-options]: https://github.com/Akord-com/akord-js/blob/193062c541ad06c186d5b872ecf9066d15806b43/src/types/query-options.ts#L14
[file-like]: https://github.com/Akord-com/akord-js/blob/ab9bb814fa9cf73d9ed01052738c8b84a86040b2/src/types/file.ts#L8
[storage-type]: https://github.com/Akord-com/akord-js/blob/26d1945bee727a1af45f0f9cc44c7fa9b68c5d75/src/types/node.ts#L149
[role-type]: https://github.com/Akord-com/akord-js/blob/03e28ffd95224dbfd0a8d891a06a154298619378/src/types/membership.ts#L4
[node-type]: https://github.com/Akord-com/akord-js/blob/03e28ffd95224dbfd0a8d891a06a154298619378/src/types/node.ts#L11
[batch-stack-create-response]: https://github.com/Akord-com/akord-js/blob/03e28ffd95224dbfd0a8d891a06a154298619378/src/types/batch-response.ts#L1
[batch-membership-invite-response]: https://github.com/Akord-com/akord-js/blob/03e28ffd95224dbfd0a8d891a06a154298619378/src/types/batch-response.ts#L7
[file-upload-example]:https://github.com/Akord-com/recipes/blob/a2dbc847097973ef08586f32b0ce3192f0581ed4/nextjs-starter/src/pages/index.tsx#L66
