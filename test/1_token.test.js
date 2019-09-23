const BigNumber = web3.utils.BN;
require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

let ORN = artifacts.require("ORN");

let orn;

contract("ORN", ([owner, user1, user2, newMinter, random]) => {
  describe("ORN::instance", async () => {
    orn = await ORN.deployed();
  });

  describe("ORN::details", () => {
    it("has correct symbol", async () => {
      let _symbol = await orn.symbol();
      _symbol.should.be.equal("ORN", "incorrect symbol");
    });

    it("has correct decimals", async () => {
      let _decimals = await orn.decimals();
      _decimals.toNumber().should.be.equal(18, "incorrect decimals");
    });

    it("has correct supply", async () => {
      let _supply = await orn.totalSupply();
      _supply.toNumber().should.be.equal(0, "incorrect supply");
    });
  });

  describe("ORN::minting", () => {
    it("check minter roles", async () => {
      let isMinter = await orn.isMinter(owner);
      isMinter.should.be.true;

      isMinter = await orn.isMinter(random);
      isMinter.should.be.false;
    });

    it("random address can't mint tokens", async () => {
      await orn.mint(user1, "1000", { from: random }).should.not.be.fulfilled;
    });

    it("only owner can mint tokens", async () => {
      await orn.mint(user1, "1000", { from: owner }).should.be.fulfilled;
    });

    it("can add new minter of coins", async () => {
      await orn.addMinter(newMinter).should.be.fulfilled;
    });
  });

  describe("ORN::transfering", () => {
    it("user 1 can transfer tokens", async () => {
      await orn.transfer(user2, "1000", { from: user1 }).should.be.fulfilled;
    });

    it("using approve and transfeFrom", async () => {
      await orn.mint(user1, "1000", { from: owner }).should.be.fulfilled;
      await orn.approve(owner, "1000", { from: user1 });
      await orn.transferFrom(user1, user2, "1000", { from: owner }).should.be
        .fulfilled;
    });
  });
});
