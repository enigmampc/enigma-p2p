/**
 @TODO lena commit receipt back to ethereum contract
 * */
const cryptography = require('../../../../common/cryptography');
const Result = require('../../../tasks/Result');
const FailedResult = Result.FailedResult;
const constants = require('../../../../common/constants');
const errors = require('../../../../common/errors');
class CommitReceiptAction {
  constructor(controller) {
    this._controller = controller;
  }
  async execute(params) {
    const task = params.task;
    const callback = params.callback;
    if (!task) return;
    try {
      const txReceipt = await this._commitTask(task);
      this._controller.logger().info(`[COMMIT_RECEIPT] success for task ${task.getTaskId()} receipt = ${txReceipt}`);
    } catch (e) {
      this._controller.logger().error(`[COMMIT_RECEIPT] error for task ${task.getTaskId()} error=  ${e}`);
    }
  }
  _commitTask(task) {
    if (task.getResult().isSuccess() && task.getResult().getDelta().data && task.getResult().getOutput()) {
      return this._commitSuccessTask(task);
    } else if (task.getResult().isFailed()) {
      return this._commitFailedTask(task);
    }
    throw errors.TypeErr(`wrong type or missing fields in Result`);
  }
  _commitFailedTask(task) {
    return this._controller.ethereum().commitTaskFailure(
        task.getContractAddr(),
        task.getTaskId(),
        task.getResult().getUsedGas(),
        task.getResult().getSignature(),
    );
  }
  _commitSuccessTask(task) {
    if(task.getTaskType() === 'DeploySecretContract') {
      return this._controller.ethereum().commitDeploySecretContract(
          task.getTaskId(),
          task.getResult().getPreCodeHash(),
          cryptography.hash(task.getResult().getOutput()),
          cryptography.hash(task.getResult().getDelta().data),
          task.getResult().getEthPayload(),
          task.getResult().getEthAddr(),
          task.getResult().getUsedGas(),
          task.getResult().getSignature(),
          {from: '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1'}
      );
    }else{
      return this._controller.ethereum().commitReceipt(
          task.getContractAddr(),
          task.getTaskId(),
          cryptography.hash(task.getResult().getDelta().data),
          cryptography.hash(task.getResult().getOutput()),
          task.getResult().getEthPayload(),
          task.getResult().getEthAddr(),
          task.getResult().getUsedGas(),
          task.getResult().getSignature(),
          {from: '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1'}
      );
    }
  }
}
module.exports = CommitReceiptAction;
