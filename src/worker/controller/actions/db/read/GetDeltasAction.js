
const constants = require('../../../../../common/constants');
const STAT_TYPES = constants.STAT_TYPES;
const STATUS = constants.MSG_STATUS;
const Envelop = require('../../../../../main_controller/channels/Envelop');
/**
 This action returns all the requested deltas.
 either from cache or directly from core.
 * */
class GetDeltasAction {
  constructor(controller) {
    this._controller = controller;
  }
  execute(params) {
    const onResult = params.onResponse;
    const queryMsg = params.requestMsg;
    // make query
    const addr = queryMsg.contractAddress();
    const range = queryMsg.getRange();
    const from = range.fromIndex;
    const to = range.toIndex;
    const input = [{address: addr, from: from, to: to}];
    this._controller.execCmd(constants.NODE_NOTIFICATIONS.DB_REQUEST, {
      dbQueryType: constants.CORE_REQUESTS.GetDeltas,
      input: input,
      onResponse: (err, result)=>{
        return onResult(err, result);
      },
    });
  }
}
module.exports = GetDeltasAction;

