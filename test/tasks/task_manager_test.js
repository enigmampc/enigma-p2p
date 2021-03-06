const Logger = require("../../src/common/logger");
const ComputeTask = require("../../src/worker/tasks/ComputeTask");
const DeployTask = require("../../src/worker/tasks/DeployTask");
const OutsideTask = require("../../src/worker/tasks/OutsideTask");
const Result = require("../../src/worker/tasks/Result");
const assert = require("assert");
const constants = require("../../src/common/constants");
const TaskManager = require("../../src/worker/tasks/TaskManager");
const tempdir = require("tempdir");
const TEST_TREE = require("../test_tree").TEST_TREE;
const utils = require("./utils");
const testUtils = require("../testUtils/utils");

let tree = TEST_TREE.task_manager;

let resultRawObj = {
  taskId: null,
  status: constants.TASK_STATUS.SUCCESS,
  output: [123, 22, 4, 55, 66],
  delta: { index: 2, delta: [96, 22, 4, 55, 66, 88] },
  usedGas: 213,
  ethereumPayload: [233, 46, 78],
  ethereumAddress: "cc353334487696ebc3e15411e0b106186eba3c0c",
  signature: [233, 43, 67, 54],
  preCodeHash: "87c2d362de99f75a4f2755cdaaad2d11bf6cc65dc71356593c445535ff28f43d"
};

const user1 = {
  userEthAddr: "0xce16109f8b49da5324ce97771b81247db6e17868",
  userNonce: 3,
  // H(userEthAddr|userNonce)
  taskId: "ae2c488a1a718dd9a854783cc34d1b3ae82121d0fc33615c54a290d90e2b02b3",
  encryptedArgs:
    "3cf8eb4f23632a59e3e2b21a25c6aa4538fde5253c7b50a10caa948e12ddc83f607790e4a0fb317cff8bde1a8b94f8e0e52741d9",
  encryptedFn:
    "5a380b9a7f5982f2b9fa69d952064e82cb4b6b9a718d98142da4b83a43d823455d75a35cc3600ba01fe4aa0f1b140006e98106a112e13e6f676d4bccb7c70cdd1c",
  userDHKey: "2532eb4f23632a59e3e2b21a25c6aa4538fde5253c7b50a10caa948e12ddc83f607790e4a0fb317cff8bde1a8b94f8e0e52741d9",
  contractAddress: "0xae2c488a1a718dd9a854783cc34d1b3ae82121d0fc33615c54a290d90e2b02b3",
  gasLimit: 24334,
  blockNumber: 100,
  preCode:
    "f236658468465aef1grd56gse6fg1ae65f1aw684fr6aw81faw51f561fwawf32a59e3e2b21a25c6aa4538fde5253c7b50a10caa948e12ddc83f607790e4a0fb317cff8bde1a8b94f8e0e52741d92532eb4f23632a59e3e2b21a25c6aa4538fde5253c7b50a10caa948e12ddc83f607790e4a0fb317cff8bde1a8b94f8e0e52741d92532eb4f23632a59e3e2b21a25c6aa4538fde5253c7b50a10caa948e12ddc83f607790e4a0fb317cff8bde1a8b94f8e0e52741d92532eb4f23632a59e3e2b21a25c6aa4538fde5253c7b50a10caa948e12ddc83f607790e4a0fb317cff8bde1a8b94f8e0e52741d92532eb4f23632a59e3e2b21a25c6aa4538fde5253c7b50a10caa948e12ddc83f607790e4a0fb317cff8bde1a8b94f8e0e52741d92532eb4f23632a59e3e2b21a25c6aa4538fde5253c7b50a10caa948e12ddc83f607790e4a0fb317cff8bde1a8b94f8e0e52741d9"
};
const user2 = {
  userEthAddr: "0x3216109f8b49da5324ce97771b81247db6e17864",
  userNonce: 43,
  // H(userEthAddr|userNonce)
  taskId: "aaac488a1a718dd9a854783cc34d1b3ae82121d0fc33615c54a290d90e2b02cc",
  encryptedArgs:
    "4ff8eb4f23632a59e3e2b21a25c6aa4538fde5253c7b50a10caa948e12ddc83f607790e4a0fb317cff8bde1a8b94f8e0e5274f4",
  encryptedFn:
    "0b9a7f5982f2b9fa69d952064e82cb4b6b9a718d98142da4b83a43d823455d75a35cc3600ba01fe4aa0f1b140006e98106a112e13e6f676d4bccb7c70cdd",
  userDHKey: "4343eb4f23632a59e3e2b21a25c6aa4538fde5253c7b50a10caa948e12ddc83f607790e4a0fb317cff8bde1a8b94f8e0e52741aa",
  contractAddress: "0x322c488a1a718dd9a854783cc34d1b3ae82121d0fc33615c54a290d90e2b0233",
  gasLimit: 24344,
  blockNumber: 100,
  preCode:
    "ab36658468465aef1grd56gse6fg1ae65f1aw684fr6aw81faw51f561fwawf32a59e3e2b21a25c6aa4538fde5253c7b50a10caa948e12ddc83f607790e4a0fb317cff8bde1a8b94f8e0e52741d92532eb4f23632a59e3e2b21a25c6aa4538fde5253c7b50a10caa948e12ddc83f607790e4a0fb317cff8bde1a8b94f8e0e52741d92532eb4f23632a59e3e2b21a25c6aa4538fde5253c7b50a10caa948e12ddc83f607790e4a0fb317cff8bde1a8b94f8e0e52741d92532eb4f23632a59e3e2b21a25c6aa4538fde5253c7b50a10caa948e12ddc83f607790e4a0fb317cff8bde1a8b94f8e0e52741d92532eb4f23632a59e3e2b21a25c6aa4538fde5253c7b50a10caa948e12ddc83f607790e4a0fb317cff8bde1a8b94f8e0e52741d92532eb4f23632a59e3e2b21a25c6aa4538fde5253c7b50a10caa948e12ddc83f607790e4a0fb317cff8bde1a8b94f8e0e52741ba"
};

