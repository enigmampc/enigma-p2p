module.exports.namespace = "ipfs";
module.exports.configPath = "../../../configs/debug";
module.exports.ID_LEN = 46;

module.exports.LOG_CONFIG = {
  level: "debug",
  file: "peer.log"
};
module.exports.NODE_NOTIFICATIONS = {
  INIT_WORKER: "iw", // init https://github.com/enigmampc/enigma-p2p#overview-on-start
  DISCOVERED: "discovered", // announcing that libp2p build a new PeerInfo from given address
  GET_PEERS: "get_peers", // get number of connected peers
  NEW_PEER_CONNECTED: "connected", // announcing a new peer has connected
  // (ready to be discovered) -> 'peer:discovery' event.
  PUBSUB_PUB: "publish", // publish notification that activates a publish action
  PUBSUB_SUB: "subscribe", // subscribe to topic
  // TODO:: after PR https://github.com/ipfs/interface-js-ipfs-core/pull/437
  PUBSUB_UNSUB: "pubunsub", // unsubscribe from topic
  STATE_SYNC_REQ: "ssyncreq", // initial request from some remote peer to get states.the provider is receiving this.
  FIND_CONTENT_PROVIDER: "findcprovider", // given a list of descriptors find providers in the network
  IDENTIFY_MISSING_STATES_FROM_REMOTE: "identify", // identify the missing states, compare local with remote
  TRY_RECEIVE_ALL: "trcva", // try recieve all of the CID's
  ANNOUNCE_ENG_CIDS: "aengcids", // announce some general cids
  ANNOUNCE_LOCAL_STATE: "alc", // announce local state (after being synced)
  DB_REQUEST: "dbreq", // some db request to core
  GET_REMOTE_TIPS: "gremotetipslocal", // get the local tips of some remote peer
  GET_ALL_TIPS: "getat", // get all tips from core
  GET_TIPS: "gett", // get tips from core
  GET_ALL_ADDRS: "getaa", // get all addrs from core
  GET_DELTAS: "getds", // get deltas request from core
  GET_CONTRACT_BCODE: "getcbc", // get the bytecode of some contract
  SYNC_RECEIVER_PIPELINE: "srpl", // full sync pipeline from identify to actually try sync all action, encapsulate all actions flow
  UPDATE_DB: "udb", // request to save a new delta or bytecode in core, usually used by the receiver during sync
  PROXY: "proxy", // proxy request from jsonrpc api
  REGISTRATION_PARAMS: "rparams", // gets ethereum registration params from core,
  NEW_TASK_INPUT_ENC_KEY: "ntek", // gets a new encryption key for some requester
  SELF_KEY_SUBSCRIBE: "sks_rpc", // on start up register to self key topic (for rpc)
  START_TASK_EXEC: "stexec", // start task execution process, worker side
  ROUTE_BLOCKING_RPC: "rbrpc", // blocking rpc call for getStatus and getRegistrationParams
  ROUTE_NON_BLOCK_RPC: "rnbrpc", // non blocking rpc i.e deploy and compute
  DISPATCH_STATUS_REQ_RPC: "dissrrpc", // get task status rpc
  // task computation related
  GET_TASK_RESULT: "gltresult", // get local task result given a task id
  VERIFY_NEW_TASK: "verifyreq", // request to perform verification of task
  TASK_VERIFIED: "tverified", // request to perform a deploySecretContract or computeTask task
  TASK_FINISHED: "tfinished", // notify the task is finished, update network with result
  EXEC_TASK: "etask", // execute the task
  DEPLOY_SECRET_CONTRACT: "dscontract", // deploySecretContract jsonrpc
  RECEIVED_NEW_RESULT: "rnresult", // result updates receoved from the task results topic
  GET_TASK_STATUS: "gtstatus", // get task status
  GET_STATE_KEYS: "getstatekeys", // PTT process
  // ethereum related
  COMMIT_RECEIPT: "creceipt", // commit computation result on chain
  REGISTER: "register", // register to Enigma contract
  UNREGISTER: "unregister", // unregister from Enigma contract
  LOGIN: "login", // login to Enigma contract
  LOGOUT: "logout", // logout from Enigma contract
  GET_ETH_WORKER_PARAM: "getworkparams", // get worker params set in Enigma contract
  HEALTH_CHECK: "healthcheck",
  GET_WORKER_STATUS: "getworkstatus"
};
/** DO NOT CHANGE THE VALUES */
module.exports.PROTOCOLS = {
  PEER_DISCOVERY: "peer:discovery",
  PEER_CONNECT: "peer:connect",
  PEER_DISCONNECT: "peer:disconnect",
  ECHO: "/echo",
  FIND_PEERS: "/findpeers/0.1",
  HEARTBEAT: "/heartbeat/0.1",
  STATE_SYNC: "/sync/0.1",
  LOCAL_STATE_EXCHAGNE: "/localstateexchange/0.1"
};

