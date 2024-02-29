import axios, { AxiosRequestConfig } from "axios";
import * as mime from "mime-types";
import { throwError } from "./errors/error-factory";
import { NotFound } from "./errors/not-found";
import { Tag, Tags } from "./types/contract";
import { CONTENT_TYPE as MANIFEST_CONTENT_TYPE, FILE_TYPE as MANIFEST_FILE_TYPE } from "./core/manifest";
import { DEFAULT_FILE_TYPE } from "./core/file";

const ARWEAVE_URL = "https://arweave.net";

const DEFAULT_RESPONSE_TYPE = "arraybuffer";

const getTxData = async (id: string, responseType = DEFAULT_RESPONSE_TYPE) => {
  const config = {
    method: "get",
    url: `${ARWEAVE_URL}/${id}`,
    responseType: responseType
  } as AxiosRequestConfig;
  try {
    const response = await axios(config);
    if (response.status == 200 || response.status == 202) {
      return responseType === DEFAULT_RESPONSE_TYPE && typeof window === 'undefined'
        ? bufferToArrayBuffer(response.data)
        : response.data;
    } else {
      throwError(response?.status, response?.data?.msg);
    }
  } catch (error) {
    throwError(error.response?.status, error.response?.data?.msg, error);
  }
};

const headFileTx = async (id: string) => {
  const txMetadata = await getTxMetadata(id);
  const mimeType = retrieveMimeType(txMetadata.tags);
  const name = retrieveName(txMetadata.tags) || (id + "." + mime.extension(mimeType));
  const size = txMetadata.data.size;
  const lastModified = txMetadata.block.timestamp;
  return { mimeType, name, size, lastModified };
}

const retrieveName = (tags: Tags = []): string => {
  return retrieveDecodedTag(tags, "File-Name")
    || retrieveDecodedTag(tags, "Title")
    || retrieveDecodedTag(tags, "Name")
}

const retrieveMimeType = (tags: Tags = []): string => {
  const contentType = retrieveDecodedTag(tags, "Content-Type");
  return (contentType === MANIFEST_CONTENT_TYPE ? MANIFEST_FILE_TYPE : contentType)
    || DEFAULT_FILE_TYPE;
}

const retrieveDecodedTag = (tags: Tags, tagName: string) => {
  const tagValue = tags?.find((tag: Tag) => tag.name === tagName)?.value;
  if (tagValue) {
    return decodeURIComponent(tagValue);
  }
  return null;
}

const getTxMetadata = async (id: string): Promise<TransactionMetadata> => {
  const result = await graphql(getTransaction, { id });
  const txMetadata = result?.data?.transactions?.edges[0]?.node;
  if (!txMetadata) {
    throw new NotFound("Cannot fetch arweave transaction metadata: " + id);
  }
  return txMetadata;
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
      url:`${ARWEAVE_URL}/graphql`,
      method: <any>'post',
      headers: {
        'content-type': 'application/json'
      },
      data: JSON.stringify({ query, variables }),
    };
    const response = await axios(config);
    return response.data;
  } catch (error) {
    throwError(error.response?.status, error.response?.data?.msg, error);
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

export type TransactionMetadata = {
  id: string,
  owner: { address: string },
  data: { type: string, size: string },
  tags: Tags,
  block: { timestamp: number }
}

export {
  getTxData,
  getTxMetadata,
  headFileTx,
  ARWEAVE_URL
}