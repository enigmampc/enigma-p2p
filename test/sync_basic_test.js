const assert = require("assert");
const path = require("path");
const waterfall = require("async/waterfall");
const TEST_TREE = require("./test_tree").TEST_TREE;
const CoreServer = require("../src/core/core_server_mock/core_server");
const EnvironmentBuilder = require("../src/main_controller/EnvironmentBuilder");
const testUtils = require("./testUtils/utils");
const ethTestUtils = require("./ethereum/utils");
const utils = require("../src/common/utils");
const crypto = require("../src/common/cryptography");

const B2Path = path.join(__dirname, "testUtils", "id-l.json");
const B2Port = "10301";

const constants = require("../src/common/constants");
const MsgTypes = constants.P2P_MESSAGES;
const DbUtils = require("../src/common/DbUtils");

const DB_PROVIDER = require("../src/core/core_server_mock/data/provider_db");
const PROVIDERS_DB_MAP = utils.transformStatesListToMap(DB_PROVIDER);

const SYNC_SCENARIOS = {
  EMPTY_DB: 1,
  PARTIAL_DB_WITH_SOME_ADDRESSES: 2,
  PARTIAL_DB_WITH_ALL_ADDRESSES: 3
};

const EnigmaContractAPIBuilder = require(path.join(__dirname, "../src/ethereum/EnigmaContractAPIBuilder"));
const Verifier = require("../src/worker/state_sync/receiver/StateSyncReqVerifier");
const Web3 = require("web3");

const SyncMsgBuilder = require("../src/policy/p2p_messages/sync_messages").MsgBuilder;

const parallel = require("async/parallel");

async function initEthereumStuff() {
  const workerAccount = new Web3().eth.accounts.create();
  const stakingAccount = new Web3().eth.accounts.create();

  const builder = new EnigmaContractAPIBuilder();
  const res = await builder
    .setOperationalKey(workerAccount.privateKey)
    .setStakingAddress(stakingAccount.address)
    .setMinimunConfirmations(0)
    .createNetwork()
    .deploy()
    .build();
  const enigmaContractApi = res.api;
  const web3 = enigmaContractApi.w3();

  const accounts = await web3.eth.getAccounts();
  const WORKER_WEI_VALUE = 100000000000000000;
  await web3.eth.sendTransaction({
    from: accounts[4],
    to: workerAccount.address,
    value: WORKER_WEI_VALUE
  });

  const workerEnclaveSigningAddress = accounts[0];
  const workerAddress = workerAccount.address;
  const workerReport = "0x123456";
  const signature = web3.utils.randomHex(32);

  await enigmaContractApi.register(workerEnclaveSigningAddress, workerReport, signature, { from: workerAddress });
  await enigmaContractApi.login({ from: workerAddress });

  return {
    enigmaContractAddress: res.enigmaContractAddress,
    enigmaContractApi: enigmaContractApi,
    web3: web3,
    workerEnclaveSigningAddress: workerEnclaveSigningAddress,
    workerAccount: workerAccount,
    stakingAccount: stakingAccount,
    environment: res.environment
  };
}

async function stopEthereumStuff(environment) {
  await environment.destroy();
}

function syncResultMsgToStatesMap(resultMsgs) {
  const statesMap = {};

  for (let i = 0; i < resultMsgs.length; ++i) {
    for (let j = 0; j < resultMsgs[i].resultList.length; ++j) {
      const msg = resultMsgs[i].resultList[j].payload;
      if (msg.type() == MsgTypes.SYNC_STATE_RES) {
        const deltas = msg.deltas();
        for (let k = 0; k < deltas.length; ++k) {
          const address = JSON.stringify(DbUtils.hexToBytes(deltas[k].address));
          if (!(address in statesMap)) {
            statesMap[address] = {};
          }
          const key = deltas[k].key;
          const delta = deltas[k].data;
          statesMap[address][key] = delta;
        }
      } else {
        // (msg.type() == MsgTypes.SYNC_BCODE_RES)
        const address = JSON.stringify(DbUtils.hexToBytes(msg.address()));
        if (!(address in statesMap)) {
          statesMap[address] = {};
        }
        statesMap[address][-1] = msg.bytecode();
      }
    }
  }
  return statesMap;
}

