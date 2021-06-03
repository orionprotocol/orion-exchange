require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

const { ethers } = require("hardhat");

describe("Token contracts", () => {
  let owner, user1, user2, newMinter, random;
  let weth;

  before(async function () {
    [owner, user1, user2, newMinter, random] = await ethers.getSigners();
  });

  beforeEach(async function () {
    const WETH = await ethers.getContractFactory("WETH");
    weth = await WETH.deploy();
  });

  describe("WETH::details", () => {
    it("has correct symbol", async () => {
      (await weth.symbol()).should.be.equal("WETH", "incorrect symbol");
    });

    it("has correct decimals", async () => {
      (await weth.decimals()).should.be.equal(18, "incorrect decimals");
    });

    it("has correct supply", async () => {
      (await weth.totalSupply()).should.be.equal(0, "incorrect supply");
    });
  });

  describe("WETH::minting", () => {
    it("check minter roles", async () => {
      (await weth.isMinter(owner.address)).should.be.true;

      (await weth.isMinter(random.address)).should.be.false;
    });

    it("random address can't mint tokens", async () => {
      await weth.connect(random).mint(user1.address, "1000").should.not.be.fulfilled;
    });

    it("only owner can mint tokens", async () => {
      await weth.mint(user1.address, "1000").should.be.fulfilled;
    });

    it("can add new minter of coins", async () => {
      await weth.addMinter(newMinter.address).should.be.fulfilled;
    });
  });

  describe("WETH::transfering", () => {
    it("user 1 can transfer tokens", async () => {
      await weth.mint(user1.address, "1000").should.be.fulfilled;
      await weth.connect(user1).transfer(user2.address, "1000").should.be.fulfilled;
    });

    it("using approve and transfeFrom", async () => {
      await weth.mint(user1.address, "1000").should.be.fulfilled;
      await weth.connect(user1).approve(owner.address, "1000").should.be.fulfilled;
      await weth.transferFrom(user1.address, user2.address, "1000").should.be.fulfilled;
    });
  });

});
