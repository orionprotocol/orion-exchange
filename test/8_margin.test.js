require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

const orders = require("./helpers/Orders.js");
const sigUtil = require("eth-sig-util");
const EIP712 = require("./helpers/EIP712.js");
const ChainManipulation = require("./helpers/ChainManipulation");
const eth_signTypedData = require("./helpers/GanacheSignatures.js");

const Exchange = artifacts.require("Exchange");
const WETH = artifacts.require("WETH");
const WBTC = artifacts.require("WBTC");
const WXRP = artifacts.require("WXRP");
const Orion = artifacts.require("Orion");
const OrionVault = artifacts.require("OrionVault");
let PriceOracle = artifacts.require("PriceOracle");

const LibValidator = artifacts.require("LibValidator");
const MarginalFunctionality = artifacts.require("MarginalFunctionality");


const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"; // WAN or ETH "asset" address in balanaces

let exchange, weth, wbtc, wxrp, orion, orionVault, priceOracle, lib, marginalFunctionality;
let oraclePub, matcher;

const initialOrionBalance = Math.floor(5000e8);
const initialWBTCBalance = Math.floor(1e7); //~430 ORN
const initialWETHBalance = Math.floor(3e8); //~430 ORN
const initialWXRPBalance = Math.floor(4300e8); //~430 ORN
const initialRawETHBalance = Math.floor(3e18); //~430 ORN
const initialETHBalance = Math.floor(initialRawETHBalance/1e10);
const stakeAmount = Math.floor(200e8);
const lockingDuration = 3600*24;
const overdueDuration = 3600*24;
const priceOverdue = 3600*3;

const OrionPrice = 1e8;
const WBTCPrice = 4321e8; //4321 orions per one btc
const WXRPPrice = 1e7; //0.1 orions per one xrp
const WETHPrice = 143e8; //143 orions per one ether
const ETHPrice = 143e8; //143 orions per one ether

