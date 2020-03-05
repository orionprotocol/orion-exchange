require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

let Exchange = artifacts.require("Exchange");
let WETH = artifacts.require("WETH");
let WBTC = artifacts.require("WBTC");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"; // WAN or ETH "asset" address in balanaces

let exchange, weth, wbtc;

async function getLastEvent(eventName, user) {
  let events = await exchange.getPastEvents(eventName, {
    user
  });

  return events[0].returnValues;
}

contract("Exchange", ([owner, user1, user2]) => {
  describe("Exchange::instance", async () => {
    exchange = await Exchange.deployed();
    weth = await WETH.deployed();
    wbtc = await WBTC.deployed();
  });

  describe("Exchange::access", () => {
    it("correct owner of contract", async () => {
      let _owner = await exchange.owner();
      _owner.should.be.equal(owner);
    });
  });

  describe("Exchange::deposit", () => {
    it("user can deposit wan to exchange", async () => {
      await exchange.depositWan({ from: user1, value: web3.utils.toWei("0.1") })
        .should.be.fulfilled;
      let balanceWan = await exchange.getBalance(ZERO_ADDRESS, user1);

      // Balance responses are in 10^8 format
      balanceWan.toString().should.be.equal(String(0.1e8));

      // Check event values (amount is emitted in 10^8 format too)
      const event = await getLastEvent("NewAssetDeposit", user1);
      event.amount.should.be.equal(String(0.1e8));
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
      const event = await getLastEvent("NewAssetDeposit", user1);
      event.amount.should.be.equal(String(1e8));
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
      const event = await getLastEvent("NewAssetDeposit", user2);
      event.amount.should.be.equal(String(1e8));
    });
  });

  describe("Exchange::withdraw", () => {
    it("user can withdraw wan from exchange", async () => {
      await exchange.withdraw(ZERO_ADDRESS, web3.utils.toWei("0.1"), {
        from: user1
      }).should.be.fulfilled;
      let balanceWan = await exchange.getBalance(ZERO_ADDRESS, user1);
      balanceWan.toString().should.be.equal(String(web3.utils.toWei("0")));

      // Check event values (amount is emitted in 10^8 format too)
      const event = await getLastEvent("NewAssetWithdrawl", user1);
      event.amount.should.be.equal(String(0.1e8));
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
      const event = await getLastEvent("NewAssetWithdrawl", user1);
      event.amount.should.be.equal(String(1e8));
    });

    it("user can't withdraw an asset if does not hold enough balance", async () => {
      //User 1 tries to withdraw again
      await exchange.withdraw(weth.address, web3.utils.toWei("1"), {
        from: user1
      }).should.be.rejected;
    });
  });
});