// prettier-ignore
function prepareSyncTestData(scenario) {
  let res = {};

  const contractAddr1 =  Object.keys(PROVIDERS_DB_MAP)[0];//[76,214,171,4,67,23,118,195,84,56,103,199,97,21,226,55,220,54,212,246,174,203,51,171,28,30,63,158,131,64,181,33];
  const contractAddr3 =  Object.keys(PROVIDERS_DB_MAP)[1];//[13, 214, 171, 4, 67, 23, 118, 195, 84, 56, 103, 199, 97, 21, 226, 55, 220, 54, 212, 246, 174, 203, 51, 171, 28, 30, 63, 158, 131, 64, 181, 42];
  const contractAddr2 = Object.keys(PROVIDERS_DB_MAP)[2]; //[11,214,171,4,67,23,118,195,84,34,103,199,97,21,226,55,220,143,212,246,174,203,51,171,28,30,63,158,131,64,181,200];

  // The provider always hold the entire data base, the one that changes between the scenarios is the receiver
  res.providerDB = PROVIDERS_DB_MAP;

  if (scenario === SYNC_SCENARIOS.EMPTY_DB) {
    res.expected = PROVIDERS_DB_MAP;
    res.receiverDB = {};
  } else if (scenario === SYNC_SCENARIOS.PARTIAL_DB_WITH_SOME_ADDRESSES) {
    res.receiverDB = {
      [contractAddr1]: {
        "-1": PROVIDERS_DB_MAP[contractAddr1][-1],
        "0": PROVIDERS_DB_MAP[contractAddr1][0],
        "1": PROVIDERS_DB_MAP[contractAddr1][1]
      },
      [contractAddr2]: {
        "-1": PROVIDERS_DB_MAP[contractAddr2][-1],
        "0": PROVIDERS_DB_MAP[contractAddr2][0]
      }
    };

    res.expected = {
      [contractAddr3]: PROVIDERS_DB_MAP[contractAddr3],
      [contractAddr1]: {
        "2": PROVIDERS_DB_MAP[contractAddr1][2]
      },
      [contractAddr2]: {
        "1": PROVIDERS_DB_MAP[contractAddr2][1]
      }
    };
  } else if (scenario === SYNC_SCENARIOS.PARTIAL_DB_WITH_ALL_ADDRESSES) {
    res.receiverDB = {
      [contractAddr1]: {
        "-1": PROVIDERS_DB_MAP[contractAddr1][-1],
        "0": PROVIDERS_DB_MAP[contractAddr1][0],
      },
      [contractAddr2]: {
        "-1": PROVIDERS_DB_MAP[contractAddr2][-1],
        "0": PROVIDERS_DB_MAP[contractAddr2][0]
      },
      [contractAddr3]: PROVIDERS_DB_MAP[contractAddr3]
    };

    res.expected = {
      [contractAddr1]: {
        "1": PROVIDERS_DB_MAP[contractAddr1][1],
        "2": PROVIDERS_DB_MAP[contractAddr1][2],
      },
      [contractAddr2]: {
        "1": PROVIDERS_DB_MAP[contractAddr2][1]
      }
    };
  }
  return res;
}
function syncTest(scenario) {
  return new Promise(async resolve => {
    const res = prepareSyncTestData(scenario);
    const { providerDB, receiverDB, expected } = res;

    const bootstrapNodes = ["/ip4/0.0.0.0/tcp/" + B2Port + "/ipfs/QmcrQZ6RJdpYuGvZqD5QEHAv6qX4BrQLJLQPQUrTrzdcgm"];

    const dnsConfig = {
      bootstrapNodes: bootstrapNodes,
      port: B2Port,
      nickname: "dns",
      idPath: B2Path,
      extraConfig: {}
    };
    const peerConfig = {
      bootstrapNodes: bootstrapNodes,
      nickname: "peer",
      extraConfig: {}
    };
    const dnsMockUri = "tcp://127.0.0.1:44444";
    const peerMockUri = "tcp://127.0.0.1:55555";

    const dnsMockCore = new CoreServer("dns");
    const peerMockCore = new CoreServer("peer");

    // start the dns mock server (core)
    dnsMockCore.runServer(dnsMockUri, providerDB);

    // start the peer mock server (core)
    peerMockCore.runServer(peerMockUri, receiverDB);

    await testUtils.sleep(1500);
    const ethereumInfo = await initEthereumStuff();
    const api = ethereumInfo.enigmaContractApi;
    const web3 = ethereumInfo.web3;
    const workerEnclaveSigningAddress = ethereumInfo.workerEnclaveSigningAddress;
    const workerAddress = ethereumInfo.workerAccount.address;
    const enigmaContractAddress = ethereumInfo.enigmaContractAddress;

    // start the dns
    const dnsBuilder = new EnvironmentBuilder();
    const dnsController = await dnsBuilder
      .setNodeConfig(dnsConfig)
      .setIpcConfig({ uri: dnsMockUri })
      .build();

    // start the dns (with the same ethereum accounts)
    const peerBuilder = new EnvironmentBuilder();
    const peerController = await peerBuilder
      .setNodeConfig(peerConfig)
      .setIpcConfig({ uri: peerMockUri })
      .setEthereumConfig({
        enigmaContractAddress: enigmaContractAddress,
        operationalAddress: workerAddress,
        operationalKey: ethereumInfo.workerAccount.privateKey,
        minConfirmations: 0,
        stakingAddress: ethereumInfo.stakingAccount.address
      })
      .build();
    // write all states to ethereum
    await ethTestUtils.setEthereumState(api, web3, workerAddress, workerEnclaveSigningAddress, providerDB);
    await testUtils.sleep(8000);
    waterfall(
      [
        cb => {
          // announce
          dnsController.getNode().tryAnnounce((err, ecids) => {
            assert.strictEqual(null, err, "error announcing" + err);
            cb(null);
          });
        },
        cb => {
          // sync
          peerController.getNode().syncReceiverPipeline(async (err, statusResult) => {
            assert.strictEqual(null, err, "error syncing" + err);
            statusResult.forEach(result => {
              assert.strictEqual(true, result.success);
            });
            cb(null, statusResult);
          });
        }
      ],
      async (err, statusResult) => {
        assert.strictEqual(null, err, "error in waterfall " + err);

        // validate the results
        const missingstatesMap = syncResultMsgToStatesMap(statusResult);
        assert.strictEqual(Object.entries(missingstatesMap).length, Object.entries(expected).length);
        for (const [address, data] of Object.entries(missingstatesMap)) {
          assert.strictEqual(
            Object.entries(missingstatesMap[address]).length,
            Object.entries(expected[address]).length
          );
          for (const [key, delta] of Object.entries(missingstatesMap[address])) {
            for (let i = 0; i < missingstatesMap[address][key].length; ++i) {
              assert.strictEqual(missingstatesMap[address][key][i], expected[address][key][i]);
            }
          }
        }
        await dnsController.getNode().stop();
        dnsController.getIpcClient().disconnect();

        await peerController.getNode().stop();
        peerController.getIpcClient().disconnect();

        dnsMockCore.disconnect();
        peerMockCore.disconnect();

        await stopEthereumStuff(ethereumInfo.environment);

        await testUtils.sleep(2000);
        resolve();
      }
    );
  });
}

