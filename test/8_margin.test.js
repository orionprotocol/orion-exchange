require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

const orders = require("./helpers/Orders.js");
const sigUtil = require("eth-sig-util");
const privKeyHelper = require("./helpers/PrivateKeys.js");
const EIP712 = require("./helpers/EIP712.js");
const ChainManipulation = require("./helpers/ChainManipulation");

const Exchange = artifacts.require("Exchange");
const WETH = artifacts.require("WETH");
const WBTC = artifacts.require("WBTC");
const WXRP = artifacts.require("WXRP");
const Orion = artifacts.require("Orion");
const Staking = artifacts.require("Staking");
let PriceOracle = artifacts.require("PriceOracle");

const LibValidator = artifacts.require("LibValidator");
const MarginalFunctionality = artifacts.require("MarginalFunctionality");


const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"; // WAN or ETH "asset" address in balanaces

let exchange, weth, wbtc, wxrp, orion, staking, priceOracle, lib, marginalFunctionality;
let oraclePub, matcher;

const initialOrionBalance = Math.floor(5000e8);
const initialWBTCBalance = Math.floor(1e7); //~430 ORN
const initialWETHBalance = Math.floor(3e8); //~430 ORN
const initialWXRPBalance = Math.floor(4300e8); //~430 ORN
const initialRawETHBalance = Math.floor(3e18); //~430 ORN
const initialETHBalance = Math.floor(initialRawETHBalance/1e10);
const stakeAmount = Math.floor(200e8);
const lockingDuration = 3600*24;

const OrionPrice = 1e8;
const WBTCPrice = 4321e8; //4321 orions per one btc
const WXRPPrice = 1e7; //0.1 orions per one xrp
const WETHPrice = 143e8; //143 orions per one ether
const ETHPrice = 143e8; //143 orions per one ether

// Weights for position calculation
const orionWeight = 220;
const wbtcWeight = 200;
const ethWeight = 190;
const wethWeight = 10;
const stakeRisk = 242;

function calcCollateral(orionStake, orion, wbtc, weth, eth) {
      let weighted = stakeRisk*Math.floor(orionStake/255) + 
          Math.floor(orion/255)*orionWeight  + 
          Math.floor(Math.floor(wbtc* WBTCPrice/1e8) /255) * wbtcWeight + 
          Math.floor(Math.floor(weth* WETHPrice/1e8) /255) * wethWeight  + 
          Math.floor(Math.floor(eth* ETHPrice/1e8) /255) * ethWeight; 
      let total = orionStake + orion + Math.floor(wbtc* WBTCPrice/1e8) +
                  Math.floor(weth* WETHPrice/1e8) +
                  Math.floor(eth* ETHPrice/1e8);
      return {weightedPosition: weighted, totalPosition: total};
}

