const JSBI = require("jsbi");
const abi = require("ethereumjs-abi");
const web3Utils = require("web3-utils");
const crypto = require("../../src/common/cryptography");
const DbUtils = require("../../src/common/DbUtils");
const nodeUtils = require("../../src/common/utils");
const constants = require("../../src/common/constants");

function runSelectionAlgo(secretContractAddress, seed, nonce, balancesSum, balances, workers) {
  const hash = crypto.hash(
    abi.rawEncode(["uint256", "bytes32", "uint256"], [seed, nodeUtils.add0x(secretContractAddress), nonce])
  );
  // Find random number between [0, tokenCpt)
  let randVal = JSBI.remainder(JSBI.BigInt(hash), JSBI.BigInt(balancesSum));

  for (let i = 0; i <= balances.length; i++) {
    randVal = JSBI.subtract(randVal, balances[i]);
    if (randVal <= 0) {
      return workers[i];
    }
  }
}

/**
 * */
module.exports.createDataForTaskCreation = function() {
  const taskId = nodeUtils.remove0x(web3Utils.randomHex(32));
  const preCode = [56, 86, 27];
  const encryptedArgs = web3Utils.randomHex(32);
  const encryptedFn = web3Utils.randomHex(32);
  const userDHKey = web3Utils.randomHex(32);
  const gasLimit = 10;

  return {
    taskId: taskId,
    preCode: preCode,
    encryptedArgs: encryptedArgs,
    encryptedFn: encryptedFn,
    userDHKey: userDHKey,
    gasLimit: gasLimit
  };
};

module.exports.createDataForTaskSubmission = function() {
  const taskId = nodeUtils.remove0x(web3Utils.randomHex(32));
  const delta = [20, 30, 66];
  const output = "ff123456";
  const deltaHash = crypto.hash(delta);
  const outputHash = crypto.hash(output);
  const blockNumber = 0;
  const usedGas = 90;
  const ethereumPayload = "";
  const ethereumAddress = "";
  const signature = "";
  const preCodeHash = "";
  const status = "SUCCESS";

  return {
    taskId: taskId,
    delta: delta,
    deltaHash: deltaHash,
    outputHash: outputHash,
    output: output,
    blockNumber: blockNumber,
    usedGas: usedGas,
    ethereumPayload: ethereumPayload,
    ethereumAddress: ethereumAddress,
    signature: signature,
    preCodeHash: preCodeHash,
    status: status
  };
};

module.exports.createDataForSelectionAlgorithm = function() {
  const workersA = [
    nodeUtils.remove0x(web3Utils.randomHex(20).toLowerCase()),
    nodeUtils.remove0x(web3Utils.randomHex(20).toLowerCase()),
    nodeUtils.remove0x(web3Utils.randomHex(20).toLowerCase()),
    nodeUtils.remove0x(web3Utils.randomHex(20).toLowerCase()),
    nodeUtils.remove0x(web3Utils.randomHex(20).toLowerCase())
  ];
  const workersB = [
    nodeUtils.remove0x(web3Utils.randomHex(20).toLowerCase()),
    nodeUtils.remove0x(web3Utils.randomHex(20).toLowerCase()),
    nodeUtils.remove0x(web3Utils.randomHex(20).toLowerCase()),
    nodeUtils.remove0x(web3Utils.randomHex(20).toLowerCase()),
    nodeUtils.remove0x(web3Utils.randomHex(20).toLowerCase())
  ];

  const balancesA = [crypto.toBN(1), crypto.toBN(2), crypto.toBN(3), crypto.toBN(4), crypto.toBN(5)];
  const balancesB = [crypto.toBN(5), crypto.toBN(4), crypto.toBN(3), crypto.toBN(2), crypto.toBN(1)];
  const seed = 10;
  const nonce = 0;
  const epochSize = 100;

  let params = [
    {
      workers: workersA,
      balances: balancesA,
      seed: seed,
      nonce: nonce,
      firstBlockNumber: 300
    },
    {
      workers: workersB,
      balances: balancesB,
      seed: seed,
      nonce: nonce,
      firstBlockNumber: 400
    },
    {
      workers: workersB,
      balances: balancesB,
      seed: seed,
      nonce: nonce,
      firstBlockNumber: 0
    },
    {
      workers: workersB,
      balances: balancesB,
      seed: seed,
      nonce: nonce,
      firstBlockNumber: 100
    },
    {
      workers: workersB,
      balances: balancesB,
      seed: seed,
      nonce: nonce,
      firstBlockNumber: 200
    }
  ];

  let balancesSum = balancesA.reduce((a, b) => JSBI.add(a, b), JSBI.BigInt(0));

  const secretContractAddress = nodeUtils.remove0x(web3Utils.randomHex(32));

  const expected = runSelectionAlgo(secretContractAddress, seed, nonce, balancesSum, balancesA, workersA);

  return {
    params: params,
    expectedAddress: expected,
    expectedParams: params[0],
    secretContractAddress: secretContractAddress,
    epochSize: epochSize
  };
};

module.exports.advanceXConfirmations = async function(web3, confirmations = constants.MINIMUM_CONFIRMATIONS) {
  let initialEthereumBlockNumber = await nodeUtils.getEthereumBlockNumber(web3);
  let ethereumBlockNumber = 0;

  const accounts = await web3.eth.getAccounts();
  const from = accounts[9];
  const to = accounts[10];

  // +3 because this function usually starts before the api call
  // TODO fix this somehow - need to be exact
  while (ethereumBlockNumber - initialEthereumBlockNumber < confirmations + 3) {
    await web3.eth.sendTransaction(
      {
        from,
        to,
        value: 1
      },
      function(err, transactionHash) {
        if (err) {
          console.log("Dummy transaction error:", err);
        }
      }
    );
    ethereumBlockNumber = await nodeUtils.getEthereumBlockNumber(web3);
  }
};

/**
 * Set Ethereum with the states provided
 * @param {EnigmaContractWriterApI} api
 * @param {web3} web3
 * @param {String} workerAddress
 * @param {String} workerEnclaveSigningAddress
 * @return {Object} statesMap - a map whose keys are addresses and each object is a map of states (key=>data)
 * */
module.exports.setEthereumState = async (api, web3, workerAddress, workerEnclaveSigningAddress, statesMap) => {
  for (const address in statesMap) {
    const secretContractData = statesMap[address];
    const addressInByteArray = JSON.parse(address);

    const hexString = "0x" + DbUtils.toHexString(addressInByteArray);
    const codeHash = crypto.hash(secretContractData[-1]);
    const firstDeltaHash = crypto.hash(secretContractData[0]);
    const outputHash = web3.utils.randomHex(32);
    const gasUsed = 5;
    const optionalEthereumData = "0x00";
    const optionalEthereumContractAddress = "0x0000000000000000000000000000000000000000";

    await api.deploySecretContract(
      hexString,
      codeHash,
      codeHash,
      firstDeltaHash,
      optionalEthereumData,
      optionalEthereumContractAddress,
      gasUsed,
      workerEnclaveSigningAddress,
      { from: workerAddress }
    );

    let i = 1;

    while (i in secretContractData) {
      const taskId = web3.utils.randomHex(32);
      const delta = secretContractData[i];
      const stateDeltaHash = crypto.hash(delta);
      await api.commitReceipt(
        hexString,
        taskId,
        stateDeltaHash,
        outputHash,
        optionalEthereumData,
        optionalEthereumContractAddress,
        gasUsed,
        workerEnclaveSigningAddress,
        { from: workerAddress }
      );

      i++;
    }
  }
};
