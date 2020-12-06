require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

const sigUtil = require("eth-sig-util");
const eth_signTypedData = require("./helpers/GanacheSignatures.js");
const EIP712 = require("./helpers/EIP712.js");
const ChainManipulation = require("./helpers/ChainManipulation");


let PriceOracle = artifacts.require("PriceOracle");
const Orion = artifacts.require("Orion");
let AggregatorV3InterfaceStub = artifacts.require("AggregatorV3InterfaceStub");

let priceOracle;

const asset0="0x0000000000000000000000000000000000000000",
      asset1="0x0000000000000000000000000000000000000001",
      asset2="0x0000000000000000000000000000000000000002";
let prices, msgParams1, msgParams2;

let ornAggregator, a2Aggregator, a3Aggregator;
let orion;
let orn2eth, a2_2_eth, a3_2_eth, tm;

async function getLastEvent(eventName, user) {
  let events = await priceOracle.getPastEvents(eventName, {
    user
  });

  return events[0].returnValues;
}

function generateMsgParams(prices) {
  return {
             types: {
               EIP712Domain: EIP712.domain,
               Prices: EIP712.pricesType,
             },
             domain: EIP712.domainData,
             primaryType: "Prices",
             message: prices,
      };
}

contract("PriceOracle", ([owner, user1, oracle, user2]) => {
  let just_staked_snapshot=0,
      requested_stake_snapshot = 0;

  describe("PriceOracle::instance", async () => {
    priceOracle = await PriceOracle.deployed(oracle);
  });

  describe("PriceOracle::basic", () => {

    it("correct oracle address", async () => {
      let _oracle = await priceOracle.oraclePublicKey();
      _oracle.should.be.equal(oracle);
    });
    /*
    it("Oracle sign price feed", async () => {
      prices= {
        assetAddresses: [asset0,asset1,asset2],
        prices: [1,2,3],
        timestamp: Date.now()
      };
      let msgParams = generateMsgParams(prices);
      msgParams1 = { data: msgParams };
      signature1 = await eth_signTypedData(oracle, msgParams);
      prices.signature = signature1;
      const recovered = sigUtil.recoverTypedSignature_v4({
        data: msgParams,
        sig: signature1
      });
      web3.utils.toChecksumAddress(recovered).should.be.equal(oracle);
      const checkSignatureResult = await priceOracle.checkPriceFeedSignature(prices);
      checkSignatureResult.should.be.equal(true);
    });

    it("User1 send signed price feed", async () => {
      await priceOracle.provideData(prices, { from: user1 }
                                ).should.be.fulfilled;
      let data = await priceOracle.givePrices([asset0, asset2, asset1, owner]);
      let _returnedPrices = [];
      let _returnedTS = [];
      for (let i of data) {
        _returnedPrices.push(parseInt(i.price));
        _returnedTS.push(parseInt(i.timestamp));
      }
      JSON.stringify(_returnedPrices).should.be.equal(JSON.stringify([1,3,2,0]));
      let t = prices.timestamp;
      JSON.stringify(_returnedTS).should.be.equal(JSON.stringify([t,t,t,0]));
    });

    it("User1 send wrongly signed price feed", async () => {
      prices_ = {
        assetAddresses: [asset0,asset1,asset2,user1],
        prices: [1,2,3,4],
        timestamp: Date.now()
      };
      let msgParams_ = generateMsgParams(prices_);
      let msgParams1_ = { data: msgParams_ };
      signature = await eth_signTypedData(user1, msgParams_);
      prices.signature = signature;
      const recovered = sigUtil.recoverTypedSignature_v4({
        data: msgParams_,
        sig: signature
      });
      web3.utils.toChecksumAddress(recovered).should.be.equal(user1);
      const checkSignatureResult = await priceOracle.checkPriceFeedSignature(prices);
      checkSignatureResult.should.be.equal(false);
      await priceOracle.provideData(prices, { from: user1 }
                                ).should.be.rejected;
    });

    it("Oracle sign and send next feed", async () => {
      let oldTS = prices.timestamp;
      prices= {
        assetAddresses: [asset2],
        prices: [7],
        timestamp: Date.now()
      };
      let msgParams = generateMsgParams(prices);
      msgParams2 = { data: msgParams };
      signature2 = await eth_signTypedData(oracle, msgParams);
      prices.signature = signature2;

      await priceOracle.provideData(prices, { from: user1 }
                                ).should.be.fulfilled;
      let data = await priceOracle.givePrices([asset0, asset2, asset1, owner]);
      let _returnedPrices = [];
      let _returnedTS = [];
      for (let i of data) {
        _returnedPrices.push(parseInt(i.price));
        _returnedTS.push(parseInt(i.timestamp));
      }
      JSON.stringify(_returnedPrices).should.be.equal(JSON.stringify([1,7,2,0]));
      let t = prices.timestamp;
      JSON.stringify(_returnedTS).should.be.equal(JSON.stringify([oldTS,t,oldTS,0]));

    });
    //TODO test timestamp ranges: too early, too late, etc
    */
  });

  describe("PriceOracle::address authorization", () => {

    it("unauthorized address can not provide data", async () => {
      prices= {
        assetAddresses: [asset2],
        prices: [11],
        timestamp: Math.floor( Date.now()/1000)
      };
      priceOracle.provideDataAddressAuthorization(prices).should.be.rejected;
    });

    it("not owner can not authorize providers", async () => {
      priceOracle.changePriceProviderAuthorization([user2], [], {from: user2}).should.be.rejected;
    });

    it("owner can change providers authorization", async () => {
      priceOracle.changePriceProviderAuthorization([user2, oracle], [], {from: owner}).should.be.fulfilled;
       let user2Authorization = await priceOracle.priceProviderAuthorization(user2);
       let oracleAuthorization = await priceOracle.priceProviderAuthorization(oracle);
       user2Authorization.should.be.equal(true);
       oracleAuthorization.should.be.equal(true);
       priceOracle.changePriceProviderAuthorization([], [oracle], {from: owner}).should.be.fulfilled; 
       oracleAuthorization = await priceOracle.priceProviderAuthorization(oracle);
       oracleAuthorization.should.be.equal(false);
    });
    it("authorized provider can provide data", async () => {
      let newPrice = 27;
      let newTs = Math.floor(Date.now()/1000);
      prices= {
        assetAddresses: [asset2],
        prices: [newPrice],
        timestamp: newTs,
        signature: "0x0"
      };
      priceOracle.provideDataAddressAuthorization(prices, {from: user2}).should.be.fulfilled;
      let data = await priceOracle.givePrices([asset2]);
      data[0].price.toString().should.be.equal(String(newPrice));
      data[0].timestamp.toString().should.be.equal(String(newTs));
    });

    it("data with timestamp less than existing will not be overwritten", async () => {
      let initialData = await priceOracle.givePrices([asset2]);
      let newPrice = 0;
      let newTs = Math.floor(Date.now()/1000);
      prices= {
        assetAddresses: [asset2],
        prices: [newPrice],
        timestamp: initialData[0].timestamp - 10,
        signature: "0x0"
      };
      priceOracle.provideDataAddressAuthorization(prices, {from: user2}).should.be.fulfilled;
      let data = await priceOracle.givePrices([asset2]);
      data[0].price.toString().should.be.equal(String(initialData[0].price));
      data[0].timestamp.toString().should.be.equal(String(initialData[0].timestamp));
    });


    it("can't provide data too far in the future", async () => {
      let newPrice = 27;
      let newTs = await ChainManipulation.getBlokchainTime() + 80;
      prices= {
        assetAddresses: [asset2],
        prices: [newPrice],
        timestamp: newTs,
        signature: "0x0"
      };
      priceOracle.provideDataAddressAuthorization(prices, {from: user2}).should.be.rejected;
    });

  });

  describe("PriceOracle::ChainLink", async () => {
    it("Init Chainlink stubs", async () => {
      orion = await Orion.deployed();
      orn2eth = Math.floor(0.00575e18);
      a2_2_eth = '1681000000000000'; //usdt
      a3_2_eth = '32130000000000000000'; //btc
      tm = await ChainManipulation.getBlokchainTime();
      let ornAggregator = await AggregatorV3InterfaceStub.new();
      let a2Aggregator = await AggregatorV3InterfaceStub.new();
      let a3Aggregator = await AggregatorV3InterfaceStub.new();
      await ornAggregator.setData(0,orn2eth, tm ,tm,0, 18);
      await a2Aggregator.setData(0,a2_2_eth, tm ,tm,0, 18);
      await a3Aggregator.setData(0,a3_2_eth, tm ,tm,0, 18);
      await priceOracle.setChainLinkAggregators([orion.address, asset1, asset2],
                   [ornAggregator.address, a2Aggregator.address, a3Aggregator.address]).
                   should.be.fulfilled;
    });

    it("Collect data from ChainLink", async () => {
       await priceOracle.getChainLinkPriceData([asset1, asset2]).should.be.fulfilled;
    });

    it("Check correct data", async () => {
      let data = await priceOracle.givePrices([asset0, asset1, asset2]);

      //ORN/ETH = 1e8/0.00575 = 17391304347 (173 ORN for 1 ETH)
      //ORN/USDT = 29234782 (0.292 ORN for 1 USDT)
      //ORN/BTC = 558782608695 ( 5582 ORN per 1 BTC)

      let _returnedPrices = [];
      let _returnedTS = [];
      for (let i of data) {
        _returnedPrices.push(parseInt(i.price));
        _returnedTS.push(parseInt(i.timestamp));
      }
      JSON.stringify(_returnedPrices).should.be.equal(JSON.stringify([17391304347,29234782,558782608695]));
      JSON.stringify(_returnedTS).should.be.equal(JSON.stringify([tm,tm,tm]));
    });

  });

});

