const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');

const WXRP = artifacts.require("WXRP");
const LINK = artifacts.require("LINK");
const WBTC = artifacts.require("WBTC");
const WETH = artifacts.require("WETH");
const Orion = artifacts.require("Orion");
const PriceOracle = artifacts.require("PriceOracle");
const Exchange = artifacts.require("Exchange");
const SafeMath = artifacts.require("SafeMath");
const LibValidator = artifacts.require("LibValidator");
const LibUnitConverter = artifacts.require("LibUnitConverter");
const MarginalFunctionality = artifacts.require("MarginalFunctionality");



module.exports = async (deployer, network, accounts) => {
  if (network === "development") {
  }
  if (network === "ropsten") {
    await deployer.deploy(MarginalFunctionality);
    await deployer.link(MarginalFunctionality,Exchange);
    let exchangeInstance = await upgradeProxy("0x5b14d57ee8961d1a96bcac827fe44786a1e9f6ea", Exchange, {unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true});
  }
  if (network === "mainnet") {
    await deployer.deploy(MarginalFunctionality);
    await deployer.link(MarginalFunctionality,Exchange);
    let exchangeInstance = await upgradeProxy("0xb5599f568D3f3e6113B286d010d2BCa40A7745AA", Exchange, {unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true});
  }

};
