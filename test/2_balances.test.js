require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

const {
  getRandomAmount,
  convertToNormalBasis,
  convertToExchangeBasis
} = require('./helpers/balancesHelper.js');

let Exchange = artifacts.require("ExchangeWithOrionPool");
let WETH = artifacts.require("WETH");
let WBTC = artifacts.require("WBTC");
let USDT = artifacts.require("USDT");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"; // WAN or ETH "asset" address in balanaces
let exchange, weth, wbtc, usdt, tokenCollection, tokenBalances;

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

    tokenCollection = [weth, wbtc, usdt];
    tokenBalances = await Promise.all(tokenCollection.map(token => getRandomAmount(token)));
  });

  describe("Exchange::access", () => {
    it("correct owner of contract", async () => {
      let _owner = await exchange.owner();
      _owner.should.be.equal(owner);
    });
  });

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
      event.assetAddress.should.be.equal(ZERO_ADDRESS);
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

    it("user can deposit specified tokens to exchange", async () => {
      const depositToken = async (token, userAddress, amount) => {
        await token.mint(userAddress, amount, { from: owner }).should.be.fulfilled;
        await token.approve(exchange.address, amount, {from: userAddress});
        await exchange.depositAsset(token.address, amount, {from: userAddress})
            .should.be.fulfilled;

        let balanceAsset = await exchange.getBalance(token.address, userAddress);
        const exchangeBasisAmount = await convertToExchangeBasis(token, amount);
        balanceAsset.toString().should.be.equal(exchangeBasisAmount.toString());

        const event = await getLastEvent("NewAssetTransaction", userAddress);
        event.amount.should.be.equal(exchangeBasisAmount.toString());
        event.isDeposit.should.be.equal(true);
        event.assetAddress.should.be.equal(token.address);
      }

      const users = [user1, user2, user3]
      for (const i in tokenCollection) {
        await depositToken(tokenCollection[i], users[i], tokenBalances[i]);
      }
    })
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
      const balance = await exchange.getBalance(weth.address, user1);
      const withdrawAmount = await convertToNormalBasis(weth, balance);
      await exchange.withdraw(weth.address, withdrawAmount, {
        from: user1
      }).should.be.fulfilled;

      // User WETH balance is now 0 in exchange
      let assetBalance = await exchange.getBalance(weth.address, user1);
      assetBalance.toString().should.be.equal(String(web3.utils.toWei("0")));

      // User now has its balance in own wallet
      let balanceWeth = await weth.balanceOf(user1);
      balanceWeth.toString().should.be.equal(withdrawAmount.toString());

      // Check event values (amount is emitted in 10^8 format too)
      const event = await getLastEvent("NewAssetTransaction", user1);
      event.amount.should.be.equal(balance.toString());
      event.isDeposit.should.be.equal(false);
    });

    it("user can withdraw an asset with decimals = 6 from exchange", async () => {
      const balance = await exchange.getBalance(usdt.address, user3);
      const withdrawAmount = await convertToNormalBasis(usdt, balance);
      await exchange.withdraw(usdt.address, withdrawAmount, {
        from: user3
      }).should.be.fulfilled;

      // User USDT balance is now 0 in exchange
      let assetBalance = await exchange.getBalance(usdt.address, user3);
      assetBalance.toString().should.be.equal(String(web3.utils.toWei("0")));

      // User now has its balance in own wallet
      let balanceUSDT = await usdt.balanceOf(user3);
      balanceUSDT.toString().should.be.equal(withdrawAmount.toString());
    });

    it("user can't withdraw an asset if does not hold enough balance", async () => {
      //User 1 tries to withdraw again
      await exchange.withdraw(weth.address, web3.utils.toWei("1"), {
        from: user1
      }).should.be.rejected;
    });
  });
});
