
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
      role
      status
      memberDetails {
        publicSigningKey
        email
        fullName
        phone
        avatarUrl
        avatarTx
       }
      keys {
        encPublicKey
        encPrivateKey
      }
      dataRoom {
        public
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
        owner
        status
        name
        parentId
        dataRoomId
        createdAt
        updatedAt
        data
        versions {
          owner
          type
          resourceUri
          size
          numberOfChunks
          chunkSize
          createdAt
          name
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
      owner
      name
      parentId
      status
      dataRoomId
      data
      createdAt
      updatedAt
    }
  }
`

export const getMemo = /* GraphQL */ `
  query GetMemo($id: ID!) {
    getMemo(id: $id) {
      id
        owner
        status
        createdAt
        updatedAt
        dataRoomId
        data
        versions {
          owner
          createdAt
          message
          reactions {
            owner
            createdAt
            reaction
          }
          attachments {
            owner
            type
            resourceUri
            size
            numberOfChunks
            chunkSize
            createdAt
            name
          }
        }
    }
  }
`

export const getNote = /* GraphQL */ `
  query GetNote($id: ID!) {
    getNote(id: $id) {
      id
        owner
        status
        name
        content
        parentId
        dataRoomId
        createdAt
        updatedAt
        data
        versions {
          content
          size
          createdAt
          name
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
      name
      status
      public
      size
      data
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
          role
          status
          memberDetails {
            publicSigningKey
            email
            name
            phone
            avatarUrl
            avatarTx
           }
          keys {
            encPublicKey
            encPrivateKey
          }
          dataRoom {
            public
            state {
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
            size
            publicKeys
            createdAt
            updatedAt
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
        owner
        name
        parentId
        status
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
        owner
        status
        name
        parentId
        createdAt
        updatedAt
        versions {
          owner
          type
          resourceUri
          size
          numberOfChunks
          chunkSize
          createdAt
          name
        }
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;

export const memosByDataRoomId = /* GraphQL */ `
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
        owner
        status
        createdAt
        updatedAt
        versions {
          owner
          createdAt
          message
          reactions {
            owner
            createdAt
            reaction
          }
          attachments {
            owner
            type
            resourceUri
            size
            numberOfChunks
            chunkSize
            createdAt
            name
          }
        }
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
        owner
        status
        name
        content
        parentId
        createdAt
        updatedAt
        versions {
          content
          size
          createdAt
          name
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