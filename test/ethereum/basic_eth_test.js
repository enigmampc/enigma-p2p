const path = require('path');
const assert = require('assert');
const TEST_TREE = require(path.join(__dirname, '../test_tree')).TEST_TREE;
const envInitializer = require('./scripts/env_initializer');
const EnigmaContractWriterAPI = require(path.join(__dirname, '../../src/ethereum/EnigmaContractWriterAPI'));
const EnigmaContractAPIBuilder = require(path.join(__dirname, '../../src/ethereum/EnigmaContractAPIBuilder'));
const EthereumServices = require(path.join(__dirname, '../../src/ethereum/EthereumServices'));

const StateSync = require(path.join(__dirname, '../../src/ethereum/StateSync'));

const truffleDir = path.join(__dirname, './scripts');

const testParameters = require('./test_parameters.json');

const testUtils = require('../testUtils/utils');

const DB_PROVIDER = require('../../src/core/core_server_mock/data/provider_db');

// const B1Path = path.join(__dirname, "../testUtils/id-l");
// const B1Port = "10300";
const B2Path = path.join(__dirname, '../testUtils/id-l');
const B2Port = '10301';
const CoreServer = require('../../src/core/core_server_mock/core_server');
const EnvironmentBuilder = require('../../src/main_controller/EnvironmentBuilder');
const waterfall = require('async/waterfall');

const util = require('util');

const SYNC_SCENARIOS = {EMPTY_DB: 1, PARTIAL_DB_WITH_SOME_ADDRESSES: 2, PARTIAL_DB_WITH_ALL_ADDRESSES: 3};

const constants = require('../../src/common/constants');
const MsgTypes = constants.P2P_MESSAGES;
const DbUtils = require('../../src/common/DbUtils');

// async function initEthereumStuff() {
//   await envInitializer.start(truffleDir);
//   const result = await envInitializer.init(truffleDir);
//   const enigmaContractAddress = result.contractAddress;
//   const enigmaContractABI = result.contractABI;
//   const web3 = result.web3;
//   const enigmaContractApi = await new EnigmaContractWriterAPI(enigmaContractAddress, enigmaContractABI, web3);
//
//   const accounts = await web3.eth.getAccounts();
//   const workerEnclaveSigningAddress = accounts[0];
//   const workerAddress = accounts[1];
//   const workerReport = "0x123456";
//
//   await enigmaContractApi.register(workerEnclaveSigningAddress, workerReport, {from: workerAddress});
//
//   await enigmaContractApi.login({from: workerAddress});
//
//   // await deploySecretContract(api, secretContractAddress1, workerEnclaveSigningAddress,
//   //  codeHash, workerAddress);
//   return {enigmaContractAddress: enigmaContractAddress, enigmaContractApi: enigmaContractApi, web3: web3,
//     workerEnclaveSigningAddress: workerEnclaveSigningAddress,
//     workerAddress: workerAddress};
// }
//
// async function stopEthereumStuff(web3) {
//   await envInitializer.disconnect(web3);
//   await envInitializer.stop(web3);
// }

function transformStatesListToMap(statesList) {
  const statesMap = {};
  for (let i = 0; i < statesList.length; ++i) {
    const address = statesList[i].address;
    if (!(address in statesMap)) {
      statesMap[address] = {};
    }
    const key = statesList[i].key;
    const delta = statesList[i].delta;
    statesMap[address][key] = delta;
  }
  return statesMap;
}

function syncResultMsgToStatesMap(resultMsgs) {
  const statesMap = {};

  for (let i = 0; i < resultMsgs.length; ++i) {
    for (let j = 0; j < resultMsgs[i].resultList.length; ++j) {
      const msg = resultMsgs[i].resultList[j].payload;
      if (msg.type() == MsgTypes.SYNC_STATE_RES) {
        const deltas = msg.deltas();
        for (let k = 0; k < deltas.length; ++k) {
          const address = DbUtils.hexToBytes((deltas[k].address));
          if (!(address in statesMap)) {
            statesMap[address] = {};
          }
          const key = deltas[k].key;
          const delta = deltas[k].data;
          statesMap[address][key] = delta;
        }
      } else { // (msg.type() == MsgTypes.SYNC_BCODE_RES)
        const address = DbUtils.hexToBytes(msg.address());
        if (!(address in statesMap)) {
          statesMap[address] = {};
        }
        statesMap[address][-1] = msg.bytecode();
      }
    }
  }
  return statesMap;
}

const PROVIDERS_DB_MAP = transformStatesListToMap(DB_PROVIDER);

async function setEthereumState(api, web3, workerAddress, workerEnclaveSigningAddress) {
  for (const address in PROVIDERS_DB_MAP) {
    const secretContractData = PROVIDERS_DB_MAP[address];
    const addressInByteArray = address.split(',').map(function(item) {
      return parseInt(item, 10);
    });

    const hexString = '0x' + DbUtils.toHexString(addressInByteArray);
    const codeHash = web3.utils.keccak256(secretContractData[-1]);
    await api.deploySecretContract(hexString, codeHash, workerAddress, workerEnclaveSigningAddress, {from: workerAddress});

    let i = 0;
    let prevDeltaHash = '0x0000000000000000000000000000000000000000000000000000000000000000';

    while (i in secretContractData) {
      const taskId = web3.utils.randomHex(32);
      const fee = 5;
      const ethCall = web3.utils.randomHex(32);
      const delta = secretContractData[i];
      await api.createTaskRecord(taskId, fee, {from: workerAddress});
      const stateDeltaHash = web3.utils.keccak256(delta);
      await api.commitReceipt(hexString, taskId, prevDeltaHash, stateDeltaHash, ethCall,
          workerEnclaveSigningAddress, {from: workerAddress});
      prevDeltaHash = stateDeltaHash;
      i++;
    }
  }
}

