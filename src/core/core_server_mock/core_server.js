const zmq = require('zeromq');
const constants = require('../../common/constants');
const MsgTypes = constants.CORE_REQUESTS;
const quote = 'AgAAANoKAAAHAAYAAAAAABYB+Vw5ueowf+qruQGtw+54eaWW7MiyrIAooQw/uU3eBAT/////AAAAAAAAAAAAAAAAAAAAAAAAAAAAA'+
              'AAAAAAAAAAAAAAAAAAAAAAAAAAABwAAAAAAAAAHAAAAAAAAALcVy53ugrfvYImaDi1ZW5RueQiEekyu/HmLIKYvg6OxAAAAAAAAAA'+
              'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACD1xnnferKFHD2uvYqTXdDA8iZ22kCD5xw7h38CMfOngAAAAAAAAAAAAAAAAAAAAAAAAA'+
              'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'+
              'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACGcCDM4cgbYe6zQ'+
              'SwWQINFsDvd21kXGeteDakovCXPDwjJ31WG0K+wyDDRo8PFi293DtIr6DgNqS/guQSkglPJqAIAALbvs91Ugh9/yhBpAyGQPth+UW'+
              'XRboGkTaZ3DY8U+Upkb2NWbLPkXbcMbB7c3SAfV4ip/kPswyq0OuTTiJijsUyOBOV3hVLIWM4f2wVXwxiVRXrfeFs/CGla6rGdRQp'+
              'Fzi4wWtrdKisVK5+Cyrt2y38Ialm0NqY9FIjxlodD9D7TC8fv0Xog29V1HROlY+PvRNa+f2qp858w8j+9TshkvOAdE1oVzu0F8Kyl'+
              'bXfsSXhH7d+n0c8fqSBoLLEjedoDBp3KSO0bof/uzX2lGQJkZhJ/RSPPvND/1gVj9q1lTM5ccbfVfkmwdN0B5iDA5fMJaRz5o8SVI'+
              'Lr3uWoBiwx7qsUceyGX77tCn2gZxfiOICNrpy3vv384TO2ovkwvhq1Lg071eXAlxQVtPvRYOGgBAABydn7bEWdP2htRd46nBkGIAo'+
              'NAnhMvbGNbGCKtNVQAU0N9f7CROLPOTrlw9gVlKK+G5vM1X95KTdcOjs8gKtTkgEos021zBs9R+whyUcs9npo1SJ8GzowVwTwWfVz'+
              '9adw2jL95zwJ/qz+y5x/IONw9iXspczf7W+bwyQpNaetO9xapF6aHg2/1w7st9yJOd0OfCZsowikJ4JRhAMcmwj4tiHovLyo2fpP3'+
              'SiNGzDfzrpD+PdvBpyQgg4aPuxqGW8z+4SGn+vwadsLr+kIB4z7jcLQgkMSAplrnczr0GQZJuIPLxfk9mp8oi5dF3+jqvT1d4CWhR'+
              'wocrs7Vm1tAKxiOBzkUElNaVEoFCPmUYE7uZhfMqOAUsylj3Db1zx1F1d5rPHgRhybpNpxThVWWnuT89I0XLO0WoQeuCSRT0Y9em1'+
              'lsozSu2wrDKF933GL7YL0TEeKw3qFTPKsmUNlWMIow0jfWrfds/Lasz4pbGA7XXjhylwum8e/I';
const DbUtils = require('../../common/DbUtils');
const DB_PROVIDER = require('./data/provider_db');
const randomize = require('randomatic');
let socket;
let globalUri;
let isProvider = false;
let signKey = null;

module.exports.setProvider= (_isProvider)=>{
  isProvider = _isProvider;
};

module.exports.disconnect = ()=>{
  socket.disconnect(globalUri);
};
module.exports.runServer = (uri)=>{
  globalUri = uri;
  socket = zmq.socket('rep');
  socket.bindSync(uri);
  console.log('Server mock on %s ', uri);

  socket.on('message', (msg)=>{
    msg = JSON.parse(msg);
    console.log('[Mock Server] got msg! ', msg);
    switch (msg.type) {
      case MsgTypes.GetRegistrationParams:
        const response = getRegistrationParams(msg);
        send(socket, response);
        break;
      case MsgTypes.GetAllTips:
        const tips = getAllTips(msg);
        send(socket, tips);
        break;
      case MsgTypes.GetAllAddrs:
        const addrs = getAllAddrs(msg);
        send(socket, addrs);
        break;
      case MsgTypes.GetDeltas:
        const deltas = getDeltas(msg);
        send(socket, deltas);
        break;
      case MsgTypes.GetContract:
        const contract = getContract(msg);
        send(socket, contract);
        break;
      case MsgTypes.UpdateNewContract:
      case MsgTypes.UpdateDeltas:
        send(socket, {
          type: msg.type,
          id: msg.id,
          success: true,
        });
        break;
      case MsgTypes.NewTaskEncryptionKey:
        const encKeyMsg = getNewTaskEncryptionKey(msg);
        send(socket, encKeyMsg);
        break;
    }
  });
};


