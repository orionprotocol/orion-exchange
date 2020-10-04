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
const Orion = artifacts.require("Orion");
const Staking = artifacts.require("Staking");
let PriceOracle = artifacts.require("PriceOracle");

const LibValidator = artifacts.require("LibValidator");
const MarginalFunctionality = artifacts.require("MarginalFunctionality");


const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"; // WAN or ETH "asset" address in balanaces

let exchange, weth, wbtc, orion, staking, priceOracle, lib, marginalFunctionality;
let oraclePub, matcher;

const initialOrionBalance = Math.floor(500e8);
const initialWBTCBalance = Math.floor(2e8);
const initialWETHBalance = Math.floor(100e8);
const initialRawETHBalance = Math.floor(20e18);
const initialETHBalance = Math.floor(initialRawETHBalance/1e10);
const stakeAmount = Math.floor(200e8);
const lockingDuration = 3600*24;

const OrionPrice = 1e8;
const WBTCPrice = 4321e8; //4321 orions per one btc
const WETHPrice = 143e8; //143 orions per one ether
const ETHPrice = 143e8; //143 orions per one ether

// Weights for position calculation
const orionWeight = 220;
const wbtcWeight = 200;
const ethWeight = 190;
const wethWeight = 10;
const stakeRisk = 242;

function calcPosition(orionStake, orion, wbtc, weth, eth) {
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
      let user1Position = await exchange.calcPosition(user1);
      let user2Position = await exchange.calcPosition(user2);
      let user1PositionJs = calcPosition(stakeAmount, 
                                         (initialOrionBalance-stakeAmount), 
                                         initialWBTCBalance, 
                                         initialWETHBalance, 
                                         initialETHBalance); 
      let user2PositionJs = calcPosition(0, 
                                         initialOrionBalance, 
                                         initialWBTCBalance, 
                                         initialWETHBalance, 
                                         initialETHBalance);
      console.log("Here",user1Position, user1PositionJs);
    });
  });
});
