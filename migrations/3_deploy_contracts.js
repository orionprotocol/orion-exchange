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
    await deployer.deploy(LibValidator);
    await deployer.deploy(LibUnitConverter);
    await deployer.deploy(MarginalFunctionality);

    await deployer.link(LibValidator, Exchange);
    await deployer.link(LibUnitConverter, Exchange);
    await deployer.link(MarginalFunctionality,Exchange);

    let priceOracleInstance = await deployer.deploy(PriceOracle, oraclePubkey, Orion.address);
    let exchangeInstance = await deployProxy(Exchange, {unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true});

    await exchangeInstance.setBasicParams("0x0000000000000000000000000000000000000000", Orion.address, PriceOracle.address, accounts[0]);

  }
  if (network === "ropsten") {
    oraclePubkey = "0xC19D917a88e07e5040cD2443FB3a026838C3b852";

    await deployer.deploy(LibValidator);
    await deployer.deploy(LibUnitConverter);
    await deployer.deploy(MarginalFunctionality);

    await deployer.link(LibValidator, Exchange);
    await deployer.link(LibUnitConverter, Exchange);
    await deployer.link(MarginalFunctionality,Exchange);

    await deployer.deploy(PriceOracle, oraclePubkey, Orion.address);
    let priceOracleInstance = await PriceOracle.deployed();

    let exchangeInstance = await deployProxy(Exchange, {unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true});

    await priceOracleInstance.changePriceProviderAuthorization([oraclePubkey],[]);
    await exchangeInstance.setBasicParams("0x0000000000000000000000000000000000000000", Orion.address, priceOracleInstance.address, "0x1FF516E5ce789085CFF86d37fc27747dF852a80a");
    await exchangeInstance.updateMarginalSettings(["0x0000000000000000000000000000000000000000", "0xfc1cd13a7f126efd823e373c4086f69beb8611c2", "0xfc25454ac2db9f6ab36bc0b0b034b41061c00982"], 242, 12, 3600*3, 3600*24);
    await exchangeInstance.updateAssetRisks(["0x0000000000000000000000000000000000000000", "0xfc1cd13a7f126efd823e373c4086f69beb8611c2","0xfc25454ac2db9f6ab36bc0b0b034b41061c00982"], [190, 180, 191]);

  }


 if (network === "live") {
    let oracleAddress = "???";
    let allowedMatcher = "0x15E030E12cD2C949181BFf268cbEF26F524d7929"

    let ORN = "0x0258F474786DdFd37ABCE6df6BBb1Dd5dfC4434a"
    let ETH = "0x0000000000000000000000000000000000000000"
    let USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7"

    let stakedOrionWeight = 242; // 242/255
    let orionWeight = 190; // 190/255
    let ethWeight = 190; // 190/255
    let usdtWeight = 180; // 180/255

    let liquidatorPremium = 12;
    let priceOverdue = 3 * 3600; // Time after which we need fresh prices
    let positionOverdue = 30 * 24 * 3600; //Time after which position may be liquidated

    await deployer.deploy(LibValidator);
    await deployer.deploy(LibUnitConverter);
    await deployer.deploy(MarginalFunctionality);

    await deployer.link(LibValidator, Exchange);
    await deployer.link(LibUnitConverter, Exchange);
    await deployer.link(MarginalFunctionality,Exchange);

    await deployer.deploy(PriceOracle, oracleAddress, Orion.address);
    let priceOracleInstance = await PriceOracle.deployed();

    let exchangeInstance = await deployProxy(Exchange, {unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true});

    await priceOracleInstance.changePriceProviderAuthorization([oracleAddress],[]);
    await exchangeInstance.setBasicParams("0x0000000000000000000000000000000000000000", Orion.address, priceOracleInstance.address, allowedMatcher);
    await exchangeInstance.updateMarginalSettings([ORN, ETH, USDT], stakedOrionWeight, liquidatorPremium, priceOverdue, 3600*24);
    await exchangeInstance.updateAssetRisks([ORN, ETH, USDT], [orionWeight, ethWeight, usdtWeight]);

  }
};
