# akord-js

Akord Client for interacting with Akord.

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
import Akord from "@akord/akord-js";
```

### Quick start

#### Init Akord
##### with email & password
```js
const akord = Akord.signIn(email, password);
```
##### with Akord Wallet & JWT
```js
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

## Methods

### Writes

#### Vault

##### `vaultCreate(name, termsOfAccess, isPublic)`

- `name` (`string`, required)
- `termsOfAccess` (`string`, optional)
- `isPublic` (`boolean`, optional)
- returns `Promise<{ vaultId, membershipId, transactionId }>` - Promise with new vault id, membership id & corresponding transaction id

##### `vaultRename(vaultId, name)`

- `vaultId` (`string`, required)
- `name` (`string`, required) - new vault name
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

##### `vaultArchive(vaultId)`

- `vaultId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

##### `vaultRestore(vaultId)`

- `vaultId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

##### `vaultDelete(vaultId)`

- `vaultId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

#### Membership

##### `membershipInvite(vaultId, email, role)`

Invite user with an Akord account

- `vaultId` (`string`, required)
- `email` (`string`, required) - invitee's email
- `role` (`string`, required) - CONTRIBUTOR or VIEWER
- returns `Promise<{ membershipId, transactionId }>` - Promise with new membership id & corresponding transaction id

##### `membershipInviteNewUser(vaultId, email, role)`

Invite user without an Akord account

- `vaultId` (`string`, required)
- `email` (`string`, required) - invitee's email
- `role` (`string`, required) - CONTRIBUTOR or VIEWER
- returns `Promise<{ transactionId }>` - Promise with new membership id & corresponding transaction id

##### `membershipAccept(membershipId)`

- `membershipId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

##### `membershipConfirm(membershipId)`

- `membershipId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

##### `membershipReject(membershipId)`

- `membershipId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

##### `membershipLeave(membershipId)`

- `membershipId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

##### `membershipRevoke(membershipId)`

- `membershipId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

##### `membershipChangeRole(membershipId, role)`

- `membershipId` (`string`, required)
- `role` (`string`, required) - CONTRIBUTOR or VIEWER
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

##### `membershipInviteResend(membershipId)`

- `membershipId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

#### Memo

##### `memoCreate(vaultId, message)`

- `vaultId` (`string`, required)
- `message` (`string`, required) - memo content
- returns `Promise<{ memoId, transactionId }>` - Promise with new memo id & corresponding transaction id

##### `memoAddReaction(memoId, reaction)`

- `memoId` (`string`, required)
- `reaction` (`reactionEmoji`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

##### `memoRemoveReaction(memoId, reaction)`

- `memoId` (`string`, required)
- `reaction` (`reactionEmoji`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

#### Stack

##### `stackCreate(vaultId, file, name, parentId, progressHook, cancelHook)`

- `vaultId` (`string`, required)
- `file` (`any`, required) - file object
- `name` (`string`, required) - stack name
- `parentId` (`string`, optional) - parent folder id
- `progressHook` (`(progress:number)=>void`, optional)
- `cancelHook` (`AbortController`, optional)
- returns `Promise<{ stackId, transactionId }>` - Promise with new stack id & corresponding transaction id

##### `stackRename(stackId, name)`

- `stackId` (`string`, required)
- `name` (`string`, required) - new stack name
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

##### `stackUploadRevision(stackId, file, progressHook)`

- `stackId` (`string`, required)
- `file` (`any`, required) - file object
- `progressHook` (`(progress:number)=>void`, optional)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

##### `stackRevoke(stackId)`

- `stackId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

##### `stackMove(stackId, parentId)`

- `stackId` (`string`, required)
- `parentId` (`string`, required) - new parent folder id
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

##### `stackRestore(stackId)`

- `stackId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

##### `stackDelete(stackId)`

- `stackId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

#### Folder

##### `folderCreate(vaultId, name, parentId)`

- `vaultId` (`string`, required)
- `name` (`string`, required) - folder name
- `parentId` (`string`, optional) - parent folder id
- returns `Promise<{ folderId, transactionId }>` - Promise with new folder id & corresponding transaction id

##### `folderRename(folderId, name)`

- `folderId` (`string`, required)
- `name` (`string`, required) - new folder name
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

##### `folderMove(folderId, parentId)`

- `folderId` (`string`, required)
- `parentId` (`string`, required) - new parent folder id
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

##### `folderRevoke(folderId)`

- `folderId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

##### `folderRestore(folderId)`

- `folderId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

##### `folderDelete(folderId)`

- `folderId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

#### Note

##### `noteCreate(vaultId, name, content, parentId)`

- `vaultId` (`string`, required)
- `name` (`string`, required) - note name
- `content` (`any`, required) - JSON note content
- `parentId` (`string`, optional) - parent folder id
- returns `Promise<{ noteId, transactionId }>` - Promise with new note id & corresponding transaction id

##### `noteUploadRevision(noteId, name, content)`

- `noteId` (`string`, required)
- `name` (`string`, required) - note name
- `content` (`string`, required) - JSON note content
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

##### `noteMove(noteId[, parentId])`

- `noteId` (`string`, required)
- `parentId` (`string`, optional) - new parent folder id
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

##### `noteRevoke(noteId)`

- `noteId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

##### `noteRestore(noteId)`

- `noteId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

##### `noteDelete(noteId)`

- `noteId` (`string`, required)
- returns `Promise<{ transactionId }>` - Promise with corresponding transaction id

#### Profile

##### `profileUpdate(name, avatar)`

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

##### `getProfileDetails()`

- returns `Promise<any>` - Promise with profile details

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
- returns `Promise<any>` - Promise with file buffer

##### `getPublicFile(id, isChunked, numberOfChunks, progressHook, cancelHook)`

- `id` (`string`, required) - file resource url
- `isChunked` (`boolean`, optional)
- `numberOfChunks` (`number`, optional)
- `progressHook` (`(progress:number)=>void`, optional)
- `cancelHook` (`AbortController`, optional)
- returns `Promise<any>` - Promise with file buffer

##### `getStackFile(stackId, index)`

Get file stack version by index, return the latest version by default

- `stackId` (`string`, required)
- `index` (`string`, optional) - file version index
- returns `Promise<any>` - Promise with file buffer

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
