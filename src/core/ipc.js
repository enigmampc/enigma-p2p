// const nodeUtils = require('../common/utils');
// const zmq = require('zmq');
//
// class IpcClient{
//
//   constructor(uri){
//     this._socket = zmq.socket('req');
//     this._uri = uri;
//   }
//   connect(){
//     this._socket.connect(this._uri);
//     console.log("IPC connected to %s", this._uri );
//   }
//   disconnect(){
//     this._socket.disconnect(this._uri);
//   }
//   sendJson(msg){
//     if(!nodeUtils.isString(msg)){
//         msg = JSON.stringify(msg);
//     }
//     this._socket.send(msg);
//   }
//   setResponseHandler(responseCallback){
//     this._socket.on('message',(msg)=>{
//       responseCallback(JSON.parse(msg));
//     });
//   }
// }
//
// module.exports = IpcClient;
//
// /** mini test */
// // const uri = 'tcp://127.0.0.1:5555';
// // let client = new IpcClient(uri);
// // client.setResponseHandler((msg)=>{
// //   console.log("From Core %s", msg.s );
// // });
// //
// // client.connect();
// // client.sendJson({"yo":"susp??"});
// //