contract("Exchange", ([owner, user1, user2]) => {
  describe("Exchange::instance", () => {
      it("deploy", async () => {
        exchange = await Exchange.deployed();
        weth = await WETH.deployed();
        wbtc = await WBTC.deployed();
        wxrp = await WXRP.deployed();
        orion = await Orion.deployed();
        lib = await LibValidator.deployed();
        priceOracle = await PriceOracle.deployed();
        staking = await Staking.deployed(orion.address);
        marginalFunctionality = await MarginalFunctionality.deployed();
        oraclePub = user2; //Defined in migrations
        matcher = owner;
    });
  });

  describe("Exchange::margin setup", () => {
    it("users deposit assets to exchange", async () => {
      let depositAsset = async (asset, amount, user) => {
        let _amount = String(amount);
        if(asset.address==weth.address){
          _amount = String(amount * 1e10);
        }
        await asset.mint(user, _amount, { from: owner }).should.be
          .fulfilled;
        await asset.approve(exchange.address, _amount, {
          from: user
        });
        await exchange.depositAsset(asset.address, _amount, {
          from: user
        }).should.be.fulfilled;
        let balanceAsset = await exchange.getBalance(asset.address, user);
        balanceAsset.toString().should.be.equal(String(amount));     
      };
      for(let user of [user1, user2]) {
        await depositAsset(orion, initialOrionBalance, user);
        await depositAsset(wbtc, initialWBTCBalance, user);
        await depositAsset(weth, initialWETHBalance, user);
        await depositAsset(wxrp, initialWXRPBalance, user);
        
        exchange.deposit({ from: user, value: String(initialRawETHBalance) });
        let balanceAsset = await exchange.getBalance(ZERO_ADDRESS, user);
        balanceAsset.toString().should.be.equal(String(initialETHBalance));
      }
    });

    it("user1 stake some orion", async () => {
      await staking.setExchangeAddress(exchange.address, {from:owner}).should.be
            .fulfilled;
      await staking.lockStake(stakeAmount, {from:user1}).should.be.fulfilled;
      await ChainManipulation.advanceTime(lockingDuration+1);
      await ChainManipulation.advanceBlock();
    });

    it("admin provide price data", async () => {
      let _oracle = await priceOracle.oraclePublicKey();
      _oracle.should.be.equal(oraclePub);
      prices= {
        assetAddresses: [weth.address, wbtc.address, orion.address, ZERO_ADDRESS],
        prices: [WETHPrice, WBTCPrice, OrionPrice, ETHPrice],
        timestamp: Date.now()
      };
      let msgParams = {
             types: {
               EIP712Domain: EIP712.domain,
               Prices: EIP712.pricesType,
             },
             domain: EIP712.domainData,
             primaryType: "Prices",
             message: prices,
      };
      msgParams1 = { data: msgParams };
      signature1 = sigUtil.signTypedData_v4(privKeyHelper.getPrivKey(oraclePub), msgParams1);
      prices.signature = signature1;
      await priceOracle.provideData(prices, { from: user1 }
                                ).should.be.fulfilled;
    });

    it("admin set risks", async () => {
      await exchange.updateMarginalSettings(
                     [orion.address, weth.address, wbtc.address, ZERO_ADDRESS],
                     stakeRisk, 12,
                     3 * 3600, 24 * 3600,
                     {from: owner})
            .should.be.fulfilled;
      await exchange.updateAssetRisks(
                     [orion.address, wbtc.address, ZERO_ADDRESS, weth.address],
                     [orionWeight, wbtcWeight, ethWeight, wethWeight],
                     {from: owner}
                     )
            .should.be.fulfilled;
    });
  });
  describe("Exchange::margin trades", () => {
    it("unsophisticated user has correct position", async () => {
      let user2Position = await exchange.calcPosition(user2);
      let user2PositionJs = calcCollateral(0, 
                                         initialOrionBalance, 
                                         initialWBTCBalance, 
                                         initialWETHBalance, 
                                         initialETHBalance);
      user2Position.weightedPosition.should.be.equal(String(user2PositionJs.weightedPosition));
      user2Position.totalPosition.should.be.equal(String(user2PositionJs.totalPosition));
    });

    it("broker has correct initial position", async () => {
      let user1Position = await exchange.calcPosition(user1);
      let user1PositionJs = calcCollateral(stakeAmount, 
                                         (initialOrionBalance-stakeAmount), 
                                         initialWBTCBalance, 
                                         initialWETHBalance, 
                                         initialETHBalance); 
      user1Position.weightedPosition.should.be.equal(String(user1PositionJs.weightedPosition));
      user1Position.totalPosition.should.be.equal(String(user1PositionJs.totalPosition));
    });

    it("broker can make marginal trades", async () => {
      let orionAmount_ = await exchange.getBalance(orion.address, user1);
      orionAmount_.toString().should.be.equal(String(initialOrionBalance-stakeAmount));
      //first get rid of all non-orion tokens
      let trades = [[wbtc, initialWBTCBalance, WBTCPrice],
                    [weth, initialWETHBalance, WETHPrice],
                    [wxrp, initialWXRPBalance, WXRPPrice],
                    [{address:ZERO_ADDRESS}, initialETHBalance, ETHPrice]
                   ];
      for(let trade of trades) {
        let sellOrder  = orders.generateOrder(user1, matcher, 0,
                                               trade[0], orion, orion,
                                               trade[1], 
                                               trade[2],
                                               350000);
        let buyOrder  = orders.generateOrder(user2, matcher, 1,
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
      let user1Position = await exchange.calcPosition(user1);
      let expectedOrionAmount = initialOrionBalance-stakeAmount +
                                Math.floor(initialWBTCBalance*WBTCPrice/1e8) +
                                Math.floor(initialWETHBalance*WETHPrice/1e8) +
                                Math.floor(initialWXRPBalance*WXRPPrice/1e8) +
                                Math.floor(initialETHBalance*ETHPrice/1e8) - 350000*4;
      let orionAmount = await exchange.getBalance(orion.address, user1);
      orionAmount.toString().should.be.equal(String(expectedOrionAmount));
      let user1PositionJs = calcCollateral(stakeAmount,
                                         expectedOrionAmount,
                                         0, 0, 0);
      user1Position.weightedPosition.should.be.equal(String(user1PositionJs.weightedPosition));
      user1Position.totalPosition.should.be.equal(String(user1PositionJs.totalPosition));
      sellOrder  = orders.generateOrder(user1, matcher, 0,
                                             wbtc, orion, orion,
                                             1e5, 
                                             WBTCPrice,
                                             350000);
      buyOrder  = orders.generateOrder(user2, matcher, 1,
                                             wbtc, orion, orion,
                                             1e5, 
                                             WBTCPrice,
                                             350000);
      await exchange.fillOrders(
          buyOrder.order,
          sellOrder.order,
          WBTCPrice,
          1e5,
          { from: matcher }
        ).should.be.fulfilled;
    });
    it("correct broker position after marginal trade", async () => {
      let brokerPosition = await exchange.calcPosition(user1);
      let expectedLiability = -(WBTCPrice*1e5/1e8);
      let expectedOrionAmount = initialOrionBalance-stakeAmount + (WBTCPrice*1e5/1e8)+
                                Math.floor(initialWBTCBalance*WBTCPrice/1e8) +
                                Math.floor(initialWETHBalance*WETHPrice/1e8) +
                                Math.floor(initialWXRPBalance*WXRPPrice/1e8) +
                                Math.floor(initialETHBalance*ETHPrice/1e8) - 350000*5;
      let orionAmount = await exchange.getBalance(orion.address, user1);
      let expectedCollaterals = calcCollateral(stakeAmount, expectedOrionAmount, 
                                         0, 0, 0);
      let expectedWeightedPosition = expectedCollaterals.weightedPosition + expectedLiability;
      let expectedTotalPosition = expectedCollaterals.totalPosition + expectedLiability;
      orionAmount.toString().should.be.equal(String(expectedOrionAmount));
      expectedLiability.toString().should.be.equal(brokerPosition.totalLiabilities.toString());
      brokerPosition.weightedPosition.toString().should.be.equal(String(expectedWeightedPosition));
      brokerPosition.totalPosition.toString().should.be.equal(String(expectedTotalPosition));
    });
    it("correct liability list after marginal trade", async () => {
      let l1 = await exchange.liabilities(user1,0);
      await exchange.liabilities(user1,1).should.be.rejected;
      l1.asset.toString().should.be.equal(wbtc.address);
    });
  });

});

