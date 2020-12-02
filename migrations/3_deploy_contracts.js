const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');

const WXRP = artifacts.require("WXRP");
const WBTC = artifacts.require("WBTC");
const WETH = artifacts.require("WETH");
const Orion = artifacts.require("Orion");
const OrionVault = artifacts.require("OrionVault");
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
    await deployer.deploy(SafeMath);
    await deployer.deploy(LibValidator);
    await deployer.deploy(LibUnitConverter);
    await deployer.deploy(MarginalFunctionality);

    await deployer.link(SafeMath, Exchange);
    await deployer.link(LibValidator, Exchange);
    await deployer.link(LibUnitConverter, Exchange);
    await deployer.link(MarginalFunctionality,Exchange);

    let orionVaultInstance = await deployProxy(OrionVault, [Orion.address], {unsafeAllowCustomTypes: true});
    let priceOracleInstance = await deployer.deploy(PriceOracle, oraclePubkey, Orion.address);
    let exchangeInstance = await deployProxy(Exchange, {unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true});

    await exchangeInstance.setBasicParams(OrionVault.address, Orion.address, PriceOracle.address, accounts[0]);
    await orionVaultInstance.setExchangeAddress(exchangeInstance.address);

  }
  if (network === "ropsten") {
    oraclePubkey = "0x00de7D7035D44Efb51618ebBE814EcACf0354387";

    await deployer.deploy(SafeMath);
    await deployer.deploy(LibValidator);
    await deployer.deploy(LibUnitConverter);
    await deployer.deploy(MarginalFunctionality);

    await deployer.link(SafeMath, Exchange);
    await deployer.link(LibValidator, Exchange);
    await deployer.link(LibUnitConverter, Exchange);
    await deployer.link(MarginalFunctionality,Exchange);

    let orionVaultInstance = await deployProxy(OrionVault, [Orion.address], {unsafeAllowCustomTypes: true});
    let priceOracleInstance = await deployer.deploy(PriceOracle, oraclePubkey, Orion.address);
    let exchangeInstance = await deployProxy(Exchange, {unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true});

    await exchangeInstance.setBasicParams(OrionVault.address, Orion.address, PriceOracle.address, "0x1FF516E5ce789085CFF86d37fc27747dF852a80a");
    await orionVaultInstance.setExchangeAddress(exchangeInstance.address);
  }
};
