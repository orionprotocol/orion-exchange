require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

const ChainManipulation = require("./helpers/ChainManipulation");

let Exchange = artifacts.require("ExchangeWithOrionPool");
const Orion = artifacts.require("Orion");
const LibValidator = artifacts.require("LibValidator");

const depositedBalance = 10e8;
let stakedBalance = 8e8;
const NOTSTAKED='0', LOCKED='1', RELEASING='2', READYTORELEASE='3', FROZEN='4';
const lockingDuration = 1, releasingDuration = 3600*24;
let exchange, orion, orionVault;

async function getLastEvent(eventName, user) {
  let events = await exchange.getPastEvents(eventName, {
    user
  });

  return events[0].returnValues;
}


contract("OrionVault", ([owner, user1, user2, user3]) => {

  describe("OrionVault::instance", () => {
    it("deploy", async () => {
      orion = await Orion.deployed();
      //orionVault = await OrionVault.deployed(orion.address);
      exchange = await Exchange.deployed("0x0000000000000000000000000000000000000000", orion.address);
      orionVault = exchange;
      lib = await LibValidator.deployed();
    });
  });


  describe("OrionVault::basic", () => {
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
      let stakeBalance = await orionVault.getStakeBalance(user1);
      let stakePhase = await orionVault.getStakePhase(user1);
      stakeBalance.toString().should.be.equal(String(0));
      stakePhase.toString().should.be.equal(NOTSTAKED);
    });

    it("user1 try stake more than (s)he has", async () => {
      await orionVault.lockStake(depositedBalance+1, {from:user1}).should.be.rejected;
    });

    it("use1 try unlocking before locking", async () => {
      await orionVault.requestReleaseStake({from:user1}).should.be.rejected;
    });

    it("user1 lock ORN for orionVault", async () => {
      await orionVault.lockStake(stakedBalance, {from:user1}).should.be.fulfilled;
      let orionBalance = await exchange.getBalance(orion.address, user1);
      orionBalance.toString()
              .should.be.equal(String(depositedBalance-stakedBalance));
      let stakeBalance = await orionVault.getStakeBalance(user1);
      let stakePhase = await orionVault.getStakePhase(user1);
      stakeBalance.toString().should.be.equal(String(stakedBalance));
      stakePhase.toString().should.be.equal(String(LOCKED));
    });
    /*it("locked stake value should be 0 for LOCKING phase", async () => {
      let lockedBalance = await orionVault.getLockedStakeBalance(user1);
      lockedBalance.toString().should.be.equal(String(0));
    });


    // Uncomment if locking period > 0
    it("user1 unlock recently (before lock period) staked ORN", async () => {
      await orionVault.requestReleaseStake({from:user1}).should.be.fulfilled;
      let stakeBalance = await orionVault.getStakeBalance(user1);
      let stakePhase = await orionVault.getStakePhase(user1);
      stakeBalance.toString().should.be.equal(String(0));
      stakePhase.toString().should.be.equal(NOTSTAKED);
      let orionBalance = await exchange.getBalance(orion.address, user1);
      orionBalance.toString()
              .should.be.equal(String(depositedBalance));
    });*/

    it("user can add to stake", async () => {
      let orionBalance = await exchange.getBalance(orion.address, user1);
      await orionVault.lockStake(1, {from:user1}).should.be.fulfilled;
      await ChainManipulation.advanceTime(lockingDuration+1);
      await ChainManipulation.advanceBlock();
      let stakePhase = await orionVault.getStakePhase(user1);
      stakePhase.toString().should.be.equal(String(LOCKED));
      stakedBalance+=1;
      let lockedBalance = await orionVault.getLockedStakeBalance(user1);
      lockedBalance.toString().should.be.equal(String(stakedBalance));
      let afterOrionBalance = await exchange.getBalance(orion.address, user1);
      (orionBalance-afterOrionBalance).toString().should.be.equal(String('1'));
    });


    it("locked stake value = staked value in LOCKED phase", async () => {
      await orionVault.lockStake(stakedBalance, {from:user2}).should.be.fulfilled;
      await ChainManipulation.advanceTime(lockingDuration+1);
      await ChainManipulation.advanceBlock();
      let stakePhase = await orionVault.getStakePhase(user2);
      stakePhase.toString().should.be.equal(String(LOCKED));
      let lockedBalance = await orionVault.getLockedStakeBalance(user2);
      lockedBalance.toString().should.be.equal(String(stakedBalance));
    });

    it("user2 start unlocking staked ORN after lock period", async () => {
      await orionVault.requestReleaseStake({from:user2}).should.be.fulfilled;
      let stakeBalance = await orionVault.getStakeBalance(user2);
      stakePhase = await orionVault.getStakePhase(user2);
      stakeBalance.toString().should.be.equal(String(stakedBalance));
      stakePhase.toString().should.be.equal(RELEASING);
      let orionBalance = await exchange.getBalance(orion.address, user2);
      orionBalance.toString().
              should.be.equal(String(depositedBalance-stakedBalance));
    });

    it("locked stake value should be 0 for RELEASING phase", async () => {
      let lockedBalance = await orionVault.getLockedStakeBalance(user2);
      lockedBalance.toString().should.be.equal(String(0));
    });

    it("user2 try finish unlocking staked ORN before date", async () => {
      await orionVault.requestReleaseStake({from:user2}).should.be.rejected;
    });

    it("user2 finish unlocking staked ORN", async () => {
      await ChainManipulation.advanceTime(releasingDuration+1);
      await ChainManipulation.advanceBlock();
      let stakePhase = await orionVault.getStakePhase(user2);
      stakePhase.toString().should.be.equal(String(READYTORELEASE));

      await orionVault.requestReleaseStake({from:user2}).should.be.fulfilled;
      let stakeBalance = await orionVault.getStakeBalance(user2);
      stakePhase = await orionVault.getStakePhase(user2);
      stakeBalance.toString().should.be.equal(String(0));
      stakePhase.toString().should.be.equal(NOTSTAKED);
      let orionBalance = await exchange.getBalance(orion.address, user2);
      orionBalance.toString()
              .should.be.equal(String(depositedBalance));
    });

    it("user2 try unlock stake after successful unlocking", async () => {
      await orionVault.requestReleaseStake({from:user2}).should.be.rejected;
    });

  });
  describe("OrionVault::admin", () => {
    it("user1 try postpone user3 Stake Release", async () => {
      await orionVault.lockStake(stakedBalance, {from:user3}).should.be.fulfilled;
      await ChainManipulation.advanceTime(lockingDuration+1);
      await ChainManipulation.advanceBlock();
      await orionVault.requestReleaseStake({from:user3}).should.be.fulfilled;
      await orionVault.postponeStakeRelease(user3, {from:user1}).should.be.rejected;
    });

    it("owner postpone user3 Stake Release", async () => {
      await orionVault.postponeStakeRelease(user3, {from:owner}).should.be.fulfilled;
      let stakePhase = await orionVault.getStakePhase(user3);
      stakePhase.toString().should.be.equal(FROZEN);
    });

    it("locked stake value = staked value in FROZEN phase", async () => {
      let lockedBalance = await orionVault.getLockedStakeBalance(user3);
      lockedBalance.toString().should.be.equal(String(stakedBalance));
    });


    it("user3 try release frozen stake", async () => {
      await orionVault.requestReleaseStake({from:user3}).should.be.rejected;
    });

    it("non-admin users try allow Stake Release", async () => {
      await orionVault.allowStakeRelease(user3, {from:user1}).should.be.rejected;
      await orionVault.allowStakeRelease(user3, {from:user3}).should.be.rejected;
    });

    it("user3 try release frozen stake after release periods", async () => {
      await ChainManipulation.advanceTime(lockingDuration+releasingDuration+1);
      await orionVault.requestReleaseStake({from:user3}).should.be.rejected;
    });

    it("owner allow user3 Stake Release", async () => {
      await orionVault.allowStakeRelease(user3, {from:owner}).should.be.fulfilled;
      let stakePhase = await orionVault.getStakePhase(user3);
      stakePhase.toString().should.be.equal(READYTORELEASE);
    });


  });

});

