import Arweave from 'arweave';
import { arweaveConfig } from './arweave-config';
import { WarpFactory, LoggerFactory, DEFAULT_LEVEL_DB_LOCATION, Contract } from "warp-contracts";
import { protocolTags } from "../../constants";
import { ContractState } from "../../types/contract";
import { clientName, protocolName, protocolVersion } from "./config";

// Set up Arweave client
const arweave = Arweave.init(arweaveConfig());

// Set up SmartWeave client
LoggerFactory.INST.logLevel("error");
const smartweave = WarpFactory.forMainnet({ inMemory: true, dbLocation: DEFAULT_LEVEL_DB_LOCATION });

const getContract = (contractId, wallet): Contract<ContractState> => {
  const contract = <any>smartweave
    .contract(contractId)
    // .setEvaluationOptions({
    //   useIVM: true
    // })
  if (wallet) {
    return contract.connect(wallet);
  }
  return contract;
};

const getTagsFromObject = (object) => {
  let tags = [];
  for (let key in object) {
    if (object.hasOwnProperty(key)) {
      tags.push({ name: key, value: object[key] });
    }
  }
  return tags;
};

async function deployContract(contractCodeSourceTxId, contractInitStateJSON, tags, wallet) {
  const initialState = JSON.stringify(contractInitStateJSON);

  const contractTxId = await smartweave.createContract.deployFromSourceTx({
    wallet,
    initState: initialState,
    srcTxId: contractCodeSourceTxId,
    tags: tags
  });
  return contractTxId;
}

// async function preparePstRewardTransfer(wallet) {
//   const contract = getContract(pstContractTxId, wallet);
//   const currentState = (await contract.readState()).cachedValue.state;
//   const holder = selectWeightedPstHolder(currentState);
//   return {
//     target: holder,
//     winstonQty: '0.15'
//   }
// }

// function selectWeightedPstHolder(state) {
//   const balances = state.balances;
//   const vault = state.vault;
//   let total = 0;
//   for (const addr of Object.keys(balances)) {
//     total += balances[addr];
//   }
//   for (const addr of Object.keys(vault)) {
//     if (!vault[addr].length) continue;
//     const vaultBalance = vault[addr]
//       .map((a) => a.balance)
//       .reduce((a, b) => a + b, 0);
//     total += vaultBalance;
//     if (addr in balances) {
//       balances[addr] += vaultBalance;
//     } else {
//       balances[addr] = vaultBalance;
//     }
//   }
//   const weighted = {};
//   for (const addr of Object.keys(balances)) {
//     weighted[addr] = balances[addr] / total;
//   }
//   const randomHolder = weightedRandom(weighted);
//   return randomHolder;
// }

// function weightedRandom(dict) {
//   let sum = 0;
//   const r = Math.random();
//   for (const addr of Object.keys(dict)) {
//     sum += dict[addr];
//     if (r <= sum && dict[addr] > 0) {
//       return addr;
//     }
//   }
//   return;
// }

async function postContractTransaction(contractId, input, tags, wallet) {
  try {
    const contract = getContract(contractId, wallet);
    // const pstTransfer = await preparePstRewardTransfer(wallet);
    const { originalTxId } = await contract.writeInteraction(input, {
      tags: getTagsFromObject(constructHeader(tags)),
      strict: true
    });
    return { txId: originalTxId }
  } catch (error) {
    console.log(error)
    throw new Error("Cannot perform the operation: " + error);
  }
}

const initContract = async (contractSrc, additionalTags, initialState, wallet) => {
  const tags = getTagsFromObject(constructHeader(additionalTags));
  const { contractTxId } = await deployContract(contractSrc, initialState, tags, wallet);
  return contractTxId;
}

function constructHeader(headerPayload) {
  return {
    ...(headerPayload ? headerPayload : {}),
    [protocolTags.CLIENT_NAME]: clientName,
    [protocolTags.PROTOCOL_NAME]: protocolName,
    [protocolTags.PROTOCOL_VERSION]: protocolVersion,
    [protocolTags.TIMESTAMP]: JSON.stringify(Date.now()),
  }
}

async function prepareArweaveTransaction(data, tags, wallet) {
  try {
    // create a new arweave transaction with data & tags
    let transaction = await arweave.createTransaction({
      data: data
    }, wallet)
    for (const [key, value] of Object.entries(tags)) {
      if (value) {
        transaction.addTag(key, value.toString());
      }
    }
    // sign the new transaction
    await arweave.transactions.sign(transaction, wallet);
    return transaction;
  } catch (error) {
    console.log("in arweave.js: Could not create an Arweave transaction: " + error);
    throw new Error("Could not create an Arweave transaction: " + error);
  }
};

async function uploadChunksArweaveTransaction(transaction) {
  try {
    const uploader = await arweave.transactions.getUploader(transaction);
    while (!uploader.isComplete) {
      await uploader.uploadChunk();
      console.log(`${uploader.pctComplete}% complete, ${uploader.uploadedChunks}/${uploader.totalChunks}`);
    }
  } catch (error) {
    console.log("Could not post the transaction to the Arweave blockchain: " + error);
    throw new Error("Could not post the transaction to the Arweave blockchain: " + error);
  }
};

async function postAndSignArweaveTransaction(transaction, wallet) {
  try {
    await arweave.transactions.sign(transaction, wallet);
    await arweave.transactions.post(transaction);
  } catch (error) {
    throw new Error("Could not post the transaction to the Arweave blockchain: " + error);
  }
};

async function postArweaveTransaction(transaction) {
  try {
    await arweave.transactions.post(transaction);
  } catch (error) {
    throw new Error("Could not post the transaction to the Arweave blockchain: " + error);
  }
};

async function getPublicKeyFromAddress(address) {
  try {
    const transactionId = await arweave.wallets.getLastTransactionID(address);
    if (transactionId) {
      const transaction = await arweave.transactions.get(transactionId);
      return transaction.owner
    } else {
      console.log("Could not find corresponding public key for the given address. Make sure that the member address is registered on the weave, ie. at least one transaction was made with that address.");
    }
  } catch (error) {
    console.log("Could not find corresponding public key for the given address. Make sure that the member address is registered on the weave, ie. at least one transaction was made with that address.");
    console.error("Could not find corresponding public key for the given address: " + error);
  }
};

async function getAddress(wallet: any) {
  try {
    return arweave.wallets.jwkToAddress(wallet);
  } catch (error) {
    console.error("Could not find address for the given wallet: " + error);
  }
};

export {
  arweave,
  prepareArweaveTransaction,
  uploadChunksArweaveTransaction,
  postArweaveTransaction,
  getPublicKeyFromAddress,
  getContract,
  postContractTransaction,
  initContract,
  postAndSignArweaveTransaction,
  getAddress
}