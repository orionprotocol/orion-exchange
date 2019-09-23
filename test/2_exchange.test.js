const BigNumber = web3.utils.BN;
require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

let Exchange = artifacts.require("Exchange");
let ORN = artifacts.require("ORN");

let exchange, orionToken;

contract("Exchange", ([owner, user1, user2, random]) => {
  describe("Exchange::instance", async () => {
    exchange = await Exchange.deployed();
    orionToken = await ORN.deployed();
  });

  describe("Exchange::Access", () => {
    it("correct owner of contract", async () => {
      let _owner = await exchange.owner();
      _owner.should.be.equal(owner);
    });
  });

  describe("Exchange::deposit", () => {
    it("user can deposit eth to exchange", async () => {
      await exchange.depositEth({ from: user1, value: web3.utils.toWei("1") })
        .should.be.fulfilled;
      let balanceEth = await exchange.getEthBalance(user1);
      balanceEth.toString().should.be.equal(String(web3.utils.toWei("1")));
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
});
