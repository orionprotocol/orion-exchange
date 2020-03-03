require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

const Exchange = artifacts.require("Exchange");
const OrionProxy = artifacts.require("OrionProxy");
const WETH = artifacts.require("WETH");
const WBTC = artifacts.require("WBTC");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"; // WAN or ETH "asset" address in balanaces

let exchange, proxy;

contract("Exchange", ([owner, user1, user2]) => {
  describe("Exchange::instance", async () => {
    exchange = await Exchange.deployed();
    proxy = await Exchange.at(OrionProxy.address);
    weth = await WETH.deployed();
    wbtc = await WBTC.deployed();
  });

  describe("Exchange::access", () => {
    it("correct owner of contracts", async () => {
      let _owner = await exchange.owner();
      _owner.should.be.equal(owner);

      let _owner2 = await proxy.owner();
      _owner2.should.be.equal(owner);
    });
  });

  describe("Exchange::deposit", () => {
    it("user can deposit wan to exchange", async () => {
      await proxy.depositWan({ from: user1, value: web3.utils.toWei("0.1") })
        .should.be.fulfilled;
      let balanceWan = await proxy.getBalance(ZERO_ADDRESS, user1);

      // Balance responses are in 10^8 format
      balanceWan.toString().should.be.equal(String(0.1e8));
    });

    it("proxy contract holds funds", async () => {
      let contractBalance = await web3.eth.getBalance(proxy.address);
      contractBalance.toString().should.be.equal(String(0.1e18));
    });

    it("logic contract does not hold user funds", async () => {
      let balanceWan = await exchange.getBalance(ZERO_ADDRESS, user1);
      // Balance responses are in 10^8 format
      balanceWan.toString().should.be.equal("0");

      let contractBalance = await web3.eth.getBalance(Exchange.address);
      contractBalance.toString().should.be.equal("0");
    });
  });

  describe("Exchange::withdraw", () => {
    it("user can't withdraw wan from exchange directly", async () => {
      await exchange.withdraw(ZERO_ADDRESS, web3.utils.toWei("0.1"), {
        from: user1
      }).should.be.rejected;
    });

    it("user can withdraw wan to exchange using proxy", async () => {
      await proxy.withdraw(ZERO_ADDRESS, web3.utils.toWei("0.1"), {
        from: user1
      }).should.be.fulfilled;
      let balanceWan = await proxy.getBalance(ZERO_ADDRESS, user1);
      balanceWan.toString().should.be.equal(String(web3.utils.toWei("0")));
    });
  });
});