function prepareSyncTestData(scenario) {
  const res = {};

  if (scenario === SYNC_SCENARIOS.EMPTY_DB) {
    res.tips = [];
    res.expected = PROVIDERS_DB_MAP;
  } else if (scenario === SYNC_SCENARIOS.PARTIAL_DB_WITH_SOME_ADDRESSES) {
    res.tips = [{
      address: [13, 214, 171, 4, 67, 23, 118, 195, 84, 56, 103, 199, 97, 21, 226, 55, 220, 54, 212, 246, 174, 203, 51, 171, 28, 30, 63, 158, 131, 64, 181, 42],
      key: 0,
      delta: [
        88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222, 73, 175, 207, 222, 86, 42, 236, 92, 194, 214,
        28, 195, 236, 122, 122, 12, 134, 55, 41, 209, 106, 172, 10, 130, 139, 149, 39, 196, 181, 187, 55, 166, 237, 215, 135, 98, 90, 12, 6, 72, 240, 138, 112, 99, 76, 55, 22,
        207, 92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
        82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
        88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222, 73, 175, 207, 222, 86, 42, 236, 92, 194, 214,
        28, 195, 236, 122, 122, 12, 134, 55, 41, 209, 106, 172, 10, 130, 139, 149, 39, 196, 181, 187, 55, 166, 237, 215, 135, 98, 90, 12, 6, 72, 240, 138, 112, 99, 76, 55, 22,
        231, 223, 153, 119, 15, 98, 26, 77, 139, 89, 64, 24, 108, 137, 118, 38, 142, 19, 131, 220, 252, 248, 212, 120],
    },
    {
      address: [76, 214, 171, 4, 67, 23, 118, 195, 84, 56, 103, 199, 97, 21, 226, 55, 220, 54, 212, 246, 174, 203, 51, 171, 28, 30, 63, 158, 131, 64, 181, 33],
      key: 1,
      delta: [135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
        150, 13, 149, 77, 159, 158, 13, 213, 171, 154, 224, 241,
        207, 92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
        82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
        88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222, 73, 175, 207, 222, 86, 42, 236, 92, 194, 214,
        28, 195, 207, 222, 86, 42, 236, 92, 194, 214],
    }];

    res.expected = transformStatesListToMap([{
      address: [76, 214, 171, 4, 67, 23, 118, 195, 84, 56, 103, 199, 97, 21, 226, 55, 220, 54, 212, 246, 174, 203, 51, 171, 28, 30, 63, 158, 131, 64, 181, 33],
      key: 2,
      delta: [135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
        150, 13, 149, 77, 159, 158, 13, 213, 171, 154, 224, 241,
        207, 92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
        82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
        88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
        82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211],
    },
    {
      address: [11, 214, 171, 4, 67, 23, 118, 195, 84, 34, 103, 199, 97, 21, 226, 55, 220, 143, 212, 246, 174, 203, 51, 171, 28, 30, 63, 158, 131, 64, 181, 200],
      key: -1,
      delta: [11, 255, 84, 134, 4, 62, 190, 60, 15, 43, 249, 32, 21, 188, 170, 27, 22, 23, 8, 248, 158, 176, 219, 85, 175, 190, 54, 199, 198, 228, 198, 87, 124, 33, 158, 115, 60, 173, 162, 16,
        150, 13, 149, 77, 159, 158, 13, 213, 171, 154, 224, 241, 4, 42, 38, 120, 66, 253, 127, 201, 113, 252, 246, 177, 218, 155, 249, 166, 68, 65, 231, 208, 210, 116, 89, 100,
        207, 92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
        56, 90, 104, 16, 241, 108, 14, 126, 116, 91, 106, 10, 141, 122, 78, 214, 148, 194, 14, 31, 96, 142, 178, 96, 150, 52, 142, 138, 37, 209, 110,
        82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
        88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222, 73, 175, 207, 222, 86, 42, 236, 92, 194, 214,
        28, 195, 236, 122, 122, 12, 134, 55, 41, 209, 106, 172, 10, 130, 139, 149, 39, 196, 181, 187, 55, 166, 237, 215, 135, 98, 90, 12, 6, 72, 240, 138, 112, 99, 76, 55, 22,
        231, 223, 153, 119, 15, 98, 26, 77, 139, 89, 64, 24, 108, 137, 118, 38, 142, 19, 131, 220, 252, 248, 212, 120, 231, 26, 21, 228, 246, 179, 104, 207, 76, 218, 88, 150, 13, 149, 77, 159, 158, 13, 213, 171, 154, 224, 241, 4, 42, 38, 120, 66, 253, 127, 201, 113, 252, 246, 177, 218, 155, 249, 166, 68, 65, 231, 208, 210, 116, 89, 100,
        207, 92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
        82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
        88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222, 73, 175, 207, 222, 86, 42, 236, 92, 194, 214,
        28, 195, 236, 122, 122, 12, 134, 55, 41, 209, 106, 172, 10, 130, 139, 149, 39, 196, 181, 187, 55, 166, 237, 215, 135, 98, 90, 12, 6, 72, 240, 138, 112, 99, 76, 55, 22,
        231, 223, 153, 119, 15, 98, 26, 77, 139, 89, 64, 24, 108, 137, 118, 38, 142, 19, 131, 220, 252, 248, 212, 120, 231, 26, 21, 228, 246, 179, 104, 207, 76, 218, 88, 150, 13, 149, 77, 159, 158, 13, 213, 171, 154, 224, 241, 4, 42, 38, 120, 66, 253, 127, 201, 113, 252, 246, 177, 218, 155, 249, 166, 68, 65, 231, 208, 210, 116, 89, 100,
        207, 92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
        82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
        88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222, 73, 175, 207, 222, 86, 42, 236, 92, 194, 214,
        28, 195, 236, 122, 122, 12, 134, 55, 41, 209, 106, 172, 10, 130, 139, 149, 39, 196, 181, 187, 55, 166, 237, 215, 135, 98, 90, 12, 6, 72, 240, 138, 112, 99, 76, 55, 22,
        231, 223, 153, 119, 15, 98, 26, 77, 139, 89, 64, 24, 108, 137, 118, 38, 142, 19, 131, 220, 252, 248, 212, 120, 231, 26, 21, 228, 246, 179, 104, 207, 76, 218, 88, 150, 13, 149, 77, 159, 158, 13, 213, 171, 154, 224, 241, 4, 42, 38, 120, 66, 253, 127, 201, 113, 252, 246, 177, 218, 155, 249, 166, 68, 65, 231, 208, 210, 116, 89, 100,
        207, 92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
        82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
        88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222, 73, 175, 207, 222, 86, 42, 236, 92, 194, 214,
        28, 195, 236, 122, 122, 12, 134, 55, 41, 209, 106, 172, 10, 130, 139, 149, 39, 196, 181, 187, 55, 166, 237, 215, 135, 98, 90, 12, 6, 72, 240, 138, 112, 99, 76, 55, 22,
        231, 223, 153, 119, 15, 98, 26, 77, 139, 89, 64, 194, 214,
        28, 195, 236, 122, 122, 12, 134, 55, 41, 209, 106, 172, 10, 130, 139, 149, 39, 196, 181, 187, 55, 166, 237, 215, 135, 98, 90, 12, 6, 72, 240, 138, 112, 99, 76, 55, 22,
        231, 223, 153, 119, 15, 98, 26, 77, 139, 89, 64, 24, 108, 137, 118, 38, 142, 19, 131, 220, 252, 248, 212, 120, 231, 26, 21, 228, 246, 179, 104, 207, 76, 218, 88, 24, 108, 137, 118, 38, 142, 19, 131, 220, 252, 248, 212, 120, 231, 26, 21, 228, 246, 179, 104, 207, 76, 218, 88, 150, 13, 149, 77, 159, 158, 13, 213, 171, 154, 224, 241, 4, 42, 38, 120, 66, 253, 127, 201, 113, 252, 246, 177, 218, 155, 249, 166, 68, 65, 231, 208, 210, 116, 89, 100,
        207, 92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
        82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
        88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222, 73, 175, 207, 222, 86, 42, 236, 92, 194, 214,
        28, 195, 236, 122, 122, 12, 134, 55, 41, 209, 106, 172, 10, 130, 139, 149, 39, 196, 181, 187, 55, 166, 237, 215, 135, 98, 90, 12, 6, 72, 240, 138, 112, 99, 76, 55, 22,
        231, 223, 153, 119, 15, 98, 26, 77, 139, 89, 64, 24, 108, 137, 118, 38, 142, 19, 131, 220, 252, 248, 212, 120, 231, 26, 21, 228, 246, 179, 104, 207, 76, 218, 88, 150, 13, 149, 77, 159, 158, 13, 213, 171, 154, 224, 241, 4, 42, 38, 120, 66, 253, 127, 201, 113, 252, 246, 177, 218, 155, 249, 166, 68, 65, 231, 208, 210, 116, 89, 100,
        207, 92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
        82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
        88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222, 73, 175, 207, 222, 86, 42, 236, 92, 194, 214,
        28, 195, 236, 122, 122, 12, 134, 55, 41, 209, 106, 172, 10, 130, 139, 149, 39, 196, 181, 187, 55, 166, 237, 215, 135, 98, 90, 12, 6, 72, 240, 138, 112, 99, 76, 55, 22,
        231, 223, 153, 119, 15, 98, 26, 77, 139, 89, 64, 24, 108, 137, 118, 38, 142, 19, 131, 220, 252, 248, 212, 120, 231, 26, 21, 228, 246, 179, 104, 207, 76, 218, 88, 150, 13, 149, 77, 159, 158, 13, 213, 171, 154, 224, 241, 4, 42, 38, 120, 66, 253, 127, 201, 113, 252, 246, 177, 218, 155, 249, 166, 68, 65, 231, 208, 210, 116, 89, 100,
        207, 92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
        82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
        88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222, 73, 175, 207, 222, 86, 42, 236, 92],
    },
    {
      // 0bd6ab04431776c3542267c76115e237dc8fd4f6aecb33ab1c1e3f9e8340b5c8
      address: [11, 214, 171, 4, 67, 23, 118, 195, 84, 34, 103, 199, 97, 21, 226, 55, 220, 143, 212, 246, 174, 203, 51, 171, 28, 30, 63, 158, 131, 64, 181, 200],
      key: 0,
      delta: [92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
        82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
        88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222, 73, 175, 207, 222, 86, 42, 236, 92, 194, 214,
        28, 195, 236, 122, 122, 12, 134, 55, 41, 209, 106, 172, 10, 130, 139, 149, 39, 196, 181, 187, 55, 166, 237, 215, 135, 98, 90, 12, 6, 72, 240, 138, 112, 99, 76, 55, 22,
        231, 223, 153, 119, 15, 98, 26, 77, 139, 89, 64, 24, 108, 137, 118, 38, 142, 19, 131, 220, 252, 248, 212, 120, 231, 26, 21, 228, 246, 179, 104, 207, 76, 218, 88, 150, 13, 149, 77, 159, 158, 13, 213, 171, 154, 224, 241, 4, 42, 38, 120, 66, 253, 127, 201, 113, 252, 246, 177, 218, 155, 249, 166, 68, 65, 231, 208, 210, 116, 89, 100,
        207, 92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
        82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
        88, 135, 204],
    },
    {
      address: [13, 214, 171, 4, 67, 23, 118, 195, 84, 56, 103, 199, 97, 21, 226, 55, 220, 54, 212, 246, 174, 203, 51, 171, 28, 30, 63, 158, 131, 64, 181, 42],
      key: 1,
      delta: [236, 122, 122, 12, 134, 55, 41, 209, 106, 172, 10, 130, 139, 149, 39, 196, 181, 187, 55, 166, 237, 215, 135, 98, 90, 12, 6, 72, 240, 138, 112, 99, 76, 55, 22,
        88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222, 73, 175, 207, 222, 86, 42, 236, 92, 194, 214,
        28, 195, 236, 122, 122, 12, 134, 55, 41, 209, 106, 172, 10, 130, 139, 149, 39, 196, 181, 187, 55, 166, 237, 215, 135, 98, 90, 12, 6, 72, 240, 138, 112, 99, 76, 55, 22,
        207, 92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
        82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
        88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222, 73, 175, 207, 222, 86, 42, 236, 92, 194, 214,
        28, 195, 236, 122, 122, 12, 134, 55, 41, 209, 106, 172, 10, 130, 139, 149, 39, 196, 181, 187, 55, 166, 237, 215, 135, 98, 90, 12, 6, 72, 240, 138, 112, 99, 76, 55, 22,
        231, 223, 153, 119, 15, 98, 26, 77, 139, 89, 64, 24, 108, 137, 118, 38, 142, 19, 131, 220, 252, 248, 212, 120,
        88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222, 73, 175, 207, 222, 86, 42],
    }]);
  } else if (scenario === SYNC_SCENARIOS.PARTIAL_DB_WITH_ALL_ADDRESSES) {
    res.tips = [{
      address: [76, 214, 171, 4, 67, 23, 118, 195, 84, 56, 103, 199, 97, 21, 226, 55, 220, 54, 212, 246, 174, 203, 51, 171, 28, 30, 63, 158, 131, 64, 181, 33],
      key: 0,
      delta: [135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
        150, 13, 149, 77, 159, 158, 13, 213, 171, 154, 224, 241,
        207, 92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
        82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
        88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222, 73, 175, 207, 222, 86, 42, 236, 92, 194, 214,
        28, 195, 207, 222, 86, 42, 236, 92, 194, 214]},
    {
      address: [13, 214, 171, 4, 67, 23, 118, 195, 84, 56, 103, 199, 97, 21, 226, 55, 220, 54, 212, 246, 174, 203, 51, 171, 28, 30, 63, 158, 131, 64, 181, 42],
      key: 0,
      delta: [
        88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222, 73, 175, 207, 222, 86, 42, 236, 92, 194, 214,
        28, 195, 236, 122, 122, 12, 134, 55, 41, 209, 106, 172, 10, 130, 139, 149, 39, 196, 181, 187, 55, 166, 237, 215, 135, 98, 90, 12, 6, 72, 240, 138, 112, 99, 76, 55, 22,
        207, 92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
        82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
        88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222, 73, 175, 207, 222, 86, 42, 236, 92, 194, 214,
        28, 195, 236, 122, 122, 12, 134, 55, 41, 209, 106, 172, 10, 130, 139, 149, 39, 196, 181, 187, 55, 166, 237, 215, 135, 98, 90, 12, 6, 72, 240, 138, 112, 99, 76, 55, 22,
        231, 223, 153, 119, 15, 98, 26, 77, 139, 89, 64, 24, 108, 137, 118, 38, 142, 19, 131, 220, 252, 248, 212, 120],
    },
    {
      address: [11, 214, 171, 4, 67, 23, 118, 195, 84, 34, 103, 199, 97, 21, 226, 55, 220, 143, 212, 246, 174, 203, 51, 171, 28, 30, 63, 158, 131, 64, 181, 200],
      key: 0,
      delta: [92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
        82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
        88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222, 73, 175, 207, 222, 86, 42, 236, 92, 194, 214,
        28, 195, 236, 122, 122, 12, 134, 55, 41, 209, 106, 172, 10, 130, 139, 149, 39, 196, 181, 187, 55, 166, 237, 215, 135, 98, 90, 12, 6, 72, 240, 138, 112, 99, 76, 55, 22,
        231, 223, 153, 119, 15, 98, 26, 77, 139, 89, 64, 24, 108, 137, 118, 38, 142, 19, 131, 220, 252, 248, 212, 120, 231, 26, 21, 228, 246, 179, 104, 207, 76, 218, 88, 150, 13, 149, 77, 159, 158, 13, 213, 171, 154, 224, 241, 4, 42, 38, 120, 66, 253, 127, 201, 113, 252, 246, 177, 218, 155, 249, 166, 68, 65, 231, 208, 210, 116, 89, 100,
        207, 92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
        82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
        88, 135, 204],
    }];

    res.expected = transformStatesListToMap([{
      address: [76, 214, 171, 4, 67, 23, 118, 195, 84, 56, 103, 199, 97, 21, 226, 55, 220, 54, 212, 246, 174, 203, 51, 171, 28, 30, 63, 158, 131, 64, 181, 33],
      key: 1,
      delta: [135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
        150, 13, 149, 77, 159, 158, 13, 213, 171, 154, 224, 241,
        207, 92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
        82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
        88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222, 73, 175, 207, 222, 86, 42, 236, 92, 194, 214,
        28, 195, 207, 222, 86, 42, 236, 92, 194, 214],
    },
    {
      address: [76, 214, 171, 4, 67, 23, 118, 195, 84, 56, 103, 199, 97, 21, 226, 55, 220, 54, 212, 246, 174, 203, 51, 171, 28, 30, 63, 158, 131, 64, 181, 33],
      key: 2,
      delta: [135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
        150, 13, 149, 77, 159, 158, 13, 213, 171, 154, 224, 241,
        207, 92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
        82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150, 36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213,
        88, 135, 204, 213, 199, 50, 191, 7, 61, 104, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
        82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211],
    },
    {
      address: [13, 214, 171, 4, 67, 23, 118, 195, 84, 56, 103, 199, 97, 21, 226, 55, 220, 54, 212, 246, 174, 203, 51, 171, 28, 30, 63, 158, 131, 64, 181, 42],
      key: 1,
      delta : [236,122,122,12,134,55,41,209,106,172,10,130,139,149,39,196,181,187,55,166,237,215,135,98,90,12,6,72,240,138,112,99,76,55,22,
        88,135,204,213,199,50,191,7,61,104,87,210,127,76,163,11,175,114,207,167,26,249,222,222,73,175,207,222,86,42,236,92,194,214,
        28,195,236,122,122,12,134,55,41,209,106,172,10,130,139,149,39,196,181,187,55,166,237,215,135,98,90,12,6,72,240,138,112,99,76,55,22,
        207,92,200,194,48,70,123,210,240,15,213,37,16,235,133,77,158,220,171,33,256,22,229,31,
        82,253,160,2,1,133,12,135,94,144,211,23,61,150,36,31,55,178,42,128,60,194,192,182,190,227,136,133,252,128,213,
        88,135,204,213,199,50,191,7,61,104,87,210,127,76,163,11,175,114,207,167,26,249,222,222,73,175,207,222,86,42,236,92,194,214,
        28,195,236,122,122,12,134,55,41,209,106,172,10,130,139,149,39,196,181,187,55,166,237,215,135,98,90,12,6,72,240,138,112,99,76,55,22,
        231,223,153,119,15,98,26,77,139,89,64,24,108,137,118,38,142,19,131,220,252,248,212,120,
        88,135,204,213,199,50,191,7,61,104,87,210,127,76,163,11,175,114,207,167,26,249,222,222,73,175,207,222,86,42],
    }]);
  }

  return res;
}


