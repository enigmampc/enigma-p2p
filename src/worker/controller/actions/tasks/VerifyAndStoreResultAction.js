/**
 * this action handles everything that is published to task results topic
 * i.e whenever some other worker publishes a result of computation or deployment
 * this action:
 * - verify correctness of task
 * - update local storage
 * */
const constants = require("../../../../common/constants");
const utils = require("../../../../common/utils");
const errors = require("../../../../common/errors");
const EngCid = require("../../../../common/EngCID");
const DeployResult = require("../../../tasks/Result").DeployResult;
const ComputeResult = require("../../../tasks/Result").ComputeResult;
const FailedResult = require("../../../tasks/Result").FailedResult;
const OutsideTask = require("../../../tasks/OutsideTask");

class VerifyAndStoreResultAction {
  constructor(controller) {
    this._controller = controller;
  }
  /**
   * params {
   * notification,
   * params : Buffer -> {the actual object from publish that contains from,data,,...}
   * }
   * */
  async execute(params) {
    const optionalCallback = params.callback;
    const message = params.params;
    const from = message.from; // b58 id
    const data = message.data;
    const msgObj = JSON.parse(data.toString());
    const resultObj = msgObj.result;
    const contractAddress = msgObj.contractAddress;
    const type = msgObj.type;
    let error = null;

    this._controller
      .logger()
      .info("[RECEIVED_RESULT] taskId {" + resultObj.taskId + "} \nstatus {" + resultObj.status + "}");

    let { taskResult, err } = this._buildTaskResult(type, resultObj);
    if (!err) {
      let { error, isVerified } = await this._verifyResult(taskResult, contractAddress);
      let verifyError = error;

      if (isVerified) {
        const coreMsg = this._buildIpcMsg(taskResult, contractAddress);
        if (coreMsg) {
          try {
            await this._controller.asyncExecCmd(constants.NODE_NOTIFICATIONS.UPDATE_DB, { data: coreMsg });
          } catch (e) {
            this._controller.logger().error(`[UPDATE_CORE] can't update core with outside task results -> ${e}`);
            if (optionalCallback) {
              optionalCallback(e);
            }
            return;
          }
          // announce as provider if its deployment and successful
          if (
            type === constants.CORE_REQUESTS.DeploySecretContract &&
            resultObj.status === constants.TASK_STATUS.SUCCESS
          ) {
            let ecid = EngCid.createFromSCAddress(resultObj.taskId);
            if (ecid) {
              try {
                // announce the network
                await this._controller.asyncExecCmd(constants.NODE_NOTIFICATIONS.ANNOUNCE_ENG_CIDS, {
                  engCids: [ecid]
                });
              } catch (e) {
                this._controller.logger().error(`[PUBLISH_ANNOUNCE_TASK] cant publish ecid  -> ${e}`);
                error = e;
              }
            }
          }
        }
      }
      // outside task is saved if this is legit task or if the task was failed due to an Ethereum callback.
      // In case of the later, we update the task status to signal that the task failed due to Ethereum callback.
      if (isVerified || verifyError instanceof errors.TaskEthereumFailureErr) {
        try {
          let outsideTask = OutsideTask.buildTask(type, resultObj);
          if (outsideTask) {
            if (verifyError instanceof errors.TaskEthereumFailureErr) {
              outsideTask.getResult().setStatus(constants.TASK_STATUS.FAILED.FAILED_ETHEREUM_CB);
            }
            // store result in TaskManager mapped with taskId
            await this._controller.taskManager().addOutsideResult(type, outsideTask);
          }
        } catch (e) {
          this._controller.logger().error(`[STORE_RESULT] can't save outside task  -> ${e}`);
          error = e;
        }
      }

      this._controller
        .logger()
        .info(`[VERIFY_AND_STORE_RESULT] finished for task ${resultObj.taskId}: is_err ?  ${error}`);
      if (optionalCallback) {
        optionalCallback(error);
      }
    } else {
      // if (err)
      this._controller
        .logger()
        .info(`[VERIFY_AND_STORE_RESULT] finished for task ${resultObj.taskId} with an error:  ${err}`);
      if (optionalCallback) {
        optionalCallback(err);
      }
    }
  }
  _buildIpcMsg(taskResult, contractAddr) {
    // FailedTask
    if (taskResult instanceof FailedResult) {
      // TODO:: what to do with a FailedTask ???
      this._controller.logger().debug(`[RECEIVED_FAILED_TASK] FAILED TASK RECEIVED id = ${taskResult.getTaskId()}`);
      return null;
    }
    // DeployResult
    else if (taskResult instanceof DeployResult) {
      return {
        address: contractAddr,
        bytecode: taskResult.getOutput(),
        type: constants.CORE_REQUESTS.UpdateNewContractOnDeployment,
        delta: taskResult.getDelta()
      };
    }
    // ComputeResult
    else {
      // Check that there is indeed a delta
      if (taskResult.hasDelta()) {
        let delta = taskResult.getDelta();
        return {
          type: constants.CORE_REQUESTS.UpdateDeltas,
          deltas: [{ address: contractAddr, key: delta.key, data: delta.data }]
        };
      }
      // No delta, no need to update core..
      else {
        return null;
      }
    }
  }
  async _verifyResult(result, contractAddress) {
    // TODO: remove this default!!!! (is there for being able to run UTs without Ethereum)
    let isVerified = true;
    let error = null;

    if (this._controller.hasEthereum()) {
      isVerified = false;
      let localTip = null;
      // If it is a compute task without delta => request tip from core to validate with Ethereum
      if (result instanceof ComputeResult && !result.hasDelta()) {
        try {
          let tips = await this._controller.asyncExecCmd(constants.NODE_NOTIFICATIONS.GET_TIPS, {
            contractAddresses: contractAddress
          });
          if (!Array.isArray(tips) || tips.length === 0 || !tips[0].address || tips[0].address !== contractAddress) {
            error = `[VERIFY_TASK_RESULT] error in reading ${contractAddress} local tip`;
          } else {
            localTip = tips[0];
          }
        } catch (e) {
          error = e;
        }
        if (error) {
          this._controller.logger().info(error);
          return { error: error, isVerified: isVerified };
        }
      }
      try {
        const currentBlockNumber = await utils.getEthereumBlockNumber(
          this._controller
            .ethereum()
            .api()
            .w3()
        );
        let res = await this._controller
          .ethereum()
          .verifier()
          .verifyTaskSubmission(result, currentBlockNumber, contractAddress, localTip);
        if (res.error) {
          this._controller
            .logger()
            .info(`[VERIFY_TASK_RESULT] error in verification of result of task ${result.getTaskId()}: ${res.error}`);
          error = res.error;
        } else if (res.isVerified) {
          this._controller.logger().debug(`[VERIFY_TASK_RESULT] successful verification of task ${result.getTaskId()}`);
          isVerified = true;
        }
      } catch (e) {
        this._controller
          .logger()
          .error(
            `[VERIFY_TASK_RESULT] an exception occurred while trying to verify result of task ${result.getTaskId()}: ${e}`
          );
        error = e;
      }
    }
    return { error: error, isVerified: isVerified };
  }
  _buildTaskResult(type, resultObj) {
    let result = null;
    let error = null;

    if (resultObj.status === constants.TASK_STATUS.FAILED) {
      result = FailedResult.buildFailedResult(resultObj);
    } else if (type === constants.CORE_REQUESTS.DeploySecretContract) {
      result = DeployResult.buildDeployResult(resultObj);
    } else if (type === constants.CORE_REQUESTS.ComputeTask) {
      result = ComputeResult.buildComputeResult(resultObj);
    } else {
      error = `[VERIFY_TASK_RESULT] received unrecognized task type ${type}, task is dropped`;
      this._controller.logger().info(error);
    }
    return { taskResult: result, err: error };
  }
}
module.exports = VerifyAndStoreResultAction;
