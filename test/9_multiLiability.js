require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

const orders = require("./helpers/Orders.js");
const sigUtil = require("eth-sig-util");
const EIP712 = require("./helpers/EIP712.js");
const ChainManipulation = require("./helpers/ChainManipulation");
const eth_signTypedData = require("./helpers/GanacheSignatures.js");

const Exchange = artifacts.require("ExchangeWithOrionPool");
const Token = artifacts.require("WETH");
const Orion = artifacts.require("Orion");
let PriceOracle = artifacts.require("PriceOracle");

const LibValidator = artifacts.require("LibValidator");
const MarginalFunctionality = artifacts.require("MarginalFunctionality");



let exchange, orion, priceOracle, lib, marginalFunctionality;
let oraclePub, matcher, priceProvider;

const totalTokensNum = 20;
let tokens = [];

const OrionPrice = 1e8;
const ETHPrice = 143e8;
const tokenPrices = 0.5e8;

const orionWeight = 220;
const ethWeight = 190;

const stakeRisk = 242;
const liquidationPremium = 12;
const initialOrionBalance = Math.floor(5000e8);
const initialRawETHBalance = Math.floor(3e18); //~430 ORN
const stakeAmount = Math.floor(200e8);

const lockingDuration = 3600*24;
const overdueDuration = 3600*24;
const priceOverdue = 3600*3;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

let generateData = async(assets,priceData) => {
      prices= {
        assetAddresses: assets,
        prices: priceData,
        timestamp: await ChainManipulation.getBlokchainTime(),
        signature: "0x00"
      };
      return prices;
}      


contract("Exchange", ([owner, broker, user2, user3, user4]) => {
  describe("Exchange::instance", () => {
      it("deploy", async () => {
        exchange = await Exchange.deployed();
        orion = await Orion.deployed();
        for(let i =0; i< totalTokensNum; i++) {
          tokens.push(await Token.new());
        }
        priceOracle = await PriceOracle.deployed();
        priceProvider = oraclePub = user2; //Defined in migrations
        matcher = owner;
      });

      //Helper
      let depositAsset = async (asset, amount, user) => {
              let balanceBefore = await exchange.getBalance(asset.address, user);
              let _amount = String(amount);
              await asset.mint(user, _amount, { from: owner }).should.be
                .fulfilled;
              await asset.approve(exchange.address, _amount, {
                from: user
              });
              await exchange.depositAsset(asset.address, _amount, {
                from: user
              }).should.be.fulfilled;
              let balanceAsset = await exchange.getBalance(asset.address, user);
              (balanceAsset-balanceBefore).toString().should.be.equal(String(amount));
      };

      it("users deposit assets to exchange", async () => {
        for(let user of [broker, user2, user3]) {
          await depositAsset(orion, initialOrionBalance, user);
          exchange.deposit({ from: user, value: String(initialRawETHBalance) });
        }
      });
      it("broker stake some orion", async () => {
        await exchange.lockStake(stakeAmount, {from:broker}).should.be.fulfilled;
        await ChainManipulation.advanceTime(1);
        await ChainManipulation.advanceBlock();
      });
      it("admin provide price data", async () => {
        await priceOracle.changePriceProviderAuthorization([priceProvider],[],{from: owner}).should.be.fulfilled;
        let priceTokens = [];
        for(let i =0; i< totalTokensNum; i++) {
          priceTokens.push(tokens[i].address);
        }
        priceTokens.push(ZERO_ADDRESS);
        priceTokens.push(orion.address);
        let priceArray=[];
        for (var i = 0; i < totalTokensNum; i++) {
            priceArray.push(tokenPrices);
          }
        priceArray.push(ETHPrice);
        priceArray.push(OrionPrice);
        prices= await generateData(priceTokens,priceArray);
        await priceOracle.provideDataAddressAuthorization(prices, {from: priceProvider}
                                  ).should.be.fulfilled;
      });
      it("admin set risks", async () => {
        await exchange.updateMarginalSettings(
                       [orion.address, ZERO_ADDRESS],
                       stakeRisk, liquidationPremium,
                       priceOverdue, overdueDuration,
                       {from: owner})
              .should.be.fulfilled;
        await exchange.updateAssetRisks(
                       [orion.address, ZERO_ADDRESS],
                       [orionWeight, ethWeight],
                       {from: owner}
                       )
              .should.be.fulfilled;
      });
  });

  describe("Exchange::create liabilities", () => {
      it("exchanges", async () => {
        const liabilityNum = 7;
        let trades = [];
        for (var i = 0; i < liabilityNum; i++) {
          trades.push([tokens[i], String(1e8), tokenPrices]);
        }        

        for(let trade of trades) {
          let sellOrder  = await orders.generateOrder(broker, matcher, 0,
                                                 trade[0], orion, orion,
                                                 trade[1],
                                                 trade[2],
                                                 350000);
          let buyOrder  = await orders.generateOrder(user2, matcher, 1,
                                                 trade[0], orion, orion,
                                                 trade[1],
                                                 trade[2],
                                                 350000);
          await exchange.fillOrders(
            buyOrder.order,
            sellOrder.order,
            trade[2],
            trade[1],
            { from: matcher }
          ).should.be.fulfilled;
        }
      });
  });

  describe("Exchange::trade", () => {
      it("1 echange", async () => {
        let trades = [];
        trades.push([{address:ZERO_ADDRESS}, String(1e6), ETHPrice]);

        for(let trade of trades) {
          let sellOrder  = await orders.generateOrder(broker, matcher, 0,
                                                 trade[0], orion, orion,
                                                 trade[1],
                                                 trade[2],
                                                 350000);
          let buyOrder  = await orders.generateOrder(user3, matcher, 1,
                                                 trade[0], orion, orion,
                                                 trade[1],
                                                 trade[2],
                                                 350000);
          await exchange.fillOrders(
            buyOrder.order,
            sellOrder.order,
            trade[2],
            trade[1],
            { from: matcher }
          ).should.be.fulfilled;
        }
      });
  });
  
});  