function destroyDb(dbPath, resolve) {
  resolve();
  // testUtils.deleteFolderFromOSRecursive(dbPath,()=>{
  //   resolve();
  // });
}

describe("TaskManager isolated tests", () => {
  let logger;
  let dbPath;

  before(async function() {
    if (!tree["all"]) {
      this.skip();
    }
    // runs before all tests in this block
    logger = new Logger({
      level: "error",
      name: "task_test_manager"
    });
    dbPath = tempdir.sync();
  });
  after(done => {
    if (!tree["all"]) {
      return done();
    }
    done();
    // testUtils.deleteFolderFromOSRecursive(dbPath,()=>{
    //   done();
    // });
  });

  it("#1 Should add 1 task", async function() {
    if (!tree["all"] || !tree["#1"]) {
      this.skip();
    }
    return new Promise(resolve => {
      // initialize the taskManager
      dbPath = tempdir.sync();
      let taskManager = new TaskManager(dbPath, logger);
      taskManager.on("notify", async obj => {
        assert.strictEqual(constants.NODE_NOTIFICATIONS.VERIFY_NEW_TASK, obj.notification, "wrong notification");
        let tasks = await taskManager.asyncGetAllTasks();
        assert.strictEqual(1, tasks.length, "not 1, current tasks len = " + tasks.length);
        assert.strictEqual(user1.taskId, tasks[0].getTaskId(), "task id not equal");
        assert.strictEqual(constants.TASK_STATUS.UNVERIFIED, tasks[0].getStatus(), "task not unverified");
        await taskManager.asyncStop();
        destroyDb(dbPath, resolve);
      });
      // add task
      let t = ComputeTask.buildTask(user1);
      taskManager.addTaskUnverified(t);
    });
  });

  it("#2 Should remove Task from db", async function() {
    if (!tree["all"] || !tree["#2"]) {
      this.skip();
    }
    return new Promise(async resolve => {
      dbPath = tempdir.sync();
      // init task manager
      let taskManager = new TaskManager(dbPath, logger);
      // add tasks
      let t1 = ComputeTask.buildTask(user1);
      let t2 = DeployTask.buildTask(user2);
      taskManager.addTaskUnverified(t1);
      let tasks = await taskManager.asyncGetAllTasks();
      assert.strictEqual(1, tasks.length, "not 1 tasks");
      taskManager.addTaskUnverified(t2);
      tasks = await taskManager.asyncGetAllTasks();
      assert.strictEqual(2, tasks.length, "not 2 tasks");
      // the actuall test - remove 1 task
      await taskManager.asyncRemoveTask(t1.getTaskId());
      tasks = await taskManager.asyncGetAllTasks();
      assert.strictEqual(1, tasks.length, "not 1 tasks in deletion, now exist: " + tasks.length);
      // remove the second task
      await taskManager.asyncRemoveTask(t2.getTaskId());
      tasks = await taskManager.asyncGetAllTasks();
      assert.strictEqual(0, tasks.length, "not 0 tasks in deletion, now exist: " + tasks.length);
      await taskManager.asyncStop();
      destroyDb(dbPath, resolve);
    });
  });
  it("#3 Should test onTaskVerify", async function() {
    if (!tree["all"] || !tree["#3"]) {
      this.skip();
    }
    return new Promise(async resolve => {
      dbPath = tempdir.sync();
      let tasksNum = 30;
      let taskManager = new TaskManager(dbPath, logger);
      let tasks = utils.generateDeployTasks(tasksNum);
      tasks.forEach(task => {
        taskManager.addTaskUnverified(task);
      });
      let uvTasks = taskManager.getUnverifiedTasks();
      // verify exactly 30 tasks in unverified state
      assert.strictEqual(tasksNum, uvTasks.length, "tasks unverified not " + tasksNum);
      let allTasks = await taskManager.asyncGetAllTasks();
      assert.strictEqual(tasksNum, allTasks.length, "tasks total not " + tasksNum);
      // make all in-progress
      for (let i = 0; i < tasksNum; ++i) {
        let isVerified = true;
        await taskManager.asyncOnVerifyTask(tasks[i].getTaskId(), isVerified);
      }
      // verify 0 unverified and 30 in-progress
      uvTasks = taskManager.getUnverifiedTasks();
      assert.strictEqual(0, uvTasks.length, "tasks unverified not zero");
      allTasks = await taskManager.asyncGetAllTasks();
      assert.strictEqual(tasksNum, allTasks.length, "tasks total not " + tasksNum);
      // validate all in-progress state
      let isError = allTasks.some(t => {
        return t.getStatus() !== constants.TASK_STATUS.IN_PROGRESS;
      });
      assert.strictEqual(false, isError, "some task is not in-progress");
      // finish test
      await taskManager.asyncStop();
      destroyDb(dbPath, resolve);
    });
  });

  it("#4 Should test onFinishTask", async function() {
    if (!tree["all"] || !tree["#4"]) {
      this.skip();
    }
    return new Promise(async resolve => {
      dbPath = tempdir.sync();
      let taskManager = new TaskManager(dbPath, logger);
      // create task
      let t1 = DeployTask.buildTask(user1);
      taskManager.addTaskUnverified(t1);
      // create result
      resultRawObj.taskId = t1.getTaskId();
      // verify task
      await taskManager.asyncOnVerifyTask(t1.getTaskId(), true);
      // create result
      let deployResult = Result.DeployResult.buildDeployResult(resultRawObj);
      // trigger onFinish
      await taskManager.asyncOnFinishTask(deployResult);
      // validate
      let tasks = await taskManager.asyncGetAllTasks();
      assert.strictEqual(1, tasks.length, "not 1 task");
      assert.strictEqual(constants.TASK_STATUS.SUCCESS, tasks[0].getStatus(), "status not success in task");
      // end test
      await taskManager.asyncStop();
      destroyDb(dbPath, resolve);
    });
  });

  /**
   * generate 1000 tasks.
   * 500 finished. (400 success (100 compute, 300 deploy), 100 failed result (100 deploy))
   * 500 in-progress. (250 deploy, 250 compute)
   * */
  it("#5 should stress test TaskManager", async function() {
    if (!tree["all"] || !tree["#5"]) {
      this.skip();
    }
    this.timeout(10000);
    return new Promise(async (resolve, reject) => {
      try {
        dbPath = tempdir.sync();
        let unFinishedDeployNum = 250,
          unFinishedComputeNum = 250,
          finishedSuccess = 400,
          finishedFail = 100;
        // create task manager
        let taskManager = new TaskManager(dbPath, logger);

        let allTasksLen = unFinishedDeployNum + unFinishedComputeNum + finishedSuccess + finishedFail;
        // generate 250 unfinished deploy tasks
        let unDeployTasks = utils.generateDeployTasks(unFinishedDeployNum);
        // // generate 250 unfinished compute tasks

        let unComputeTasks = utils.generateComputeTasks(unFinishedComputeNum);
        // // generate 400 finished + success

        let successBundle = utils.generateDeployBundle(finishedSuccess, true);
        // generate 100 failed

        let failedBundle = utils.generateDeployBundle(finishedFail, false);

        // add all tasks
        unComputeTasks.forEach(task => taskManager.addTaskUnverified(task));
        unDeployTasks.forEach(task => taskManager.addTaskUnverified(task));
        successBundle.forEach(task => taskManager.addTaskUnverified(task.task));
        failedBundle.forEach(task => taskManager.addTaskUnverified(task.task));
        // verify 1000 tasks
        let allTasks = await taskManager.asyncGetAllTasks();
        assert.strictEqual(allTasksLen, allTasks.length, `Task manager has mismatched number of tasks`);
        // verify 1000 unverified tasks
        assert.strictEqual(
          allTasksLen,
          taskManager.getUnverifiedTasks().length,
          `All tasks should be ${allTasksLen} but is actually ${taskManager.getUnverifiedTasks().length}`
        );

        // verify 750 tasks
        await Promise.all([
          ...unDeployTasks.map(task => taskManager.asyncOnVerifyTask(task.getTaskId(), true)),
          ...successBundle.map(task => taskManager.asyncOnVerifyTask(task.task.getTaskId(), true)),
          ...failedBundle.map(task => taskManager.asyncOnVerifyTask(task.task.getTaskId(), true))
        ]);
        let expectedVerifiedAmount = unFinishedDeployNum + finishedSuccess + finishedFail;
        let verifiedTasks = await taskManager.asyncGetVerifiedTasks();
        assert.strictEqual(
          expectedVerifiedAmount,
          verifiedTasks.length,
          `verified tasks is not ${expectedVerifiedAmount}actual = ${verifiedTasks.length}`
        );

        // verify the other 250
        let expectedUnverifiedAmount = allTasks.length - expectedVerifiedAmount;
        let tested = taskManager.getUnverifiedTasks().length;
        assert.strictEqual(
          expectedUnverifiedAmount,
          tested,
          `expectedUnverifiedAmount is not ${expectedUnverifiedAmount} actual = ${tested}`
        );
        await Promise.all(unComputeTasks.map(task => taskManager.asyncOnVerifyTask(task.getTaskId(), true)));

        await Promise.all(successBundle.map(task => taskManager.asyncOnFinishTask(task.result)));
        await testUtils.sleep(100);
        let finishedTasks = await taskManager.asyncGetFinishedTasks();
        assert.strictEqual(
          finishedSuccess,
          finishedTasks.length,
          `not ${finishedSuccess} finished, actual = ${finishedTasks.length}`
        );

        let successTasks = await taskManager.asyncGetSuccessfullTasks();
        assert.strictEqual(
          finishedSuccess,
          successTasks.length,
          `not ${finishedSuccess} success, actual = ${successTasks.length}`
        );
        // verify taskId's check if all ids equal in success bundle and storage
        let noneId = successBundle.some(b => {
          let t = b.task;
          let existInStore = successTasks.some(st => {
            return t.getTaskId() === st.getTaskId();
          });
          return !existInStore;
        });
        assert.strictEqual(false, noneId, "some id don't appear");

        // finish with fail result
        await Promise.all(failedBundle.map(task => taskManager.asyncOnFinishTask(task.result)));
        await testUtils.sleep(100);
        let failedTasks = await taskManager.asyncGetFailedTasks();
        assert.strictEqual(
          finishedFail,
          failedTasks.length,
          `not ${finishedFail} failed, actual = ${failedTasks.length}`
        );
        // end test
        await taskManager.asyncStop();
        destroyDb(dbPath, resolve);
      } catch (err) {
        console.log(err);
        reject(err);
      }
    });
  });
  it("#6 Should addOutsideResult()", async function() {
    if (!tree["all"] || !tree["#6"]) {
      this.skip();
    }
    return new Promise(async resolve => {
      dbPath = tempdir.sync();
      // initialize the taskManager
      let taskManager = new TaskManager(dbPath, logger);
      // add task
      let t = getOutsideDeployTask();
      await taskManager.addOutsideResult(t.getTaskType(), t);
      // verify task using getAll
      let tasks = [await taskManager.asyncGetTask(t.getTaskId())];
      assert.strictEqual(1, tasks.length, "not 1, current tasks len = " + tasks.length);
      assert.strictEqual(t.getTaskId(), tasks[0].getTaskId(), "task id not equal");
      assert.strictEqual(constants.TASK_STATUS.SUCCESS, tasks[0].getStatus(), "task SUCCESS");
      // verify getTaskById
      ta = await taskManager.asyncGetTask(t.getTaskId());
      assert.strictEqual(t.getTaskId(), ta.getTaskId(), "taskId not equal");
      assert.strictEqual(constants.TASK_STATUS.SUCCESS, ta.getStatus(), "task SUCCESS");
      // stop the test
      await taskManager.asyncStop();
      destroyDb(dbPath, resolve);
    });
  });
  // end of suite
});

function getOutsideDeployTask() {
  let resultRawObj = {
    taskId: "ae2c488a1a718dd9a854783cc34d1b3ae82121d0fc33615c54a290d90e2b02b3",
    status: "SUCCESS",
    preCodeHash: "hash-of-the-precode-bytecode",
    output: "the-deployed-bytecode",
    delta: { key: 0, data: [11, 2, 3, 5, 41, 44] },
    usedGas: "amount-of-gas-used",
    ethereumPayload: "hex of payload",
    ethereumAddress: "address of the payload",
    signature: "enclave-signature"
  };
  return OutsideTask.buildTask(constants.CORE_REQUESTS.DeploySecretContract, resultRawObj);
}
