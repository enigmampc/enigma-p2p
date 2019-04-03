const Verifier = require('./receiver/StateSyncReqVerifier');
const EncoderUtil = require('../../common/EncoderUtil');
const constants = require('../../common/constants');
const SyncMsgMgmgt = require('../../policy/p2p_messages/sync_messages');
const SyncMsgBuilder = SyncMsgMgmgt.SyncMsgBuilder;
/**
 * global methods
 * */
/**
 * @param {JSON} globalState - a global state the is accessible to all of the stream methods.
 * @param {Receiver/Provider} context - access other methods i.e db requests
 * @param {Logger} logger
 * */
const globalState = {
  providerContext: null,
  receiverContext: null,
  logger: null,
};

/**
 * Set the global state, this function will be executed only once
 * regardless of the amount of times it is being called.
 * */

// TODO: remove this all together and move to a local state
//  (due to binding between tests, the following lines had to be commented out)
module.exports.setGlobalState = (state)=>{
  if (state.providerContext) {// && globalState.providerContext === null){
    globalState.providerContext = state.providerContext;
  }
  if (state.receiverContext) {// && globalState.receiverContext === null){
    globalState.receiverContext = state.receiverContext;
  }
  if (state.logger && globalState.logger === null) {
    globalState.logger = state.logger;
  }
};
/**
 * Actuall streams implementation
 * */

/**
 * from providerStream => verify (consensus)
 * @param {stream} read
 * @return {function()}
 * */
module.exports.verificationStream = (read)=>{
  return _verificationStream(read);
};

/**
 * After verificationStream => into db
 * @param {stream} read
 * @return {function()}
 * */
// module.exports.toDbStream = (read)=>{
//   return _toDbStream(read);
// };

module.exports.fromDbStream = (read) =>{
  return _fromDbStream(read);
};
/**
 * parses the data from the requester into a format that core can read
 * this is preperation before loading the deltas from the db.
 * the data here gets one by one from remote. (i.e for list of request, this is activated for each request)
 * @param {stream} read
 * @return {function()}
 * */
module.exports.requestParserStream = (read) =>{
  return _requestParserStream(read);
};

/**
 * Taking the result from the Database (done by the provider)
 * and parse them into network mode (i.e msgpack etc.)
 * */

module.exports.toNetworkParser = (read) =>{
  return _toNetworkParse(read);
};

/** Parse the request state sync msg from the reciever before passing the request to the provider stream
 * msgpack serialize */

module.exports.toNetworkSyncReqParser = (read)=>{
  return _toNetworkSyncReqParser(read);
};
/**
 * used by the receiver to store the deltas into db
 * After verificationStream => into db
 * @param {stream} read
 * @return {function()}
 * */
module.exports.throughDbStream = (read)=>{
  return _throughDbStream(read);
};
function _throughDbStream(read) {
  return function readble(end, cb) {
    read(end, (end, data)=>{
      if (data != null) {
        fakeSaveToDb(data, (err, status)=>{
          if (!status || err ) {
            globalState.logger.error('some fake error saving to db ');
            throw end;
          } else {
            cb(end, {status: status, data: data});
          }
        });
      } else {
        cb(end, null);
      }
    });
  };
}

