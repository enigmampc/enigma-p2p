const Messages = require("../policy/p2p_messages/messages");
const PeerId = require("peer-id");
const PeerInfo = require("peer-info");
const randomize = require("randomatic");
const defaultsDeep = require("@nodeutils/defaults-deep");
const pickRandom = require("pick-random");
const mafmt = require("mafmt");
const multiaddr = require("multiaddr");
const timestamp = require("unix-timestamp");
const rimraf = require("rimraf");
const zlib = require("zlib");
const fs = require("fs");

/**
 * Simply sleep
 * @param {Integer} ms - milliseconds
 * @example `await sleep(1000)` will sleep for a second and block.
 * */
module.exports.sleep = function(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * A promisified version of readFile
 * @param {String} path - file path
 * @return {Promise}
 * */
module.exports.readFile = function(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

/** turn peerbook into parsed obj
 * @param {peerInfo} rawPeerBook
 * @return {Array}
 */
module.exports.parsePeerBook = function(rawPeerBook) {
  if (rawPeerBook == undefined || rawPeerBook == null) {
    return null;
  }
  const parsed = [];
  rawPeerBook.forEach(rp => {
    const pp = _parsePeerInfo(rp);
    if (pp != null) {
      parsed.push(pp);
    }
  });
  return parsed;
};
/** turn the libp2p peer-info into a parsed obj
 * @params {PeerInfo} , rawPeerInfo libp2p
 * @returns {peerId, connectedMultiaddr,multiAddrs}
 * */

module.exports.parsePeerInfo = function(rawPeerInfo) {
  return _parsePeerInfo(rawPeerInfo);
};

function _parsePeerInfo(rawPeerInfo) {
  if (rawPeerInfo == undefined || rawPeerInfo == null) {
    return null;
  }

  const multiAddrs = [];
  rawPeerInfo.multiaddrs.forEach(ma => {
    multiAddrs.push(ma.toString());
  });
  const parsedPeerInfo = {
    peerId: rawPeerInfo.id.toJSON(),
    connectedMultiaddr: rawPeerInfo._connectedMultiaddr.toString(),
    multiAddrs: multiAddrs
  };
  return parsedPeerInfo;
}

/** Generate a random id out of Aa0 in len 12
 * for the JSONRPC id parameter.
 * @return {String} random
 * */
module.exports.randId = function() {
  return randomize("Aa0", 12);
};

/** Map a connection stream to a HeartBeat response Message
 * @param {Buffer} data, stream data
 * @return {HeartBeatResMsg} hb response
 * */
module.exports.toHeartBeatResMsg = function(data) {
  const hb = data.toString("utf8").replace("\n", "");
  return new Messages.HeartBeatResMsg(hb);
};
/** Map a connection stream to a HeartBeat request Message
 * @param {Buffer} data, stream data
 * @return {HeartBeatReqMsg} hb request
 * */
module.exports.toHeartBeatReqMsg = function(data) {
  const hb = data.toString("utf8").replace("\n", "");
  return new Messages.HeartBeatReqMsg(hb);
};

/** Map a connection stream to a findpeers request msg
 * @param {Buffer} data ,
 * @return {HeartBeatReqMsg}*/
module.exports.toFindPeersReqMsg = function(data) {
  const fp = data.toString("utf8").replace("\n", "");
  return new Messages.FindPeersReqMsg(fp);
};

/** Map a connection stream to a findpeers response msg
 * @param {Buffer} data ,
 * @return {FindPeersResMsg}*/
module.exports.toFindPeersResMsg = function(data) {
  const fp = data.toString("utf8").replace("\n", "");
  return new Messages.FindPeersResMsg(fp);
};

/** Extract the peer id B58 from a multiaddr (bootstrapNodes)
 * @param {String} url
 * @return {String} id, base 58
 * */
module.exports.extractId = function(url) {
  if (!_isIpfs(url)) {
    return null;
  } else {
    return url.substring(url.length - 46, url.length);
  }
};

module.exports.isString = function(x) {
  return Object.prototype.toString.call(x) === "[object String]";
};

module.exports.isFunction = function(functionToCheck) {
  return functionToCheck && {}.toString.call(functionToCheck) === "[object Function]";
};
/** update the delta patch to a json object from a smaller json
 * @param {JSON} main
 * @param {JSON} patch
 * @return {JSON} updated, the result with the patch
 * */
module.exports.applyDelta = function(main, patch) {
  const updated = defaultsDeep(patch, main);
  return updated;
};

/** get current timestamp in unix format
 * @return {number} now e.g 1537191762.112
 */
module.exports.unixTimestamp = function() {
  return timestamp.now();
};
/**
 * get 24 hours in unixtimes stamp
 * */
module.exports.unixDay = () => {
  return timestamp.Day;
};
/** Turn a 1 level distionary to a list
 * @param {dictionary} dictionary
 * @return {Array}
 */
module.exports.dictToList = function(dictionary) {
  const list = [];
  Object.keys(dictionary).forEach(function(key) {
    list.push(dictionary[key]);
  });
  return list;
};

/** pick a random number of elements from a list
 * @param {Array} list - list of elements to chose from
 * @param {Integer} num - if num =0 || num> list size return all list
 * @return {Array}
 */
module.exports.pickRandomFromList = function(list, num) {
  if (num <= 0 || num >= list.length) {
    return list;
  }
  return pickRandom(list, { count: num });
};

/** check if a connection string is an IPFS address
 * @param {String} addr, /ip4/0.0.0.0/tcp/10333/ipfs/QmcrQZ6RJdpYuGvZqD5QEHAv6qX4BrQLJLQPQUrTrzdcgm
 * @return {Boolean} bool, true if isIpfs false otherwise.
 * */
module.exports.isIpfs = function(addr) {
  return _isIpfs(addr);
};

/** turn a seed from the peer bank into PeerInfo class*
 * @param {Json} seed https://paste.ubuntu.com/p/YMq9dvHkkS/
 * @param {Function} callback , (err,peerInfo)=>{}
 */

module.exports.peerBankSeedtoPeerInfo = function(seed, callback) {
  if (PeerInfo.isPeerInfo(seed)) {
    callback(null, seed);
  } else {
    PeerInfo.create(seed.peerId, (err, peerInfo) => {
      if (err) {
        callback(err, null);
      }

      if (seed.multiAddrs) {
        seed.multiAddrs.forEach(ma => {
          if (_isIpfs(ma)) {
            peerInfo.multiaddrs.add(ma);
          }
        });
      }
      callback(err, peerInfo);
    });
  }
};

/**
 * Connection string to PeerInfo
 * @param {String} addr,/ip4/0.0.0.0/tcp/10333/ipfs/QmcrQZ6RJdpYuGvZqD5QEHAv6qX4BrQLJLQPQUrTrzdcgm
 * @param {Function} onResult , (err,PeerInfo)=>{}
 * */
module.exports.connectionStrToPeerInfo = function(addr, onResult) {
  _connectionStrToPeerInfo(addr, onResult);
};

function _isIpfs(addr) {
  try {
    return mafmt.IPFS.matches(addr);
  } catch (e) {
    return false;
  }
}

function _connectionStrToPeerInfo(candidate, onResult) {
  if (!_isIpfs(candidate)) {
    onResult(new Error("Invalid multiaddr"), null);
  }

  const ma = multiaddr(candidate);

  const peerId = PeerId.createFromB58String(ma.getPeerId());

  PeerInfo.create(peerId, (err, peerInfo) => {
    if (err) {
      onResult(err, null);
    } else {
      peerInfo.multiaddrs.add(ma);
      onResult(err, peerInfo);
    }
  });
}

/**
 * same as rm -rf <some folder>
 *   @param {string} path
 *   @param {function} callback ()=>{}
 */
module.exports.deleteFolderFromOSRecursive = function(path, callback) {
  rimraf(path, callback);
};

/**
 *  create PeerId from b58 string id
 *  @param {string} b58Id base 58 id
 *  @return {PeerId} peerId
 * */

module.exports.b58ToPeerId = b58Id => {
  return PeerId.createFromB58String(b58Id);
};

/**
 * Removes '0x' from a hex string, if present
 *
 * @param {string} hexString
 * @return {string}
 */
module.exports.remove0x = function(hexString) {
  if (module.exports.isString(hexString)) {
    if (hexString.substring(0, 2) === "0x") {
      return hexString.substring(2);
    } else {
      return hexString;
    }
  } else {
    return null;
  }
};

/**
 * Adds '0x' to a hex string, if not present
 *
 * @param {string} hexString
 * @return {string}
 */
module.exports.add0x = function(hexString) {
  if (module.exports.isString(hexString)) {
    if (hexString.substring(0, 2) === "0x") {
      return hexString;
    } else {
      return "0x" + hexString;
    }
  } else {
    return null;
  }
};

/** Compress using GZIP
 *  @param {Buffer} buffer to compress
 *  @return {Promise}
 * */
module.exports.gzip = function gzip(buffer) {
  return new Promise((resolve, reject) => {
    zlib.gzip(buffer, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
};

/** Unzip using GZIP
 *  @param {Buffer} compressed buffer
 *  @return {Promise}
 * */
module.exports.gunzip = function gunzip(buffer) {
  return new Promise((resolve, reject) => {
    zlib.gunzip(buffer, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
};

/** Get the current Ethereum block number
 *  @param {Web3} The web3 instance
 *  @return {Promise} number
 * */
module.exports.getEthereumBlockNumber = web3 => {
  return new Promise((resolve, reject) => {
    web3.eth.getBlockNumber((error, data) => (error ? reject(error) : resolve(data)));
  });
};

/**
 * Transform a list of states to a corresponding map.
 * @param {Array<Object>} statesList - list of states in the format {address, key, data}
 * @return {Object} a map whose keys are addresses and each object is a map of states (key=>data)
 * */
module.exports.transformStatesListToMap = statesList => {
  const statesMap = {};
  for (let i = 0; i < statesList.length; ++i) {
    const address = JSON.stringify(statesList[i].address);
    if (!(address in statesMap)) {
      statesMap[address] = {};
    }
    const key = statesList[i].key;
    const delta = statesList[i].data;
    statesMap[address][key] = delta;
  }
  return statesMap;
};
