class EnigmaContractReaderAPI {
  /**
     * {string} enigmaContractAddress
     * {Json} enigmaContractABI
     * {Web3} web3
     * */
  constructor(enigmaContractAddress, enigmaContractABI, web3) {
    this._enigmaContract = new web3.eth.Contract(enigmaContractABI, enigmaContractAddress);
    this._web3 = web3;
    this._activeEventSubscriptions = {};
    this._initEventParsers();
  }
  w3() {
    return this._web3;
  }
  /**
     * check if a secret contract is deployed
     * @param {string} secrectContractAddress
     * @return {Promise} bool
     * */
  isDeployed(secrectContractAddress) {
    return new Promise((resolve, reject) => {
      this._enigmaContract.methods.isDeployed(secrectContractAddress).call((error, data)=> {
        if (error) {
          reject(error);
        }
        resolve(data);
      });
    });
  }
  /**
     * get a secret contract hash
     * @param {string} secrectContractAddress
     * @return {Promise} string
     * */
  getCodeHash(secrectContractAddress) {
    return new Promise((resolve, reject) => {
      this._enigmaContract.methods.contracts(secrectContractAddress).call((error, data)=> {
        if (error) {
          reject(error);
        }
        resolve(data.codeHash);
      });
    });
  }
  /**
     * count the number of deployed secret contracts
     * @return {Promise} number
     * */
  countSecretContracts() {
    return new Promise((resolve, reject) => {
      this._enigmaContract.methods.countSecretContracts().call((error, data)=> {
        if (error) {
          reject(error);
        }
        resolve(parseInt(data));
      });
    });
  }
  /**
     * return a list of addresses given a range
     * @param {Integer} from , including
     * @param {Integer} to , up to not including
     * @return {Promise} Array<string>
     * */
  getSecretContractAddresses(from, to) {
    return new Promise((resolve, reject) => {
      this._enigmaContract.methods.getSecretContractAddresses(from, to).call((error, data)=> {
        if (error) {
          reject(error);
        }
        resolve(data);
      });
    });
  }
  /**
     * get the number of state deltas in a secret contract
     * @param {string} secrectContractAddress
     * @return {Promise} number
     * */
  countStateDeltas(secrectContractAddress) {
    return new Promise((resolve, reject) => {
      this._enigmaContract.methods.countStateDeltas(secrectContractAddress).call((error, data)=> {
        if (error) {
          reject(error);
        }
        resolve(parseInt(data));
      });
    });
  }
  /**
     * get a hash of some delta
     * @param {string} secrectContractAddress
     * @param {Integer} index
     * @return {Promise} string
     * */
  getStateDeltaHash(secrectContractAddress, index) {
    return new Promise((resolve, reject) => {
      this._enigmaContract.methods.getStateDeltaHash(secrectContractAddress, index).call((error, data)=> {
        if (error) {
          reject(error);
        }
        resolve(data);
      });
    });
  }
  /**
    * get a hashes list of some delta's range
    * @param {string} secrectContractAddress
    * @param {Integer} index
    * @return {Promise} Array<String>
    * */
  getStateDeltaHashes(secrectContractAddress, from, to) {
    return new Promise((resolve, reject) => {
      this._enigmaContract.methods.getStateDeltaHashes(secrectContractAddress, from, to).call((error, data)=> {
        if (error) {
          reject(error);
        }
        resolve(data);
      });
    });
  }
  /**
     * Validate a hash on-chain
     * @param {string} secrectContractAddress
     * @param {string} deltaHash
     * @return {Promise} boolean
     * */
  isValidDeltaHash(secrectContractAddress, delatHash) {
    return new Promise((resolve, reject) => {
      this._enigmaContract.methods.isValidDeltaHash(secrectContractAddress, delatHash).call((error, data)=> {
        if (error) {
          reject(error);
        }
        resolve(data);
      });
    });
  }
  /**
     * Get the Worker parameters
     * @param {Integer} blockNumber //TODO:: check which time solidity expects, maybe BN ?
     * @return {Promise} //TODO:: what are the exact patameters that are returned?
     * */
  getWorkerParams(blockNumber) {
    return new Promise((resolve, reject) => {
      this._enigmaContract.methods.getWorkerParams(blockNumber).call((error, data)=> {
        if (error) {
          reject(error);
        }
        resolve(data);
      });
    });
  }
  /**
     * TODO:: what does it do?
     * */
  getWorkerGroup(blockNumber, secrectContractAddress) {
    return new Promise((resolve, reject) => {
      this._enigmaContract.methods.getWorkerParams(blockNumber, secrectContractAddress).call((error, data)=> {
        if (error) {
          reject(error);
        }
        resolve(data);
      });
    });
  }
  /**
     * * Get the Worker report
     * @param {string} workerAddress
     * @return {JSON} : {string} signer, {string} report
     * */
  getReport(workerAddress) {
    return new Promise((resolve, reject) => {
      this._enigmaContract.methods.getReport(workerAddress).call((error, data)=> {
        if (error) {
          reject(error);
        }
        const params = {
          signer: data[0],
          report: this._web3.utils.hexToAscii(data[1]),
        };
        resolve(params);
      });
    });
  }
  /**
   * * Get Ethereum block number
   * @return {Integer} : blockNumber
   * */
  getEthereumBlockNumber() {
    return new Promise((resolve, reject) => {
      this._web3.eth((error, data)=> {
        if (error) {
          reject(error);
        }
        resolve(data);
      });
    });
  }
  /**
     * //TODO:: WTF is 'changed' ?
     * Listen to events emmited by the Enigma.sol contract and trigger a callback
     * @param {string} eventName
     * @param {Json} filter, incase a filter is required on top of the event itself. //TODO:: add an example HERE of a filter
     * @param {Function} callback (err,event)=>{} //TODO:: add the parameters that the function takes.
     * */
  subscribe(eventName, filter, callback) {
    const eventWatcher = this._enigmaContract.events[eventName]({filter: filter});

    eventWatcher
        .on('data', (event)=>{
          const result = this._eventParsers[eventName](event, this._web3);
          callback(null, result);
        })
        .on('changed', (event)=> {
          console.log('received a change of the event ', event);
          if (eventName in this._activeEventSubscriptions) {
            delete(this._activeEventSubscriptions[eventName]);
          }
        })
        .on('error', (err)=>{
          callback(err);
        });

    this._activeEventSubscriptions[eventName] = eventWatcher;
  }
  /**
     * Unsubscribe from all the subscribed events
     * @return {Boolean} success
     * */
  unsubscribeAll() {
    for (const [eventName, eventWatcher] of Object.entries(this._activeEventSubscriptions)) {
      // console.log("unsubscribing " + eventName);
      eventWatcher.unsubscribe();
    }
    return true;
  }