function syncTest(scenario, web3, enigmaContractAddress, api) {
  return new Promise(async (resolve)=>{
    const res = prepareSyncTestData(scenario);
    const tips = res.tips;
    const expectedMap= res.expected;

    const bootstrapNodes = ['/ip4/0.0.0.0/tcp/' + B2Port + '/ipfs/QmcrQZ6RJdpYuGvZqD5QEHAv6qX4BrQLJLQPQUrTrzdcgm'];

    const dnsConfig = {
      'bootstrapNodes': bootstrapNodes,
      'port': B2Port,
      'nickname': 'dns',
      'idPath': B2Path,
    };
    const peerConfig = {
      'bootstrapNodes': bootstrapNodes,
      'nickname': 'peer',
    };
    const dnsMockUri = 'tcp://127.0.0.1:4444';
    const peerMockUri = 'tcp://127.0.0.1:5555';

    const dnsMockCore = new CoreServer('dns');
    const peerMockCore = new CoreServer('peer');

    // start the dns mock server (core)
    dnsMockCore.setProvider(true);
    dnsMockCore.runServer(dnsMockUri);

    // start the peer mock server (core)
    peerMockCore.runServer(peerMockUri);
    // set empty tips array
    peerMockCore.setReceiverTips(tips);

    const accounts = await web3.eth.getAccounts();
    const workerEnclaveSigningAddress = accounts[0];
    const workerAddress = accounts[1];
    const workerReport = '0x123456';

    await api.register(workerEnclaveSigningAddress, workerReport, {from: workerAddress});

    await api.login({from: workerAddress});

    // start the dns
    const dnsBuilder = new EnvironmentBuilder();
    const dnsController = await dnsBuilder
        .setNodeConfig(dnsConfig)
        .setIpcConfig({uri: dnsMockUri})
        .build();

    // start the dns
    const peerBuilder = new EnvironmentBuilder();
    const peerController = await peerBuilder
        .setNodeConfig(peerConfig)
        .setIpcConfig({uri: peerMockUri})
        .build();

    await peerController.getNode().initializeEthereum(enigmaContractAddress);

    await setEthereumState(api, web3, workerAddress, workerEnclaveSigningAddress);

    await testUtils.sleep(2000);

    waterfall([
      (cb)=>{
        // announce
        dnsController.getNode().tryAnnounce((err, ecids)=>{
          assert.strictEqual(null, err, 'error announcing' + err);
          cb(null);
        });
      },
      (cb)=>{
        // sync
        peerController.getNode().syncReceiverPipeline(async (err, statusResult)=>{
          assert.strictEqual(null, err, 'error syncing' + err);
          statusResult.forEach((result)=> {
            assert.strictEqual(true, result.success);
          });

          cb(null, statusResult);
        });
      },
    ], async (err, statusResult)=>{
      assert.strictEqual(null, err, 'error in waterfall ' + err);

      // validate the results
      const missingstatesMap = syncResultMsgToStatesMap(statusResult);

      assert.strictEqual(Object.entries(missingstatesMap).length, Object.entries(expectedMap).length);
      for (const [address, data] of Object.entries(missingstatesMap)) {
        assert.strictEqual(Object.entries(missingstatesMap[address]).length, Object.entries(expectedMap[address]).length);
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

      peerController.getNode().stopEthereum();

      dnsMockCore.disconnect();
      peerMockCore.disconnect();
      resolve();
    });
  });
}

describe('Ethereum tests', function() {
  let web3;
  let api;
  let enigmaContractAddress;
  let enigmaContractABI;

  beforeAll(async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree['all']) {
      this.skip();
    }
    // runs before all tests in this block
    await envInitializer.start(truffleDir);
  });

  afterAll(async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree['all']) {
      this.skip();
    }
    // runs after all tests in this block
    await envInitializer.stop(web3);
  });

  beforeEach(async function() {
    // runs before each test in this block
    const result = await envInitializer.init(truffleDir);
    enigmaContractAddress = result.contractAddress;
    enigmaContractABI = result.contractABI;

    web3 = result.web3;

    //     let web3 = new Web3(provider);
    api = await new EnigmaContractWriterAPI(enigmaContractAddress, enigmaContractABI, web3);
  }, 60000);

  afterEach(async function() {
    // runs after each test in this block
    await envInitializer.disconnect(web3);
  });

  function eventSubscribe(api, eventName, filter, callback) {
    api.subscribe(eventName, filter, callback);
    // console.log("subscribed to " + eventName);
  }

  // const util = require('util')

  // console.log(util.inspect(myObject, {showHidden: false, depth: null}))

  function getEventRecievedFunc(eventName, resolve) {
    return (err, event)=> {
      resolve(event);
    };
  }

  it('Register a worker, deposit and deploy a secret contract using the BUILDER ', async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree['all'] || !tree['#1']) {
      await envInitializer.disconnect(web3);
      this.skip();
    }
    return new Promise(async function(resolve) {
      await envInitializer.disconnect(web3);
      await envInitializer.stop(web3);

      await testUtils.sleep(3000);

      const builder = new EnigmaContractAPIBuilder();
      res = await builder.createNetwork().deploy().build();
      const api = res.api;

      const accounts = await api.w3().eth.getAccounts();
      const workerEnclaveSigningAddress = accounts[3];
      const workerAddress = accounts[4];
      const workerReport = JSON.stringify(testParameters.report);// "0x123456";
      const depositValue = 1000;
      const secretContractAddress = api.w3().utils.randomHex(32); // accounts[5];
      const secretContractAddress2 = api.w3().utils.randomHex(32); // accounts[6];
      const codeHash = web3.utils.sha3(JSON.stringify(testParameters.bytecode));

      eventSubscribe(api, 'Registered', {}, getEventRecievedFunc('Registered',
          (result)=> {
            assert.strictEqual(result.signer, workerEnclaveSigningAddress);
            assert.strictEqual(result.workerAddress, workerAddress);
          }));

      eventSubscribe(api, 'DepositSuccessful', {}, getEventRecievedFunc('DepositSuccessful',
          (result)=> {
            assert.strictEqual(result.from, workerAddress);
            assert.strictEqual(result.value, depositValue);
          }));

      eventSubscribe(api, 'SecretContractDeployed', {}, getEventRecievedFunc('SecretContractDeployed',
          (result)=> {
            assert.strictEqual(result.secretContractAddress, secretContractAddress);
            assert.strictEqual(result.codeHash, codeHash);
          }));

      await api.register(workerEnclaveSigningAddress, workerReport, {from: workerAddress});

      await api.deposit(workerAddress, depositValue, {from: workerAddress});

      // Verify worker's report
      const result = await api.getReport(workerAddress);
      assert.strictEqual(result.report, workerReport);

      // Verify the number of secret-accounts before deploying one
      const countBefore = await api.countSecretContracts();
      assert.strictEqual(countBefore, 0);

      await api.deploySecretContract(secretContractAddress, codeHash, workerAddress, workerEnclaveSigningAddress, {from: workerAddress});

      // Verify the number of secret-accounts after deploying one
      const countAfter = await api.countSecretContracts();
      assert.strictEqual(countAfter, 1);

      // Verify that the secret-accounts is deployed
      const isDeployed = await api.isDeployed(secretContractAddress);
      assert.strictEqual(isDeployed, true);

      const observedCodeHash = await api.getCodeHash(secretContractAddress);
      assert.strictEqual(observedCodeHash, codeHash);

      const observedAddresses = await api.getSecretContractAddresses(0, 1);
      assert.strictEqual(observedAddresses[0], secretContractAddress);

      api.unsubscribeAll();

      await api.deploySecretContract(secretContractAddress2, codeHash, workerAddress, workerEnclaveSigningAddress, {from: workerAddress});

      // Verify the number of secret-accounts after deploying another one
      const observedCount = await api.countSecretContracts();
      assert.strictEqual(observedCount, 2);

      const observedAddressesArray1 = await api.getSecretContractAddresses(0, 1);
      assert.strictEqual(observedAddressesArray1[0], secretContractAddress);

      const observedAddresses2 = await api.getSecretContractAddresses(1, 2);
      assert.strictEqual(observedAddresses2[0], secretContractAddress2);

      const observedAddressesArray = await api.getSecretContractAddresses(0, 2);
      assert.strictEqual(observedAddressesArray[0], secretContractAddress);
      assert.strictEqual(observedAddressesArray[1], secretContractAddress2);

      await res.environment.destroy();
      await envInitializer.start(truffleDir);
      resolve();
    }).catch(console.log);
  }, 50000);

  it('Register, login, deploy secret contract, create tasks and commit reciepts using the BUILDER ', async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree['all'] || !tree['#2']) {
      await envInitializer.disconnect(web3); // due to: https://github.com/mochajs/mocha/issues/2546
      this.skip();
    }

    return new Promise(async function(resolve) {
      const config = {enigmaContractAddress: enigmaContractAddress, enigmaContractABI: enigmaContractABI};
      const builder = new EnigmaContractAPIBuilder();
      res = await builder.useDeployed(config).build();

      const api2 = res.api;
      const web3_2 = api.w3();

      const accounts = await web3_2.eth.getAccounts();
      const workerEnclaveSigningAddress = accounts[3];
      const workerAddress = accounts[4];
      const workerReport = JSON.stringify(testParameters.report);// "0x123456";
      const secretContractAddress = web3_2.utils.randomHex(32);// accounts[5];
      const codeHash = web3_2.utils.sha3(JSON.stringify(testParameters.bytecode));

      await api2.register(workerEnclaveSigningAddress, workerReport, {from: workerAddress});

      await api.deploySecretContract(secretContractAddress, codeHash, workerAddress, workerEnclaveSigningAddress, {from: workerAddress});

      const taskId1 = web3_2.utils.randomHex(32);
      const taskFee1 = 5;
      const taskSenderAddress1 = accounts[9];

      const taskId2 = web3_2.utils.randomHex(32);
      const taskFee2 = 19;
      const taskId3 = web3_2.utils.randomHex(32);
      const taskFee3 = 58;

      eventSubscribe(api2, 'TaskRecordCreated', {}, getEventRecievedFunc('TaskRecordCreated',
          (result)=> {
            assert.strictEqual(result.taskId, taskId1);
            assert.strictEqual(result.fee, taskFee1);
            assert.strictEqual(result.senderAddress, taskSenderAddress1);
          }));

      eventSubscribe(api2, 'TaskRecordsCreated', {}, getEventRecievedFunc('TaskRecordsCreated',
          (result)=> {
            assert.strictEqual(result.taskIds[0], taskId2);
            assert.strictEqual(result.taskIds[1], taskId3);
            assert.strictEqual(result.taskIds.length, 2);

            assert.strictEqual(result.fees[0], taskFee2);
            assert.strictEqual(result.fees[1], taskFee3);
            assert.strictEqual(result.fees.length, 2);

            assert.strictEqual(result.senderAddress, workerAddress);
          }));

      await api2.createTaskRecord(taskId1, taskFee1, {from: taskSenderAddress1});

      await api2.createTaskRecords([taskId2, taskId3], [taskFee2, taskFee3], {from: workerAddress});

      const stateDeltaHash0 = '0x0000000000000000000000000000000000000000000000000000000000000000';
      const stateDeltaHash1 = web3_2.utils.randomHex(32);
      const stateDeltaHash2 = web3_2.utils.randomHex(32);
      const stateDeltaHash3 = web3_2.utils.randomHex(32);
      const ethCall = web3_2.utils.randomHex(32);


      eventSubscribe(api2, 'ReceiptVerified', {}, getEventRecievedFunc('ReceiptVerified',
          (result)=> {
            assert.strictEqual(result.taskId, taskId1);
            assert.strictEqual(result.inStateDeltaHash, stateDeltaHash0);
            assert.strictEqual(result.outStateDeltaHash, stateDeltaHash1);
            assert.strictEqual(result.ethCall, ethCall);
            assert.strictEqual(result.signature, workerEnclaveSigningAddress);
          }));


      eventSubscribe(api2, 'ReceiptsVerified', {}, getEventRecievedFunc('ReceiptsVerified',
          (result)=> {
            assert.strictEqual(result.taskIds[0], taskId2);
            assert.strictEqual(result.taskIds[1], taskId3);
            assert.strictEqual(result.inStateDeltaHashes[0], stateDeltaHash1);
            assert.strictEqual(result.inStateDeltaHashes[1], stateDeltaHash2);
            assert.strictEqual(result.outStateDeltaHashes[0], stateDeltaHash2);
            assert.strictEqual(result.outStateDeltaHashes[1], stateDeltaHash3);
            assert.strictEqual(result.ethCall, ethCall);
            assert.strictEqual(result.signature, workerEnclaveSigningAddress);
          }));


      // await testUtils.sleep(5000);

      // Verify the number of state deltas is 0 before any commit
      const count1 = await api2.countStateDeltas(secretContractAddress);
      assert.strictEqual(count1, 0);

      // Verify the input state delta is not valid before any commit
      const observedValidBefore = await api2.isValidDeltaHash(secretContractAddress, stateDeltaHash1);
      assert.strictEqual(observedValidBefore, false);

      // Login the worker before commmitting receipts
      await api2.login({from: workerAddress});
      await api2.commitReceipt(secretContractAddress, taskId1, stateDeltaHash0, stateDeltaHash1,
          ethCall, workerEnclaveSigningAddress, {from: workerAddress});

      // Verify the number of state deltas after one commit
      const count2 = await api2.countStateDeltas(secretContractAddress);
      assert.strictEqual(count2, 1);

      // Verify the input state delta is valid after the commit
      const observedValidAfter = await api2.isValidDeltaHash(secretContractAddress, stateDeltaHash1);
      assert.strictEqual(observedValidAfter, true);

      await api2.commitReceipts(secretContractAddress, [taskId2, taskId3], [stateDeltaHash1, stateDeltaHash2], [stateDeltaHash2, stateDeltaHash3],
          ethCall, workerEnclaveSigningAddress, {from: workerAddress});

      // Verify the number of state deltas after a batch commit
      const count3 = await api2.countStateDeltas(secretContractAddress);
      assert.strictEqual(count3, 3);

      const observedStateDeltaHash3 = await api2.getStateDeltaHash(secretContractAddress, 2);
      assert.strictEqual(observedStateDeltaHash3, stateDeltaHash3);

      const observedStateDeltaHashes = await api2.getStateDeltaHashes(secretContractAddress, 0, 3);
      assert.strictEqual(observedStateDeltaHashes[0], stateDeltaHash1);
      assert.strictEqual(observedStateDeltaHashes[1], stateDeltaHash2);
      assert.strictEqual(observedStateDeltaHashes[2], stateDeltaHash3);
      assert.strictEqual(observedStateDeltaHashes.length, 3);

      api2.unsubscribeAll();

      await api.logout({from: workerAddress});

      await res.environment.destroy();

      resolve();
    });
  });

  it('State sync - empty local tips', async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree['all'] || !tree['#3']) {
      await envInitializer.disconnect(web3); // due to: https://github.com/mochajs/mocha/issues/2546
      this.skip();
    }

    return new Promise(async function(resolve) {
      const accounts = await web3.eth.getAccounts();
      const workerEnclaveSigningAddress = accounts[3];
      const workerAddress = accounts[4];
      const workerReport = JSON.stringify(testParameters.report);// "0x123456";
      const secretContractAddress1 = web3.utils.randomHex(32); // accounts[5];
      const secretContractAddress2 = web3.utils.randomHex(32); // accounts[4];
      const codeHash = web3.utils.sha3(JSON.stringify(testParameters.bytecode));

      await api.register(workerEnclaveSigningAddress, workerReport, {from: workerAddress});

      await api.login({from: workerAddress});

      await api.deploySecretContract(secretContractAddress1, codeHash, workerAddress, workerEnclaveSigningAddress, {from: workerAddress});
      await api.deploySecretContract(secretContractAddress2, codeHash, workerAddress, workerEnclaveSigningAddress, {from: workerAddress});

      const taskId1 = web3.utils.randomHex(32);
      const taskFee1 = 5;
      const taskSenderAddress1 = accounts[9];

      const taskId2 = web3.utils.randomHex(32);
      const taskFee2 = 19;
      const taskId3 = web3.utils.randomHex(32);
      const taskFee3 = 58;
      const taskId4 = web3.utils.randomHex(32);
      const taskFee4 = 580;

      await api.createTaskRecord(taskId1, taskFee1, {from: taskSenderAddress1});

      await api.createTaskRecords([taskId2, taskId3], [taskFee2, taskFee3], {from: workerAddress});

      await api.createTaskRecord(taskId4, taskFee4, {from: workerAddress});

      const stateDeltaHash0 = '0x0000000000000000000000000000000000000000000000000000000000000000';
      const stateDeltaHash1 = web3.utils.randomHex(32);
      const stateDeltaHash2 = web3.utils.randomHex(32);
      const stateDeltaHash3 = web3.utils.randomHex(32);
      const stateDeltaHash4 = web3.utils.randomHex(32);
      const ethCall = web3.utils.randomHex(32);

      await api.commitReceipt(secretContractAddress1, taskId1, stateDeltaHash0, stateDeltaHash1,
          ethCall, workerEnclaveSigningAddress, {from: workerAddress});

      await api.commitReceipts(secretContractAddress1, [taskId2, taskId3], [stateDeltaHash1, stateDeltaHash2], [stateDeltaHash2, stateDeltaHash3],
          ethCall, workerEnclaveSigningAddress, {from: workerAddress});

      await api.commitReceipt(secretContractAddress2, taskId4, stateDeltaHash0, stateDeltaHash4,
          ethCall, workerEnclaveSigningAddress, {from: workerAddress});

      StateSync.getRemoteMissingStates(api, [], (err, results)=>{
        // DONE results == [{address, deltas : [deltaHash, index]}]
        assert.strictEqual(results.length, 2);

        assert.strictEqual(results[0].address, secretContractAddress1.slice(2, secretContractAddress1.length));
        assert.strictEqual(results[0].deltas[0].index, 0);
        assert.strictEqual(results[0].deltas[0].deltaHash, stateDeltaHash1);
        assert.strictEqual(results[0].deltas[1].index, 1);
        assert.strictEqual(results[0].deltas[1].deltaHash, stateDeltaHash2);
        assert.strictEqual(results[0].deltas[2].index, 2);
        assert.strictEqual(results[0].deltas[2].deltaHash, stateDeltaHash3);
        assert.strictEqual(results[0].deltas.length, 3);

        assert.strictEqual(results[0].bytecode, codeHash);

        assert.strictEqual(results[1].address, secretContractAddress2.slice(2, secretContractAddress2.length));
        assert.strictEqual(results[1].deltas[0].index, 0);
        assert.strictEqual(results[1].deltas[0].deltaHash, stateDeltaHash4);
        assert.strictEqual(results[1].deltas.length, 1);
        assert.strictEqual(results[1].bytecode, codeHash);

        api.unsubscribeAll();
        resolve();
      });
    });
  });

  it('State sync - partial local tips', async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree['all'] || !tree['#4']) {
      await envInitializer.disconnect(web3); // due to: https://github.com/mochajs/mocha/issues/2546
      this.skip();
    }

    return new Promise(async function(resolve) {
      const accounts = await web3.eth.getAccounts();
      const workerEnclaveSigningAddress = accounts[3];
      const workerAddress = accounts[4];
      const workerReport = JSON.stringify(testParameters.report);// "0x123456";
      const secretContractAddress1 = web3.utils.randomHex(32);// accounts[5];
      const secretContractAddress2 = web3.utils.randomHex(32); // accounts[4];
      const codeHash1 = web3.utils.sha3(JSON.stringify(testParameters.bytecode));
      const codeHash2 = web3.utils.sha3(web3.utils.randomHex(32));

      await api.register(workerEnclaveSigningAddress, workerReport, {from: workerAddress});

      await api.login({from: workerAddress});

      await api.deploySecretContract(secretContractAddress1, codeHash1, workerAddress, workerEnclaveSigningAddress, {from: workerAddress});
      await api.deploySecretContract(secretContractAddress2, codeHash2, workerAddress, workerEnclaveSigningAddress, {from: workerAddress});

      const taskId1 = web3.utils.randomHex(32);
      const taskFee1 = 5;
      const taskSenderAddress1 = accounts[9];

      const taskId2 = web3.utils.randomHex(32);
      const taskFee2 = 19;
      const taskId3 = web3.utils.randomHex(32);
      const taskFee3 = 58;
      const taskId4 = web3.utils.randomHex(32);
      const taskFee4 = 580;

      await api.createTaskRecord(taskId1, taskFee1, {from: taskSenderAddress1});

      await api.createTaskRecords([taskId2, taskId3], [taskFee2, taskFee3], {from: workerAddress});

      await api.createTaskRecord(taskId4, taskFee4, {from: workerAddress});

      const stateDeltaHash0 = '0x0000000000000000000000000000000000000000000000000000000000000000';
      const stateDeltaHash1 = web3.utils.randomHex(32);
      const stateDeltaHash2 = web3.utils.randomHex(32);
      const stateDeltaHash3 = web3.utils.randomHex(32);
      const stateDeltaHash4 = web3.utils.randomHex(32);
      const ethCall = web3.utils.randomHex(32);

      await api.commitReceipt(secretContractAddress1, taskId1, stateDeltaHash0, stateDeltaHash1,
          ethCall, workerEnclaveSigningAddress, {from: workerAddress});

      await api.commitReceipts(secretContractAddress1, [taskId2, taskId3], [stateDeltaHash1, stateDeltaHash2], [stateDeltaHash2, stateDeltaHash3],
          ethCall, workerEnclaveSigningAddress, {from: workerAddress});

      await api.commitReceipt(secretContractAddress2, taskId4, stateDeltaHash0, stateDeltaHash4,
          ethCall, workerEnclaveSigningAddress, {from: workerAddress});

      StateSync.getRemoteMissingStates(api, [{address: secretContractAddress1, key: 0}], (err, results)=>{
        // DONE results == [{address, deltas : [deltaHash, index]}]
        assert.strictEqual(results.length, 2);

        assert.strictEqual(results[0].address, secretContractAddress1.slice(2, secretContractAddress1.length));
        assert.strictEqual(results[0].deltas[0].index, 1);
        assert.strictEqual(results[0].deltas[0].deltaHash, stateDeltaHash2);
        assert.strictEqual(results[0].deltas[1].index, 2);
        assert.strictEqual(results[0].deltas[1].deltaHash, stateDeltaHash3);
        assert.strictEqual(results[0].deltas.length, 2);
        assert.strictEqual('bytecode' in results[0], false);

        assert.strictEqual(results[1].address, secretContractAddress2.slice(2, secretContractAddress2.length));
        assert.strictEqual(results[1].deltas[0].index, 0);
        assert.strictEqual(results[1].deltas[0].deltaHash, stateDeltaHash4);
        assert.strictEqual(results[1].deltas.length, 1);
        assert.strictEqual(results[1].bytecode, codeHash2);


        api.unsubscribeAll();
        resolve();
      });
    });
  }, 7000);

  it('State sync - partial local tips 2', async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree['all'] || !tree['#5']) {
      await envInitializer.disconnect(web3); // due to: https://github.com/mochajs/mocha/issues/2546
      this.skip();
    }

    return new Promise(async function(resolve) {
      const accounts = await web3.eth.getAccounts();
      const workerEnclaveSigningAddress = accounts[3];
      const workerAddress = accounts[4];
      const workerReport = JSON.stringify(testParameters.report);// "0x123456";
      const secretContractAddress1 = web3.utils.randomHex(32); // accounts[5];
      const secretContractAddress2 = web3.utils.randomHex(32); // accounts[4];
      const codeHash = web3.utils.sha3(JSON.stringify(testParameters.bytecode));

      await api.register(workerEnclaveSigningAddress, workerReport, {from: workerAddress});

      await api.login({from: workerAddress});

      await api.deploySecretContract(secretContractAddress1, codeHash, workerAddress, workerEnclaveSigningAddress, {from: workerAddress});
      await api.deploySecretContract(secretContractAddress2, codeHash, workerAddress, workerEnclaveSigningAddress, {from: workerAddress});

      const taskId1 = web3.utils.randomHex(32);
      const taskFee1 = 5;
      const taskSenderAddress1 = accounts[9];

      const taskId2 = web3.utils.randomHex(32);
      const taskFee2 = 19;
      const taskId3 = web3.utils.randomHex(32);
      const taskFee3 = 58;
      const taskId4 = web3.utils.randomHex(32);
      const taskFee4 = 580;

      await api.createTaskRecord(taskId1, taskFee1, {from: taskSenderAddress1});

      await api.createTaskRecords([taskId2, taskId3], [taskFee2, taskFee3], {from: workerAddress});

      await api.createTaskRecord(taskId4, taskFee4, {from: workerAddress});

      const stateDeltaHash0 = '0x0000000000000000000000000000000000000000000000000000000000000000';
      const stateDeltaHash1 = web3.utils.randomHex(32);
      const stateDeltaHash2 = web3.utils.randomHex(32);
      const stateDeltaHash3 = web3.utils.randomHex(32);
      const stateDeltaHash4 = web3.utils.randomHex(32);
      const ethCall = web3.utils.randomHex(32);

      await api.commitReceipt(secretContractAddress1, taskId1, stateDeltaHash0, stateDeltaHash1,
          ethCall, workerEnclaveSigningAddress, {from: workerAddress});

      await api.commitReceipts(secretContractAddress1, [taskId2, taskId3], [stateDeltaHash1, stateDeltaHash2], [stateDeltaHash2, stateDeltaHash3],
          ethCall, workerEnclaveSigningAddress, {from: workerAddress});

      await api.commitReceipt(secretContractAddress2, taskId4, stateDeltaHash0, stateDeltaHash4,
          ethCall, workerEnclaveSigningAddress, {from: workerAddress});

      StateSync.getRemoteMissingStates(api, [{address: secretContractAddress1, key: 0}, {address: secretContractAddress2, key: 0}], (err, results)=>{
        // DONE results == [{address, deltas : [deltaHash, index]}]
        assert.strictEqual(results.length, 1);

        assert.strictEqual(results[0].address, secretContractAddress1.slice(2, secretContractAddress1.length));
        assert.strictEqual(results[0].deltas[0].index, 1);
        assert.strictEqual(results[0].deltas[0].deltaHash, stateDeltaHash2);
        assert.strictEqual(results[0].deltas[1].index, 2);
        assert.strictEqual(results[0].deltas[1].deltaHash, stateDeltaHash3);
        assert.strictEqual(results[0].deltas.length, 2);
        assert.strictEqual('bytecode' in results[0], false);

        api.unsubscribeAll();
        resolve();
      });
    });
  }, 7000);

  it('State sync - full local tips', async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree['all'] || !tree['#6']) {
      await envInitializer.disconnect(web3); // due to: https://github.com/mochajs/mocha/issues/2546
      this.skip();
    }

    return new Promise(async function(resolve) {
      const accounts = await web3.eth.getAccounts();
      const workerEnclaveSigningAddress = accounts[3];
      const workerAddress = accounts[4];
      const workerReport = JSON.stringify(testParameters.report);// "0x123456";
      const secretContractAddress1 = web3.utils.randomHex(32);// accounts[5];
      const secretContractAddress2 = web3.utils.randomHex(32);// accounts[4];
      const codeHash = web3.utils.sha3(JSON.stringify(testParameters.bytecode));

      await api.register(workerEnclaveSigningAddress, workerReport, {from: workerAddress});

      await api.login({from: workerAddress});

      await api.deploySecretContract(secretContractAddress1, codeHash, workerAddress, workerEnclaveSigningAddress, {from: workerAddress});
      await api.deploySecretContract(secretContractAddress2, codeHash, workerAddress, workerEnclaveSigningAddress, {from: workerAddress});

      const taskId1 = web3.utils.randomHex(32);
      const taskFee1 = 5;
      const taskSenderAddress1 = accounts[9];

      const taskId2 = web3.utils.randomHex(32);
      const taskFee2 = 19;
      const taskId3 = web3.utils.randomHex(32);
      const taskFee3 = 58;
      const taskId4 = web3.utils.randomHex(32);
      const taskFee4 = 580;

      await api.createTaskRecord(taskId1, taskFee1, {from: taskSenderAddress1});

      await api.createTaskRecords([taskId2, taskId3], [taskFee2, taskFee3], {from: workerAddress});

      await api.createTaskRecord(taskId4, taskFee4, {from: workerAddress});

      const stateDeltaHash0 = '0x0000000000000000000000000000000000000000000000000000000000000000';
      const stateDeltaHash1 = web3.utils.randomHex(32);
      const stateDeltaHash2 = web3.utils.randomHex(32);
      const stateDeltaHash3 = web3.utils.randomHex(32);
      const stateDeltaHash4 = web3.utils.randomHex(32);
      const ethCall = web3.utils.randomHex(32);

      await api.commitReceipt(secretContractAddress1, taskId1, stateDeltaHash0, stateDeltaHash1,
          ethCall, workerEnclaveSigningAddress, {from: workerAddress});

      await api.commitReceipts(secretContractAddress1, [taskId2, taskId3], [stateDeltaHash1, stateDeltaHash2], [stateDeltaHash2, stateDeltaHash3],
          ethCall, workerEnclaveSigningAddress, {from: workerAddress});

      await api.commitReceipt(secretContractAddress2, taskId4, stateDeltaHash0, stateDeltaHash4,
          ethCall, workerEnclaveSigningAddress, {from: workerAddress});

      StateSync.getRemoteMissingStates(api, [{address: secretContractAddress1, key: 2}, {address: secretContractAddress2, key: 0}], (err, results)=>{
        // DONE results == [{address, deltas : [deltaHash, index]}]
        assert.strictEqual(results.length, 0);

        api.unsubscribeAll();
        resolve();
      });
    });
  }, 7000);

  it('Test ethereum services ', async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree['all'] || !tree['#7']) {
      await envInitializer.disconnect(web3); // due to: https://github.com/mochajs/mocha/issues/2546
      this.skip();
    }

    return new Promise(async function(resolve) {
      const config = {enigmaContractAddress: enigmaContractAddress, enigmaContractABI: enigmaContractABI};
      const builder = new EnigmaContractAPIBuilder();
      res = await builder.useDeployed(config).build();

      const api2 = res.api;
      const web3_2 = api.w3();

      const services = new EthereumServices(api2);

      const accounts = await web3_2.eth.getAccounts();
      const workerEnclaveSigningAddress = accounts[3];
      const workerAddress = accounts[4];
      const workerReport = JSON.stringify(testParameters.report);// "0x123456";
      const secretContractAddress = web3.utils.randomHex(32); // accounts[5];
      const codeHash = web3_2.utils.sha3(JSON.stringify(testParameters.bytecode));

      await api2.register(workerEnclaveSigningAddress, workerReport, {from: workerAddress});
      // Login the worker before commmitting receipts
      await api2.login({from: workerAddress});

      await api2.deploySecretContract(secretContractAddress, codeHash, workerAddress, workerEnclaveSigningAddress, {from: workerAddress});

      const taskId1 = web3_2.utils.randomHex(32);
      const taskFee1 = 5;
      const taskSenderAddress1 = accounts[9];

      const taskId2 = web3_2.utils.randomHex(32);
      const taskFee2 = 19;
      const taskId3 = web3_2.utils.randomHex(32);
      const taskFee3 = 58;

      let taskIndex = 0;

      services.initServices(['TaskCreation', 'TaskSubmission']);

      services.on('TaskCreation', (err, result)=> {
        if (taskIndex === 0) {
          assert.strictEqual(result.taskId, taskId1);
          assert.strictEqual(result.fee, taskFee1);
          assert.strictEqual(result.senderAddress, taskSenderAddress1);

          taskIndex += 1;
        } else if (taskIndex === 1) {
          assert.strictEqual(result.taskIds[0], taskId2);
          assert.strictEqual(result.taskIds[1], taskId3);
          assert.strictEqual(result.taskIds.length, 2);

          assert.strictEqual(result.fees[0], taskFee2);
          assert.strictEqual(result.fees[1], taskFee3);
          assert.strictEqual(result.fees.length, 2);

          assert.strictEqual(result.senderAddress, workerAddress);
        }
      });

      await api2.createTaskRecord(taskId1, taskFee1, {from: taskSenderAddress1});
      await api2.createTaskRecords([taskId2, taskId3], [taskFee2, taskFee3], {from: workerAddress});

      const stateDeltaHash0 = '0x0000000000000000000000000000000000000000000000000000000000000000';
      const stateDeltaHash1 = web3_2.utils.randomHex(32);
      const stateDeltaHash2 = web3_2.utils.randomHex(32);
      const stateDeltaHash3 = web3_2.utils.randomHex(32);
      const ethCall = web3_2.utils.randomHex(32);

      const recieptIndex = 0;

      services.on('TaskSubmission', (err, result)=> {
        if (recieptIndex === 0) {
          assert.strictEqual(result.taskId, taskId1);
          assert.strictEqual(result.inStateDeltaHash, stateDeltaHash0);
          assert.strictEqual(result.outStateDeltaHash, stateDeltaHash1);
          assert.strictEqual(result.ethCall, ethCall);
          assert.strictEqual(result.signature, workerEnclaveSigningAddress);

          taskIndex += 1;
        } else if (recieptIndex === 1) {
          assert.strictEqual(result.taskIds[0], taskId2);
          assert.strictEqual(result.taskIds[1], taskId3);
          assert.strictEqual(result.inStateDeltaHashes[0], stateDeltaHash1);
          assert.strictEqual(result.inStateDeltaHashes[1], stateDeltaHash2);
          assert.strictEqual(result.outStateDeltaHashes[0], stateDeltaHash2);
          assert.strictEqual(result.outStateDeltaHashes[1], stateDeltaHash3);
          assert.strictEqual(result.ethCall, ethCall);
          assert.strictEqual(result.signature, workerEnclaveSigningAddress);
        }
      });

      await api2.commitReceipt(secretContractAddress, taskId1, stateDeltaHash0, stateDeltaHash1,
          ethCall, workerEnclaveSigningAddress, {from: workerAddress});

      await api2.commitReceipts(secretContractAddress, [taskId2, taskId3], [stateDeltaHash1, stateDeltaHash2], [stateDeltaHash2, stateDeltaHash3],
          ethCall, workerEnclaveSigningAddress, {from: workerAddress});

      api2.unsubscribeAll();

      await res.environment.destroy();

      resolve();
    });
  }, 7000);

  it('Perform a full sync scenario - from scratch', async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree['all'] || !tree['#8']) {
      await envInitializer.disconnect(web3); // due to: https://github.com/mochajs/mocha/issues/2546
      this.skip();
    }

    return syncTest(SYNC_SCENARIOS.EMPTY_DB, web3, enigmaContractAddress, api);
  }, 40000);

  it('Perform a full sync scenario - from mid-with-some-addresses', async function() {
    const tree = TEST_TREE.ethereum;
    // if (!tree['all'] || !tree['#9']) {
    //   await envInitializer.disconnect(web3); // due to: https://github.com/mochajs/mocha/issues/2546
    //   this.skip();
    // }
    return syncTest(SYNC_SCENARIOS.PARTIAL_DB_WITH_SOME_ADDRESSES, web3, enigmaContractAddress, api);
  }, 40000);

  it('Perform a full sync scenario - from mid-with-all-addresses', async function() {
    const tree = TEST_TREE.ethereum;
    // if (!tree['all'] || !tree['#9']) {
    //   await envInitializer.disconnect(web3); // due to: https://github.com/mochajs/mocha/issues/2546
    //   this.skip();
    // }
    return syncTest(SYNC_SCENARIOS.PARTIAL_DB_WITH_ALL_ADDRESSES, web3, enigmaContractAddress, api);
  }, 40000);
});
