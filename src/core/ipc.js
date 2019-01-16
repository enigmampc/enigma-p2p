const nodeUtils = require('../common/utils');
const zmq = require('zeromq');
const EventEmitter = require('events').EventEmitter;
const constants = require('../common/constants');
const Logger = require('../common/logger');


class IpcClient extends EventEmitter {
  constructor(uri, logger) {
    super();
    this._socket = zmq.socket('req');
    this._uri = uri;

    if (logger) {
      this._logger = logger;
    } else {
      this._logger = new Logger({
        'level': 'debug',
        'cli': true,
      });
    }

    // map msg id's for sequential tasks
    // delete the callbacks after use.
    this._msgMapping = {};
    this._initContextListener();
  }
  connect() {
    this._socket.connect(this._uri);
    this._logger.debug('IPC connected to ' + this._uri );
  }
  disconnect() {
    this._socket.disconnect(this._uri);
  }
  sendJson(msg) {
    if (!nodeUtils.isString(msg)) {
      msg = JSON.stringify(msg);
    }
    this._socket.send(msg);
  }
  _initContextListener(){
    this._socket.on('message',(msg)=>{
      msg = JSON.parse(msg);
      let callback = this._msgMapping[msg.id];
      if(callback){
        callback(msg);
        // clear memory
        this._msgMapping[msg.id] = null;
      }
    });
  }
  /** Send a JSON message and trigger a callback once there's a response.
   * A unique msg.id is used to identify each response and its callback
   * @param {JSON} msg, must have id field
   * @param {Function} callback , (msg)=>{}
   * */
  sendJsonAndReceive(msg,callback){
    this._msgMapping[msg.id] = callback;
    if(!nodeUtils.isString(msg)){
      msg = JSON.stringify(msg);
    }
    this._socket.send(msg);
  }
  /** General response callback that will be called for every incoming message
   * Usage example - logging
   * @param {Function} responseCallback
   * */
  setResponseHandler(responseCallback) {
    this._socket.on('message', (msg)=>{
      msg = JSON.parse(msg);
      this.emit('message', msg);
      responseCallback(msg);
    });
  }
}

module.exports = IpcClient;

// /** mini test */
// const uri = 'tcp://127.0.0.1:5555';
// let client = new IpcClient(uri);
// client.setResponseHandler((msg)=>{
//   console.log("From Core %s", msg.s );
// });
//
// client.connect();
// client.sendJson({"yo":"susp??"});
//
