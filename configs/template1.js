module.exports = {
  logger: {
    level: "debug", // log level
    cli: true, // output to std
    file: false // output to file, if set path then will save to file else none.
  },
  node: {
    network: {
      port: "0", // if 0 then chose random port,
      multiAddrs: ["/ip4/0.0.0.0/tcp/"],
      // TODO:: ignored because of constants/namespace
      namespace: "ipfs"
    },
    idPath: null, // load PeerId, if null-> create one
    // TODO:: ignored currently cuz of implementation
    id: null, // either idPath or id -> actuall object here are acceptable if both are set, idPath is the default
    // TODO:: ignored libp2p-bundle
    isDiscover: true, // should do discovery ?
    // the inner task manager of the node controller
    taskManager: {
      dbPath: null // the db path for storage, if null saves in default
    },
    // epoch related config
    // TODO:: ignored because of constants/PRINCIPAL_NODE
    principalNode: {
      uri: null, //principal node url,  default if null
      retryOptions: {
        retries: 10, // try 1 time and retry 10 times if needed, total = 11
        factor: 1.7, // https://www.wolframalpha.com/input/?i=Sum%5B1000*x%5Ek,+%7Bk,+0,+9%7D%5D+%3D+5+*+60+*+1000
        minTimeout: 1 * 1000, // the number of milliseconds before starting the first retry
        maxTimeout: 2 * 60 * 1000, // the maximum number of milliseconds between two retries
        randomize: true
      }
    }
  },
  // IPC
  core: {
    uri: "tcp://127.0.0.1:5552" // ipc uri
  },
  // JsonRpc config
  proxy: {
    withProxy: true, // default serve as a proxy node
    port: null // integer or null will default in constants
  },
  // Ethereum related configuration
  ethereum: {
    //default use ethereum or not
    withEthereum: false,
    // websocket provider
    ethereumWebsocketProvider: "",
    // enigma contract address
    enigmaContractAddress: ""
  },
  // TODO:: CURRENTLY IGNORED
  "dev:": {
    truffleDir: ""
  }
};
