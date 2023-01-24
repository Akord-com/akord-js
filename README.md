# akord-js

Akord Client for interacting with Akord.\
This package can be used in both browser and Node.js environments.

- [Usage](#usage)
  - [Import](#import)
  - [Quick Start](#quick-start)
  - [Examples](#examples)
- [Modules](#modules)
  - [Auth](#auth)
  - [Vault](#vault)
  - [Membership](#membership)
  - [Memo](#memo)
  - [Stack](#stack)
  - [File](#file)
  - [Folder](#folder)
  - [Note](#note)
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
##### with email & password
```js
const { akord, wallet, jwtToken } = Akord.auth.signIn(email, password);
```
##### with Akord Wallet & JWT
```js
const akord = Akord.init(wallet, jwtToken);
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
const vaults = await akord.vault.list();
```

### Examples
See our [demo app tutorial](https://akord-js-tutorial.akord.com) and learn how to create,
contribute and access an Akord Vault.\
We also have some example flows in our [tests](src/__tests__) repository.

## Modules

### auth

#### `signIn(email, password)`

- `email` (`string`, required)
- `password` (`string`, required)
- returns `Promise<{ akord, wallet, jwtToken }>` - Promise with Akord Client instance, JWT token & Akord Wallet

<details>
  <summary>example</summary>

```js
const { akord, wallet, jwtToken } = await akord.auth.signIn("winston@gmail.com", "1984");
```
</details>

#### `signUp(email, password)`

- `email` (`string`, required)
- `password` (`string`, required)
- `clientMetadata` (`any`, optional) - JSON client metadata, ex: { clientType: "CLI" }
- returns `Promise<AkordWallet>` - Promise with Akord Wallet

<details>
  <summary>example</summary>

```js
const wallet = await akord.auth.signUp("winston@gmail.com", "1984");
```
</details>

#### `verifyAccount(email, code)`

- `email` (`string`, required)
- `code` (`string`, required)
- returns `Promise<void>`

<details>
  <summary>example</summary>

```js
await akord.auth.verifyAccount("winston@gmail.com", 123456);
```
</details>

### vault

#### `create(name, termsOfAccess, isPublic)`

- `name` (`string`, required) - new vault name
- `termsOfAccess` (`string`, optional) - if the vault is intended for professional or legal use, you can add terms of access and they must be digitally signed before accessing the vault
- `isPublic` (`boolean`, optional)
- returns `Promise<{ vaultId, membershipId, transactionId }>` - Promise with new vault id, owner membership id & corresponding transaction id

<details>
  <summary>example</summary>

```js
const { vaultId, membershipId } = await akord.vault.create("my first vault", "terms of access");
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

#### `get(vaultId)`

- `vaultId` (`string`, required)
- returns `Promise<any>` - Promise with the decrypted vault

<details>
  <summary>example</summary>

```js
const vault = await akord.vault.get(vaultId);
```
</details>

#### `list()`

- returns `Promise<any>` - Promise with currently authenticated user vaults

<details>
  <summary>example</summary>

```js
const vaultArray = await akord.vault.list();
```
</details>

### membership

#### `invite(vaultId, email, role)`

Invite user with an Akord account

- `vaultId` (`string`, required)
- `email` (`string`, required) - invitee's email
- `role` (`string`, required) - CONTRIBUTOR or VIEWER
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
- `role` (`string`, required) - CONTRIBUTOR or VIEWER
- returns `Promise<{ transactionId }>` - Promise with new membership id & corresponding transaction id

<details>
  <summary>example</summary>

```js
const { membershipId } = await akord.membership.inviteNewUser(vaultId, "winston@gmail.com", "VIEWER");
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
- `role` (`string`, required) - CONTRIBUTOR or VIEWER
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

#### `get(membershipId)`

- `membershipId` (`string`, required)
- returns `Promise<any>` - Promise with the decrypted membership

<details>
  <summary>example</summary>

```js
const membership = await akord.membership.get(membershipId);
```
</details>

#### `list(vaultId)`

- `vaultId` (`string`, required)
- returns `Promise<any>` - Promise with all memberships within given vault

<details>
  <summary>example</summary>

```js
const membershipArray = await akord.membership.list(vaultId);
```
</details>

### memo

#### `create(vaultId, message)`

- `vaultId` (`string`, required)
- `message` (`string`, required) - memo content
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

#### `get(memoId)`

- `memoId` (`string`, required)
- returns `Promise<any>` - Promise with the decrypted memo

<details>
  <summary>example</summary>

```js
const memo = await akord.memo.get(memoId);
```
</details>

#### `list(vaultId)`

- `vaultId` (`string`, required)
- returns `Promise<any>` - Promise with all memos within given vault

<details>
  <summary>example</summary>

```js
const memoArray = await akord.memo.list(vaultId);
```
</details>

### stack

#### `create(vaultId, file, name, parentId, progressHook, cancelHook)`

- `vaultId` (`string`, required)
- `file` (`FileLike`, required) - file object - web: File, node: NodeJs.File (Blob implementation; web like File) 
- `name` (`string`, required) - stack name
- `parentId` (`string`, optional) - parent folder id
- `progressHook` (`(progress:number)=>void`, optional)
- `cancelHook` (`AbortController`, optional)
- returns `Promise<{ stackId, transactionId }>` - Promise with new stack id & corresponding transaction id

<details>
  <summary>example</summary>

```js
const { stackId } = await akord.stack.create(vaultId, file, "your stack name");
```
</details>

#### `rename(stackId, name)`

- `stackId` (`string`, required)
- `name` (`string`, required) - new stack name
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.stack.rename(vaultId, "new name for your stack");
```
</details>

#### `uploadRevision(stackId, file, progressHook)`

- `stackId` (`string`, required)
- `file` (`any`, required) - file object
- `progressHook` (`(progress:number)=>void`, optional)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.stack.uploadRevision(vaultId, file);
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

#### `get(stackId)`

- `stackId` (`string`, required)
- returns `Promise<any>` - Promise with the decrypted stack

<details>
  <summary>example</summary>

```js
const stack = await akord.stack.get(stackId);
```
</details>

#### `list(vaultId)`

- `vaultId` (`string`, required)
- returns `Promise<any>` - Promise with all stacks within given vault

<details>
  <summary>example</summary>

```js
const stackArray = await akord.stack.list(vaultId);
```
</details>

#### `getVersion(stackId, index)`

Get file stack version by index, return the latest version by default

- `stackId` (`string`, required)
- `index` (`string`, optional) - file version index
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

#### `create(vaultId, name, parentId)`

- `vaultId` (`string`, required)
- `name` (`string`, required) - folder name
- `parentId` (`string`, optional) - parent folder id
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

#### `get(folderId)`

- `folderId` (`string`, required)
- returns `Promise<any>` - Promise with the decrypted folder

<details>
  <summary>example</summary>

```js
const folder = await akord.folder.get(folderId);
```
</details>

#### `list(vaultId)`

- `vaultId` (`string`, required)
- returns `Promise<any>` - Promise with all folder within given vault

<details>
  <summary>example</summary>

```js
const folderArray = await akord.folder.list(vaultId);
```
</details>

### note

#### `create(vaultId, name, content, parentId)`

- `vaultId` (`string`, required)
- `content` (`string`, required) - note text content, ex: stringified JSON
- `name` (`string`, required) - note name
- `parentId` (`string`, optional) - parent folder id
- `mimeType` (`string`, optional) - MIME type for the note text file, default: text/markdown
- returns `Promise<{ noteId, transactionId }>` - Promise with new note id & corresponding transaction id

<details>
  <summary>example</summary>

```js
const { noteId } = await akord.note.create(vaultId, "# Hello World", "Hello World note");

const { noteId } = await akord.note.create(
  vaultId,
  JSON.stringify({ name: "My first JSON note" }),
  "My first JSON note",
  parentId,
  "application/json"
);
```
</details>

#### `uploadRevision(noteId, name, content)`

- `noteId` (`string`, required)
- `content` (`string`, required) - note text content, ex: stringified JSON
- `name` (`string`, required) - note name
- `mimeType` (`string`, optional) - MIME type for the note text file, default: text/markdown
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.note.uploadRevision(vaultId, "# Hello World bis", "Hello World note bis");
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

#### `get(noteId)`

- `noteId` (`string`, required)
- returns `Promise<any>` - Promise with the decrypted note

<details>
  <summary>example</summary>

```js
const note = await akord.note.get(noteId);
```
</details>

#### `list(vaultId)`

- `vaultId` (`string`, required)
- returns `Promise<any>` - Promise with all notes within given vault

<details>
  <summary>example</summary>

```js
const noteArray = await akord.note.list(vaultId);
```
</details>

#### `getVersion(noteId, index)`

Get note text version by index, return the latest version by default

- `noteId` (`string`, required)
- `index` (`string`, optional) - note version index
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
- `avatar` (`any`, required) - new avatar buffer
- returns `Promise<Array<{ transactionId }>>` - Promise with corresponding transaction ids

### batch

#### `revoke(items)`

- `items` (`Array<{ id: string, type: string }>`, required)
- returns `Promise<Array<{ transactionId }>>` - Promise with corresponding transaction ids

#### `restore(items)`

- `items` (`Array<{ id: string, type: string }>`, required)
- returns `Promise<Array<{ transactionId }>>` - Promise with corresponding transaction ids

#### `delete(items)`

- `items` (`Array<{ id: string, type: string }>`, required)
- returns `Promise<Array<{ transactionId }>>` - Promise with corresponding transaction ids

#### `move(items, parentId)`

- `items` (`Array<{ transactionId }>`, required)
- `parentId` (`string`, optional)
- returns `Promise<Array<{ transactionId }>>` - Promise with corresponding transaction ids

#### `membershipChangeRole(items)`

- `items` (`Array<{ transactionId }>`, required)
- returns `Promise<Array<{ transactionId }>>` - Promise with corresponding transaction ids

#### `stackCreate(vaultId, items, parentId, progressHook, cancelHook)`

- `vaultId` (`string`, required)
- `items` (`Array<{ transactionId }>`, required)
- `parentId` (`string`, optional)
- `progressHook` (`(progress:number)=>void`, optional)
- `cancelHook` (`AbortController`, optional)
- returns `Promise<Array<{ transactionId }>>` - Promise with new stack ids & their corresponding transaction ids

#### `membershipInvite(vaultId, items)`

- `vaultId` (`string`, required)
- `items` (`Array<{ transactionId }>`, required)
- returns `Promise<Array<{ transactionId }>>` - Promise with new membership ids & their corresponding transaction ids

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