/** DO NOT CHANGE THE VALUES SINCE ITS PART OF THE PROTOCOL MESSAGE FIELDS */
module.exports.P2P_MESSAGES = {
  SYNC_STATE_REQ: "SYNC_STATE_REQ",
  SYNC_STATE_RES: "SYNC_STATE_RES",
  SYNC_BCODE_REQ: "SYNC_BCODE_REQ",
  SYNC_BCODE_RES: "SYNC_BCODE_RES"
};

module.exports.PUBSUB_TOPICS = {
  BROADCAST: "/broadcast/0.1",
  TASK_RESULTS: "/taskresults/0.1"
};

module.exports.MSG_STATUS = {
  OK: 0,
  ERROR: 1,
  ERR_EMPTY_PEER_BANK: 2,
  ERR_SELF_DIAL: 3
};

module.exports.CONTENT_ROUTING = {
  // each sync req msg should consist out of RANGE_SIZE this will determine the amount of "chunks" send over the stream each time.
  RANGE_LIMIT: 10,
  TIMEOUT_FIND_PROVIDER: 180000 // 3 minutes, t.o before declaring couldn't find content provider
};
/**
 * Stat Types:
 * - CONNECTION_SUCCESS // dial success
 * - CONNECTION_FAILURE // dial failure
 * - HANDSHAKED_SUCCESS
 * - HANDSHAKE_FAILURE
 * - BLACKLIST
 * - DEBLACKLIST
 * */
module.exports.STAT_TYPES = {
  CONNECTION_SUCCESS: "CONNECTION_SUCCESS",
  CONNECTION_FAILURE: "CONNECTION_FAILURE",
  HANDSHAKE_SUCCESS: "HANDSHAKE_SUCCESS",
  HANDSHAKE_FAILURE: "HANDSHAKE_FAILURE",
  BLACKLIST: "BLACKLIST",
  DEBLACKLIST: "DEBLACKLIST"
};

// used by the main controller
// every runtime implements getType() method
module.exports.RUNTIME_TYPE = {
  CLI: "cli",
  Core: "core",
  Node: "node",
  Ethereum: "eth",
  JsonRpc: "jsonRpc"
};

/** All the notificatiosn that the MainController can handle */
module.exports.MAIN_CONTROLLER_NOTIFICATIONS = {
  DbRequest: "dbreq",
  Proxy: "proxy"
};
/** IPC core message types
 * in /docs there is  a README called IPC_MESSAGES.md# Task Result Propagation in the network
 * describing each message
 * */
// all the different requests that can be made to Core via the Ipc client
module.exports.CORE_REQUESTS = {
  CORE_DB_ACTION: "CORE_DB_ACTION", // internal for CoreRuntime
  GetRegistrationParams: "GetRegistrationParams",
  GetTip: "GetTip",
  GetTips: "GetTips",
  GetAllTips: "GetAllTips",
  GetAllAddrs: "GetAllAddrs",
  GetDelta: "GetDelta",
  GetDeltas: "GetDeltas",
  GetContract: "GetContract",
  UpdateNewContract: "UpdateNewContract",
  UpdateNewContractOnDeployment: "UpdateNewContractOnDeployment",
  RemoveContract: "RemoveContract",
  UpdateDeltas: "UpdateDeltas",
  RemoveDeltas: "RemoveDeltas",
  UpdateDb: "UpdateDb",
  NewTaskEncryptionKey: "NewTaskEncryptionKey", // jsonrpc request from remote user for encryption key
  DeploySecretContract: "DeploySecretContract", // jsonrpc request from remote use for deploying
  ComputeTask: "ComputeTask", // jsonrpc request for compute task
  FailedTask: "FailedTask", // failed task returned FROM core as a response to deploy/compute -> valid response should be commited.
  GetPTTRequest: "GetPTTRequest", // Get The PTT request from core with addresses.
  PTTResponse: "PTTResponse" // Give Core the response from the principal node.
};

// Status codes returned from core
module.exports.CORE_RESPONSE_STATUS_CODES = {
  OK: 0
};

