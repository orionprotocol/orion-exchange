require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

const sigUtil = require("eth-sig-util");


let Exchange = artifacts.require("Exchange");
const Orion = artifacts.require("Orion");
const LibValidator = artifacts.require("LibValidator");

let exchange, orion;

const asset0="0x0000000000000000000000000000000000000000", 
      asset1="0x0000000000000000000000000000000000000001", 
      asset2="0x0000000000000000000000000000000000000002";
let prices, msgParams1, msgParams2;

const privKey2 =
        "ecbcd49667c96bcf8b30ccb35234a0b217ea039a8e097d3a70de9d28624ba520";
const privKey = Buffer.from(privKey2, "hex");


async function getLastEvent(eventName, user) {
  let events = await exchange.getPastEvents(eventName, {
    user
  });

  return events[0].returnValues;
}

const setBlockchainTime = async function(from_snapshot, time) {
  await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0});
  await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_revert", params: [from_snapshot], id: 0});
  await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_snapshot", params: [], id: 0});
  await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0});
  bn = await web3.eth.blockNumber;
  bl = await web3.eth.getBlock(bn);
  tm = bl.timestamp;
  await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [time-tm], id: 0});  
  await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0});
};

const getSnapshot = async function() {
      return parseInt((await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_snapshot", params: [], id: 0}))["result"]);
}

const domain = [
                 { name: "name", type: "string" },
                 { name: "version", type: "string" },
                 { name: "chainId", type: "uint256" },
                 { name: "salt", type: "bytes32" },
               ];
const domainData = {
          name: "Orion Exchange",
          version: "1",
          chainId: 666,
          salt: "0xf2d857f4a3edcb9b78b4d503bfe733db1e3f6cdc2b7971ee739626c97e86a557",
};
const pricesType =  [
            { name: "assetAddresses", type: "address[]" },
            { name: "prices", type: "uint64[]" },
            { name: "timestamp", type: "uint64" },
];

contract("Exchange", ([owner, user1, oracle]) => {
  let just_staked_snapshot=0,
      requested_stake_snapshot = 0;

  describe("Exchange::instance", async () => {
    orion = await Orion.deployed();
    exchange = await Exchange.deployed(orion.address, oracle);
    lib = await LibValidator.deployed();
  });

  describe("Exchange::priceOracle", () => {

    it("correct oracle address", async () => {
      let _oracle = await exchange.oraclePublicKey();
      _oracle.should.be.equal(oracle);
    });

    it("Oracle sign price feed", async () => {
      prices= {
        assetAddresses: [asset0,asset1,asset2],
        prices: [1,2,3],
        timestamp: Date.now()
      };
      let msgParams = {
             types: {
               EIP712Domain: domain,
               Prices: pricesType,
             },
             domain: domainData,
             primaryType: "Prices",
             message: prices,
      };
      msgParams1 = { data: msgParams };
      signature1 = sigUtil.signTypedData_v4(privKey, msgParams1);
      prices.signature = signature1;
      //console.log("eth", sigUtil.typedSignatureHash(prices));
      //console.log("solidity", await exchange.getPricesHash(prices));
      //console.log(await exchange.checkPriceFeedSignature(prices));
      //console.log("sig", signature1);
      const recovered = sigUtil.recoverTypedSignature_v4({
        data: msgParams,
        sig: signature1
      });
      web3.utils.toChecksumAddress(recovered).should.be.equal(oracle);
      const checkSignatureResult = await exchange.checkPriceFeedSignature(prices);
      checkSignatureResult.should.be.equal(true);
    });
    
    it("User1 send signed price feed", async () => {
      await exchange.provideData(prices, { from: user1 }
                                ).should.be.fulfilled;
      let data = await exchange.givePrices([asset0, asset2, asset1, owner]);
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
    
    it("Oracle sign and send next feed", async () => {
      let oldTS = prices.timestamp;
      prices= {
        assetAddresses: [asset2],
        prices: [7],
        timestamp: Date.now()
      };
      let msgParams = {
             types: {
               EIP712Domain: domain,
               Prices: pricesType,
             },
             domain: domainData,
             primaryType: "Prices",
             message: prices,
      };
      msgParams2 = { data: msgParams };
      signature2 = sigUtil.signTypedData_v4(privKey, msgParams1);
      prices.signature = signature2;

      await exchange.provideData(prices, { from: user1 }
                                ).should.be.fulfilled;
      let data = await exchange.givePrices([asset0, asset2, asset1, owner]);
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

