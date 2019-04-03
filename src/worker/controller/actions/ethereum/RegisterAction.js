const constants = require('../../../../common/constants');

class RegisterAction {
  constructor(controller) {
    this._controller = controller;
  }
  async execute(params) {
    const onResult = params.onResponse;
    this._controller.execCmd(constants.NODE_NOTIFICATIONS.REGISTRATION_PARAMS, {
      onResponse: async (err, regParams)=>{
        let success = false;
        if (err) {
          this._controller.logger().error(`[REGISTER] error=  ${err}`);
        }
        else {
          const workerAddress = regParams.result.signingKey;
          const report = regParams.result.report;
          const signature = regParams.result.signature;
          const txParams = {from: workerAddress};
          try {
            const txReceipt = await this._controller.ethereum().api().register(workerAddress, report, signature, txParams);
            this._controller.logger().info(`[REGISTER] successful registration, receipt = ${txReceipt}`);
            success = true;
          } catch (e) {
            this._controller.logger().error(`[REGISTER] error=  ${e}`);
            err = e;
          }
        }
        if (onResult) {
          onResult(err, success);
        }
      },
    });
  }
  async asyncExecute(params) {
    const action = this;
    return new Promise((res, rej)=>{
      params.onResponse = function(err, verificationResult) {
        if (err) rej(err);
        else res(verificationResult);
      };
      action.execute(params);
    });
  }
}
module.exports = RegisterAction;
