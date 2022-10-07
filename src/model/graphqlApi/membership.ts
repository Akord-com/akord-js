export interface Membership {
    id: string;
    state: {
        status: string
        encryptionType: string
        keys: Array<{
          publicKey: string
          encPrivateKey: string
        }>
    }
    dataRoom: {
        id: string,
        updatedAt: string,
        state: {
          isPublic: boolean
          status: string
          title: string
          publicKeys: string[]
        }
        storage: {
            storage_used: number
        }
      }
  }
