const BigNumber = web3.utils.BN;
require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

let Exchange = artifacts.require("Exchange");
let ORN = artifacts.require("ORN");

let exchange, orionToken;

contract("Exchange", ([owner, user1, user2, otherAsset]) => {
  describe("Exchange::instance", async () => {
    exchange = await Exchange.deployed();
    orionToken = await ORN.deployed();
  });

  describe("Exchange::access", () => {
    it("correct owner of contract", async () => {
      let _owner = await exchange.owner();
      _owner.should.be.equal(owner);
    });
  });

  describe("Exchange::deposit", () => {
    it("user can deposit wan to exchange", async () => {
      await exchange.depositEth({ from: user1, value: web3.utils.toWei("0.1") })
        .should.be.fulfilled;
      let balanceEth = await exchange.getEthBalance(user1);
      balanceEth.toString().should.be.equal(String(web3.utils.toWei("0.1")));
    });

    it("user can deposit asset to exchange", async () => {
      await orionToken.mint(user1, web3.utils.toWei("1"), { from: owner })
        .should.be.fulfilled;
      await orionToken.approve(exchange.address, web3.utils.toWei("1"), {
        from: user1
      });
      await exchange.depositAsset(orionToken.address, web3.utils.toWei("1"), {
        from: user1
      }).should.be.fulfilled;

      let balanceAsset = await exchange.getAssetBalance(
        orionToken.address,
        user1
      );
      balanceAsset.toString().should.be.equal(String(web3.utils.toWei("1")));
    });
  });

  describe("Exchange::make order", () => {
    it("user can create an order", async () => {
      let order = [
        user1,
        user2,
        orionToken.address,
        otherAsset,
        orionToken.address,
        1,
        100,
        2,
        165,
        1569377300,
        true
      ];

      await exchange.makeOrder(order, { from: user1 }).should.be.fulfilled;
      let totalOrders = await exchange.totalOrders();

      let orderInfo = await exchange.orders(totalOrders.toNumber());
      orderInfo.senderAddress.should.be.equal(user1);
      orderInfo.matcherAddress.should.be.equal(user2);
      orderInfo.baseAsset.should.be.equal(orionToken.address);
    });
  });
});
