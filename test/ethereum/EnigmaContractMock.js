class EnigmaContractMock {

  constructor() {
    this._taskRecords = {};
    this._contracts = {};
    this._epochSize = null;
    this._eventListeners = {};
    this._workersParams = [];
    this._except = false;
  }

  setTaskParams(taskId, blockNumber, status, gasLimit) {
    this._taskRecords[taskId] = {taskId: taskId,
                                 blockNumber: blockNumber,
                                 status: status,
                                 gasLimit: gasLimit};
  }

  setContractParams(contractAddress, codeHash, deltas, outputs) {
    this._contracts[contractAddress] = {codeHash: codeHash, deltaHashes: deltas, outputHashes: outputs};
  }

  setEpochSize(size) {
    this._epochSize = size;
  }

  setWorkerParams(workerParams) {
    this._workersParams = workerParams;
  }

  getTaskParams(taskId) {
    if (this._except) {
      throw Error("Ethereum Mock exception");
    }
    return this._taskRecords[taskId];
  }

  getEpochSize() {
    return this._epochSize;
  }

  getWorkersParams() {
    return this._workersParams;
  }

  getContractParams(contractAddress) {
    return this._contracts[contractAddress];
  }

  getStateDeltaHash(contractAddress, key) {
    return this._contracts[contractAddress].deltaHashes[key];
  }

  getOutputHash(contractAddress, key) {
    return this._contracts[contractAddress].outputHashes[key];
  }

  subscribe(eventName, filter, callback) {
    this._eventListeners[eventName] = callback;
  }

  triggerEvent(eventName, event) {
    this._eventListeners[eventName](null, event);
  }

  triggerException() {
    this._except = true;
  }
}

module.exports = EnigmaContractMock;
