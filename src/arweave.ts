import axios, { AxiosRequestConfig } from "axios";

const ARWEAVE_URL = "https://arweave.net/";

const getTxData = async (id: string) => {
  const config = {
    method: "get",
    url: ARWEAVE_URL + id,
    responseType: "arraybuffer"
  } as AxiosRequestConfig;
  try {
    const response = await axios(config);
    if (response.status == 200 || response.status == 202) {
      return bufferToArrayBuffer(response.data);
    } else {
      throw new Error("Cannot fetch arweave transaction data: " + id);
    }
  } catch (error) {
    throw new Error("Cannot fetch arweave transaction data: " + id);
  }
};

const getTxMetadata = async (id: string) => {
  try {
    const result = await graphql(getTransaction, { id });
    const txMetadata = result?.data?.transactions?.edges[0]?.node;
    if (!txMetadata) {
      throw new Error("Cannot fetch arweave transaction metadata: " + id);
    }
    return txMetadata;
  } catch (error) {
    throw new Error("Cannot fetch arweave transaction metadata: " + id);
  }
};

const getTransaction = /* GraphQL */ `
query transactionsById($id: ID!) {
  transactions(ids:[$id]) {
    edges {
      node {
        id
        owner {
          address
        }
        data {
          type
          size
        }
        tags {
          name
          value
        }
        block {
          timestamp
        }
      }
    }
  }
}
`;

const graphql = async (query: any, variables: any) => {
  try {
    const config = {
      url: ARWEAVE_URL + "graphql",
      method: <any>'post',
      headers: {
        'content-type': 'application/json'
      },
      data: JSON.stringify({ query, variables }),
    };
    const response = await axios(config);
    return response.data;
  } catch (error) {
    throw new Error("Error while trying to make fetch request");
  }
}

const bufferToArrayBuffer = (buffer: Buffer) => {
  const arrayBuffer = new ArrayBuffer(buffer.length);
  var view = new Uint8Array(arrayBuffer);
  for (var i = 0; i < buffer.length; ++i) {
    view[i] = buffer[i];
  }
  return arrayBuffer;
}

export {
  getTxData,
  getTxMetadata
}