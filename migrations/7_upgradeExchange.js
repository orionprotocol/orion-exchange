const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');

const Exchange = artifacts.require("Exchange");
const MarginalFunctionality = artifacts.require("MarginalFunctionality");
const LibValidator = artifacts.require("LibValidator");
const LibUnitConverter = artifacts.require("LibUnitConverter");

module.exports = async (deployer, network, accounts) => {
  if (network === "testnet") {
     await deployer.deploy(MarginalFunctionality);
     await deployer.link(MarginalFunctionality,Exchange);
     let exchangeInstance = await upgradeProxy("0x927C99EaF573914C340220F25642a5523516d220", Exchange, {unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true});
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
