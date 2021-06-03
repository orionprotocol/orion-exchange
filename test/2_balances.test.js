require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

let Exchange = artifacts.require("ExchangeWithOrionPool");
let WETH = artifacts.require("WETH");
let WBTC = artifacts.require("WBTC");
let USDT = artifacts.require("USDT");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"; // WAN or ETH "asset" address in balanaces

let exchange, weth, wbtc;

async function getLastEvent(eventName, user) {
  let events = await exchange.getPastEvents(eventName, {
    user
  });

  return events[0].returnValues;
}

async function wereNoEvents(eventName, user) {
  let events = await exchange.getPastEvents(eventName, {
    user
  });
  return events.length==0;
}

contract("Exchange", ([owner, user1, user2, user3]) => {
  describe("Exchange::instance", async () => {
    exchange = await Exchange.deployed();
    weth = await WETH.deployed();
    wbtc = await WBTC.deployed();
    usdt = await USDT.deployed();
  });

  /*describe("Exchange::access", () => {
    it("correct owner of contract", async () => {
      let _owner = await exchange.owner();
      _owner.should.be.equal(owner);
    });
  });*/ //TODO

  describe("Exchange::deposit", () => {
    it("user can deposit eth to exchange", async () => {
      await exchange.deposit({ from: user1, value: web3.utils.toWei("0.1") })
        .should.be.fulfilled;
      let balanceEth = await exchange.getBalance(ZERO_ADDRESS, user1);

      // Balance responses are in 10^8 format
      balanceEth.toString().should.be.equal(String(0.1e8));

      // Check event values (amount is emitted in 10^8 format too)
      const event = await getLastEvent("NewAssetTransaction", user1);
      event.amount.should.be.equal(String(0.1e8));
      event.isDeposit.should.be.equal(true);
    });

    it("user can deposit 0 eth to exchange", async () => {
      await exchange.deposit({ from: user1, value: 0 })
        .should.be.fulfilled;
      let balanceEth = await exchange.getBalance(ZERO_ADDRESS, user1);

      // Balance responses are in 10^8 format
      balanceEth.toString().should.be.equal(String(0.1e8));

      //no event with 0 deposit
      let noEvents = await wereNoEvents("NewAssetTransaction", user1);
      noEvents.should.be.equal(true);
    });

    it("user can deposit weth to exchange", async () => {
      //WETH has 18 decimals
      await weth.mint(user1, web3.utils.toWei("1"), { from: owner }).should.be
        .fulfilled;
      await weth.approve(exchange.address, web3.utils.toWei("1"), {
        from: user1
      });
      await exchange.depositAsset(weth.address, web3.utils.toWei("1"), {
        from: user1
      }).should.be.fulfilled;

      let balanceAsset = await exchange.getBalance(weth.address, user1);
      balanceAsset.toString().should.be.equal(String(1e8));

      // Check event values (amount is emitted in 10^8 format too)
      const event = await getLastEvent("NewAssetTransaction", user1);
      event.amount.should.be.equal(String(1e8));
      event.isDeposit.should.be.equal(true);
    });

    it("user can deposit wbtc to exchange", async () => {
      // WBTC has 8 decimals
      await wbtc.mint(user2, String(1e8), { from: owner }).should.be.fulfilled;
      await wbtc.approve(exchange.address, String(1e8), {
        from: user2
      });
      await exchange.depositAsset(wbtc.address, String(1e8), {
        from: user2
      }).should.be.fulfilled;

      let balanceAsset = await exchange.getBalance(wbtc.address, user2);
      balanceAsset.toString().should.be.equal(String(1e8));

      // Check event values (amount is emitted in 10^8 format too)
      const event = await getLastEvent("NewAssetTransaction", user2);
      event.amount.should.be.equal(String(1e8));
      event.isDeposit.should.be.equal(true);
    });

    it("user can deposit usdt to exchange", async () => {
      // USDT has 6 decimals
      await usdt.mint(user3, String(1e6), { from: owner }).should.be.fulfilled;
      await usdt.approve(exchange.address, String(1e6), {
        from: user3
      });
      await exchange.depositAsset(usdt.address, String(1e6), {
        from: user3
      }).should.be.fulfilled;

      let balanceAsset = await exchange.getBalance(usdt.address, user3);
      balanceAsset.toString().should.be.equal(String(1e8));

      // Check event values (amount is emitted in 10^8 format too)
      const event = await getLastEvent("NewAssetTransaction", user3);
      event.amount.should.be.equal(String(1e8));
      event.isDeposit.should.be.equal(true);
    });

  });

  describe("Exchange::withdraw", () => {
    it("user can withdraw eth from exchange", async () => {
      await exchange.withdraw(ZERO_ADDRESS, web3.utils.toWei("0.1"), {
        from: user1
      }).should.be.fulfilled;
      let balanceEth = await exchange.getBalance(ZERO_ADDRESS, user1);
      balanceEth.toString().should.be.equal(String(web3.utils.toWei("0")));

      // Check event values (amount is emitted in 10^8 format too)
      const event = await getLastEvent("NewAssetTransaction", user1);
      event.amount.should.be.equal(String(0.1e8));
      event.isDeposit.should.be.equal(false);
    });

    it("user can withdraw an asset from exchange", async () => {
      // User 1 withdraws 1 WETH
      await exchange.withdraw(weth.address, web3.utils.toWei("1"), {
        from: user1
      }).should.be.fulfilled;

      // User WETH balance is now 0 in exchange
      let assetBalance = await exchange.getBalance(weth.address, user1);
      assetBalance.toString().should.be.equal(String(web3.utils.toWei("0")));

      // User now has its balance in own wallet
      let balanceWeth = await weth.balanceOf(user1);
      balanceWeth.toString().should.be.equal(String(web3.utils.toWei("1")));

      // Check event values (amount is emitted in 10^8 format too)
      const event = await getLastEvent("NewAssetTransaction", user1);
      event.amount.should.be.equal(String(1e8));
      event.isDeposit.should.be.equal(false);
    });

    it("user can withdraw an asset with decimals = 6 from exchange", async () => {
      await exchange.withdraw(usdt.address, String(1e6), {
        from: user3
      }).should.be.fulfilled;

      // User USDT balance is now 0 in exchange
      let assetBalance = await exchange.getBalance(usdt.address, user3);
      assetBalance.toString().should.be.equal(String(web3.utils.toWei("0")));

      // User now has its balance in own wallet
      let balanceUSDT = await usdt.balanceOf(user3);
      balanceUSDT.toString().should.be.equal(String(1e6));
    });


    it("user can't withdraw an asset if does not hold enough balance", async () => {
      //User 1 tries to withdraw again
      await exchange.withdraw(weth.address, web3.utils.toWei("1"), {
        from: user1
      }).should.be.rejected;
    });
  });
});
