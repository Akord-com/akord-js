import axios from "axios";

const ARWEAVE_URL = "https://arweave.net/";

const getTxData = async (id: string) => {
  const response = await fetch(ARWEAVE_URL + id);
  if (response.status == 200 || response.status == 202) {
    const body = await response.arrayBuffer();
    return body;
  } else {
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

export {
  getTxData,
  getTxMetadata
}