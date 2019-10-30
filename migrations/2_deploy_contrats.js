const WETH = artifacts.require("WETH");
const WBTC = artifacts.require("WBTC");
const Exchange = artifacts.require("Exchange");

module.exports = async (deployer, network) => {
  if (network === "development") {
    await deployer.deploy(WETH);
    await deployer.deploy(WBTC);
    await deployer.deploy(Exchange);
  }

  if (network === "gwan") {
    await deployer.deploy(WETH);
    await deployer.deploy(WBTC);
    await deployer.deploy(Exchange);
  }

  if (network === "wanache") {
    await deployer.deploy(WETH);
    await deployer.deploy(WBTC);
    await deployer.deploy(Exchange);
  }
};