// Weights for position calculation
const orionWeight = 220;
const wbtcWeight = 200;
const ethWeight = 190;
const wethWeight = 190;
const stakeRisk = 242;
const liquidationPremium = 12;

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
contract("Exchange", ([owner, broker, user2, liquidator]) => {
  describe("Exchange::instance", () => {
      it("deploy", async () => {
        exchange = await Exchange.deployed();
        weth = await WETH.deployed();
        wbtc = await WBTC.deployed();
        wxrp = await WXRP.deployed();
        orion = await Orion.deployed();
        lib = await LibValidator.deployed();
        priceOracle = await PriceOracle.deployed();
        orionVault = await OrionVault.deployed(orion.address);
        marginalFunctionality = await MarginalFunctionality.deployed();
        oraclePub = user2; //Defined in migrations
        matcher = owner;
    });
  });

  //helper
  let depositAsset = async (asset, amount, user) => {
        let balanceBefore = await exchange.getBalance(asset.address, user);
        let _amount = String(amount);
        if(asset.address==weth.address){
          _amount = _amount+"0000000000";
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
        (balanceAsset-balanceBefore).toString().should.be.equal(String(amount));
  };

  let generateData = async(assets,priceData) => {
      prices= {
        assetAddresses: assets,
        prices: priceData,
        timestamp: await ChainManipulation.getBlokchainTime()
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
      signature1 = await eth_signTypedData(oraclePub, msgParams);
      prices.signature = signature1;
      return prices;
  };

  describe("Exchange::margin setup", () => {
    it("users deposit assets to exchange", async () => {
      for(let user of [broker, user2]) {
        await depositAsset(orion, initialOrionBalance, user);
        await depositAsset(wbtc, initialWBTCBalance, user);
        await depositAsset(weth, initialWETHBalance, user);
        await depositAsset(wxrp, initialWXRPBalance, user);

        exchange.deposit({ from: user, value: String(initialRawETHBalance) });
        let balanceAsset = await exchange.getBalance(ZERO_ADDRESS, user);
        balanceAsset.toString().should.be.equal(String(initialETHBalance));
      }
    });

    it("broker stake some orion", async () => {
      await orionVault.setExchangeAddress(exchange.address, {from:owner}).should.be
            .fulfilled;
      await orionVault.lockStake(stakeAmount, {from:broker}).should.be.fulfilled;
      await ChainManipulation.advanceTime(lockingDuration+1);
      await ChainManipulation.advanceBlock();
    });

    it("admin provide price data", async () => {
      let _oracle = await priceOracle.oraclePublicKey();
      _oracle.should.be.equal(oraclePub);
      prices= await generateData([weth.address, wbtc.address, orion.address, ZERO_ADDRESS, wxrp.address],
                           [WETHPrice, WBTCPrice, OrionPrice, ETHPrice, WXRPPrice]);
      await priceOracle.provideData(prices, { from: broker }
                                ).should.be.fulfilled;
    });

    it("admin set risks", async () => {
      await exchange.updateMarginalSettings(
                     [orion.address, weth.address, wbtc.address, ZERO_ADDRESS],
                     stakeRisk, liquidationPremium,
                     priceOverdue, overdueDuration,
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
      let brokerPosition = await exchange.calcPosition(broker);
      let brokerPositionJs = calcCollateral(stakeAmount,
                                         (initialOrionBalance-stakeAmount),
                                         initialWBTCBalance,
                                         initialWETHBalance,
                                         initialETHBalance);
      brokerPosition.weightedPosition.should.be.equal(String(brokerPositionJs.weightedPosition));
      brokerPosition.totalPosition.should.be.equal(String(brokerPositionJs.totalPosition));
    });

    it("broker can make marginal trades", async () => {
      let orionAmount_ = await exchange.getBalance(orion.address, broker);
      orionAmount_.toString().should.be.equal(String(initialOrionBalance-stakeAmount));
      //first get rid of all non-orion tokens
      let trades = [[wbtc, initialWBTCBalance, WBTCPrice],
                    [weth, initialWETHBalance, WETHPrice],
                    [wxrp, initialWXRPBalance, WXRPPrice],
                    [{address:ZERO_ADDRESS}, initialETHBalance, ETHPrice]
                   ];
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
      let brokerPosition = await exchange.calcPosition(broker);
      let expectedOrionAmount = initialOrionBalance-stakeAmount +
                                Math.floor(initialWBTCBalance*WBTCPrice/1e8) +
                                Math.floor(initialWETHBalance*WETHPrice/1e8) +
                                Math.floor(initialWXRPBalance*WXRPPrice/1e8) +
                                Math.floor(initialETHBalance*ETHPrice/1e8) - 350000*4;
      let orionAmount = await exchange.getBalance(orion.address, broker);
      orionAmount.toString().should.be.equal(String(expectedOrionAmount));
      let brokerPositionJs = calcCollateral(stakeAmount,
                                         expectedOrionAmount,
                                         0, 0, 0);
      brokerPosition.weightedPosition.should.be.equal(String(brokerPositionJs.weightedPosition));
      brokerPosition.totalPosition.should.be.equal(String(brokerPositionJs.totalPosition));
      sellOrder  = await orders.generateOrder(broker, matcher, 0,
                                             wbtc, orion, orion,
                                             1e5,
                                             WBTCPrice,
                                             350000);
      buyOrder  = await orders.generateOrder(user2, matcher, 1,
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
    it("stake can not be withdrawn if there is liability", async () => {
      await orionVault.requestReleaseStake({from:broker}).should.be.rejected;
    });
    it("asset with negative balance can not be withdrawn", async () => {
      await exchange.withdraw(wbtc.address, 1, {
          from: broker
        }).should.be.rejected;
    });
    it("correct broker position after marginal trade", async () => {
      let brokerPosition = await exchange.calcPosition(broker);
      let expectedLiability = -(WBTCPrice*1e5/1e8);
      let expectedOrionAmount = initialOrionBalance-stakeAmount + (WBTCPrice*1e5/1e8)+
                                Math.floor(initialWBTCBalance*WBTCPrice/1e8) +
                                Math.floor(initialWETHBalance*WETHPrice/1e8) +
                                Math.floor(initialWXRPBalance*WXRPPrice/1e8) +
                                Math.floor(initialETHBalance*ETHPrice/1e8) - 350000*5;
      let orionAmount = await exchange.getBalance(orion.address, broker);
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
      let l1 = await exchange.liabilities(broker,0);
      await exchange.liabilities(broker,1).should.be.rejected;
      l1.asset.toString().should.be.equal(wbtc.address);
    });

    it("broker can open up to 3 liabilities", async () => {
      let trades = [
                    [weth, 1e8, WETHPrice],
                    [wxrp, 1e8, WXRPPrice]
                   ];
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
      let expectedOrionAmount = initialOrionBalance-stakeAmount +
                                Math.floor(initialWBTCBalance*WBTCPrice/1e8) + (WBTCPrice*1e5/1e8) +
                                Math.floor(initialWETHBalance*WETHPrice/1e8) + (WETHPrice*1e8/1e8) +
                                Math.floor(initialWXRPBalance*WXRPPrice/1e8) + (WXRPPrice*1e8/1e8) +
                                Math.floor(initialETHBalance*ETHPrice/1e8) - 350000*7;
      let orionAmount = await exchange.getBalance(orion.address, broker);
      orionAmount.toString().should.be.equal(String(expectedOrionAmount));
      let expectedCollaterals = calcCollateral(stakeAmount, expectedOrionAmount,
                                         0, 0, 0);
      let expectedLiability = -(WBTCPrice*1e5/1e8) - (WETHPrice*1e8/1e8) - (WXRPPrice*1e8/1e8);
      let expectedWeightedPosition = expectedCollaterals.weightedPosition + expectedLiability;
      let expectedTotalPosition = expectedCollaterals.totalPosition + expectedLiability;
      let brokerPosition = await exchange.calcPosition(broker);
      expectedLiability.toString().should.be.equal(brokerPosition.totalLiabilities.toString());
      brokerPosition.weightedPosition.toString().should.be.equal(String(expectedWeightedPosition));
      brokerPosition.totalPosition.toString().should.be.equal(String(expectedTotalPosition));
    });

    it("broker can't open 4 liabilities", async () => {
      let trades = [
                    [{address:ZERO_ADDRESS}, 1e8, ETHPrice]
                   ];
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
        ).should.be.rejected;
      }
      await exchange.liabilities(broker,2).should.be.fulfilled;
    });

    it("broker can reimburse liability via deposit", async () => {
      await depositAsset(wbtc, 2e5, broker);
      await exchange.liabilities(broker,2).should.be.rejected;
      let fL = await exchange.liabilities(broker,0);
      let sL = await exchange.liabilities(broker,1);
      fL.asset.toString().should.be.equal(weth.address);
      sL.asset.toString().should.be.equal(wxrp.address);
      let wbtcAmount = await exchange.getBalance(wbtc.address, broker);
      wbtcAmount.toString().should.be.equal(String(1e5)); //-1e5+2e5
    });

    it("broker can reimburse liability via trade", async () => {
      let trades = [
                    [wxrp, 2e8, WXRPPrice]
                   ];
      for(let trade of trades) {
        let buyOrder  = await orders.generateOrder(broker, matcher, 1,
                                               trade[0], orion, orion,
                                               trade[1],
                                               trade[2],
                                               350000);
        let sellOrder  = await orders.generateOrder(user2, matcher, 0,
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
      await exchange.liabilities(broker,1).should.be.rejected;
      let fL = await exchange.liabilities(broker,0);
      fL.asset.toString().should.be.equal(weth.address);
    });

    it("broker can deepen existing liability", async () => {
      let fL = await exchange.liabilities(broker,0);
      const firstLiabilityTime = fL.timestamp.toString();
      let trades = [
                    [weth, 1e8, WETHPrice]
                   ];
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
      await exchange.liabilities(broker,1).should.be.rejected; //No new liabilities
      let nL = await exchange.liabilities(broker,0);
      const newLiabilityTime = nL.timestamp.toString();
      firstLiabilityTime.should.be.equal(newLiabilityTime);
      let wethAmount = await exchange.getBalance(weth.address, broker);
      wethAmount.toString().should.be.equal(String(-2e8));

    });

    it("broker can't open new liability if he overdue old one", async () => {
      await ChainManipulation.advanceTime(overdueDuration+1);
      await ChainManipulation.advanceBlock();
      prices= await generateData([weth.address, wbtc.address, orion.address, ZERO_ADDRESS,wxrp.address],
                           [WETHPrice, WBTCPrice, OrionPrice, ETHPrice, WXRPPrice]);
      await priceOracle.provideData(prices, { from: broker }
                                ).should.be.fulfilled;
      let trades = [
                    [{address:ZERO_ADDRESS}, 1e8, ETHPrice]
                   ];
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
        ).should.be.rejected;
      }
    });

    it("broker can't deepen old liability if he overdue it", async () => {
      await ChainManipulation.advanceTime(overdueDuration+1);
      await ChainManipulation.advanceBlock();
      prices= await generateData([weth.address, wbtc.address, orion.address, ZERO_ADDRESS, wxrp.address],
                           [WETHPrice, WBTCPrice, OrionPrice, ETHPrice, WXRPPrice]);
      await priceOracle.provideData(prices, { from: broker }
                                ).should.be.fulfilled;
      let trades = [
                    [weth, 1e8, WETHPrice]
                   ];
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
        ).should.be.rejected;
      }
      await depositAsset(weth, 2e8, broker);
      await exchange.liabilities(broker,0).should.be.rejected; //No liabilities
    });
    it("correct overdue time calculation", async () => {
      // Create liability
      let addWethLiability = async (amount) => {
        await ChainManipulation.advanceBlock();
        prices= await generateData([weth.address, wbtc.address, orion.address, ZERO_ADDRESS, wxrp.address],
                             [WETHPrice, WBTCPrice, OrionPrice, ETHPrice, WXRPPrice]);
        await priceOracle.provideData(prices, { from: broker }
                                  ).should.be.fulfilled;
        let trades = [
                      [weth, amount, WETHPrice]
                     ];
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
      }
      
      //Create liability
      let initialAmount = 1e8;
      await addWethLiability(initialAmount);
      let liability = await exchange.liabilities(broker,0);
      liability.asset.toString().should.be.equal(weth.address);
      let liabilityTimestamp = liability.timestamp;
      liability.outstandingAmount.toString().should.be.equal(String(initialAmount));
      // liability.timestamp should be roughly equal blockchain subjective time
      let st = Math.abs(liability.timestamp - await ChainManipulation.getBlokchainTime())<5;
      st.toString().should.be.equal("true");

      await ChainManipulation.advanceTime(1000);

      //Deepen liability
      let additionalAmount = 3e5;
      await addWethLiability(additionalAmount);
      let updatedLiability = await exchange.liabilities(broker,0);
      // liability.timestamp and outstandingAmount should not be updated
      updatedLiability.outstandingAmount.toString().should.be.equal(String(initialAmount));
      updatedLiability.timestamp.toString().should.be.equal(liabilityTimestamp.toString());


      await ChainManipulation.advanceTime(1000);

      //partially reimburse liability
      let partialAmount = Math.floor(initialAmount/3);
      await depositAsset(weth, partialAmount, broker);

      let updatedLiability2 = await exchange.liabilities(broker,0);
      // outstandingAmount should be decreased by partial amount
      updatedLiability2.outstandingAmount.toString().should.be.equal(String(initialAmount-partialAmount));
      // since initial liability is not reimbursed timestamp should not be updated
      updatedLiability2.timestamp.toString().should.be.equal(liabilityTimestamp.toString());


      //fully reimburse 1st liability and partially second
      let partialAmount2 = initialAmount - partialAmount + Math.floor(additionalAmount/3);
      await depositAsset(weth, partialAmount2, broker);

      let updatedLiability3 = await exchange.liabilities(broker,0);
      // outstandingAmount should be now be equal current total liability
      updatedLiability3.outstandingAmount.toString().should.be.equal(
        String(initialAmount + additionalAmount - partialAmount - partialAmount2)
      );
      // since initial liability is reimbursed timestamp should be roughly equal blockchain subjective time
      st = Math.abs(updatedLiability3.timestamp - await ChainManipulation.getBlokchainTime())<5;
      st.toString().should.be.equal("true");


      await depositAsset(weth, initialAmount + additionalAmount - partialAmount - partialAmount2, broker);
      await exchange.liabilities(broker,0).should.be.rejected; //No liabilities

    });

  });

  describe("Exchange::Liquidation", () => {
    it("positive position can not be liquidated", async () => {
      await depositAsset(orion, 50000e8, user2);
      await depositAsset(weth, Math.floor(1100e8), liquidator);
      let trades = [
                    [{address:weth.address}, 200e8, WETHPrice]
                   ];
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
      await exchange.partiallyLiquidate(broker, weth.address, 10e8, {from:liquidator}).should.be.rejected;
    });
    it("negative position can be liquidated", async () => {
      prices= await generateData([weth.address, wbtc.address, orion.address, ZERO_ADDRESS, wxrp.address],
                           [160e8, WBTCPrice, OrionPrice, 160e8, WXRPPrice]);
      await priceOracle.provideData(prices, { from: broker }
                                ).should.be.fulfilled;
      let position = await exchange.calcPosition(broker);
      position.state.should.be.equal(String(1)); //Negative
      let brokerOrionAmount = await exchange.getBalance(orion.address, broker);

      await exchange.partiallyLiquidate(broker, weth.address, 10e8, {from:liquidator});
      let newBrokerOrionAmount = await exchange.getBalance(orion.address, broker);
      let liquidatorOrionAmount = await exchange.getBalance(orion.address, liquidator);
      let liquidationAmount = Math.floor(10e8*160e8/1e8);
      let premium = Math.floor(liquidationAmount/255)*liquidationPremium;
      (newBrokerOrionAmount-brokerOrionAmount).toString().should.be.equal(String(-(liquidationAmount+premium)));
      liquidatorOrionAmount.toString().should.be.equal(String(liquidationAmount+premium));
      position = await exchange.calcPosition(broker);
    });
    it("correct balances after liquidation", async () => {
      let liquidationAmount = Math.floor(10e8*160e8/1e8);
      let premium = Math.floor(liquidationAmount/255)*liquidationPremium;
      let liquidatorOrionAmount = await exchange.getBalance(orion.address, liquidator);
      liquidatorOrionAmount.toString().should.be.equal(String(liquidationAmount+premium));
    });
    it("liquidation can not make balance very positive", async () => {
      await exchange.partiallyLiquidate(broker, weth.address, 220e8, {from:liquidator}).should.be.rejected;
    });
    it("overdue position can be liquidated", async () => {
      await ChainManipulation.advanceTime(overdueDuration+1);
      await ChainManipulation.advanceBlock();
      let position = await exchange.calcPosition(broker);
      //position.state.should.be.equal(String(3)); //OVERDUE
      prices= await generateData([weth.address, wbtc.address, orion.address, ZERO_ADDRESS, wxrp.address],
                           [160e8, WBTCPrice, OrionPrice, 160e8, WXRPPrice]);
      await priceOracle.provideData(prices, { from: broker }
                                ).should.be.fulfilled;
      //position.state.should.be.equal(String(3)); //OVERDUE
      let liquidatorOrionAmount = await exchange.getBalance(orion.address, liquidator);
      await exchange.partiallyLiquidate(broker, weth.address, 180e8, {from:liquidator});
      let newLiquidatorOrionAmount = await exchange.getBalance(orion.address, liquidator);

      let liquidationAmount = Math.floor(180e8*160e8/1e8);
      let premium = Math.floor(liquidationAmount/255)*liquidationPremium;
      (newLiquidatorOrionAmount-liquidatorOrionAmount).toString()
        .should.be.equal(String((liquidationAmount+premium)));
    });
  });

});
