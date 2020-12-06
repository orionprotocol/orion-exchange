const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');

const WXRP = artifacts.require("WXRP");
const WBTC = artifacts.require("WBTC");
const WETH = artifacts.require("WETH");
const Orion = artifacts.require("Orion");
const PriceOracle = artifacts.require("PriceOracle");
const Exchange = artifacts.require("Exchange");
const SafeMath = artifacts.require("SafeMath");
const LibValidator = artifacts.require("LibValidator");
const LibUnitConverter = artifacts.require("LibUnitConverter");
const MarginalFunctionality = artifacts.require("MarginalFunctionality");

let oraclePubkey = "";

module.exports = async (deployer, network, accounts) => {
  if (network === "development") {
    oraclePubkey = accounts[2];

    await deployer.link(LibValidator, Exchange);
    await deployer.link(LibUnitConverter, Exchange);
    await deployer.link(MarginalFunctionality,Exchange);

    let priceOracleInstance = await deployer.deploy(PriceOracle, oraclePubkey, Orion.address);
    let exchangeInstance = await deployProxy(Exchange, {unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true});

    await exchangeInstance.setBasicParams(Orion.address, PriceOracle.address, accounts[0]);

  }

 if (network === "mainnet") {
    let oracleAddress = "0x3b9E04C53B45A9386de378ab9c27dddd4E15725F";
    let allowedMatcher = "0x15E030E12cD2C949181BFf268cbEF26F524d7929"

    let ORN = "0x0258F474786DdFd37ABCE6df6BBb1Dd5dfC4434a"
    let ETH = "0x0000000000000000000000000000000000000000"
    let USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7"

    let stakedOrionWeight = 242; // 242/255 94.9%
    let orionWeight = 190; // 190/255 74.5%
    let ethWeight = 190; // 190/255 74.5%
    let usdtWeight = 180; // 180/255 70.6%

    let liquidatorPremium = 12;
    let priceOverdue = 3 * 3600; // Time after which we need fresh prices
    let positionOverdue = 30 * 24 * 3600; //Time after which position may be liquidated

    await deployer.link(LibValidator, Exchange);
    await deployer.link(LibUnitConverter, Exchange);
    await deployer.link(MarginalFunctionality,Exchange);

    await deployer.deploy(PriceOracle, oracleAddress, ORN);
    let priceOracleInstance = await PriceOracle.deployed();

    let exchangeInstance = await deployProxy(Exchange, {unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true});

    await priceOracleInstance.changePriceProviderAuthorization([oracleAddress],[]);
    await exchangeInstance.setBasicParams(Orion.address, priceOracleInstance.address, allowedMatcher);
    await exchangeInstance.updateMarginalSettings([ORN, ETH, USDT], stakedOrionWeight, liquidatorPremium, priceOverdue, positionOverdue);
    await exchangeInstance.updateAssetRisks([ORN, ETH, USDT], [orionWeight, ethWeight, usdtWeight]);

  }

}
