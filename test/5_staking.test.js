require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

let Exchange = artifacts.require("Exchange");
const Orion = artifacts.require("Orion");

const depositedBalance = 10e8, stakedBalance = 8e8;
const NOTSTAKED='0', LOCKING='1', LOCKED='2', RELEASING='3', READYTORELEASE='4', FROZEN='5';
const lockingDuration = 3600*24, releasingDuration = 3600*24;
let exchange, orion;

async function getLastEvent(eventName, user) {
  let events = await exchange.getPastEvents(eventName, {
    user
  });

  return events[0].returnValues;
}

const setBlockchainTime = async function(from_snapshot, time) {
  await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0});
  await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_revert", params: [from_snapshot], id: 0});
  await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_snapshot", params: [], id: 0});
  await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0});
  bn = await web3.eth.blockNumber;
  bl = await web3.eth.getBlock(bn);
  tm = bl.timestamp;
  await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [time-tm], id: 0});  
  await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0});
};

const revertToSnapshot = async function(initial_snapshot) {
  await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_revert", params: [initial_snapshot], id: 0});
  await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_snapshot", params: [], id: 0});
  await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0});
}

const getSnapshot = async function() {
      return parseInt((await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_snapshot", params: [], id: 0}))["result"]);
}
contract("Exchange", ([owner, user1]) => {
  let just_staked_snapshot=0,
      requested_stake_snapshot = 0;

  describe("Exchange::instance", async () => {
    orion = await Orion.deployed();
    exchange = await Exchange.deployed(orion.address);
    lib = await LibValidator.deployed();
  });

  describe("Exchange::staking", () => {
    it("user1 deposits ORN to exchange", async () => {
      await orion.mint(user1, String(depositedBalance), { from: owner }).should.be
        .fulfilled;
      await orion.approve(exchange.address, String(depositedBalance), {
        from: user1
      });
      await exchange.depositAsset(orion.address, String(depositedBalance), {
        from: user1
      }).should.be.fulfilled;

      let orionBalance = await exchange.getBalance(orion.address, user1);
      orionBalance.toString().should.be.equal(String(depositedBalance));
      let stakeBalance = await exchange.getStakeBalance(user1);
      let stakePhase = await exchange.getStakePhase(user1);
      stakeBalance.toString().should.be.equal(String(0));
      stakePhase.toString().should.be.equal(NOTSTAKED);
    });

    it("user1 try stake more than (s)he has", async () => {
      await exchange.lockStake(depositedBalance+1, {from:user1}).should.be.rejected;
    });
    

    it("user1 lock ORN for staking", async () => {
      await exchange.lockStake(stakedBalance, {from:user1}).should.be.fulfilled;
      let orionBalance = await exchange.getBalance(orion.address, user1);
      orionBalance.toString()
              .should.be.equal(String(depositedBalance-stakedBalance));
      let stakeBalance = await exchange.getStakeBalance(user1);
      let stakePhase = await exchange.getStakePhase(user1);
      stakeBalance.toString().should.be.equal(String(stakedBalance));
      stakePhase.toString().should.be.equal(String(LOCKING));
      just_staked_snapshot = getSnapshot();
    });

    it("user1 unlock recently (before lock period) staked ORN", async () => {
      await exchange.requestReleaseStake({from:user1}).should.be.fulfilled;
      let stakeBalance = await exchange.getStakeBalance(user1);
      let stakePhase = await exchange.getStakePhase(user1);
      stakeBalance.toString().should.be.equal(String(0));
      stakePhase.toString().should.be.equal(NOTSTAKED);
      let orionBalance = await exchange.getBalance(orion.address, user1);
      orionBalance.toString()
              .should.be.equal(String(depositedBalance));
    });

    it("user1 start unlocking staked ORN after lock period", async () => {
      await setBlockchainTime(just_staked_snapshot, 
                              Date.now()/1e3+lockingDuration);
      (await exchange.getStakePhase(user1)).toString()
              .should.be.equal(String(RELEASED));
      
      await exchange.requestReleaseStake({from:user1}).should.be.fulfilled;
      let stakeBalance = await exchange.getStakeBalance(user1);
      let stakePhase = await exchange.getStakePhase(user1);
      stakeBalance.toString().should.be.equal(stakedBalance);
      stakePhase.toString().should.be.equal(RELEASING);
      let orionBalance = await exchange.getBalance(orion.address, user1);
      orionBalance.toString().
              should.be.equal(String(depositedBalance-stakedBalance));
      requested_stake_snapshot = getSnapshot();
    });

    it("user1 try finish unlocking staked ORN before date", async () => {
      await exchange.requestReleaseStake({from:user1}).should.be.rejected;
    });

    it("user1 finish unlocking staked ORN", async () => {
      await setBlockchainTime(requested_stake_snapshot, 
                              Date.now()/1e3+releasingDuration);
      await exchange.getStakePhase(user1).toString()
              .should.be.equal(READYTORELEASE);
      
      await exchange.requestReleaseStake({from:user1}).should.be.fulfilled;
      let stakeBalance = await exchange.getStakeBalance(user1);
      let stakePhase = await exchange.getStakePhase(user1);
      stakeBalance.toString().should.be.equal(String(0));
      stakePhase.toString().should.be.equal(NOTSTAKED);
      let orionBalance = await exchange.getBalance(orion.address, user1);
      orionBalance.toString()
              .should.be.equal(String(depositedBalance));
    });

    it("user1 try postpone Stake Release", async () => {
      await revertToSnapshot(requested_stake_snapshot);
      await exchange.postponeStakeRelease(user1, {from:user1}).should.be.rejected;
    });

    it("owner postpone Stake Release", async () => {
      await revertToSnapshot(requested_stake_snapshot);
      await exchange.postponeStakeRelease(user1, {from:owner}).should.be.fulfilled;
      let stakePhase = await exchange.getStakePhase(user1);
      stakePhase.toString().should.be.equal(FROZEN);
    });

    it("user1 try allow Stake Release", async () => {
      await exchange.allowStakeRelease(user1, {from:user1}).should.be.rejected;
    });

    it("owner allow Stake Release", async () => {
      await exchange.allowStakeRelease(user1, {from:owner}).should.be.fulfilled;
      let stakePhase = await exchange.getStakePhase(user1);
      stakePhase.toString().should.be.equal(FROZEN);
    });


  });

});

