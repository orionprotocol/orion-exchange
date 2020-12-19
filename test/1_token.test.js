require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

let WETH = artifacts.require("WETH");

let weth;

contract("WETH", ([owner, user1, user2, newMinter, random]) => {
  describe("WETH::instance", async () => {
    weth = await WETH.deployed();
  });

  describe("WETH::details", () => {
    it("has correct symbol", async () => {
      let _symbol = await weth.symbol();
      _symbol.should.be.equal("WETH", "incorrect symbol");
    });

    it("has correct decimals", async () => {
      let _decimals = await weth.decimals();
      _decimals.toNumber().should.be.equal(18, "incorrect decimals");
    });

    it("has correct supply", async () => {
      let _supply = await weth.totalSupply();
      _supply.toNumber().should.be.equal(0, "incorrect supply");
    });
  });

  describe("WETH::minting", () => {
    it("check minter roles", async () => {
      let isMinter = await weth.isMinter(owner);
      isMinter.should.be.true;

      isMinter = await weth.isMinter(random);
      isMinter.should.be.false;
    });

    it("random address can't mint tokens", async () => {
      await weth.mint(user1, "1000", { from: random }).should.not.be.fulfilled;
    });

    it("only owner can mint tokens", async () => {
      await weth.mint(user1, "1000", { from: owner }).should.be.fulfilled;
    });

    it("can add new minter of coins", async () => {
      await weth.addMinter(newMinter).should.be.fulfilled;
    });
  });

  describe("WETH::transfering", () => {
    it("user 1 can transfer tokens", async () => {
      await weth.transfer(user2, "1000", { from: user1 }).should.be.fulfilled;
    });

    it("using approve and transfeFrom", async () => {
      await weth.mint(user1, "1000", { from: owner }).should.be.fulfilled;
      await weth.approve(owner, "1000", { from: user1 });
      await weth.transferFrom(user1, user2, "1000", { from: owner }).should.be
        .fulfilled;
    });
  });

});
