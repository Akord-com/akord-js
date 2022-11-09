
export const postLedgerTransaction = /* GraphQL */ `
  mutation PostLedgerTransaction($transactions: [TransactionInput]) {
    postLedgerTransaction(transactions: $transactions) {
      id
      hash
      schemaUri
      postedAt
      publicSigningKey
      contextVersion
      prevHash
      refHash
      dataRoomId
      modelId
      memberDetails {
        publicSigningKey
        email
        fullName
        phone
        avatarUrl
        avatarTx
      }
      actionRef
      groupRef
      encodedPrevState
      membership {
        status
        role
        expiresOn
        memberDetails {
          publicSigningKey
          email
          fullName
          phone
          avatarUrl
          avatarTx
        }
        termsOfAccess
        agreementHash
        message
        encryptionType
        keys {
          publicKey
          encPrivateKey
        }
        encAccessKey
      }
      dataroom {
        status
        title
        description
        termsOfAccess
        publicKeys
      }
      stack {
        status
        title
        description
        resourceVersion
        files {
          title
          resourceUrl
          thumbnailUrl
          postedAt
          fileType
          size
        }
      }
      folder {
        status
        title
      }
      memo {
        message
      }
      note {
        content
      }
      profile {
        profileDetails {
          publicSigningKey
          email
          fullName
          phone
          avatarUrl
          avatarTx
        }
        status
        wallets {
          publicSigningKey
          encBackupPhrase
          publicKey
          revokedOn
        }
        encryptionType
        keys {
          publicKey
          encPrivateKey
        }
        encAccessKey
      }
      status
      encodedHeader
      encodedBody
      publicKey
      signature
    }
  }
`

export const usersByEmail = `
query usersByEmail($emails: [String]) {
  usersByEmail(emails: $emails) {
    email
    publicSigningKey
    address
    publicKey
  }
}
`

export const getMembership = /* GraphQL */ `
  query GetMembership($id: ID!) {
    getMembership(id: $id) {
      id
      hash
      prevHash
      refHash
      publicSigningKey
      postedAt
      contextVersion
      dataRoomId
      memberPublicSigningKey
      email
      status
      state {
        status
        role
        expiresOn
        memberDetails {
          publicSigningKey
          email
          fullName
          phone
          avatarUrl
          avatarTx
        }
        termsOfAccess
        agreementHash
        message
        encryptionType
        keys {
          publicKey
          encPrivateKey
        }
        encAccessKey
      }
      dataRoom {
        state {
          publicKeys
        }
      }
      createdAt
      updatedAt
    }
  }
`

export const getStack = /* GraphQL */ `
  query GetStack($id: ID!) {
    getStack(id: $id) {
      id
      hash
      prevHash
      refHash
      publicSigningKey
      postedAt
      dataRoomId
      folderId
      status
      state {
        status
        title
        description
        resourceVersion
        size
        files {
          title
          resourceUrl
          thumbnailUrl
          postedAt
          fileType
          size
          numberOfChunks
          chunkSize
          hash
        }
      }
      createdAt
      updatedAt
    }
  }
`

export const getFolder = /* GraphQL */ `
  query GetFolder($id: ID!) {
    getFolder(id: $id) {
      id
      hash
      prevHash
      refHash
      publicSigningKey
      postedAt
      dataRoomId
      folderId
      status
      state {
        status
        title
      }
      createdAt
      updatedAt
    }
  }
`

export const getMemo = /* GraphQL */ `
  query GetMemo($id: ID!) {
    getMemo(id: $id) {
      id
      hash
      prevHash
      refHash
      publicSigningKey
      postedAt
      dataRoomId
      state {
        message
        reactions {
          publicSigningKey
          name
          reaction
          status
          postedAt
          refHash
        }
      }
      createdAt
      updatedAt
    }
  }
`

export const getNote = /* GraphQL */ `
  query GetNote($id: ID!) {
    getNote(id: $id) {
      id
      hash
      prevHash
      refHash
      publicSigningKey
      postedAt
      dataRoomId
      folderId
      status
      state {
        status
        title
        resourceVersion
        size
        content
        revisions {
          title
          postedAt
          size
          hash
          content
        }
      }
      createdAt
      updatedAt
    }
  }
`

