import { ListOptions } from "../types/query-options";
import lodash from "lodash";
import { EncryptedPayload } from "@akord/crypto/lib/types";
import { base64ToArray } from "@akord/crypto";
import { EncryptionMetadata } from "../types/encryption";

export const handleListErrors = async <T>(originalItems: Array<T>, promises: Array<Promise<T>>)
  : Promise<{ items: Array<T>, errors: Array<{ id: string, error: Error }> }> => {
  const results = await Promise.all(promises.map(p => p.catch(e => e)));
  const items = results.filter(result => !(result instanceof Error));
  const errors = results
    .map((result, index) => ({ result, index }))
    .filter((mapped) => mapped.result instanceof Error)
    .map((filtered) => ({ id: (<any>originalItems[filtered.index]).id, error: filtered.result }));
  return { items, errors };
}

export const paginate = async <T>(apiCall: any, listOptions: ListOptions & { vaultId?: string }): Promise<Array<T>> => {
  let token = undefined;
  let results = [] as T[];
  do {
    const { items, nextToken } = await apiCall(listOptions);
    results = results.concat(items);
    token = nextToken;
    listOptions.nextToken = nextToken;
    if (nextToken === "null") {
      token = undefined;
    }
  } while (token);
  return results;
}

export const mergeState = (currentState: any, stateUpdates: any): any => {
  let newState = lodash.cloneDeepWith(currentState);
  lodash.mergeWith(
    newState,
    stateUpdates,
    function concatArrays(objValue, srcValue) {
      if (lodash.isArray(objValue)) {
        return objValue.concat(srcValue);
      }
    });
  return newState;
}

export const getEncryptedPayload = (data: ArrayBuffer | string, metadata: EncryptionMetadata)
  : EncryptedPayload => {
  const { encryptedKey, iv } = metadata;
  if (encryptedKey && iv) {
    return {
      encryptedKey,
      encryptedData: {
        iv: base64ToArray(iv),
        ciphertext: data as ArrayBuffer
      }
    }
  }
  return null;
}
