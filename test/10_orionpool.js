require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

const BN = require("bn.js");

const orders = require("./helpers/Orders.js");
const sigUtil = require("eth-sig-util");
const EIP712 = require("./helpers/EIP712.js");
const ChainManipulation = require("./helpers/ChainManipulation");
const eth_signTypedData = require("./helpers/GanacheSignatures.js");

const ExchangeWithOrionPool = artifacts.require("ExchangeWithOrionPool");
const WETH = artifacts.require("WETH");
const Orion = artifacts.require("Orion");
let USDT = artifacts.require("USDT");
let PriceOracle = artifacts.require("PriceOracle");

const LibValidator = artifacts.require("LibValidator");
const MarginalFunctionality = artifacts.require("MarginalFunctionality");

const OrionPoolRouter = artifacts.require("OrionPoolV2Router02Ext");
const Factory = artifacts.require("OrionPoolV2Factory");
const OrionPoolLibrary = artifacts.require("OrionPoolV2Library");
const Pair = artifacts.require("OrionPoolV2Pair");

let exchangeWithOrionPool, router, orion, usdt, weth, priceOracle, lib, marginalFunctionality, matcher, factory;

let theOne = '100000000';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';


contract("ExchangeWithOrionPool", ([owner, broker, user1, user3, user4]) => {
  describe("OrionPool::instance", () => {
      it("Create pair", async () => {
          exchangeWithOrionPool = await ExchangeWithOrionPool.deployed();
          orion = await Orion.deployed();
          usdt = await USDT.deployed();
          weth = await WETH.deployed(); //new("Wrapped Ethereum", "WETH", web3.utils.toWei("10000000"), 18);
          factory = await Factory.deployed();
          router = await OrionPoolRouter.deployed();

          priceOracle = await PriceOracle.deployed();
          matcher = owner;

          let orionMint = new BN(1000 * 10e8);
          let usdtMint = new BN(800 * 10e8);
          let wethMint = new BN(web3.utils.toWei("800"));
          await orion.mint(owner, orionMint, { from: owner });
          await usdt.mint(owner, usdtMint, { from: owner });
          await weth.mint(owner, wethMint, { from: owner });

          let orionApprove = orionMint.divn(10);
          let usdtApprove = usdtMint.divn(8);
          let wethApprove = wethMint.divn(8);

          await factory.createPair(orion.address, usdt.address);
          await factory.createPair(weth.address, usdt.address);
          await factory.createPair(weth.address, orion.address);

          await orion.approve(router.address, orionApprove, { from: owner });
          await usdt.approve(router.address, usdtApprove, { from: owner });

          var result = await router.addLiquidity(orion.address, usdt.address,
                                                orionApprove.toString(), usdtApprove.toString(),
                                                orionApprove.toString(), usdtApprove.toString(),
                                                owner,
                                                2000000000,
                                                {from: owner, gas: 6e6 }
          );

          await orion.approve(router.address, orionApprove.toString(), { from: owner });
          await weth.approve(router.address, wethApprove.toString(), { from: owner });

          var wethResult = await router.addLiquidity(orion.address, weth.address,
              orionApprove.toString(), wethApprove.toString(),
              orionApprove.toString(), wethApprove.toString(),
              owner,
              2000000000,
              {from: owner, gas: 6e6 }
          );



          await weth.approve(router.address, wethApprove.toString(), { from: owner });
          await usdt.approve(router.address, usdtApprove.toString(), {from: owner});
          await router.addLiquidity(weth.address, usdt.address,
                    wethApprove.toString(), usdtApprove.toString(),
                    wethApprove.toString(), usdtApprove.toString(),
              owner, "2000000000", { from: owner });

      });
  });
  describe("OrionPool::Exchanges", () => {
    it("user1 deposits 10 ORN", async () => {
      await orion.mint(user1, String(10e8), { from: owner });
      await orion.approve(exchangeWithOrionPool.address, String(10e8), {
        from: user1
      });
      await exchangeWithOrionPool.depositAsset(orion.address, String(10e8), {
        from: user1
      }).should.be.fulfilled;

      let balanceAsset = await exchangeWithOrionPool.getBalance(orion.address, user1);
      balanceAsset.toString().should.be.equal(String(10e8));
    });
      it("user1 exchange through orionpool pair", async () => {
        buyOrder  = await orders.generateOrder(user1, matcher, 1,
                                       usdt, orion, orion,
                                       100000,
                                       theOne,
                                       2000);
        //console.log("Get anounts In:" + (await router.getAmountsIn(7000000, [orion.address, usdt.address])).toString());
        (await exchangeWithOrionPool.getBalance(orion.address, user1)).toString().should.be.equal("1000000000");
        (await exchangeWithOrionPool.getBalance(usdt.address, user1)).toString().should.be.equal("0");
        await exchangeWithOrionPool.fillThroughOrionPool(
            buyOrder.order,
            100000,
            buyOrder.order.matcherFee,
            [orion.address, usdt.address],
            { from: matcher,
            gas:6e6}
        );
        //console.log((await exchangeWithOrionPool.getBalance(orion.address, user1)).toString(), (await exchangeWithOrionPool.getBalance(usdt.address, user1)).toString());
    });

    it("user1 exchange through orionpool pair again (initiated balances)", async () => {
        buyOrder  = await orders.generateOrder(user1, matcher, 1,
                                       usdt, orion, orion,
                                        100000,
                                        theOne,
                                       2000);
        //console.log(await router.getAmountsIn(7000000, [orion.address, usdt.address]));
        //console.log((await exchangeWithOrionPool.getBalance(orion.address, user1)).toString(), (await exchangeWithOrionPool.getBalance(usdt.address, user1)).toString());
        await exchangeWithOrionPool.fillThroughOrionPool(
            buyOrder.order,
            100000,
            buyOrder.order.matcherFee,
            [orion.address, usdt.address],
            { from: matcher }
        );
        //console.log((await exchangeWithOrionPool.getBalance(orion.address, user1)).toString(), (await exchangeWithOrionPool.getBalance(usdt.address, user1)).toString());
    });


    it("user1 exchange through orionpool 1-hop path", async () => {
        var ethAmount = theOne;
        let buyOrder  = await orders.generateOrder(user1, matcher, 1,
                                       weth, orion, orion,
                                       ethAmount,
                                       theOne*20,
                                       0);
        //we will sell orion and buy weth, so we need to mint orion equals to usdt
        await orion.mint(user1, theOne, { from: owner });

        await orion.approve(exchangeWithOrionPool.address, theOne, {
            from: user1
        }).should.be.fulfilled;
        await exchangeWithOrionPool.depositAsset(orion.address, theOne, {
            from: user1
        }).should.be.fulfilled;

        let orionBefore = await exchangeWithOrionPool.getBalance(orion.address, user1);
        //console.log("user1 exchange through orionpool 1-hop path, orionBefore:" + orionBefore);
        let wethBefore = await exchangeWithOrionPool.getBalance(weth.address, user1);
        //console.log("user1 exchange through orionpool 1-hop path, wethBefore:" + wethBefore);

        var path = [orion.address, usdt.address, weth.address];
        amountsIn = await router.getAmountsIn(ethAmount, path);

        await exchangeWithOrionPool.fillThroughOrionPool(
            buyOrder.order,
            ethAmount,
            buyOrder.order.matcherFee,
            path,
            { from: matcher }
        );
        let orionAfter = await exchangeWithOrionPool.getBalance(orion.address, user1);
        //console.log("user1 exchange through orionpool 1-hop path, orionBefore:" + orionAfter);
        let wethAfter = await exchangeWithOrionPool.getBalance(weth.address, user1);
        //console.log("user1 exchange through orionpool 1-hop path, wethBefore:" + wethAfter);
        (wethAfter - wethBefore).toString().should.be.equals(theOne);
        (1*orionBefore).should.be.greaterThan(1*orionAfter);
    });

    //sell orders go here
    it("SELL ORDER user1 exchange through orionpool pair", async () => {
        let buyAmount = theOne; //1 ETH
        let fee = '0'; //fee will be zero because orionpool takes fee itself

        let sellOrder  = await orders.generateOrder(user1, matcher, 0,
            orion, usdt, orion,
            buyAmount,
            theOne,
            fee
        );

        //we will sell orion and buy usdt, so we need to mint orion equals to usdt
        await orion.mint(user1, buyAmount, { from: owner });

        await orion.approve(exchangeWithOrionPool.address, buyAmount, {
            from: user1
        }).should.be.fulfilled;
        await exchangeWithOrionPool.depositAsset(orion.address, buyAmount, {
            from: user1
        }).should.be.fulfilled;
        let orionBefore = await exchangeWithOrionPool.getBalance(orion.address, user1);
        let usdtBefore = await exchangeWithOrionPool.getBalance(usdt.address, user1);


        await exchangeWithOrionPool.fillThroughOrionPool(
            sellOrder.order,
            buyAmount,
            sellOrder.order.matcherFee,
            [orion.address, usdt.address],
            { from: matcher,
              gas:6e6}
        ).should.be.fulfilled;
        let orionAfter = await exchangeWithOrionPool.getBalance(orion.address, user1);
        let usdtAfter = await exchangeWithOrionPool.getBalance(usdt.address, user1);
        (usdtAfter-usdtBefore).should.be.greaterThan(buyAmount*0.97); //0.97 - we must account percent has been taken by orionpool
        (orionBefore-orionAfter).toString().should.be.equal(buyAmount);
    });
  });
});
