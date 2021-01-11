require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

const orders = require("./helpers/Orders.js");
const sigUtil = require("eth-sig-util");
const EIP712 = require("./helpers/EIP712.js");
const ChainManipulation = require("./helpers/ChainManipulation");
const eth_signTypedData = require("./helpers/GanacheSignatures.js");

const Exchange = artifacts.require("ExchangeWithUniswap");
const WETH = artifacts.require("GenericToken");
const Orion = artifacts.require("Orion");
let USDT = artifacts.require("USDT");
let PriceOracle = artifacts.require("PriceOracle");

const LibValidator = artifacts.require("LibValidator");
const MarginalFunctionality = artifacts.require("MarginalFunctionality");

const UniswapRouter = artifacts.require("UniswapV2Router02");
const Factory = artifacts.require("UniswapV2Factory");
const UniswapLibrary = artifacts.require("UniswapV2Library");
const uPair = artifacts.require("UniswapV2Pair");

let exchange, router, orion, usdt, weth, priceOracle, lib, marginalFunctionality, matcher;

contract("ExchangeWithUniswap", ([owner, broker, user1, user3, user4]) => {
  describe("Uniswap::instance", () => {
      it("Create pair", async () => {
        exchange = await Exchange.deployed();
        orion = await Orion.deployed();
        usdt = await USDT.deployed();
        weth = await WETH.new("Wrapped Ethereum", "WETH", web3.utils.toWei("10000000"), 18);
        router = await UniswapRouter.deployed();
        var factory = await Factory.deployed();

        await orion.mint(owner, "200000000000", { from: owner });
        await usdt.mint(owner, "20000000000", { from: owner });
        await weth.mint(owner, web3.utils.toWei("10"), { from: owner });

        await orion.approve(router.address, "200000000000", { from: owner });
        await usdt.approve(router.address, "20000000000", { from: owner });
        await weth.approve(router.address, web3.utils.toWei("10"), { from: owner });
        var pair = await factory.createPair(orion.address, usdt.address);
        // 3.5 orn/usdt
        var result =  await router.addLiquidity(orion.address, usdt.address, "100000000000", "3500000000", "10000000", "1000000", owner, "2000000000", { from: owner });
        // 1200 weth/usdt
        await router.addLiquidity(weth.address, usdt.address, web3.utils.toWei("10"), "12000000000", "10000000", "1000000", owner, "2000000000", { from: owner });
        matcher = owner;
      });
  });
  describe("Uniswap::Exchanges", () => {
    it("user1 deposits 10 ORN", async () => {
      await orion.mint(user1, String(10e8), { from: owner });
      await orion.approve(exchange.address, String(10e8), {
        from: user1
      });
      await exchange.depositAsset(orion.address, String(10e8), {
        from: user1
      }).should.be.fulfilled;

      let balanceAsset = await exchange.getBalance(orion.address, user1);
      balanceAsset.toString().should.be.equal(String(10e8));
    });
    it("user1 exchange through uniswap pair", async () => {
        buyOrder  = await orders.generateOrder(user1, matcher, 1,
                                       usdt, orion, orion,
                                       700000000,
                                       31250000, // current price is aroun 3.5, we set it with slippage to 3.2
                                       200000000);
        console.log(await router.getAmountsIn(7000000, [orion.address, usdt.address]));
        console.log((await exchange.getBalance(orion.address, user1)).toString(), (await exchange.getBalance(usdt.address, user1)).toString());
        await exchange.fillThroughUniswap(
            buyOrder.order,
            700000000,
            [orion.address, usdt.address],
            { from: matcher }
        );
        console.log((await exchange.getBalance(orion.address, user1)).toString(), (await exchange.getBalance(usdt.address, user1)).toString());
    });

    it("user1 exchange through uniswap pair again (initiated balances)", async () => {
        buyOrder  = await orders.generateOrder(user1, matcher, 1,
                                       usdt, orion, orion,
                                       100000000,
                                       31250000, // current price is aroun 3.5, we set it with slippage to 3.2
                                       0);
        console.log(await router.getAmountsIn(7000000, [orion.address, usdt.address]));
        console.log((await exchange.getBalance(orion.address, user1)).toString(), (await exchange.getBalance(usdt.address, user1)).toString());
        await exchange.fillThroughUniswap(
            buyOrder.order,
            100000000,
            [orion.address, usdt.address],
            { from: matcher }
        );
        console.log((await exchange.getBalance(orion.address, user1)).toString(), (await exchange.getBalance(usdt.address, user1)).toString());
    });


    it("user1 exchange through uniswap 1-hop path", async () => {
        var ethAmount = 10000; // 0.0001 ETH
        buyOrder  = await orders.generateOrder(user1, matcher, 1,
                                       weth, orion, orion,
                                       ethAmount, //0.01ETH
                                       40000000000, // price is about 350 ORN/usdt, set 310
                                       200000000);
        var path = [orion.address, usdt.address, weth.address];
        console.log(await router.getAmountsIn(web3.utils.toWei("0.0001"), path));
        console.log((await exchange.getBalance(orion.address, user1)).toString(), (await exchange.getBalance(usdt.address, user1)).toString());
        await exchange.fillThroughUniswap(
            buyOrder.order,
            ethAmount,
            path,
            { from: matcher }
        );
        console.log((await exchange.getBalance(orion.address, user1)).toString(), (await exchange.getBalance(usdt.address, user1)).toString(),
                    (await exchange.getBalance(weth.address, user1)).toString());
    });
  });
});