function send(socket, msg) {
  const error = {'error': 'from server error'};
  if (msg) {
    socket.send(JSON.stringify(msg));
  } else {
    socket.send(JSON.stringify(error));
  }
}


function getNewTaskEncryptionKey(msg) {
  if (signKey === null) {
    signKey = randomize('Aa0', 40 );
  }
  return {
    id: msg.id,
    type: msg.type,
    userPubKey: signKey,
    result: {
      workerEncryptionKey: '0061d93b5412c0c99c3c7867db13c4e13e51292bd52565d002ecf845bb0cfd8adfa5459173364ea8aff3fe2'+
                           '4054cca88581f6c3c5e928097b9d4d47fce12ae47',
      workerSig: 'worker-signature-with-signed-by-the-private-key-of-the-sender-key',
    },

  };
}


function getContract(msg) {
  let bcode = null;
  let contractAddr = null;
  DB_PROVIDER.forEach((entry)=>{
    if (msg.input[0] === DbUtils.toHexString(entry.address) && entry.key === -1) {
      bcode = entry.delta;
      contractAddr = DbUtils.toHexString(entry.address);
    }
  });
  return {
    type: msg.type,
    id: msg.id,
    address: contractAddr,
    bytecode: bcode,
  };
}

// input = [{address, from:key,to:key},...]
// response deltas : [{address,key,data},...]
function getDeltas(msg) {
  const response = [];
  const input = msg.input;
  const reqAddrs = input.map((r)=>{
    return r.address;
  });
  const inputMap = {};
  input.forEach((r)=>{
    inputMap[r.address] = r;
  });
  DB_PROVIDER.forEach((entry)=>{
    const dbAddr = DbUtils.toHexString(entry.address);
    const dbIndex = entry.key;
    if (inputMap[dbAddr]) {
      const from = inputMap[dbAddr].from;
      const to = inputMap[dbAddr].to;
      if (dbIndex >= from && dbIndex <= to) {
        response.push({
          address: dbAddr,
          key: dbIndex,
          data: entry.delta,
        });
      }
    }
  });
  return {
    type: msg.type,
    id: msg.id,
    deltas: response,
  };
}


