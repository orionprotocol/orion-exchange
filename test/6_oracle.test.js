require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

const sigUtil = require("eth-sig-util");
const eth_signTypedData = require("./helpers/GanacheSignatures.js");
const EIP712 = require("./helpers/EIP712.js");


let PriceOracle = artifacts.require("PriceOracle");

let priceOracle;

const asset0="0x0000000000000000000000000000000000000000",
      asset1="0x0000000000000000000000000000000000000001",
      asset2="0x0000000000000000000000000000000000000002";
let prices, msgParams1, msgParams2;


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

contract("PriceOracle", ([owner, user1, oracle]) => {
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

  });

});