  _initEventParsers() {
    this._eventParsers = {
      /**
             * @return {JSON}: {string} workerAddress , {string} signer
             * */
      'Registered': (event) => {
        return {
          workerAddress: event.returnValues.custodian,
          signer: event.returnValues.signer,
        };
      },
      /**
             * @return {JSON}: {string} signature , {string} hash, {string} workerAddress
             * */
      'ValidatedSig': (event) => {
        return {
          signature: event.returnValues.sig,
          hash: event.returnValues.hash,
          workerAddress: event.returnValues.workerAddr,
        };
      },
      /**
             * @return {JSON}: {Integer} seed , {Integer} blockNumber, {Array<string>} workers, {Array<Integer>} balances, {Integer} nonce
             * */
      'WorkersParameterized': (event) => {
        return {
          seed: event.returnValues.seed,
          blockNumber: event.returnValues.blockNumber,
          workers: event.returnValues.workers,
          balances: event.returnValues.balances,
          nonce: parseInt(event.returnValues.nonce),
        };
      },
      /**
             * @return {JSON}: {string} taskId , {Integer} gasLimit, {Integer} gasPrice, {string} senderAddress
             * */
      'TaskRecordCreated': (event) => {
        return {
          taskId: event.returnValues.taskId,
          gasLimit: parseInt(event.returnValues.gasLimit),
          gasPrice: parseInt(event.returnValues.gasPx),
          senderAddress: event.returnValues.sender,
        };
      },
      /**
             * @return {JSON}: {Array<string>} taskIds , {Array<Integer>} gasLimits,
             *                 {Array<Integer>} gasPrices, {string} senderAddress
             * */
      'TaskRecordsCreated': (event) => {
        const parsedGasLimit = [];
        event.returnValues.gasLimits.forEach(function(element) {
          parsedGasLimit.push(parseInt(element));
        });
        const parsedGasPrice = [];
        event.returnValues.gasPxs.forEach(function(element) {
          parsedGasPrice.push(parseInt(element));
        });
        return {
          taskIds: event.returnValues.taskIds,
          gasLimits: parsedGasLimit,
          gasPrices: parsedGasPrice,
          senderAddress: event.returnValues.sender,
        };
      },
      /**
             * @return {JSON}: {string} taskId , {string} stateDeltaHash, {string} outputHash,
             *                 {string} ethCall, {string} signature
             * */
      'ReceiptVerified': (event, web3) => {
        return {
          taskId: event.returnValues.taskId,
          stateDeltaHash: event.returnValues.stateDeltaHash,
          outputHash: event.returnValues.outputHash,
          ethCall: event.returnValues.ethCall,
          signature: event.returnValues.sig,
        };
      },
      /**
             * @return {JSON}: {Array<string>} taskIds , {Array<string>} stateDeltaHashes, {string} outputHash,
             *                 {string} ethCall, {string} signature
             * */
      'ReceiptsVerified': (event, web3) => {
        return {
          taskIds: event.returnValues.taskIds,
          stateDeltaHashes: event.returnValues.stateDeltaHashes,
          outputHash: event.returnValues.outputHash,
          ethCall: event.returnValues.ethCall,
          signature: event.returnValues.sig,
        };
      },
      /**
       * @return {JSON}: {string>} taskId , {string} ethCall, {string} signature
       * */
      'ReceiptFailed': (event, web3) => {
        return {
          taskId: event.returnValues.taskId,
          signature: event.returnValues.sig,
        };
      },
      /**
       * @return {JSON}: {string>} taskId
       * */
      'TaskFeeReturned': (event, web3) => {
        return {
          taskId: event.returnValues.taskId,
        };
      },
      /**
             * @return {JSON}: {string} from , {Integer} value
             * */
      'DepositSuccessful': (event) => {
        return {
          from: event.returnValues.from,
          value: parseInt(event.returnValues.value),
        };
      },
      /**
       * @return {JSON}: {string} to , {Integer} value
       * */
      'WithdrawSuccessful': (event) => {
        return {
          to: event.returnValues.to,
          value: parseInt(event.returnValues.value),
        };
      },
      /**
             * @return {JSON}: {string} secretContractAddress , {string} codeHash
             * */
      'SecretContractDeployed': (event) => {
        return {
          secretContractAddress: event.returnValues.scAddr,
          codeHash: event.returnValues.codeHash,
        };
      },
    };
  }
}


module.exports = EnigmaContractReaderAPI;
