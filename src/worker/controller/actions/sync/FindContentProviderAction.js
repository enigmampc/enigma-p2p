
const constants = require('../../../../common/constants');
const STAT_TYPES = constants.STAT_TYPES;
const STATUS = constants.MSG_STATUS;

/**
 * Find content providers to provide data
 * Takes list of hashes -> turns them into cid's
 * calls next(result)
 * */
class FindContentProviderAction {
  constructor(controller) {
    this._controller = controller;
  }
  execute(params) {
    const descriptorsList = params.descriptorsList;
    const next = params.next;
    const isEngCid = params.isEngCid;
    this._controller.receiver()
        .findProvidersBatch(descriptorsList, isEngCid, (findProviderResult)=>{
        // TODO:: add error param to the callback.
          next(findProviderResult);
        });
  }
}
module.exports = FindContentProviderAction;
