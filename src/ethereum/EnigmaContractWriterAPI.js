const defaultsDeep = require('@nodeutils/defaults-deep');
const utils = require('../common/utils');
const errors = require('../common/errors');

const EnigmaContractReaderAPI = require('./EnigmaContractReaderAPI');

const EMPTY_HEX_STRING = '0x'; // This is the right value to pass an empty value to the contract, otherwise we get an error

class EnigmaContractWriterAPI extends EnigmaContractReaderAPI {
  constructor(enigmaContractAddress, enigmaContractABI, web3, logger, workerAddress) {
    super(enigmaContractAddress, enigmaContractABI, web3, logger, workerAddress);
  }
  /**
     * Step 1 in registration
     * Register a worker to the network.
     * @param {string} signerAddress ,
     * @param {string} report , worker
     * @param {string} signature
     * @param {JSON} txParams
     * @return {Promise} receipt
     * */
  register(signerAddress, report, signature, txParams=null) {
    return new Promise((resolve, reject) => {
      let transactionOptions = this._defaultTrxOptions;
      if (txParams !== undefined && txParams !== null) {
        const error = this._validateTxParams(txParams);
        if (error !== null) {
          reject(error);
          return;
        }
        transactionOptions = defaultsDeep(txParams, this._defaultTrxOptions);
      }
      this._enigmaContract.methods.register(
        utils.add0x(signerAddress),
        utils.add0x(report),
        utils.add0x(signature))
          .send(transactionOptions, (error, receipt)=> {
            if (error) {
              reject(error);
            }
            resolve(receipt);
          });
    });
  }
  /**
     * Step 2 in registration : stake ENG's (TO DA MOON)
     * @param {string} custodian - the worker address
     * @param {Integer} amount
     * @param {JSON} txParams
     * */
  deposit(custodian, amount, txParams=null) {
    return new Promise((resolve, reject) => {
      let transactionOptions = this._defaultTrxOptions;
      if (txParams !== undefined && txParams !== null) {
        const error = this._validateTxParams(txParams);
        if (error !== null) {
          reject(error);
          return;
        }
        transactionOptions = defaultsDeep(txParams, this._defaultTrxOptions);
      }
      this._enigmaContract.methods.deposit(custodian, amount).send(transactionOptions, (error, receipt)=> {
        if (error) {
          reject(error);
        }
        resolve(receipt);
      });
    });
  }
  /**
   * Step 2 in registration : stake ENG's of the current worker(TO DA MOON)
   * @param {Integer} amount
   * @param {JSON} txParams
   * */
  selfDeposit(amount, txParams=null) {
    return new Promise((resolve, reject) => {
      let transactionOptions = this._defaultTrxOptions;
      if (txParams !== undefined && txParams !== null) {
        const error = this._validateTxParams(txParams);
        if (error !== null) {
          reject(error);
          return;
        }
        transactionOptions = defaultsDeep(txParams, this._defaultTrxOptions);
      }
      let workerAddress = this.getWorkerAddress();
      if (!workerAddress) {
        reject(new errors.InputErr("Missing worker-address when calling selfDeposit"));
      }
      this._enigmaContract.methods.deposit(workerAddress, amount).send(transactionOptions, (error, receipt)=> {
        if (error) {
          reject(error);
        }
        resolve(receipt);
      });
    });
  }
  /**
   * Withdraw worker's stake (full or partial)
   * @param {Integer} amount
   * @param {JSON} txParams
   * */
  withdraw(amount, txParams) {
    return new Promise((resolve, reject) => {
      let transactionOptions = this._defaultTrxOptions;
      if (txParams !== undefined && txParams !== null) {
        const error = this._validateTxParams(txParams);
        if (error !== null) {
          reject(error);
          return;
        }
        transactionOptions = defaultsDeep(txParams, this._defaultTrxOptions);
      }
      this._enigmaContract.methods.withdraw(amount).send(transactionOptions, (error, receipt)=> {
        if (error) {
          console.log(error);
          reject(error);
        }
        resolve(receipt);
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
     * @return {Promise} receipt //TODO:: we want to turn all the Json's into real classes.
     * */
  deploySecretContract(taskId, preCodeHash, codeHash, initStateDeltaHash, optionalEthereumData, optionalEthereumContractAddress, gasUsed, signature, txParams=null) {
    return new Promise((resolve, reject) => {
      let transactionOptions = this._defaultTrxOptions;
      if (txParams !== undefined && txParams !== null) {
        const error = this._validateTxParams(txParams);
        if (error !== null) {
          reject(error);
          return;
        }
        transactionOptions = defaultsDeep(txParams, this._defaultTrxOptions);
      }

      if(!optionalEthereumData) {
        optionalEthereumData = EMPTY_HEX_STRING;
      }

      this._enigmaContract.methods.deploySecretContract(
        utils.add0x(taskId),
        utils.add0x(preCodeHash),
        utils.add0x(codeHash),
        utils.add0x(initStateDeltaHash),
        utils.add0x(optionalEthereumData),
        utils.add0x(optionalEthereumContractAddress),
        gasUsed,
        utils.add0x(signature))
        .send(transactionOptions, (error, receipt)=> {
        if (error) {
          reject(error);
        }
        resolve(receipt);
      });
    });
  }
  /**
     * login a worker
     * @return {Promise} receipt
     * */
  login(txParams=null) {
    return new Promise((resolve, reject) => {
      let transactionOptions = this._defaultTrxOptions;
      if (txParams !== undefined && txParams !== null) {
        const error = this._validateTxParams(txParams);
        if (error !== null) {
          reject(error);
          return;
        }
        transactionOptions = defaultsDeep(txParams, this._defaultTrxOptions);
      }
      this._enigmaContract.methods.login().send(transactionOptions, (error, receipt)=> {
        if (error) {
          reject(error);
        }
        resolve(receipt);
      });
    });
  }
  /**
     * login a worker
     * @return {Promise} receipt
     * */
  logout(txParams=null) {
    return new Promise((resolve, reject) => {
      let transactionOptions = this._defaultTrxOptions;
      if (txParams !== undefined && txParams !== null) {
        const error = this._validateTxParams(txParams);
        if (error !== null) {
          reject(error);
          return;
        }
        transactionOptions = defaultsDeep(txParams, this._defaultTrxOptions);
      }
      this._enigmaContract.methods.logout().send(transactionOptions, (error, receipt)=> {
        if (error) {
          reject(error);
        }
        resolve(receipt);
      });
    });
  }
  /**
     * Irrelevant for workers -> users create deployment tasks with it
     * */
  createDeploymentTaskRecord(inputsHash, gasLimit, gasPrice, firstBlockNumber, nonce, txParams=null) {
    return new Promise((resolve, reject) => {
      let transactionOptions = this._defaultTrxOptions;
      if (txParams !== undefined && txParams !== null) {
        const error = this._validateTxParams(txParams);
        if (error !== null) {
          reject(error);
          return;
        }
        transactionOptions = defaultsDeep(txParams, this._defaultTrxOptions);
      }
      this._enigmaContract.methods.createDeploymentTaskRecord(inputsHash, gasLimit, gasPrice, firstBlockNumber, nonce)
          .send(transactionOptions, (error, receipt)=> {
            if (error) {
              reject(error);
            }
            resolve(receipt);
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
     * @return {Promise} receipt
     * */
  commitReceipt(secretContractAddress, taskId, stateDeltaHash, outputHash, optionalEthereumData, optionalEthereumContractAddress, gasUsed, signature, txParams=null) {
    return new Promise((resolve, reject) => {
      let transactionOptions = this._defaultTrxOptions;
      if (txParams !== undefined && txParams !== null) {
        const error = this._validateTxParams(txParams);
        if (error !== null) {
          reject(error);
          return;
        }
        transactionOptions = defaultsDeep(txParams, this._defaultTrxOptions);
      }
      if(!optionalEthereumData) {
        optionalEthereumData = EMPTY_HEX_STRING;
      }
      if(!stateDeltaHash) {
        stateDeltaHash = EMPTY_HEX_STRING;
      }
      this._enigmaContract.methods.commitReceipt(
        utils.add0x(secretContractAddress),
        utils.add0x(taskId),
        utils.add0x(stateDeltaHash),
        utils.add0x(outputHash),
        utils.add0x(optionalEthereumData),
        utils.add0x(optionalEthereumContractAddress),
        gasUsed,
        utils.add0x(signature))
          .send(transactionOptions, (error, receipt)=> {
            if (error) {
              reject(error);
            }
            resolve(receipt);
          });
    });
  }
  /** same as above but for a batch */
  // commitReceipts(secretContractAddresses, taskIds, stateDeltaHashes, outputHashes, optionalEthereumData,
  //                optionalEthereumContractAddress, gasUsed, signature, txParams=null) {
  //   return new Promise((resolve, reject) => {
  //     let transactionOptions = this._defaultTrxOptions;
  //     if (txParams !== undefined && txParams !== null) {
  //       const error = this._validateTxParams(txParams);
  //       if (error !== null) {
  //         reject(error);
  //         return;
  //       }
  //       transactionOptions = defaultsDeep(txParams, this._defaultTrxOptions);
  //     }
  //     this._enigmaContract.methods.commitReceipts(secretContractAddresses, taskIds, stateDeltaHashes, outputHashes, optionalEthereumData,
  //       optionalEthereumContractAddress, gasUsed, signature)
  //         .send(transactionOptions, (error, receipt)=> {
  //           if (error) {
  //             reject(error);
  //           }
  //           resolve(receipt);
  //         });
  //   });
  // }
  /**
   * Worker commits the failed task result on-chain
   * @param {string} secretContractAddress
   * @param {string} taskId
   * @param {Integer} gasUsed
   * @param {string} signature
   * @param {JSON} txParams
   * @return {Promise} receipt
   * */
  commitTaskFailure(secretContractAddress, taskId, gasUsed, signature, txParams=null) {
    return new Promise((resolve, reject) => {
      let transactionOptions = this._defaultTrxOptions;
      if (txParams !== undefined && txParams !== null) {
        const error = this._validateTxParams(txParams);
        if (error !== null) {
          reject(error);
          return;
        }
        transactionOptions = defaultsDeep(txParams, this._defaultTrxOptions);
      }
      this._enigmaContract.methods.commitTaskFailure(
        utils.add0x(secretContractAddress),
        utils.add0x(taskId),
        gasUsed,
        utils.add0x(signature))
        .send(transactionOptions, (error, receipt)=> {
          if (error) {
            reject(error);
          }
          resolve(receipt);
        });
    });
  }
  /**
   * Worker commits the failed deploy task result on-chain
   * @param {string} taskId == secretContractAddress
   * @param {Integer} gasUsed
   * @param {string} signature
   * @param {JSON} txParams
   * @return {Promise} receipt
   * */
  deploySecretContractFailure(taskId, gasUsed, signature, txParams=null) {
    return new Promise((resolve, reject) => {
      let transactionOptions = this._defaultTrxOptions;
      if (txParams !== undefined && txParams !== null) {
        const error = this._validateTxParams(txParams);
        if (error !== null) {
          reject(error);
          return;
        }
        transactionOptions = defaultsDeep(txParams, this._defaultTrxOptions);
      }
      this._enigmaContract.methods.deploySecretContractFailure(
        utils.add0x(taskId),
        gasUsed,
        utils.add0x(signature))
        .send(transactionOptions, (error, receipt)=> {
          if (error) {
            reject(error);
          }
          resolve(receipt);
        });
    });
  }
  /** used by the principal node to commit a random number === new epoch */
  setWorkersParams(seed, signature, txParams=null) {
    return new Promise((resolve, reject) => {
      let transactionOptions = this._defaultTrxOptions;
      if (txParams !== undefined && txParams !== null) {
        const error = this._validateTxParams(txParams);
        if (error !== null) {
          reject(error);
          return;
        }
        transactionOptions = defaultsDeep(txParams, this._defaultTrxOptions);
      }
      this._enigmaContract.methods.setWorkersParams(seed, signature)
          .send(transactionOptions, (error, receipt)=> {
            if (error) {
              reject(error);
            }
            resolve(receipt);
          });
    });
  }
  _validateTxParams(txParams) {
    if ('gas' in txParams) {
      if (txParams.gas < this._validTrxParams.gasMin || txParams.gas > this._validTrxParams.gasMax) {
        return 'gas limit specified ' + txParams.gas + ' is not in the allowed range: ' + this._validTrxParams.gasMin + '-' + this._validTrxParams.gasMax;
      }
    }
    if ('gasPrice' in txParams) {
      if (txParams.gasPrice < this._validTrxParams.gasPriceMin || txParams.gasPrice > this._validTrxParams.gasPriceMax) {
        return 'gas price specified ' + txParams.gasPrice + ' is not in the allowed range: ' + this._validTrxParams.gasPriceMin + '-' + this._validTrxParams.gasPriceMax;
      }
    }
    if ('from' in txParams) {
      if (!this._web3.utils.isAddress(txParams.from)) {
        return 'the from address specified ' + txParams.from + ' is not a valid Ethereum address' + this._validTrxParams.gasPriceMin + '-' + this._validTrxParams.gasPriceMax;
      }
    }
    return null;
  }
}

module.exports = EnigmaContractWriterAPI;
