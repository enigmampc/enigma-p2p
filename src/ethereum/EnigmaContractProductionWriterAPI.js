const utils = require('../common/utils');
const errors = require('../common/errors');
const constants = require('../common/constants');
const EnigmaContractWriterAPI = require('./EnigmaContractWriterAPI');

const EMPTY_HEX_STRING = '0x'; // This is the right value to pass an empty value to the contract, otherwise we get an error

const ETHEREUM_CONFIRMATION_EVENT = 'confirmation';
const ETHEREUM_RECEIPT_EVENT = 'receipt';
const ETHEREUM_ERROR_EVENT = 'error';

class EnigmaContractProductionWriterAPI extends EnigmaContractWriterAPI {
  constructor(enigmaContractAddress, enigmaContractABI, web3, logger, workerAddress, privateKey) {
    super(enigmaContractAddress, enigmaContractABI, web3, logger, workerAddress);
    this._privateKey = privateKey;
  }
  /**
   * Step 1 in registration
   * Register a worker to the network.
   * @param {string} signerAddress ,
   * @param {string} report , worker
   * @param {string} signature
   * @param {JSON} txParams
   * @return {Promise} in success: null, in failure: error
   * */
  register(signerAddress, report, signature, txParams=null) {
    return new Promise((resolve, reject) => {
      const res = this.getTransactionOptions(txParams);
      if (res.error) {
        reject(res.error);
        return;
      }
      const tx = {
        from: res.transactionOptions.from,
        to: this._enigmaContractAddress,
        gas: res.transactionOptions.gas,
        // this encodes the ABI of the method and the arguments
        data: this._enigmaContract.methods.register(utils.add0x(signerAddress), utils.add0x(report), utils.add0x(signature)).encodeABI()
      };

      this._web3.eth.accounts.signTransaction(tx, this._privateKey)
        .then((signedTx)=> {
          this._web3.eth.sendSignedTransaction(signedTx.rawTransaction)
            .on(ETHEREUM_ERROR_EVENT, (error, receipt) => {
              reject(error);
            })
            .on(ETHEREUM_RECEIPT_EVENT, (receipt) => {
              resolve(null);
            })
        })
        .catch((error) =>{
          reject(error);
        });
    });
  }
  /**
   * Step 2 in registration : stake ENG's (TO DA MOON)
   * @param {string} custodian - the worker address
   * @param {Integer} amount
   * @param {JSON} txParams
   * @return {Promise} in success: null, in failure: error
   * */
  deposit(custodian, amount, txParams=null) {
    return new Promise((resolve, reject) => {
      const res = this.getTransactionOptions(txParams);
      if (res.error) {
        reject(res.error);
        return;
      }
      const tx = {
        from: res.transactionOptions.from,
        to: this._enigmaContractAddress,
        gas: res.transactionOptions.gas,
        data: this._enigmaContract.methods.deposit(custodian, amount).encodeABI()
      };
      this._web3.eth.accounts.signTransaction(tx, this._privateKey)
        .then((signedTx)=> {
          this._web3.eth.sendSignedTransaction(signedTx.rawTransaction)
            .on(ETHEREUM_ERROR_EVENT, (error, receipt) => {
              reject(error);
            })
            .on(ETHEREUM_RECEIPT_EVENT, (receipt) => {
              //let events = this._parseEvents(receipt);
              resolve(null);
            })
        })
        .catch((error) =>{
          reject(error);
        });
    });
  }
  /**
   * Step 2 in registration : stake ENG's of the current worker(TO DA MOON)
   * @param {Integer} amount
   * @param {JSON} txParams
   * @return {Promise} in success: null, in failure: error
   * */
  selfDeposit(amount, txParams=null) {
    return new Promise((resolve, reject) => {
      const res = this.getTransactionOptions(txParams);
      if (res.error) {
        reject(res.error);
        return;
      }
      let workerAddress = this.getWorkerAddress();
      if (!workerAddress) {
        reject(new errors.InputErr("Missing worker-address when calling selfDeposit"));
      }
      const tx = {
        from: res.transactionOptions.from,
        to: this._enigmaContractAddress,
        gas: res.transactionOptions.gas,
        data: this._enigmaContract.methods.deposit(workerAddress, amount).encodeABI()
      };
      this._web3.eth.accounts.signTransaction(tx, this._privateKey)
        .then((signedTx)=> {
          this._web3.eth.sendSignedTransaction(signedTx.rawTransaction)
            .on(ETHEREUM_ERROR_EVENT, (error, receipt) => {
              reject(error);
            })
            .on(ETHEREUM_RECEIPT_EVENT, (receipt) => {
              //let events = this._parseEvents(receipt);
              resolve(null);
            })
        })
        .catch((error) =>{
          reject(error);
        });
    });
  }
  /**
   * Withdraw worker's stake (full or partial)
   * @param {Integer} amount
   * @param {JSON} txParams
   * @return {Promise} in success: null, in failure: error
   * */
  withdraw(amount, txParams) {
    return new Promise((resolve, reject) => {
      const res = this.getTransactionOptions(txParams);
      if (res.error) {
        reject(res.error);
        return;
      }
      const tx = {
        from: res.transactionOptions.from,
        to: this._enigmaContractAddress,
        gas: res.transactionOptions.gas,
        data: this._enigmaContract.methods.withdraw(amount).encodeABI()
      };
      this._web3.eth.accounts.signTransaction(tx, this._privateKey)
        .then((signedTx)=> {
          this._web3.eth.sendSignedTransaction(signedTx.rawTransaction)
            .on(ETHEREUM_ERROR_EVENT, (error, receipt) => {
              reject(error);
            })
            .on(ETHEREUM_RECEIPT_EVENT, (receipt) => {
              //let events = this._parseEvents(receipt);
              resolve(null);
            })
        })
        .catch((error) =>{
          reject(error);
        });
    });
  }
  /**
   * deploy a secret contract by a worker
   * @param {string} taskId
   * @param {string} preCodeHash
   * @param {string} codeHash
   * @param {string} initStateDeltaHash
   * @param {string} optionalEthereumData
   * @param {string} optionalEthereumContractAddress
   * @param {Integer} gasUsed
   * @param {string} signature //TODO:: since it expects bytes maybe here it will be bytes as well (Json-san)
   * @param {JSON} txParams
   * @return @return {Promise} in success: Enigma contract emitted events, in failure: error //TODO:: we want to turn all the Json's into real classes.
   * */
  deploySecretContract(taskId, preCodeHash, codeHash, initStateDeltaHash, optionalEthereumData, optionalEthereumContractAddress, gasUsed, signature, txParams=null) {
    return new Promise((resolve, reject) => {
      const res = this.getTransactionOptions(txParams);
      if (res.error) {
        reject(res.error);
        return;
      }
      if(!optionalEthereumData) {
        optionalEthereumData = EMPTY_HEX_STRING;
      }
      const packedParams = [utils.add0x(taskId), utils.add0x(preCodeHash), utils.add0x(codeHash), utils.add0x(initStateDeltaHash)];
      const tx = {
        from: res.transactionOptions.from,
        to: this._enigmaContractAddress,
        gas: res.transactionOptions.gas,
        data: this._enigmaContract.methods.deploySecretContract(
          gasUsed,
          utils.add0x(optionalEthereumContractAddress),
          packedParams,
          utils.add0x(optionalEthereumData),
          utils.add0x(signature)).encodeABI()
      };
      this.getEthereumBlockNumber()
        .then((blockNumber) => {
          this._web3.eth.accounts.signTransaction(tx, this._privateKey)
            .then((signedTx) => {
              this._web3.eth.sendSignedTransaction(signedTx.rawTransaction)
                .on(ETHEREUM_ERROR_EVENT, (error, receipt) => {
                  reject(error);
                })
                .on(ETHEREUM_RECEIPT_EVENT, async (receipt) => {
                  let deployedEvents = await this._parsePastEvent(constants.RAW_ETHEREUM_EVENTS.SecretContractDeployed, {scAddr: utils.add0x(taskId)}, blockNumber);
                  if (deployedEvents && Object.keys(deployedEvents).length > 0) {
                    resolve(deployedEvents);
                  } else {
                    let failedEvents = await this._parsePastEvent(constants.RAW_ETHEREUM_EVENTS.ReceiptFailedETH, {taskId: utils.add0x(taskId)}, blockNumber);
                    resolve(failedEvents);
                  }
                });
            })
            .catch((error) => {
              reject(error);
            });
        })
        .catch((error) => {
          reject(error);
        });
    });
  }
  /**
   * login a worker
   * @return {Promise} in success: null, in failure: error
   * */
  login(txParams=null) {
    return new Promise((resolve, reject) => {
      const res = this.getTransactionOptions(txParams);
      if (res.error) {
        reject(res.error);
        return;
      }
      const tx = {
        from: res.transactionOptions.from,
        to: this._enigmaContractAddress,
        gas: res.transactionOptions.gas,
        data: this._enigmaContract.methods.login().encodeABI()
      };
      this._web3.eth.accounts.signTransaction(tx, this._privateKey)
        .then((signedTx)=> {
          this._web3.eth.sendSignedTransaction(signedTx.rawTransaction)
            .on(ETHEREUM_ERROR_EVENT, (error, receipt) => {
              reject(error);
            })
            .on(ETHEREUM_RECEIPT_EVENT, (receipt) => {
              resolve(null);
            });
        })
        .catch((error) =>{
          reject(error);
        });
    });
  }
  /**
   * login a worker
   * @return {Promise} in success: null, in failure: error
   * */
  logout(txParams=null) {
    return new Promise((resolve, reject) => {
      const res = this.getTransactionOptions(txParams);
      if (res.error) {
        reject(res.error);
        return;
      }
      const tx = {
        from: res.transactionOptions.from,
        to: this._enigmaContractAddress,
        gas: res.transactionOptions.gas,
        data: this._enigmaContract.methods.logout().encodeABI()
      };
      this._web3.eth.accounts.signTransaction(tx, this._privateKey)
        .then((signedTx)=> {
          this._web3.eth.sendSignedTransaction(signedTx.rawTransaction)
            .on(ETHEREUM_ERROR_EVENT, (error, receipt) => {
              reject(error);
            })
            .on(ETHEREUM_RECEIPT_EVENT, (receipt) => {
              resolve(null);
            })
        })
        .catch((error) =>{
          reject(error);
        });
    });
  }
  /**
   * Worker commits the results on-chain
   * @param {string} secretContractAddress
   * @param {string} taskId
   * @param {string} stateDeltaHash
   * @param {string} outputHash
   * @param {string} optionalEthereumData
   * @param {string} optionalEthereumContractAddress
   * @param {Integer} gasUsed
   * @param {string} signature
   * @param {JSON} txParams
   * @return {Promise} in success: Enigma contract emitted events, in failure: error
   * */
  commitReceipt(secretContractAddress, taskId, stateDeltaHash, outputHash, optionalEthereumData, optionalEthereumContractAddress, gasUsed, signature, txParams=null) {
    return new Promise((resolve, reject) => {
      const res = this.getTransactionOptions(txParams);
      if (res.error) {
        reject(res.error);
        return;
      }
      if(!optionalEthereumData) {
        optionalEthereumData = EMPTY_HEX_STRING;
      }
      if(!stateDeltaHash) {
        stateDeltaHash = EMPTY_HEX_STRING;
      }
      const packedParams = [utils.add0x(secretContractAddress), utils.add0x(taskId), utils.add0x(stateDeltaHash), utils.add0x(outputHash)];
      const tx = {
        from: res.transactionOptions.from,
        to: this._enigmaContractAddress,
        gas: res.transactionOptions.gas,
        data: this._enigmaContract.methods.commitReceipt(
          gasUsed,
          utils.add0x(optionalEthereumContractAddress),
          packedParams,
          utils.add0x(optionalEthereumData),
          utils.add0x(signature)).encodeABI()
      };
      this.getEthereumBlockNumber()
        .then((blockNumber) => {
          this._web3.eth.accounts.signTransaction(tx, this._privateKey)
            .then((signedTx) => {
              this._web3.eth.sendSignedTransaction(signedTx.rawTransaction)
                .on(ETHEREUM_ERROR_EVENT, (error, receipt) => {
                  reject(error);
                })
                .on(ETHEREUM_RECEIPT_EVENT, async (receipt) => {
                  let rawEvents = await this._enigmaContract.getPastEvents('allEvents', {fromBlock: blockNumber, filter: {taskId: utils.add0x(taskId)}});
                  let events = {};
                  if (Array.isArray(rawEvents) && (rawEvents.length > 0)) {
                    rawEvents.forEach((event) => {
                      if (event.event === constants.RAW_ETHEREUM_EVENTS.ReceiptFailedETH ||
                        event.event === constants.RAW_ETHEREUM_EVENTS.ReceiptVerified) {
                        resolve(this._parseEvents({[event.event]: event}));
                      }
                    });
                    resolve(events);
                  } else {
                    resolve(events);
                  }
                });
            })
            .catch((error) => {
              reject(error);
            });
        })
      .catch((error) => {
        reject(error);
      });
    });
  }
  /**
   * Worker commits the failed task result on-chain
   * @param {string} secretContractAddress
   * @param {string} taskId
   * @param {string} outputHash
   * @param {Integer} gasUsed
   * @param {string} signature
   * @param {JSON} txParams
   * @return {Promise} in success: Enigma contract emitted events, in failure: error
   * */
  commitTaskFailure(secretContractAddress, taskId, outputHash, gasUsed, signature, txParams=null) {
    return new Promise((resolve, reject) => {
      const res = this.getTransactionOptions(txParams);
      if (res.error) {
        reject(res.error);
        return;
      }
      const tx = {
        from: res.transactionOptions.from,
        to: this._enigmaContractAddress,
        gas: res.transactionOptions.gas,
        data: this._enigmaContract.methods.commitTaskFailure(
          utils.add0x(secretContractAddress),
          utils.add0x(taskId),
          utils.add0x(outputHash),
          gasUsed,
          utils.add0x(signature)).encodeABI()
      };
      this.getEthereumBlockNumber()
        .then((blockNumber) => {
          this._web3.eth.accounts.signTransaction(tx, this._privateKey)
            .then((signedTx) => {
              this._web3.eth.sendSignedTransaction(signedTx.rawTransaction)
                .on(ETHEREUM_ERROR_EVENT, (error, receipt) => {
                  reject(error);
                })
                .on(ETHEREUM_RECEIPT_EVENT, async (receipt) => {
                  let events = await this._parsePastEvent(constants.RAW_ETHEREUM_EVENTS.ReceiptFailed, {taskId: utils.add0x(taskId)}, blockNumber);
                  resolve(events);
                })
            })
            .catch((error) => {
              reject(error);
            });
        })
        .catch((error) => {
          reject(error);
        });
    });
  }
  /**
   * Worker commits the failed deploy task result on-chain
   * @param {string} taskId == secretContractAddress
   * @param {string} outputHash
   * @param {Integer} gasUsed
   * @param {string} signature
   * @param {JSON} txParams
   * @return {Promise} in success: Enigma contract emitted events, in failure: error
   * */
  deploySecretContractFailure(taskId, outputHash, gasUsed, signature, txParams=null) {
    return new Promise((resolve, reject) => {
      const res = this.getTransactionOptions(txParams);
      if (res.error) {
        reject(res.error);
        return;
      }
      const tx = {
        from: res.transactionOptions.from,
        to: this._enigmaContractAddress,
        gas: res.transactionOptions.gas,
        data: this._enigmaContract.methods.deploySecretContractFailure(
          utils.add0x(taskId),
          utils.add0x(outputHash),
          gasUsed,
          utils.add0x(signature)).encodeABI()
      };
      this.getEthereumBlockNumber()
        .then((blockNumber) => {
          this._web3.eth.accounts.signTransaction(tx, this._privateKey)
            .then((signedTx) => {
              this._web3.eth.sendSignedTransaction(signedTx.rawTransaction)
                .on(ETHEREUM_ERROR_EVENT, (error, receipt) => {
                  reject(error);
                })
                .on(ETHEREUM_RECEIPT_EVENT, async (receipt) => {
                  let events = await this._parsePastEvent(constants.RAW_ETHEREUM_EVENTS.ReceiptFailed, {taskId: utils.add0x(taskId)}, blockNumber);
                  resolve(events);
                })
            })
            .catch((error) => {
              reject(error);
            });
        })
        .catch((error) =>{
          reject(error);
        });
    });
  }
  /**
   * Irrelevant for workers -> users create deployment tasks with it
   * */
  createDeploymentTaskRecord(inputsHash, gasLimit, gasPrice, firstBlockNumber, nonce, txParams=null) {
    return new Promise((resolve, reject) => {
      const res = this.getTransactionOptions(txParams);
      if (res.error) {
        reject(res.error);
        return;
      }
      const tx = {
        from: res.transactionOptions.from,
        to: this._enigmaContractAddress,
        gas: res.transactionOptions.gas,
        data: this._enigmaContract.methods.createDeploymentTaskRecord(inputsHash, gasLimit, gasPrice, firstBlockNumber, nonce).encodeABI()
      };
      this._web3.eth.accounts.signTransaction(tx, this._privateKey)
        .then((signedTx)=> {
          this._web3.eth.sendSignedTransaction(signedTx.rawTransaction)
            .on(ETHEREUM_ERROR_EVENT, (error, receipt) => {
              reject(error);
            })
            .on(ETHEREUM_RECEIPT_EVENT, (receipt) => {
              resolve(null);
            });
        })
        .catch((error) =>{
          reject(error);
        });
    });
  }

  async _parsePastEvent(eventName, filter, blockNumber) {
    const rawEvents = await this._enigmaContract.getPastEvents(eventName, {fromBlock: blockNumber, filter: filter});
    let events = {};
    if (Array.isArray(rawEvents) && (rawEvents.length > 0)) {
      if (rawEvents.length > 1) {
        this._logger.info(`Received am unexpected number of events for ${eventName} with the current filter ${JSON.stringify(filter)}.. taking the first`);
      }
      events[eventName] = rawEvents[0];
      events = this._parseEvents(events);
    }
    return events;
  }
}

module.exports = EnigmaContractProductionWriterAPI;

