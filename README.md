# akord-js

Akord Client for interacting with Akord.\
This package can be used in both browser and Node.js environments.

- [Usage](#usage)
  - [Import](#import)
  - [Quick Start](#quick-start)
  - [Examples](#examples)
- [Methods](#methods)
  - [Writes](#writes)
    - [Vault](#vault)
    - [Membership](#membership)
    - [Memo](#memo)
    - [Stack](#stack)
    - [Folder](#folder)
    - [Note](#note)
  - [Batch writes](#batch-writes)
  - [Reads](#reads)
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

## Methods

### Writes

#### Vault

##### `create(name, termsOfAccess, isPublic)`

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

##### `rename(vaultId, name)`

- `vaultId` (`string`, required)
- `name` (`string`, required) - new vault name
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.vault.rename(vaultId, "updated name");
```
</details>

##### `archive(vaultId)`

- `vaultId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.vault.archive(vaultId);
```
</details>

##### `restore(vaultId)`

- `vaultId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.vault.restore(vaultId);
```
</details>

##### `delete(vaultId)`

- `vaultId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.vault.delete(vaultId);
```
</details>

#### Membership

##### `invite(vaultId, email, role)`

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

##### `inviteNewUser(vaultId, email, role)`

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

##### `accept(membershipId)`

- `membershipId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.membership.accept(membershipId);
```
</details>

##### `confirm(membershipId)`

- `membershipId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.membership.confirm(membershipId);
```
</details>

##### `reject(membershipId)`

Reject pending invitation

- `membershipId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.membership.reject(membershipId);
```
</details>

##### `leave(membershipId)`

Reject already accepted invitation

- `membershipId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.membership.leave(membershipId);
```
</details>

##### `revoke(membershipId)`

Revoke a membership, update also each valid membership with new rotated keys

- `membershipId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.membership.revoke(membershipId);
```
</details>

##### `changeRole(membershipId, role)`

- `membershipId` (`string`, required)
- `role` (`string`, required) - CONTRIBUTOR or VIEWER
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.membership.changeRole(membershipId, "CONTRIBUTOR");
```
</details>

##### `inviteResend(membershipId)`

Resend email invitation

- `membershipId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.membership.inviteResend(membershipId);
```
</details>

#### Memo

##### `create(vaultId, message)`

- `vaultId` (`string`, required)
- `message` (`string`, required) - memo content
- returns `Promise<{ memoId, transactionId }>` - Promise with new memo id & corresponding transaction id

<details>
  <summary>example</summary>

```js
const { memoId } = await akord.memo.create(vaultId, "Suspendisse ut lorem vitae lectus faucibus lacinia");
```
</details>

##### `addReaction(memoId, reaction)`

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

##### `removeReaction(memoId, reaction)`

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

#### Stack

##### `create(vaultId, file, name, parentId, progressHook, cancelHook)`

- `vaultId` (`string`, required)
- `file` (`any`, required) - file object
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

##### `rename(stackId, name)`

- `stackId` (`string`, required)
- `name` (`string`, required) - new stack name
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.stack.rename(vaultId, "new name for your stack");
```
</details>

##### `uploadRevision(stackId, file, progressHook)`

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

##### `revoke(stackId)`

- `stackId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.stack.revoke(stackId);
```
</details>

##### `move(stackId, parentId)`

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

##### `restore(stackId)`

- `stackId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.stack.restore(stackId);
```
</details>

##### `delete(stackId)`

- `stackId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.stack.delete(stackId);
```
</details>

#### Folder

##### `create(vaultId, name, parentId)`

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

##### `rename(folderId, name)`

- `folderId` (`string`, required)
- `name` (`string`, required) - new folder name
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.folder.rename(folderId, "my first folder");
```
</details>

##### `move(folderId, parentId)`

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

##### `revoke(folderId)`

Revoke the given folder along with the sub-tree of stacks and folders

- `folderId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.folder.revoke(folderId);
```
</details>

##### `restore(folderId)`

Restore the given folder along with the sub-tree of stacks and folders

- `folderId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.folder.restore(folderId);
```
</details>

##### `delete(folderId)`

Remove the folder along with the sub-tree of stacks and folders from the vault

- `folderId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.folder.delete(folderId);
```
</details>

#### Note

##### `create(vaultId, name, content, parentId)`

- `vaultId` (`string`, required)
- `name` (`string`, required) - note name
- `content` (`any`, required) - JSON note content
- `parentId` (`string`, optional) - parent folder id
- returns `Promise<{ noteId, transactionId }>` - Promise with new note id & corresponding transaction id

<details>
  <summary>example</summary>

```js
const { noteId } = await akord.note.create(vaultId, "Hello World note", "# Hello World");
```
</details>

##### `uploadRevision(noteId, name, content)`

- `noteId` (`string`, required)
- `name` (`string`, required) - note name
- `content` (`string`, required) - JSON note content
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.note.uploadRevision(vaultId, "Hello World note bis", "# Hello World bis");
```
</details>

##### `move(noteId, parentId)`

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

##### `revoke(noteId)`

- `noteId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.note.revoke(noteId);
```
</details>

##### `restore(noteId)`

- `noteId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.note.restore(noteId);
```
</details>

##### `delete(noteId)`

- `noteId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

<details>
  <summary>example</summary>

```js
const { transactionId } = await akord.note.delete(noteId);
```
</details>

#### Profile

##### `get()`

Fetch currently authenticated user's profile details

- returns `Promise<ProfileDetails>` - Promise with profile details

##### `update(name, avatar)`

Update user profile along with all active memberships

- `name` (`string`, required) - new profile name
- `avatar` (`any`, required) - new avatar buffer
- returns `Promise<Array<{ transactionId }>>` - Promise with corresponding transaction ids

### Batch writes

##### `batchRevoke(items)`

- `items` (`Array<{ transactionId }>`, required)
- returns `Promise<Array<{ transactionId }>>` - Promise with corresponding transaction ids

##### `batchRestore(items)`

- `items` (`Array<{ transactionId }>`, required)
- returns `Promise<Array<{ transactionId }>>` - Promise with corresponding transaction ids

##### `batchDelete(items)`

- `items` (`Array<{ transactionId }>`, required)
- returns `Promise<Array<{ transactionId }>>` - Promise with corresponding transaction ids

##### `batchMove(items, parentId)`

- `items` (`Array<{ transactionId }>`, required)
- `parentId` (`string`, optional)
- returns `Promise<Array<{ transactionId }>>` - Promise with corresponding transaction ids

##### `batchMembershipChangeRole(items)`

- `items` (`Array<{ transactionId }>`, required)
- returns `Promise<Array<{ transactionId }>>` - Promise with corresponding transaction ids

##### `batchStackCreate(vaultId, items, parentId, progressHook, cancelHook)`

- `vaultId` (`string`, required)
- `items` (`Array<{ transactionId }>`, required)
- `parentId` (`string`, optional)
- `progressHook` (`(progress:number)=>void`, optional)
- `cancelHook` (`AbortController`, optional)
- returns `Promise<Array<{ transactionId }>>` - Promise with new stack ids & their corresponding transaction ids

##### `batchMembershipInvite(vaultId, items)`

- `vaultId` (`string`, required)
- `items` (`Array<{ transactionId }>`, required)
- returns `Promise<Array<{ transactionId }>>` - Promise with new membership ids & their corresponding transaction ids

### Reads

##### `getVaults()`

- returns `Promise<Array<{ id, name }>>` - Promise with user vaults array

##### `getNodes(vaultId, objectType)`

- `vaultId` (`string`, required)
- `objectType` (`string`, required)
- returns `Promise<any>` - Promise with nodes array

##### `decryptNode(objectId, objectType, vaultId)`

- `objectId` (`string`, required)
- `objectType` (`string`, required)
- `vaultId` (`string`, optional)
- returns `Promise<any>` - Promise with decrypted node state

##### `decryptObject(objectId, objectType)`

- `objectId` (`string`, required)
- `objectType` (`string`, required)
- returns `Promise<any>` - Promise with decrypted object

##### `decryptState(state)`

Decrypt given state (require encryption context)

- `state` (`any`, required)
- returns `Promise<any>` - Promise with decrypted state

##### `getFile(id, vaultId, isChunked, numberOfChunks, progressHook, cancelHook)`

- `id` (`string`, required) - file resource url
- `vaultId` (`string`, required)
- `isChunked` (`boolean`, optional)
- `numberOfChunks` (`number`, optional)
- `progressHook` (`(progress:number)=>void`, optional)
- `cancelHook` (`AbortController`, optional)
- returns `Promise<ArrayBuffer>` - Promise with file buffer

##### `getPublicFile(id, isChunked, numberOfChunks, progressHook, cancelHook)`

- `id` (`string`, required) - file resource url
- `isChunked` (`boolean`, optional)
- `numberOfChunks` (`number`, optional)
- `progressHook` (`(progress:number)=>void`, optional)
- `cancelHook` (`AbortController`, optional)
- returns `Promise<ArrayBuffer>` - Promise with file buffer

##### `getStackFile(stackId, index)`

Get file stack version by index, return the latest version by default

- `stackId` (`string`, required)
- `index` (`string`, optional) - file version index
- returns `Promise<{ name: string, data: ArrayBuffer }>` - Promise with file name & data buffer

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
