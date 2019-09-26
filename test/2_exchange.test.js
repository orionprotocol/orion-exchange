const BigNumber = web3.utils.BN;
require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

let Exchange = artifacts.require("Exchange");
let ORN = artifacts.require("ORN");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

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
      await exchange.depositWan({ from: user1, value: web3.utils.toWei("0.1") })
        .should.be.fulfilled;
      let balanceWan = await exchange.getBalance(ZERO_ADDRESS, user1);
      balanceWan.toString().should.be.equal(String(web3.utils.toWei("0.1")));
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

      let balanceAsset = await exchange.getBalance(orionToken.address, user1);
      balanceAsset.toString().should.be.equal(String(web3.utils.toWei("1")));
    });
  });
});