function createSyncMsgForVerifierTest(type, data) {
  const rawMsg = {};
  rawMsg.msgType = type;
  rawMsg.id = "e3yB8OEMGSiA";

  if (type === MsgTypes.SYNC_STATE_RES) {
    rawMsg.type = "GetDeltas";
    rawMsg.result = { deltas: data };
    return SyncMsgBuilder.stateResponseMessage(rawMsg);
  }
  if (type === MsgTypes.SYNC_BCODE_RES) {
    rawMsg.type = "GetContract";
    rawMsg.result = {
      address: data.address,
      bytecode: data.bytecode
    };
    return SyncMsgBuilder.bcodeResponseMessage(rawMsg);
  }
  if (type === MsgTypes.SYNC_BCODE_REQ) {
    return SyncMsgBuilder.bCodeRequestMessage(rawMsg);
  }
  return SyncMsgBuilder.stateRequestMessage(rawMsg);
}

it("#1 should tryAnnounce action from mock-db no-cache", async function() {
  const tree = TEST_TREE["sync_basic"];
  if (!tree["all"] || !tree["#1"]) {
    this.skip();
  }
  return new Promise(async resolve => {
    const uri = "tcp://127.0.0.1:6111";
    const coreServer = new CoreServer();
    const peerConfig = {
      bootstrapNodes: [],
      port: "0",
      nickname: "peer",
      idPath: null,
      extraConfig: {}
    };
    let mainController;
    waterfall(
      [
        cb => {
          // start the mock server first
          coreServer.runServer(uri);
          cb(null);
        },
        cb => {
          const builder = new EnvironmentBuilder();
          builder
            .setNodeConfig(peerConfig)
            .setIpcConfig({ uri: uri })
            .build()
            .then(instance => {
              mainController = instance;
              cb(null);
            });
        },
        cb => {
          // announce
          mainController.getNode().tryAnnounce((err, ecids) => {
            assert.strictEqual(null, err, "error announcing" + err);
            cb(null, ecids);
          });
        },
        (ecids, cb) => {
          // verify announcement FindContentProviderAction action
          mainController.getNode().findProviders(ecids, findProvidersResult => {
            const keyCounter = findProvidersResult.getKeysList().length;
            assert.strictEqual(ecids.length, keyCounter, "not enough keys");
            cb(null);
          });
        }
      ],
      async err => {
        assert.strictEqual(null, err, "error in waterfall " + err);
        await mainController.getNode().stop();
        mainController.getIpcClient().disconnect();
        coreServer.disconnect();
        resolve();
      }
    );
  });
});

