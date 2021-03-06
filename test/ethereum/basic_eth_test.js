const path = require("path");
const assert = require("assert");
const EnigmaContractAPIBuilder = require(path.join(__dirname, "../../src/ethereum/EnigmaContractAPIBuilder"));
const testParameters = require("./test_parameters.json");
const constants = require("../../src/common/constants");
const utils = require("../../src/common/utils");
const Web3 = require("web3");
const ethTestUtils = require("./utils");
const TEST_TREE = require("../test_tree").TEST_TREE;

const WORKER_WEI_VALUE = 100000000000000000;

describe("Ethereum API tests (TODO: use enigmejs instead)", function() {
  function eventSubscribe(api, eventName, filter, callback) {
    api.subscribe(eventName, filter, callback);
  }

  function getEventRecievedFunc(eventName, resolve) {
    return (err, event) => {
      resolve(event);
    };
  }

  // GLOBALS
  let res, workerAccount;
  let accounts, workerEnclaveSigningAddress, workerAddress, workerReport, signature, api;

  async function init(minConfirmations) {
    const w3 = new Web3();

    const workerAccount = w3.eth.accounts.create();
    const stakingAccount = w3.eth.accounts.create();
    const builder = new EnigmaContractAPIBuilder();
    const res = await builder
      .setOperationalKey(workerAccount.privateKey)
      .setStakingAddress(stakingAccount.address)
      .setMinimunConfirmations(minConfirmations)
      .createNetwork()
      .deploy()
      .build();
    const web3 = res.api.w3();
    const accounts = await web3.eth.getAccounts();
    // transfer money to worker address
    await web3.eth.sendTransaction({
      from: accounts[4],
      to: workerAccount.address,
      value: WORKER_WEI_VALUE
    });
    return { res, workerAccount, builder };
  }

  async function stop() {
    api.unsubscribeAll();
    await res.environment.destroy();
  }

  async function start() {
    const x = await init(constants.MINIMUM_CONFIRMATIONS);
    res = x.res;
    workerAccount = x.workerAccount;

    api = res.api;
    accounts = await api.w3().eth.getAccounts();
    workerEnclaveSigningAddress = accounts[3];
    workerAddress = workerAccount.address;
    workerReport = testParameters.report;
    signature = api.w3().utils.randomHex(32);
  }

  it("check default minConfirmation is set", async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree["all"] || !tree["#1"]) {
      this.skip();
    }
    await start();
    assert.strictEqual(api.minimumConfirmations, constants.MINIMUM_CONFIRMATIONS);
    await stop();
  });

  it("check non-default minConfirmation is set", async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree["all"] || !tree["#2"]) {
      this.skip();
    }
    await start();
    await res.environment.destroy();

    const x = await init(15);
    res = x.res;
    api = res.api;
    assert.strictEqual(api.minimumConfirmations, 15);
    await stop();
  });

  it("worker register", async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree["all"] || !tree["#3"]) {
      this.skip();
    }
    await start();
    const registerPromise = api.register(workerEnclaveSigningAddress, workerReport, signature, { from: workerAddress });
    ethTestUtils.advanceXConfirmations(api.w3());
    await registerPromise;

    const worker = await api.getWorker(workerAddress);
    assert.strictEqual(worker.status, constants.ETHEREUM_WORKER_STATUS.LOGGEDOUT);
    await stop();
  });

  it("worker register event", async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree["all"] || !tree["#4"]) {
      this.skip();
    }
    return new Promise(async resolve => {
      await start();
      eventSubscribe(
        api,
        constants.RAW_ETHEREUM_EVENTS.Registered,
        {},
        getEventRecievedFunc(constants.RAW_ETHEREUM_EVENTS.Registered, async result => {
          assert.strictEqual(result.signer, workerEnclaveSigningAddress);
          assert.strictEqual(result.workerAddress, workerAddress);

          const worker = await api.getWorker(workerAddress);
          assert.strictEqual(worker.status, constants.ETHEREUM_WORKER_STATUS.LOGGEDOUT);
          await stop();
          resolve();
        })
      );

      api.register(workerEnclaveSigningAddress, workerReport, signature, {
        from: workerAddress
      });
      ethTestUtils.advanceXConfirmations(api.w3());
    });
  });

  it("worker login", async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree["all"] || !tree["#5"]) {
      this.skip();
    }
    await start();
    const registerPromise = api.register(workerEnclaveSigningAddress, workerReport, signature, { from: workerAddress });
    ethTestUtils.advanceXConfirmations(api.w3());
    await registerPromise;

    const loginPromise = api.login({ from: workerAddress });
    ethTestUtils.advanceXConfirmations(api.w3());
    await loginPromise;

    const worker = await api.getWorker(workerAddress);
    assert.strictEqual(worker.status, constants.ETHEREUM_WORKER_STATUS.LOGGEDIN);
    await stop();
  });

  it("worker login event", async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree["all"] || !tree["#6"]) {
      this.skip();
    }
    return new Promise(async resolve => {
      await start();
      const registerPromise = api.register(workerEnclaveSigningAddress, workerReport, signature, {
        from: workerAddress
      });
      ethTestUtils.advanceXConfirmations(api.w3());
      await registerPromise;

      eventSubscribe(
        api,
        constants.RAW_ETHEREUM_EVENTS.LoggedIn,
        {},
        getEventRecievedFunc(constants.RAW_ETHEREUM_EVENTS.LoggedIn, async result => {
          assert.strictEqual(result.workerAddress, workerAddress);
          const worker = await api.getWorker(workerAddress);
          assert.strictEqual(worker.status, constants.ETHEREUM_WORKER_STATUS.LOGGEDIN);
          await stop();
          resolve();
        })
      );

      api.login({ from: workerAddress });
      ethTestUtils.advanceXConfirmations(api.w3());
    });
  });

  it('"verify" worker enclave report', async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree["all"] || !tree["#7"]) {
      this.skip();
    }
    await start();
    const registerPromise = api.register(workerEnclaveSigningAddress, workerReport, signature, { from: workerAddress });
    ethTestUtils.advanceXConfirmations(api.w3());
    await registerPromise;

    const worker = await api.getWorker(workerAddress);
    const { report } = await api.getReport(workerAddress);
    assert.strictEqual(worker.report, report);
    assert.strictEqual(worker.report, workerReport);
    await stop();
  });

  it("worker deploy secret contract", async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree["all"] || !tree["#8"]) {
      this.skip();
    }
    await start();
    const registerPromise = api.register(workerEnclaveSigningAddress, workerReport, signature, { from: workerAddress });
    ethTestUtils.advanceXConfirmations(api.w3());
    await registerPromise;

    const loginPromise = api.login({ from: workerAddress });
    ethTestUtils.advanceXConfirmations(api.w3());
    await loginPromise;

    const countSCsBefore = await api.countSecretContracts();
    assert.strictEqual(countSCsBefore, 0);

    const secretContractAddress = utils.remove0x(api.w3().utils.randomHex(32));
    const codeHash = api.w3().utils.sha3(JSON.stringify(testParameters.bytecode));
    const initStateDeltaHash = api.w3().utils.randomHex(32);
    const zeroAddress = "0x0000000000000000000000000000000000000000";
    const gasUsed = 10;

    const deployPromise = api.deploySecretContract(
      secretContractAddress,
      codeHash,
      codeHash,
      initStateDeltaHash,
      "0x00",
      zeroAddress,
      gasUsed,
      workerEnclaveSigningAddress,
      { from: workerAddress }
    );
    ethTestUtils.advanceXConfirmations(api.w3());
    const result = await deployPromise;

    assert.strictEqual(result.SecretContractDeployed.codeHash, codeHash);
    assert.strictEqual(result.SecretContractDeployed.secretContractAddress, secretContractAddress);
    assert.strictEqual(result.SecretContractDeployed.stateDeltaHash, initStateDeltaHash);

    const countSCsAfter = await api.countSecretContracts();
    assert.strictEqual(countSCsAfter, 1);

    const observedCodeHash = await api.getContractParams(secretContractAddress);
    assert.strictEqual(observedCodeHash.codeHash, codeHash);
    await stop();
  });

  it("worker deploy secret contract event", async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree["all"] || !tree["#9"]) {
      this.skip();
    }
    return new Promise(async resolve => {
      await start();
      const registerPromise = api.register(workerEnclaveSigningAddress, workerReport, signature, {
        from: workerAddress
      });
      ethTestUtils.advanceXConfirmations(api.w3());
      await registerPromise;

      const loginPromise = api.login({ from: workerAddress });
      ethTestUtils.advanceXConfirmations(api.w3());
      await loginPromise;

      const countSCsBefore = await api.countSecretContracts();
      assert.strictEqual(countSCsBefore, 0);

      const secretContractAddress = utils.remove0x(api.w3().utils.randomHex(32));
      const codeHash = api.w3().utils.sha3(JSON.stringify(testParameters.bytecode));
      const initStateDeltaHash = api.w3().utils.randomHex(32);
      const zeroAddress = "0x0000000000000000000000000000000000000000";
      const gasUsed = 10;

      eventSubscribe(
        api,
        constants.RAW_ETHEREUM_EVENTS.SecretContractDeployed,
        {},
        getEventRecievedFunc(constants.RAW_ETHEREUM_EVENTS.SecretContractDeployed, async result => {
          assert.strictEqual(result.codeHash, codeHash);
          assert.strictEqual(result.secretContractAddress, secretContractAddress);
          assert.strictEqual(result.stateDeltaHash, initStateDeltaHash);

          const countSCsAfter = await api.countSecretContracts();
          assert.strictEqual(countSCsAfter, 1);

          const observedCodeHash = await api.getContractParams(secretContractAddress);
          assert.strictEqual(observedCodeHash.codeHash, codeHash);
          await stop();
          resolve();
        })
      );

      api.deploySecretContract(
        secretContractAddress,
        codeHash,
        codeHash,
        initStateDeltaHash,
        "0x00",
        zeroAddress,
        gasUsed,
        workerEnclaveSigningAddress,
        { from: workerAddress }
      );
      ethTestUtils.advanceXConfirmations(api.w3());
    });
  });

  it("worker deploy secret contract failure", async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree["all"] || !tree["#10"]) {
      this.skip();
    }
    await start();
    const registerPromise = api.register(workerEnclaveSigningAddress, workerReport, signature, { from: workerAddress });
    ethTestUtils.advanceXConfirmations(api.w3());
    await registerPromise;

    const loginPromise = api.login({ from: workerAddress });
    ethTestUtils.advanceXConfirmations(api.w3());
    await loginPromise;

    const countSCsBefore = await api.countSecretContracts();
    assert.strictEqual(countSCsBefore, 0);

    const codeHash = api.w3().utils.sha3(JSON.stringify(testParameters.bytecode));
    const gasUsed = 10;
    const taskId1 = utils.remove0x(api.w3().utils.randomHex(32));

    const deployFailurePromise = api.deploySecretContractFailure(taskId1, codeHash, gasUsed, signature, {
      from: workerAddress
    });
    ethTestUtils.advanceXConfirmations(api.w3());
    const events = await deployFailurePromise;

    assert.strictEqual(events.ReceiptFailed.taskId, taskId1);
    assert.strictEqual(events.ReceiptFailed.outputHash, codeHash);

    const countSCsAfter = await api.countSecretContracts();
    assert.strictEqual(countSCsAfter, 0);
    await stop();
  });

  it("worker deploy secret contract failure event", async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree["all"] || !tree["#11"]) {
      this.skip();
    }
    return new Promise(async resolve => {
      await start();
      const registerPromise = api.register(workerEnclaveSigningAddress, workerReport, signature, {
        from: workerAddress
      });
      ethTestUtils.advanceXConfirmations(api.w3());
      await registerPromise;

      const loginPromise = api.login({ from: workerAddress });
      ethTestUtils.advanceXConfirmations(api.w3());
      await loginPromise;

      const countSCsBefore = await api.countSecretContracts();
      assert.strictEqual(countSCsBefore, 0);

      const codeHash = api.w3().utils.sha3(JSON.stringify(testParameters.bytecode));
      const gasUsed = 10;
      const taskId1 = utils.remove0x(api.w3().utils.randomHex(32));

      eventSubscribe(
        api,
        constants.RAW_ETHEREUM_EVENTS.ReceiptFailed,
        {},
        getEventRecievedFunc(constants.RAW_ETHEREUM_EVENTS.ReceiptFailed, async event => {
          assert.strictEqual(event.taskId, taskId1);
          assert.strictEqual(event.outputHash, codeHash);
          const countSCsAfter = await api.countSecretContracts();
          assert.strictEqual(countSCsAfter, 0);
          await stop();
          resolve();
        })
      );

      api.deploySecretContractFailure(taskId1, codeHash, gasUsed, signature, {
        from: workerAddress
      });
      ethTestUtils.advanceXConfirmations(api.w3());
    });
  });

  it("worker logout", async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree["all"] || !tree["#12"]) {
      this.skip();
    }
    await start();
    const registerPromise = api.register(workerEnclaveSigningAddress, workerReport, signature, { from: workerAddress });
    ethTestUtils.advanceXConfirmations(api.w3());
    await registerPromise;

    const loginPromise = api.login({ from: workerAddress });
    ethTestUtils.advanceXConfirmations(api.w3());
    await loginPromise;

    const loggedInWorker = await api.getWorker(workerAddress);
    assert.strictEqual(loggedInWorker.status, constants.ETHEREUM_WORKER_STATUS.LOGGEDIN);

    const logoutPromise = api.logout({ from: workerAddress });
    ethTestUtils.advanceXConfirmations(api.w3());
    await logoutPromise;

    const loggedOutWorker = await api.getWorker(workerAddress);
    assert.strictEqual(loggedOutWorker.status, constants.ETHEREUM_WORKER_STATUS.LOGGEDOUT);
    await stop();
  });

  it("worker logout event", async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree["all"] || !tree["#13"]) {
      this.skip();
    }
    return new Promise(async resolve => {
      await start();
      const registerPromise = api.register(workerEnclaveSigningAddress, workerReport, signature, {
        from: workerAddress
      });
      ethTestUtils.advanceXConfirmations(api.w3());
      await registerPromise;

      const loginPromise = api.login({ from: workerAddress });
      ethTestUtils.advanceXConfirmations(api.w3());
      await loginPromise;

      eventSubscribe(
        api,
        constants.RAW_ETHEREUM_EVENTS.LoggedOut,
        {},
        getEventRecievedFunc(constants.RAW_ETHEREUM_EVENTS.LoggedOut, async result => {
          assert.strictEqual(result.workerAddress, workerAddress);
          const worker = await api.getWorker(workerAddress);
          assert.strictEqual(worker.status, constants.ETHEREUM_WORKER_STATUS.LOGGEDOUT);
          await stop();
          resolve();
        })
      );

      api.logout({ from: workerAddress });
      ethTestUtils.advanceXConfirmations(api.w3());
    });
  });

  it("worker commit receipt", async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree["all"] || !tree["#14"]) {
      this.skip();
    }
    await start();
    const registerPromise = api.register(workerEnclaveSigningAddress, workerReport, signature, { from: workerAddress });
    ethTestUtils.advanceXConfirmations(api.w3());
    await registerPromise;

    const loginPromise = api.login({ from: workerAddress });
    ethTestUtils.advanceXConfirmations(api.w3());
    await loginPromise;

    const secretContractAddress = utils.remove0x(api.w3().utils.randomHex(32));
    const codeHash = api.w3().utils.sha3(JSON.stringify(testParameters.bytecode));
    const initStateDeltaHash = api.w3().utils.randomHex(32);
    const zeroAddress = "0x0000000000000000000000000000000000000000";
    const gasUsed = 10;

    const deployPromise = api.deploySecretContract(
      secretContractAddress,
      codeHash,
      codeHash,
      initStateDeltaHash,
      "0x00",
      zeroAddress,
      gasUsed,
      workerEnclaveSigningAddress,
      { from: workerAddress }
    );
    ethTestUtils.advanceXConfirmations(api.w3());
    await deployPromise;

    const optionalEthereumData = "0x00";
    const optionalEthereumContractAddress = "0x0000000000000000000000000000000000000000";
    const outputHash = api.w3().utils.randomHex(32);
    const stateDeltaHash = api.w3().utils.randomHex(32);
    const taskId = utils.remove0x(api.w3().utils.randomHex(32));

    const receiptPromise = api.commitReceipt(
      secretContractAddress,
      taskId,
      stateDeltaHash,
      outputHash,
      optionalEthereumData,
      optionalEthereumContractAddress,
      gasUsed,
      signature
    );
    ethTestUtils.advanceXConfirmations(api.w3());
    const receipt = await receiptPromise;

    assert.strictEqual(receipt.ReceiptVerified.outputHash, outputHash);
    assert.strictEqual(receipt.ReceiptVerified.stateDeltaHash, stateDeltaHash);
    assert.strictEqual(receipt.ReceiptVerified.stateDeltaHashIndex, 1);
    assert.strictEqual(receipt.ReceiptVerified.taskId, taskId);
    await stop();
  });

  it("worker commit receipt event", async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree["all"] || !tree["#15"]) {
      this.skip();
    }
    return new Promise(async resolve => {
      await start();
      const registerPromise = api.register(workerEnclaveSigningAddress, workerReport, signature, {
        from: workerAddress
      });
      ethTestUtils.advanceXConfirmations(api.w3());
      await registerPromise;

      const loginPromise = api.login({ from: workerAddress });
      ethTestUtils.advanceXConfirmations(api.w3());
      await loginPromise;

      const secretContractAddress = utils.remove0x(api.w3().utils.randomHex(32));
      const codeHash = api.w3().utils.sha3(JSON.stringify(testParameters.bytecode));
      const initStateDeltaHash = api.w3().utils.randomHex(32);
      const zeroAddress = "0x0000000000000000000000000000000000000000";
      const gasUsed = 10;

      const deployPromise = api.deploySecretContract(
        secretContractAddress,
        codeHash,
        codeHash,
        initStateDeltaHash,
        "0x00",
        zeroAddress,
        gasUsed,
        workerEnclaveSigningAddress,
        { from: workerAddress }
      );
      ethTestUtils.advanceXConfirmations(api.w3());
      await deployPromise;

      const optionalEthereumData = "0x00";
      const optionalEthereumContractAddress = "0x0000000000000000000000000000000000000000";
      const outputHash = api.w3().utils.randomHex(32);
      const stateDeltaHash = api.w3().utils.randomHex(32);
      const taskId = utils.remove0x(api.w3().utils.randomHex(32));

      eventSubscribe(
        api,
        constants.RAW_ETHEREUM_EVENTS.ReceiptVerified,
        {},
        getEventRecievedFunc(constants.RAW_ETHEREUM_EVENTS.ReceiptVerified, async receipt => {
          assert.strictEqual(receipt.outputHash, outputHash);
          assert.strictEqual(receipt.stateDeltaHash, stateDeltaHash);
          assert.strictEqual(receipt.stateDeltaHashIndex, 1);
          assert.strictEqual(receipt.taskId, taskId);
          await stop();
          resolve();
        })
      );

      api.commitReceipt(
        secretContractAddress,
        taskId,
        stateDeltaHash,
        outputHash,
        optionalEthereumData,
        optionalEthereumContractAddress,
        gasUsed,
        signature
      );
      ethTestUtils.advanceXConfirmations(api.w3());
    });
  });

  it("worker commit task failure", async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree["all"] || !tree["#16"]) {
      this.skip();
    }
    await start();
    const registerPromise = api.register(workerEnclaveSigningAddress, workerReport, signature, { from: workerAddress });
    ethTestUtils.advanceXConfirmations(api.w3());
    await registerPromise;

    const loginPromise = api.login({ from: workerAddress });
    ethTestUtils.advanceXConfirmations(api.w3());
    await loginPromise;

    const secretContractAddress = utils.remove0x(api.w3().utils.randomHex(32));
    const codeHash = api.w3().utils.sha3(JSON.stringify(testParameters.bytecode));
    const initStateDeltaHash = api.w3().utils.randomHex(32);
    const zeroAddress = "0x0000000000000000000000000000000000000000";
    const gasUsed = 10;

    const deployPromise = api.deploySecretContract(
      secretContractAddress,
      codeHash,
      codeHash,
      initStateDeltaHash,
      "0x00",
      zeroAddress,
      gasUsed,
      workerEnclaveSigningAddress,
      { from: workerAddress }
    );
    ethTestUtils.advanceXConfirmations(api.w3());
    await deployPromise;

    const outputHash = api.w3().utils.randomHex(32);
    const taskId = utils.remove0x(api.w3().utils.randomHex(32));

    const taskFailurePromise = api.commitTaskFailure(secretContractAddress, taskId, outputHash, gasUsed, signature);
    ethTestUtils.advanceXConfirmations(api.w3());
    const receipt = await taskFailurePromise;

    assert.strictEqual(receipt.ReceiptFailed.taskId, taskId);
    assert.strictEqual(receipt.ReceiptFailed.outputHash, outputHash);
    await stop();
  });

  it("worker commit task failure event", async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree["all"] || !tree["#17"]) {
      this.skip();
    }
    return new Promise(async resolve => {
      await start();
      const registerPromise = api.register(workerEnclaveSigningAddress, workerReport, signature, {
        from: workerAddress
      });
      ethTestUtils.advanceXConfirmations(api.w3());
      await registerPromise;

      const loginPromise = api.login({ from: workerAddress });
      ethTestUtils.advanceXConfirmations(api.w3());
      await loginPromise;

      const secretContractAddress = utils.remove0x(api.w3().utils.randomHex(32));
      const codeHash = api.w3().utils.sha3(JSON.stringify(testParameters.bytecode));
      const initStateDeltaHash = api.w3().utils.randomHex(32);
      const zeroAddress = "0x0000000000000000000000000000000000000000";
      const gasUsed = 10;

      const deployPromise = api.deploySecretContract(
        secretContractAddress,
        codeHash,
        codeHash,
        initStateDeltaHash,
        "0x00",
        zeroAddress,
        gasUsed,
        workerEnclaveSigningAddress,
        { from: workerAddress }
      );
      ethTestUtils.advanceXConfirmations(api.w3());
      await deployPromise;

      const outputHash = api.w3().utils.randomHex(32);
      const taskId = utils.remove0x(api.w3().utils.randomHex(32));

      eventSubscribe(
        api,
        constants.RAW_ETHEREUM_EVENTS.ReceiptFailed,
        {},
        getEventRecievedFunc(constants.RAW_ETHEREUM_EVENTS.ReceiptFailed, async receipt => {
          assert.strictEqual(receipt.taskId, taskId);
          assert.strictEqual(receipt.outputHash, outputHash);
          await stop();
          resolve();
        })
      );

      api.commitTaskFailure(secretContractAddress, taskId, outputHash, gasUsed, signature);
      ethTestUtils.advanceXConfirmations(api.w3());
    });
  });

  it("worker unregister", async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree["all"] || !tree["#18"]) {
      this.skip();
    }
    await start();
    const registerPromise = api.register(workerEnclaveSigningAddress, workerReport, signature, { from: workerAddress });
    ethTestUtils.advanceXConfirmations(api.w3());
    await registerPromise;

    const unregisterPromise = api.unregister({ from: workerAddress });
    ethTestUtils.advanceXConfirmations(api.w3());
    await unregisterPromise;

    const worker = await api.getWorker(workerAddress);
    assert.strictEqual(worker.status, constants.ETHEREUM_WORKER_STATUS.UNREGISTERED);
    await stop();
  });

  it("worker unregister event", async function() {
    const tree = TEST_TREE.ethereum;
    if (!tree["all"] || !tree["#19"]) {
      this.skip();
    }
    return new Promise(async resolve => {
      await start();
      const registerPromise = api.register(workerEnclaveSigningAddress, workerReport, signature, {
        from: workerAddress
      });
      ethTestUtils.advanceXConfirmations(api.w3());
      await registerPromise;

      eventSubscribe(
        api,
        constants.RAW_ETHEREUM_EVENTS.Unregistered,
        {},
        getEventRecievedFunc(constants.RAW_ETHEREUM_EVENTS.Unregistered, async result => {
          assert.strictEqual(result.address, workerAddress);

          const worker = await api.getWorker(workerAddress);
          assert.strictEqual(worker.status, constants.ETHEREUM_WORKER_STATUS.UNREGISTERED);
          await stop();
          resolve();
        })
      );

      api.unregister({ from: workerAddress });
      ethTestUtils.advanceXConfirmations(api.w3());
    });
  });
});
