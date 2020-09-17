require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

let Exchange = artifacts.require("Exchange");
const Orion = artifacts.require("Orion");
const Staking = artifacts.require("Staking");
const LibValidator = artifacts.require("LibValidator");

const depositedBalance = 10e8, stakedBalance = 8e8;
const NOTSTAKED='0', LOCKING='1', LOCKED='2', RELEASING='3', READYTORELEASE='4', FROZEN='5';
const lockingDuration = 3600*24, releasingDuration = 3600*24;
let exchange, orion, staking;

async function getLastEvent(eventName, user) {
  let events = await exchange.getPastEvents(eventName, {
    user
  });

  return events[0].returnValues;
}


const revertToSnapshot = (snapshot_id) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({jsonrpc: '2.0', method: 'evm_revert', params: [snapshot_id], id: new Date().getTime()},
                              (err, result) => {
                                if (err) { return reject(err); }
                                return resolve(result);
                              });
    });
};

const getSnapshot = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({jsonrpc: '2.0', method: 'evm_snapshot', id: new Date().getTime()},
                              (err, result) => {
                                 if (err) { return reject(err); }
                                 return resolve(result);
                              })
    });
};

const advanceTime = (time) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({jsonrpc: '2.0', method: 'evm_increaseTime', params: [time], id: new Date().getTime()}, 
                              (err, result) => {
                                 if (err) { return reject(err); }
                                 return resolve(result);
                              });
    });
};

const advanceBlock = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({jsonrpc: '2.0', method: 'evm_mine', id: new Date().getTime()}, 
                              (err, result) => {
                                if (err) { return reject(err); }
                                return resolve(result);
                              });
    });
};

const setBlockchainTime = async function(from_snapshot, time) {
  time = Math.ceil(time);
  await revertToSnapshot(from_snapshot);
  await getSnapshot();
  let bn = await web3.eth.getBlockNumber();
  let bl = await web3.eth.getBlock(bn);
  let tm = bl.timestamp;
  await advanceTime(time-tm);
  await advanceBlock();
}

contract("Staking", ([owner, user1, user2, user3]) => {

  describe("Staking::instance", async () => {
    orion = await Orion.deployed();
    staking = await Staking.deployed(orion.address);
    exchange = await Exchange.deployed(staking.address, orion.address);
    await staking.setExchangeAddress(exchange.address, {from:owner}).should.be
          .fulfilled;;
    lib = await LibValidator.deployed();
  });

  describe("Staking::basic", () => {
    it("users deposit ORN to exchange", async () => {
      for (let user of [user1, user2, user3]) {
        await orion.mint(user, String(depositedBalance), { from: owner }).should.be
          .fulfilled;
        await orion.approve(exchange.address, String(depositedBalance), {
          from: user
        });
        await exchange.depositAsset(orion.address, String(depositedBalance), {
          from: user
        }).should.be.fulfilled;
      }

      let orionBalance = await exchange.getBalance(orion.address, user1);
      orionBalance.toString().should.be.equal(String(depositedBalance));
      let stakeBalance = await staking.getStakeBalance(user1);
      let stakePhase = await staking.getStakePhase(user1);
      stakeBalance.toString().should.be.equal(String(0));
      stakePhase.toString().should.be.equal(NOTSTAKED);
    });

    it("user1 try stake more than (s)he has", async () => {
      await staking.lockStake(depositedBalance+1, {from:user1}).should.be.rejected;
    });


    it("user1 lock ORN for staking", async () => {
      await staking.lockStake(stakedBalance, {from:user1}).should.be.fulfilled;
      let orionBalance = await exchange.getBalance(orion.address, user1);
      orionBalance.toString()
              .should.be.equal(String(depositedBalance-stakedBalance));
      let stakeBalance = await staking.getStakeBalance(user1);
      let stakePhase = await staking.getStakePhase(user1);
      stakeBalance.toString().should.be.equal(String(stakedBalance));
      stakePhase.toString().should.be.equal(String(LOCKING));
    });

    it("user1 unlock recently (before lock period) staked ORN", async () => {
      await staking.requestReleaseStake({from:user1}).should.be.fulfilled;
      let stakeBalance = await staking.getStakeBalance(user1);
      let stakePhase = await staking.getStakePhase(user1);
      stakeBalance.toString().should.be.equal(String(0));
      stakePhase.toString().should.be.equal(NOTSTAKED);
      let orionBalance = await exchange.getBalance(orion.address, user1);
      orionBalance.toString()
              .should.be.equal(String(depositedBalance));
    });

    it("user2 start unlocking staked ORN after lock period", async () => {
      await staking.lockStake(stakedBalance, {from:user2}).should.be.fulfilled;
      await advanceTime(lockingDuration+1);
      await advanceBlock();
      let stakePhase = await staking.getStakePhase(user2);
      stakePhase.toString().should.be.equal(String(LOCKED));

      await staking.requestReleaseStake({from:user2}).should.be.fulfilled;
      let stakeBalance = await staking.getStakeBalance(user2);
      stakePhase = await staking.getStakePhase(user2);
      stakeBalance.toString().should.be.equal(String(stakedBalance));
      stakePhase.toString().should.be.equal(RELEASING);
      let orionBalance = await exchange.getBalance(orion.address, user2);
      orionBalance.toString().
              should.be.equal(String(depositedBalance-stakedBalance));
    });

    it("user2 try finish unlocking staked ORN before date", async () => {
      await staking.requestReleaseStake({from:user2}).should.be.rejected;
    });

    it("user2 finish unlocking staked ORN", async () => {
      await advanceTime(releasingDuration+1);
      await advanceBlock();
      let stakePhase = await staking.getStakePhase(user2);
      stakePhase.toString().should.be.equal(String(READYTORELEASE));

      await staking.requestReleaseStake({from:user2}).should.be.fulfilled;
      let stakeBalance = await staking.getStakeBalance(user2);
      stakePhase = await staking.getStakePhase(user2);
      stakeBalance.toString().should.be.equal(String(0));
      stakePhase.toString().should.be.equal(NOTSTAKED);
      let orionBalance = await exchange.getBalance(orion.address, user2);
      orionBalance.toString()
              .should.be.equal(String(depositedBalance));
    });

    it("user1 try postpone user3 Stake Release", async () => {
      await staking.lockStake(stakedBalance, {from:user3}).should.be.fulfilled;
      await advanceTime(lockingDuration+1);
      await advanceBlock();
      await staking.requestReleaseStake({from:user3}).should.be.fulfilled;
      await staking.postponeStakeRelease(user3, {from:user1}).should.be.rejected;
    });

    it("owner postpone user3 Stake Release", async () => {
      await staking.postponeStakeRelease(user3, {from:owner}).should.be.fulfilled;
      let stakePhase = await staking.getStakePhase(user3);
      stakePhase.toString().should.be.equal(FROZEN);
    });

    it("user1 try allow Stake Release", async () => {
      await staking.allowStakeRelease(user3, {from:user1}).should.be.rejected;
    });

    it("owner allow user3 Stake Release", async () => {
      await staking.allowStakeRelease(user3, {from:owner}).should.be.fulfilled;
      let stakePhase = await staking.getStakePhase(user3);
      stakePhase.toString().should.be.equal(READYTORELEASE);
    });


  });

});