it("#2 Perform a full sync scenario - from scratch", async function() {
  const tree = TEST_TREE["sync_basic"];
  if (!tree["all"] || !tree["#2"]) {
    this.skip();
  }
  return syncTest(SYNC_SCENARIOS.EMPTY_DB);
});

it("#3 Perform a full sync scenario - from mid-with-some-addresses", async function() {
  const tree = TEST_TREE["sync_basic"];
  if (!tree["all"] || !tree["#3"]) {
    this.skip();
  }
  return syncTest(SYNC_SCENARIOS.PARTIAL_DB_WITH_SOME_ADDRESSES);
});

it("#4 Perform a full sync scenario - from mid-with-all-addresses", async function() {
  const tree = TEST_TREE["sync_basic"];
  if (!tree["all"] || !tree["#4"]) {
    this.skip();
  }
  return syncTest(SYNC_SCENARIOS.PARTIAL_DB_WITH_ALL_ADDRESSES);
});

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}
function generateByteCode(size) {
  let byteCode = [];
  for (let i = 0; i < size; ++i) {
    byteCode.push(getRandomInt(255));
  }
  return byteCode;
}

// For next debug steps of the size limitation of the sync scenario - uncomment this
/*
it("#6 debug bytecode", async function() {
  const tree = TEST_TREE["sync_basic"];
  if (!tree["all"] || !tree["#6"]) {
    this.skip();
  }
  return new Promise(async resolve => {
    const contractAddress = Object.keys(PROVIDERS_DB_MAP)[0];
    let expectedMap = { [contractAddress]: PROVIDERS_DB_MAP[contractAddress] };

    let byteCodeArr = generateByteCode(1024 * 1024 * 2.5);
    expectedMap[contractAddress][-1] = byteCodeArr;

    const bootstrapNodes = ["/ip4/0.0.0.0/tcp/" + B2Port + "/ipfs/QmcrQZ6RJdpYuGvZqD5QEHAv6qX4BrQLJLQPQUrTrzdcgm"];

    const dnsConfig = {
      bootstrapNodes: bootstrapNodes,
      port: B2Port,
      nickname: "dns",
      idPath: B2Path,
      extraConfig: {}
    };
    const peerConfig = {
      bootstrapNodes: bootstrapNodes,
      nickname: "peer",
      extraConfig: {}
    };
    const dnsMockUri = "tcp://127.0.0.1:44444";
    const peerMockUri = "tcp://127.0.0.1:55555";

    const dnsMockCore = new CoreServer("dns");
    const peerMockCore = new CoreServer("peer");

    // start the dns mock server (core)
    dnsMockCore.runServer(dnsMockUri, expectedMap);

    // start the peer mock server (core)
    peerMockCore.runServer(peerMockUri, {});
    await testUtils.sleep(1500);
    const ethereumInfo = await initEthereumStuff();
    const api = ethereumInfo.enigmaContractApi;
    const web3 = ethereumInfo.web3;
    const workerEnclaveSigningAddress = ethereumInfo.workerEnclaveSigningAddress;
    const workerAddress = ethereumInfo.workerAddress;
    const enigmaContractAddress = ethereumInfo.enigmaContractAddress;

    // start the dns
    const dnsBuilder = new EnvironmentBuilder();
    const dnsController = await dnsBuilder
      .setNodeConfig(dnsConfig)
      .setIpcConfig({ uri: dnsMockUri })
      .build();

    // start the dns
    const peerBuilder = new EnvironmentBuilder();
    const peerController = await peerBuilder
      .setNodeConfig(peerConfig)
      .setIpcConfig({ uri: peerMockUri })
      .setEthereumConfig({ enigmaContractAddress: enigmaContractAddress })
      .build();

    // write all states to ethereum
    await ethTestUtils.setEthereumState(api, web3, workerAddress, workerEnclaveSigningAddress, expectedMap);
    await testUtils.sleep(8000);
    waterfall(
      [
        cb => {
          // announce
          dnsController.getNode().tryAnnounce((err, ecids) => {
            assert.strictEqual(null, err, "error announcing" + err);
            cb(null);
          });
        },
        cb => {
          // sync
          peerController.getNode().syncReceiverPipeline(async (err, statusResult) => {
            assert.strictEqual(null, err, "error syncing" + err);
            statusResult.forEach(result => {
              assert.strictEqual(true, result.success);
            });
            cb(null, statusResult);
          });
        }
      ],
      async (err, statusResult) => {
        assert.strictEqual(null, err, "error in waterfall " + err);

        // validate the results
        const missingstatesMap = syncResultMsgToStatesMap(statusResult);
        assert.strictEqual(Object.entries(missingstatesMap).length, Object.entries(expectedMap).length);
        for (const [address, data] of Object.entries(missingstatesMap)) {
          assert.strictEqual(
            Object.entries(missingstatesMap[address]).length,
            Object.entries(expectedMap[address]).length
          );
          for (const [key, delta] of Object.entries(missingstatesMap[address])) {
            for (let i = 0; i < missingstatesMap[address][key].length; ++i) {
              assert.strictEqual(missingstatesMap[address][key][i], expectedMap[address][key][i]);
            }
          }
        }
        await dnsController.getNode().stop();
        dnsController.getIpcClient().disconnect();

        await peerController.getNode().stop();
        peerController.getIpcClient().disconnect();

        dnsMockCore.disconnect();
        peerMockCore.disconnect();

        await stopEthereumStuff(ethereumInfo.environment);

        await testUtils.sleep(2000);
        resolve();
      }
    );
  });
});
*/
// prettier-ignore
function prepareDataForVerifierTest() {
  const web3 = new Web3();

  let address0 = web3.utils.randomHex(32);
  address0 = address0.slice(2, address0.length);

  let address1 = web3.utils.randomHex(32);
  address1 = address1.slice(2, address1.length);

  const bytecode = Buffer.from([11, 255, 84, 134, 4, 62, 190, 60, 15, 43, 249, 32, 21, 188, 170, 27, 22, 23, 8, 248, 158, 176, 219, 85, 175, 190, 54, 199, 198, 228, 198, 87, 124, 33, 158, 115, 60, 173, 162, 16,
    150, 13, 149, 77, 159, 158, 13, 213, 171, 154, 224, 241, 4, 42, 38, 120, 66, 253, 127, 201, 113, 252, 246, 177, 218, 155, 249, 166, 68, 65, 231, 208, 210, 116, 89, 100,
    207, 92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
    56, 90, 104, 16, 241, 108, 14, 126, 116, 91, 106, 10, 141, 122, 78, 214, 148, 194, 14, 31, 96, 142, 178, 96, 150, 52, 142, 138, 37, 209, 110,
    82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
    88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222, 73, 175, 207, 222, 86, 42, 236, 92, 194, 214,
    28, 195, 236, 122, 122, 12, 134, 55, 41, 209, 106, 172, 10, 130, 139, 149, 39, 196, 181, 187, 55, 166, 237, 215, 135, 98, 90, 12, 6, 72, 240, 138, 112, 99, 76, 55, 22,
    231, 223, 153, 119, 15, 98, 26, 77, 139, 89, 64, 24, 108, 137, 118, 38, 142, 19, 131, 220, 252, 248, 212, 120, 231, 26, 21, 228, 246, 179, 104, 207, 76, 218, 88, 150, 13, 149, 77, 159, 158, 13, 213, 171, 154, 224, 241, 4, 42, 38, 120, 66, 253, 127, 201, 113, 252, 246, 177, 218, 155, 249, 166, 68, 65, 231, 208, 210, 116, 89, 100,
    207, 92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
    82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190,
    227, 136, 133, 252, 128, 213]).toString('hex');

  const delta0_0 = Buffer.from([135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
    150, 13, 149, 77, 159, 158, 13, 213, 171, 154, 224, 241,
    207, 92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
    82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
    88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
    82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211]).toString('hex');;

  const delta0_1 = Buffer.from([236, 122, 122, 12, 134, 55, 41, 209, 106, 172, 10, 130, 139, 149, 39, 196, 181, 187, 55, 166, 237, 215, 135, 98, 90, 12, 6, 72, 240, 138, 112, 99, 76, 55, 22,
    88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222, 73, 175, 207, 222, 86, 42, 236, 92, 194, 214,
    28, 195, 236, 122, 122, 12, 134, 55, 41, 209, 106, 172, 10, 130, 139, 149, 39, 196, 181, 187, 55, 166, 237, 215, 135, 98, 90, 12, 6, 72, 240, 138, 112, 99, 76, 55, 22,
    207, 92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
    82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
    88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222, 73, 175, 207, 222, 86, 42, 236, 92, 194, 214,
    28, 195, 236, 122, 122, 12, 134, 55, 41, 209, 106, 172, 10, 130, 139, 149, 39, 196, 181, 187, 55, 166, 237, 215, 135, 98, 90, 12, 6, 72, 240, 138, 112, 99, 76, 55, 22,
    231, 223, 153, 119, 15, 98, 26, 77, 139, 89, 64, 24, 108, 137, 118, 38, 142, 19, 131, 220, 252, 248, 212, 120,
    88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222,
    73, 175, 207, 222, 86, 42]).toString('hex');

  const delta1_0 = Buffer.from([92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
    82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
    88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222, 73, 175, 207, 222, 86, 42, 236, 92, 194, 214,
    28, 195, 236, 122, 122, 12, 134, 55, 41, 209, 106, 172, 10, 130, 139, 149, 39, 196, 181, 187, 55, 166, 237, 215, 135, 98, 90, 12, 6, 72, 240, 138, 112, 99, 76, 55, 22,
    231, 223, 153, 119, 15, 98, 26, 77, 139, 89, 64, 24, 108, 137, 118, 38, 142, 19, 131, 220, 252, 248, 212, 120, 231, 26, 21, 228, 246, 179, 104, 207, 76, 218, 88, 150, 13, 149, 77, 159, 158, 13, 213, 171, 154, 224, 241, 4, 42, 38, 120, 66, 253, 127, 201, 113, 252, 246, 177, 218, 155, 249, 166, 68, 65, 231, 208, 210, 116, 89, 100,
    207, 92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
    82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
    88, 135, 204]).toString('hex');

  const missing = {};
  missing[address0] = {deltas: {0: crypto.hash(delta0_0), 1: crypto.hash(delta0_1)}, bytecodeHash: crypto.hash(bytecode)};
  missing[address1] = {deltas: {0: crypto.hash(delta1_0)}};

  const wrongMsg1 = createSyncMsgForVerifierTest(MsgTypes.SYNC_STATE_RES, [{address: address1, key: '1', data: delta1_0}]);
  const expectedErr1 = 'received an unknown index ' + '1' + ' for address ' + address1;

  let wrongAddress = web3.utils.randomHex(32);
  wrongAddress = address1.slice(2, address1.length);

  const wrongMsg2 = createSyncMsgForVerifierTest(MsgTypes.SYNC_STATE_RES, [{address: wrongAddress, key: '0', data: delta1_0}]);
  const expectedErr2 = 'received an unknown address ' + wrongAddress + ' in SyncStateRes';

  const correctSyncStateMsg = createSyncMsgForVerifierTest(MsgTypes.SYNC_STATE_RES, [{address: address1, key: '0', data: delta1_0}]);

  const wrongData1 = Array.from(delta1_0);
  wrongData1.push(130);

  const wrongMsg3 = createSyncMsgForVerifierTest(MsgTypes.SYNC_STATE_RES, [{address: address1, key: '0', data: wrongData1}]);
  const expectedErr3 = 'delta received for address ' + address1 + ' in index ' + '0' + ' does not match remote hash';

  const wrongMsg4 = createSyncMsgForVerifierTest(MsgTypes.SYNC_BCODE_RES, {address: address1, bytecode: bytecode});
  const expectedErr4 = 'received a bytecodeHash for unknown address ' + address1;

  const wrongMsg5 = createSyncMsgForVerifierTest(MsgTypes.SYNC_BCODE_RES, {address: wrongAddress, bytecode: bytecode});
  const expectedErr5 = 'received an unknown address ' + wrongAddress + ' in SyncBcodeRes';

  const correctSyncBytecodeMsg = createSyncMsgForVerifierTest(MsgTypes.SYNC_BCODE_RES, {address: address0, bytecode: bytecode});

  const wrongData2 = Array.from(bytecode);
  wrongData2.push(130);

  const wrongMsg6 = createSyncMsgForVerifierTest(MsgTypes.SYNC_BCODE_RES, {address: address0, bytecode: wrongData2});
  const expectedErr6 = 'bytecodeHash received for address ' + address0 + ' does not match remote hash';

  const wrongMsg7 = createSyncMsgForVerifierTest(MsgTypes.SYNC_BCODE_REQ, {address: address0, bytecode: wrongData2});
  const expectedErr7 = 'received an unknown msgType ' + MsgTypes.SYNC_BCODE_REQ;

  const expected = [{msg: wrongMsg1, err: expectedErr1, res: false}, {msg: wrongMsg2, err: expectedErr2, res: false},
    {msg: wrongMsg3, err: expectedErr3, res: false}, {msg: correctSyncStateMsg, err: null, res: true},
    {msg: wrongMsg4, err: expectedErr4, res: false}, {msg: wrongMsg5, err: expectedErr5, res: false},
    {msg: wrongMsg6, err: expectedErr6, res: false}, {msg: wrongMsg7, err: expectedErr7, res: false},
    {msg: correctSyncBytecodeMsg, err: null, res: true}];

  return {expected: expected, missing: missing};
}

it("#5 Test verifier", async function() {
  const tree = TEST_TREE["sync_basic"];
  if (!tree["all"] || !tree["#5"]) {
    this.skip();
  }

  return new Promise(async resolve => {
    const res = prepareDataForVerifierTest();

    const expected = res.expected;
    const missing = res.missing;

    // verify
    const jobs = [];
    let i = 0;

    expected.forEach(testCaseData => {
      jobs.push(cb => {
        Verifier.verify(missing, testCaseData.msg, (err, isOk) => {
          assert.strictEqual(err, testCaseData.err);
          assert.strictEqual(isOk, testCaseData.res);
          i += 1;
          return cb(null);
        });
      });
    });

    parallel(jobs, err => {
      resolve();
    });
  });
});
