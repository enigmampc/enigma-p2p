const tree = require("./test_tree").TEST_TREE.healthcheck;
const assert = require("assert");
const http = require("http");
const testBuilder = require("./testUtils/quickBuilderUtil");
const testUtils = require("./testUtils/utils");
const constants = require("../src/common/constants");

const noLoggerOpts = {
  bOpts: {
    withLogger: true
  },
  pOpts: {
    withLogger: true
  }
};

const stopTest = async (peers, bNodeController, bNodeCoreServer, resolve) => {
  let pPaths = peers.map(p => {
    return p.tasksDbPath;
  });
  for (let i = 0; i < pPaths.length; ++i) {
    await peers[i].mainController.shutdownSystem();
    peers[i].coreServer.disconnect();
  }
  await bNodeController.shutdownSystem();
  bNodeCoreServer.disconnect();
  resolve();
};

it("#1 Perform healthCheck", async function() {
  if (!tree["all"] || !tree["#1"]) {
    this.skip();
  }
  return new Promise(async resolve => {
    const peersNum = 5;
    const hcPort = 9898;
    const hcUrl = "/hc";
    // init nodes
    let { peers, bNode } = await testBuilder.createN(peersNum, noLoggerOpts);
    await testUtils.sleep(4000);
    let bNodeController = bNode.mainController;
    let bNodeCoreServer = bNode.coreServer;
    // start the tested node
    const testPeer = await testBuilder.createNode({
      withEth: true,
      webserver: { healthCheck: { port: hcPort, url: hcUrl } }
    });
    await testUtils.sleep(12000);

    // request the check using the web server
    http.get({ hostname: "localhost", port: hcPort, path: hcUrl }, async res => {
      //assert.strictEqual(res.statusMessage, "OK");
      assert.strictEqual(res.statusCode, 200);
      res.setEncoding("utf8");
      let rawData = "";
      res.on("data", chunk => {
        rawData += chunk;
      });
      res.on("end", async () => {
        const healthCheckResult = JSON.parse(rawData);
        assert.strictEqual(healthCheckResult.core.status, true);
        assert.strictEqual(healthCheckResult.core.registrationParams.signKey.length, 42);
        assert.strictEqual(healthCheckResult.ethereum.status, true);
        assert.strictEqual(healthCheckResult.connectivity.status, true);
        assert.strictEqual(healthCheckResult.connectivity.connections, peersNum + 1);
        // STOP EVERYTHING
        peers.push(testPeer);
        await stopTest(peers, bNodeController, bNodeCoreServer, resolve);
      });
    });
  });
});
