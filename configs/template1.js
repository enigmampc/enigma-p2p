module.exports = {
  "logger" : {
    "level" : "debug", // log level
    "cli" : true, // output to std
    "file" : false // output to file, if set path then will save to file else none.
  },
  "node" : {
    "network" : {
      "port" : "0", // if 0 then chose random port,
      "multiAddrs" : ["/ip4/0.0.0.0/tcp/"],
      // TODO:: ignored because of constants/namespace
      "namespace" : "ipfs",
      "bootstrapNodes" : ["/ip4/0.0.0.0/tcp/10300/ipfs/QmcrQZ6RJdpYuGvZqD5QEHAv6qX4BrQLJLQPQUrTrzdcgm"],
      // TODO:: ignored because of constants/CONSISTENT_DISCOVERY_PARAMS
      "consistentDiscovery" : {
        "persistent" : true, // do persistent discovery i.e every disconnect below lowDht
        "delay": 500, // delay between each attempt
        "maxRetry": 10, // max number of retires to reach optimal dht
        "timeout": 100000 // maxtimeout before canceling discovery
      },
      // TODO:: ignored because of constants/DHT_STATUS
      "optimalDht" : 8, // optimal number of outbound connections
      "criticalLowDht" : 5 // whenever currentPeers < criticalLowDht -> should get more peers ASAP
    },
    "idPath" : null, // load PeerId, if null-> create one
    // TODO:: ignored currently cuz of implementation
    "id" : null, // either idPath or id -> actuall object here are acceptable if both are set, idPath is the default
    // TODO:: ignored libp2p-bundle
    "isDiscover" : true, // should do discovery ?
    // the inner task manager of the node controller
    "taskManager" : {
      "dbPath" : null // the db path for storage, if null saves in default
    },
    // epoch related config
    "principalNode" : {
      "uri" : null //principal node url,  default if null
    }
  },
  // IPC
  "core" : {
    "uri" : "tcp://127.0.0.1:5552" // ipc uri
  },
  // JsonRpc config
  "proxy" : {
    "withProxy" : true, // default serve as a proxy node
    "port" : null // integer or null will default in constants
  },
  // Ethereum related configuration
  "ethereum" :{
    //default use ethereum or not
    "withEthereum" : false,
    // websocket provider
    "ethereumWebsocketProvider" : "",
    // enigma contract address
    "enigmaContractAddress" : ""
  },
  // TODO:: CURRENTLY IGNORED
  "dev:":{
    "truffleDir" : ""
  }
};