function getAllAddrs(msg) {
  let addresses;
  if (isProvider) {
    addresses = DB_PROVIDER.map((o)=>{
      if (o.key < 0) {
        return DbUtils.toHexString(o.address);
      } else {
        return [];
      }
    }).filter((o)=>{
      return o.length > 0;
    });
  } else {
    addresses = TIPS.map((tip)=>{
      return DbUtils.toHexString(tip.address);
    });
  }
  return {
    type: msg.type,
    id: msg.id,
    result: {
      addresses: addresses,
    },
  };
}
function getAllTips(msg) {
  return {
    type: msg.type,
    id: msg.id,
    tips: TIPS,
  };
}
function getRegistrationParams(msg) {
  if (signKey === null) {
    signKey = '0x' + randomize('?0', 40, {chars: 'abcdef'});
  }
  return {
    type: msg.type,
    id: msg.id,
    result: {
      signingKey: signKey,
      quote: quote,
    },
  };
}
const TIPS = [{
  address: [92, 214, 171, 4, 67, 94, 118, 195, 84, 97, 103, 199, 97, 21, 226, 55, 220, 143, 212, 246, 174, 203, 51, 171,
    28, 30, 63, 158, 131, 79, 181, 127],
  key: 10,
  delta: [171, 255, 84, 134, 4, 62, 190, 60, 15, 43, 249, 32, 21, 188, 170, 27, 22, 23, 8, 248, 158, 176, 219, 85, 175,
    190, 54, 199, 198, 228, 198, 87, 124, 33, 158, 115, 60, 173, 162, 16, 150, 13, 149, 77, 159, 158, 13, 213, 171, 154,
    224, 241, 4, 42, 38, 120, 66, 253, 127, 201, 113, 252, 246, 177, 218, 155, 249, 166, 68, 65, 231, 208, 210, 116, 89,
    100, 207, 92, 200, 194, 48, 70, 71, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 214, 256, 22, 229, 31,
    56, 90, 104, 16, 241, 108, 14, 126, 116, 91, 106, 10, 141, 122, 78, 214, 148, 194, 14, 31, 96, 142, 178, 96, 150,
    52, 142, 138, 37, 209, 110, 153, 185, 96, 236, 44, 46, 192, 138, 108, 168, 91, 145, 153, 60, 88, 7, 229, 183, 174,
    187, 204, 233, 54, 89, 107, 16, 237, 247, 66, 76, 39, 82, 253, 160, 2, 1, 133, 210, 135, 94, 144, 211, 23, 61, 150,
    36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213, 88, 135, 204, 213, 199, 50, 191, 7,
    61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222, 73, 175, 207, 222, 86, 42, 236, 92, 194,
    214, 28, 195, 236, 122, 122, 77, 134, 55, 41, 209, 106, 172, 10, 130, 139, 149, 39, 196, 181, 187, 55, 166, 237,
    215, 135, 98, 90, 12, 6, 72, 240, 138, 112, 99, 76, 55, 22, 231, 223, 153, 119, 15, 98, 26, 77, 139, 89, 64, 24,
    108, 137, 118, 38, 142, 19, 131, 220, 252, 248, 212, 120, 231, 26, 21, 228, 246, 179, 104, 207, 76, 218, 144, 90,
    20, 76, 41, 98, 111, 25, 84, 7, 71, 84, 27, 124, 190, 86, 16, 136, 16, 198, 76, 215, 164, 228, 117, 182, 238, 213,
    52, 253, 105, 152, 215, 197, 95, 244, 65, 186, 140, 45, 167, 114, 24, 139, 199, 179, 116, 105, 181],
}, {
  address: [11, 214, 171, 4, 67, 23, 118, 195, 84, 34, 103, 199, 97, 21, 226, 55, 220, 143, 212, 246, 174, 203, 51, 171,
    28, 30, 63, 158, 131, 64, 181, 200],
  key: 34,
  delta: [11, 255, 84, 134, 4, 62, 190, 60, 15, 43, 249, 32, 21, 188, 170, 27, 22, 23, 8, 248, 158, 176, 219, 85, 175,
    190, 54, 199, 198, 228, 198, 87, 124, 33, 158, 115, 60, 173, 162, 16, 150, 13, 149, 77, 159, 158, 13, 213, 171, 154,
    224, 241, 4, 42, 38, 120, 66, 253, 127, 201, 113, 252, 246, 177, 218, 155, 249, 166, 68, 65, 231, 208, 210, 116, 89,
    100, 207, 92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37, 16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31,
    56, 90, 104, 16, 241, 108, 14, 126, 116, 91, 106, 10, 141, 122, 78, 214, 148, 194, 14, 31, 96, 142, 178, 96, 150,
    52, 142, 138, 37, 209, 110, 153, 185, 96, 236, 44, 46, 192, 138, 108, 168, 91, 145, 153, 60, 88, 7, 229, 183, 174,
    187, 204, 233, 54, 89, 107, 16, 237, 247, 66, 76, 39, 82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150,
    36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213, 88, 135, 204, 213, 199, 50, 191, 7,
    61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222, 73, 175, 207, 222, 86, 42, 236, 92, 194,
    214, 28, 195, 236, 122, 122, 12, 134, 55, 41, 209, 106, 172, 10, 130, 139, 149, 39, 196, 181, 187, 55, 166, 237,
    215, 135, 98, 90, 12, 6, 72, 240, 138, 112, 99, 76, 55, 22, 231, 223, 153, 119, 15, 98, 26, 77, 139, 89, 64, 24,
    108, 137, 118, 38, 142, 19, 131, 220, 252, 248, 212, 120, 231, 26, 21, 228, 246, 179, 104, 207, 76, 218, 144, 141,
    221, 46, 22, 81, 13, 87, 209, 68, 197, 189, 10, 130, 182, 34, 16, 198, 180, 90, 20, 76, 41, 98, 111, 25, 84, 7, 71,
    84, 27, 124, 190, 86, 16, 136, 16, 198, 76, 215, 164, 228, 117, 182, 238, 213, 52, 253, 105, 152, 215, 197, 95, 244,
    65, 186, 140, 45, 167, 114],
},
{
  address: [76, 214, 171, 4, 67, 23, 118, 195, 84, 56, 103, 199, 97, 21, 226, 55, 220, 54, 212, 246, 174, 203, 51, 171,
    28, 30, 63, 158, 131, 64, 181, 33],
  key: 0,
  delta: [150, 13, 149, 77, 159, 158, 13, 213, 171, 154, 224, 241, 4, 42, 38, 120, 66, 253, 127, 201, 113, 252, 246,
    177, 218, 155, 249, 166, 68, 65, 231, 208, 210, 116, 89, 100, 207, 92, 200, 194, 48, 70, 123, 210, 240, 15, 213, 37,
    16, 235, 133, 77, 158, 220, 171, 33, 256, 22, 229, 31, 82, 253, 160, 2, 1, 133, 12, 135, 94, 144, 211, 23, 61, 150,
    36, 31, 55, 178, 42, 128, 60, 194, 192, 182, 190, 227, 136, 133, 252, 128, 213, 88, 135, 204, 213, 199, 50, 191, 7,
    61, 104, 87, 210, 127, 76, 163, 11, 175, 114, 207, 167, 26, 249, 222, 222, 73, 175, 207, 222, 86, 42, 236, 92, 194,
    214, 28, 195, 236, 122, 122, 12, 134, 55, 41, 209, 106, 172, 10, 130, 139, 149, 39, 196, 181, 187, 55, 166, 237,
    215, 135, 98, 90, 12, 6, 72, 240, 138, 112, 99, 76, 55, 22, 231, 223, 153, 119, 15, 98, 26, 77, 139, 89, 64, 24,
    108, 137, 118, 38, 142, 19, 131, 220, 252, 248, 212, 120, 231, 26, 21, 228, 246, 179, 104, 207, 76, 218, 88],
}];

