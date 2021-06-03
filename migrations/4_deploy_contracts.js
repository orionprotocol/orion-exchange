const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');

const Orion = artifacts.require("Orion");
const PriceOracle = artifacts.require("PriceOracle");
const Exchange = artifacts.require("Exchange");
const LibValidator = artifacts.require("LibValidator");
const LibUnitConverter = artifacts.require("LibUnitConverter");
const MarginalFunctionality = artifacts.require("MarginalFunctionality");

module.exports = async (deployer, network, accounts) => {
  if (network === "development") {
    oraclePubkey = accounts[2];

    await deployer.link(LibValidator, Exchange);
    await deployer.link(LibUnitConverter, Exchange);
    await deployer.link(MarginalFunctionality,Exchange);

    var orn = await Orion.deployed();
    let priceOracleInstance = await deployer.deploy(PriceOracle, oraclePubkey, orn.address);
    let exchangeInstance = await deployProxy(Exchange, {unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true});
    await exchangeInstance.setBasicParams(orn.address, priceOracleInstance.address, accounts[0]);
  }

  if (network === "binanceTestnet") {

  }

 if (network === "mainnet") {

    const oracleAddress = "0x3b9E04C53B45A9386de378ab9c27dddd4E15725F";
    const allowedMatcher = "0x15E030E12cD2C949181BFf268cbEF26F524d7929";

    const ORN = "0x0258F474786DdFd37ABCE6df6BBb1Dd5dfC4434a";
    const ETH = "0x0000000000000000000000000000000000000000";
    const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7";

    const stakedOrionWeight = 242; // 242/255 94.9%
    const orionWeight = 190; // 190/255 74.5%
    const ethWeight = 190; // 190/255 74.5%
    const usdtWeight = 180; // 180/255 70.6%

    const liquidatorPremium = 12; // 12/255 = 4.7%
    const priceOverdue = 4 * 3600; // Time after which we need fresh prices
    const positionOverdue = 30 * 24 * 3600; //Time after which position may be liquidated

    await deployer.link(LibValidator, Exchange);
    await deployer.link(LibUnitConverter, Exchange);
    await deployer.link(MarginalFunctionality,Exchange);

    await deployer.deploy(PriceOracle, oracleAddress, ORN);
    const priceOracleInstance = await PriceOracle.deployed();

    const exchangeInstance = await deployProxy(Exchange, {unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true});

    await priceOracleInstance.changePriceProviderAuthorization([oracleAddress],[]);
    await exchangeInstance.setBasicParams(ORN, priceOracleInstance.address, allowedMatcher);
    await exchangeInstance.updateMarginalSettings([ORN, ETH, USDT], stakedOrionWeight, liquidatorPremium, priceOverdue, positionOverdue);
    await exchangeInstance.updateAssetRisks([ORN, ETH, USDT], [orionWeight, ethWeight, usdtWeight]);

  }

}
