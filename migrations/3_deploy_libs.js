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
    await deployer.deploy(LibValidator);
    await deployer.deploy(LibUnitConverter);
    await deployer.deploy(MarginalFunctionality);
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
    await exchangeInstance.setBasicParams(Orion.address, priceOracleInstance.address, "0x1FF516E5ce789085CFF86d37fc27747dF852a80a");
    await exchangeInstance.updateMarginalSettings(["0x0000000000000000000000000000000000000000", "0xfc1cd13a7f126efd823e373c4086f69beb8611c2", "0xfc25454ac2db9f6ab36bc0b0b034b41061c00982"], 242, 12, 3600*3, 3600*24);
    await exchangeInstance.updateAssetRisks(["0x0000000000000000000000000000000000000000", "0xfc1cd13a7f126efd823e373c4086f69beb8611c2","0xfc25454ac2db9f6ab36bc0b0b034b41061c00982"], [190, 180, 191]);

  }


 if (network === "mainnet") {

    await deployer.deploy(LibValidator);
    await deployer.deploy(LibUnitConverter);
    await deployer.deploy(MarginalFunctionality);

  }
};