export const getVault = /* GraphQL */ `
  query GetDataRoom($id: ID!) {
    getDataRoom(id: $id) {
      id
      hash
      prevHash
      refHash
      publicSigningKey
      postedAt
      contextVersion
      status
      state {
        status
        title
        description
        termsOfAccess
        permanentStorage
        isContract
        isPublic
        publicKeys
      }
      createdAt
      updatedAt
    }
  }
`

export const membershipsByMemberPublicSigningKey =
  /* GraphQL */
  `
    query MembershipsByMemberPublicSigningKey(
      $memberPublicSigningKey: String
      $sortDirection: ModelSortDirection
      $filter: ModelMembershipFilterInput
      $limit: Int
      $nextToken: String
    ) {
      membershipsByMemberPublicSigningKey(
        memberPublicSigningKey: $memberPublicSigningKey
        sortDirection: $sortDirection
        filter: $filter
        limit: $limit
        nextToken: $nextToken
      ) {
        items {
          id
          hash
          prevHash
          refHash
          publicSigningKey
          postedAt
          contextVersion
          dataRoomId
          memberPublicSigningKey
          email
          status
          state {
            status
            role
            expiresOn
            memberDetails {
              publicSigningKey
              email
              fullName
              phone
              avatarUrl
              avatarTx
            }
            termsOfAccess
            agreementHash
            message
            encryptionType
            keys {
              publicKey
              encPrivateKey
            }
            encAccessKey
          }
          dataRoom {
            status
            state {
              isContract
              isPublic
              permanentStorage
              publicKeys
            }
          }
          createdAt
          updatedAt
        }
        nextToken
      }
    }
  `

  export const listVaults =
  /* GraphQL */
  `
    query MembershipsByMemberPublicSigningKey(
      $memberPublicSigningKey: String
      $sortDirection: ModelSortDirection
      $filter: ModelMembershipFilterInput
      $limit: Int
      $nextToken: String
    ) {
      membershipsByMemberPublicSigningKey(
        memberPublicSigningKey: $memberPublicSigningKey
        sortDirection: $sortDirection
        filter: $filter
        limit: $limit
        nextToken: $nextToken
      ) {
        items {
          id
          status
          role
          keys {
            encPublicKey
            encPrivateKey
          }
          dataRoom {
            id
            name
            status
            public
          }
          createdAt
          updatedAt
        }
        nextToken
      }
    }
  `

export const profilesByPublicSigningKey = /* GraphQL */ `
  query ProfilesByPublicSigningKey(
    $publicSigningKey: String
    $sortDirection: ModelSortDirection
    $filter: ModelProfileFilterInput
    $limit: Int
    $nextToken: String
  ) {
    profilesByPublicSigningKey(
      publicSigningKey: $publicSigningKey
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        hash
        publicSigningKey
        postedAt
        contextVersion
        status
        state {
          profileDetails {
            publicSigningKey
            email
            fullName
            phone
            avatarUrl
            avatarTx
          }
          encryptionType
          keys {
            publicKey
            encPrivateKey
          }
          encAccessKey
          status
        }
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`

export const getVaultStateRef = /* GraphQL */ `
  query GetDataRoom($id: ID!) {
    getDataRoom(id: $id) {
      stateRef
    }
  }
`

export const getMembershipStateRef = /* GraphQL */ `
  query GetMembership($id: ID!) {
    getMembership(id: $id) {
      stateRef
    }
  }
`

export const getFolderStateRef = /* GraphQL */ `
  query GetFolder($id: ID!) {
    getFolder(id: $id) {
      stateRef
    }
  }
`

export const getMemoStateRef = /* GraphQL */ `
  query GetMemo($id: ID!) {
    getMemo(id: $id) {
      stateRef
    }
  }
`

export const getStackStateRef = /* GraphQL */ `
  query GetStack($id: ID!) {
    getStack(id: $id) {
      stateRef
    }
  }
`

export const getNoteStateRef = /* GraphQL */ `
  query GetNote($id: ID!) {
    getNote(id: $id) {
      stateRef
    }
  }
`