function _toNetworkSyncReqParser(read) {
  return function readble(end, cb) {
    read(end, (end, data) => {
      if (data != null) {
        cb(end, data.toNetwork());
      } else {
        cb(end, null);
      }
    });
  };
}
function _parseFromDbToNetwork(dbResult, callback) {
  // TODO:: add toNetwork() method to all the dbResults.
  // parse all to network
  if (dbResult.type === constants.CORE_REQUESTS.GetDeltas) {
    dbResult.msgType = constants.P2P_MESSAGES.SYNC_STATE_RES;
  } else if (dbResult.type === constants.CORE_REQUESTS.GetContract) {
    dbResult.msgType = constants.P2P_MESSAGES.SYNC_BCODE_RES;
  }
  dbResult = EncoderUtil.encode(JSON.stringify(dbResult));
  const parsed = dbResult;
  const isError = null;
  callback(isError, parsed);
}
// this takes result from the db (done by the provider) and
// returns the result directly into the other peer stream (source)
function _toNetworkParse(read) {
  return function readble(end, cb) {
    read(end, (end, data)=>{
      if (data!=null) {
        _parseFromDbToNetwork(data, (err, parsedResult)=>{
          if (err) {
            cb(err, null);
          } else {
            cb(end, parsedResult);
          }
        });
      } else {
        cb(end, null);
      }
    });
  };
}
function _fakeFromDbStream(syncReqMsg, callback) {
  // TODO:: create a db call ...
  // TODO:: validate that the range < limit here or somewhere else.
  let queryType = null;
  if (syncReqMsg.type() === constants.P2P_MESSAGES.SYNC_BCODE_REQ) {
    queryType = constants.CORE_REQUESTS.GetContract;
  } else if (syncReqMsg.type() === constants.P2P_MESSAGES.SYNC_STATE_REQ) {
    queryType = constants.CORE_REQUESTS.GetDeltas;
  } else {
    // TODO:: handle error
    globalState.logger.error('error in _fakeFromDbStream');
  }
  globalState.providerContext.dbRequest({
    dbQueryType: queryType,
    requestMsg: syncReqMsg,
    onResponse: (ctxErr, dbResult) =>{
      callback(ctxErr, dbResult);
    },
  });
}

// fake load from the database, this will return the deltas for the requester
function _fromDbStream(read) {
  return function readble(end, cb) {
    read(end, (end, data)=>{
      if (data != null) {
        _fakeFromDbStream(data, (err, dbResult)=>{
          if (err) {
            console.log('error in fakeFromDbStream {%s}', err);
            cb(err, null);
          } else {
            cb(end, dbResult);
          }
        });
      } else {
        cb(end, null);
      }
    });
  };
}

// used by _requestParserStream() this should parse the msgs from network
// into something that core can read and load from db
function _requestParser(data, callback) {
  let err = null;
  // TODO:: validate network input validity
  data = EncoderUtil.decode(data);
  let parsedData = JSON.parse(data);
  parsedData = SyncMsgBuilder.msgReqFromObjNoValidation(parsedData);
  if (parsedData === null) {
    err = 'error building request message';
  }
  return callback(err, parsedData);
}
function _requestParserStream(read) {
  return function readble(end, cb) {
    read(end, (end, data)=>{
      if (data != null) {
        _requestParser(data, (err, parsed)=>{
          if (err) {
            cb(true, null);
          } else {
            cb(end, parsed);
          }
        });
      } else {
        cb(end, null);
      }
    });
  };
}

// used by _toDbStream()
// save response (after validation) to db
// the objects are either SYNC_STATE_RES or SYNC_BCODE_RES
function fakeSaveToDb(msgObj, callback) {
  if (msgObj === null || msgObj === undefined) {
    const err = 'error saving to db';
    globalState.logger.error(err);
    return callback(err);
  }
  globalState.receiverContext.dbWrite({
    data: msgObj,
    callback: (err, status)=>{
      callback(err, status);
    },
  });
}

function _verificationStream(read) {
  return function readble(end, cb) {
    read(end, (end, data)=>{
      if (data !=null) {
        data = EncoderUtil.decode(data);
        data = JSON.parse(data);
        data = SyncMsgBuilder.msgResFromObjNoValidation(data);
        if (data == null) {
          return cb(true, null);
        }
        // TODO:: placeholder for future ethereum veirfier.
        // verify the data
        Verifier.verify(globalState.receiverContext.getRemoteMissingStatesMap(), data, (err, isOk)=>{
          if (isOk) {
            return cb(end, data);
          } else {
            return cb('Error in verification with Ethereum: ' + err, null);
          }
        });
      } else {
        return cb(end, null);
      }
    });
  };
}