/** Default configuration for JSON RPC Server
 */
module.exports.JSON_RPC_SERVER = {
  port: 3000
};

/**
 * Task different status (deploy,compute etc)
 * - 0 unverified , pre ethereum verification (chosen worker, inputHash,payment are the 3 things that needs to be verified)
 * - 1 in-progress , passed to core
 * - 2 - success , contains output
 * - 3 - failure , contains error status (failed computation, returned from Core)
 * */
module.exports.TASK_STATUS = {
  UNVERIFIED: "UNVERIFIED",
  IN_PROGRESS: "INPROGRESS",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  FAILED_ETHEREUM_CB: "ETHEREUMFAILURE"
};

/**
 * Ethereum Enigma contract events, defined by the different services exposed by the EthereumServices
 * */
module.exports.ETHEREUM_EVENTS = {
  NewEpoch: "NewEpoch",
  TaskCreation: "TaskCreation",
  TaskSuccessSubmission: "TaskSuccessSubmission",
  TaskFailureSubmission: "TaskFailureSubmission",
  TaskFailureDueToEthereumCB: "TaskFailureDueToEthereumCB",
  TaskCancelled: "TaskCancelled",
  SecretContractDeployment: "SecretContractDeployment"
};

/**
 * The raw Ethereum Enigma contract events
 * */
module.exports.RAW_ETHEREUM_EVENTS = {
  WorkersParameterized: "WorkersParameterized",
  TaskRecordCreated: "TaskRecordCreated",
  ReceiptVerified: "ReceiptVerified",
  ReceiptFailed: "ReceiptFailed",
  ReceiptFailedETH: "ReceiptFailedETH",
  TaskFeeReturned: "TaskFeeReturned",
  SecretContractDeployed: "SecretContractDeployed",
  Registered: "Registered",
  DepositSuccessful: "DepositSuccessful",
  WithdrawSuccessful: "WithdrawSuccessful",
  LoggedIn: "LoggedIn",
  LoggedOut: "LoggedOut",
  Unregistered: "Unregistered"
};

/**
 * Enigma Contract task status
 * */
module.exports.ETHEREUM_TASK_STATUS = {
  RECORD_UNDEFINED: 0,
  RECORD_CREATED: 1,
  RECEIPT_VERIFIED: 2,
  RECEIPT_FAILED: 3,
  RECEIPT_FAILED_ETH: 4,
  RECEIPT_FAILED_CANCELLED: 5
};

/**
 * Enigma Contract secret contract status
 * */
module.exports.ETHEREUM_SECRET_CONTRACT_STATUS = {
  UNDEFINED: 0,
  DEPLOYED: 1
};

/**
 * Enigma Contract worker status
 * */
module.exports.ETHEREUM_WORKER_STATUS = {
  UNREGISTERED: 0,
  LOGGEDIN: 1,
  LOGGEDOUT: 2
};

/**
 * Enigma Contract worker status
 * */
module.exports.ETHEREUM_EMPTY_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

module.exports.PRINCIPAL_NODE = {
  uri: "http://127.0.0.1:10101",
  retryOptions: {
    retries: 10, // try 1 time and retry 10 times if needed, total = 11
    factor: 1.7, // https://www.wolframalpha.com/input/?i=Sum%5B1000*x%5Ek,+%7Bk,+0,+9%7D%5D+%3D+5+*+60+*+1000
    minTimeout: 1 * 1000, // the number of milliseconds before starting the first retry
    maxTimeout: 2 * 60 * 1000, // the maximum number of milliseconds between two retries
    randomize: true
  },
  EPOCH_STATE_TRANSITION_ERROR_CODE: -32002
};

module.exports.ETHEREUM_REVERT_INVALID_SIG =
  "Returned error: VM Exception while processing transaction: revert Invalid signature";

module.exports.PTT_END_EVENT = "PTT";

module.exports.MINIMUM_CONFIRMATIONS = 12;

module.exports.WEB_SERVER_CONSTANTS = {
  port: 12345,
  error_code: 500,
  health: {
    url: "/healthcheck"
  },
  status: {
    url: "/status"
  },
  MGMT: {
    port: 23456,
    url: "/mgmt",
    errorCode: 500
  }
};

/**
 * Enigma Contract worker status
 * */
module.exports.WORKER_STATUS = {
  INITIALIZING: "initializing",
  UNREGISTERED: "unregistered",
  REGISTERED: "registered",
  LOGGEDIN: "logged-in"
};