export const preInviteCheck = /* GraphQL */ `
  query PreInviteCheck($emails: [String], $dataRoomId: ID) {
    preInviteCheck(emails: $emails, dataRoomId: $dataRoomId) {
      address
      email
      publicSigningKey
      publicKey
      membership {
        id
        hash
        prevHash
        refHash
        publicSigningKey
        postedAt
        contextVersion
        dataRoomId
        memberPublicSigningKey
        email
        status
        state {
          status
          role
          expiresOn
          memberDetails {
            publicSigningKey
            email
            fullName
            phone
            avatarUrl
            avatarTx
          }
          termsOfAccess
          agreementHash
          message
          encryptionType
          keys {
            publicKey
            encPrivateKey
          }
          encAccessKey
        }
        createdAt
        updatedAt
      }
    }
  }
`;

export const foldersByDataRoomId = /* GraphQL */ `
  query FoldersByDataRoomId(
    $dataRoomId: ID
    $sortDirection: ModelSortDirection
    $filter: ModelFolderFilterInput
    $limit: Int
    $nextToken: String
  ) {
    foldersByDataRoomId(
      dataRoomId: $dataRoomId
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        hash
        prevHash
        refHash
        publicSigningKey
        postedAt
        contextVersion
        dataRoomId
        folderId
        status
        state {
          status
          title
        }
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;

export const stacksByDataRoomId =
/* GraphQL */
`
  query StacksByDataRoomId(
    $dataRoomId: ID
    $sortDirection: ModelSortDirection
    $filter: ModelStackFilterInput
    $limit: Int
    $nextToken: String
  ) {
    stacksByDataRoomId(
      dataRoomId: $dataRoomId
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        hash
        prevHash
        refHash
        publicSigningKey
        postedAt
        contextVersion
        dataRoomId
        folderId
        status
        state {
          status
          title
          description
          resourceVersion
          size
          files {
            title
            resourceUrl
            thumbnailUrl
            postedAt
            fileType
            size
            numberOfChunks
            chunkSize
            hash
            resourceTx
            thumbnailTx
          }
        }
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;

export const memosByDataRoomId =
/* GraphQL */
`
  query MemosByDataRoomId(
    $dataRoomId: ID
    $sortDirection: ModelSortDirection
    $filter: ModelMemoFilterInput
    $limit: Int
    $nextToken: String
  ) {
    memosByDataRoomId(
      dataRoomId: $dataRoomId
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        hash
        prevHash
        refHash
        publicSigningKey
        postedAt
        contextVersion
        dataRoomId
        state {
          message
          reactions {
            publicSigningKey
            name
            reaction
            status
            postedAt
            refHash
          }
        }
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;

export const notesByDataRoomId =
/* GraphQL */
`
  query NotesByDataRoomId(
    $dataRoomId: ID
    $sortDirection: ModelSortDirection
    $filter: ModelNoteFilterInput
    $limit: Int
    $nextToken: String
  ) {
    notesByDataRoomId(
      dataRoomId: $dataRoomId
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        hash
        prevHash
        refHash
        publicSigningKey
        postedAt
        dataRoomId
        folderId
        status
        state {
          status
          title
          resourceVersion
          size
          content
          revisions {
            title
            postedAt
            size
            hash
            content
          }
        }
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;

export const membershipsByDataRoomId =
  /* GraphQL */
  `
    query MembershipsByDataRoomId(
      $dataRoomId: ID
      $sortDirection: ModelSortDirection
      $filter: ModelMembershipFilterInput
      $limit: Int
      $nextToken: String
    ) {
      membershipsByDataRoomId(
        dataRoomId: $dataRoomId
        sortDirection: $sortDirection
        filter: $filter
        limit: $limit
        nextToken: $nextToken
      ) {
        items {
          id
          hash
          prevHash
          refHash
          publicSigningKey
          postedAt
          contextVersion
          dataRoomId
          memberPublicSigningKey
          email
          status
          state {
            status
            role
            expiresOn
            memberDetails {
              publicSigningKey
              email
              fullName
              phone
              avatarUrl
              avatarTx
            }
            termsOfAccess
            agreementHash
            message
            encryptionType
            keys {
              publicKey
              encPrivateKey
            }
            encAccessKey
          }
          dataRoom {
            state {
              permanentStorage
              isContract
              isPublic
              publicKeys
            }
          }
          createdAt
          updatedAt
        }
        nextToken
      }
    }
  `;