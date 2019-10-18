const WETH = artifacts.require("WETH");
const WBTC = artifacts.require("WBTC");
const Exchange = artifacts.require("Exchange");

module.exports = async (deployer, network) => {
  // await deployer.deploy(WETH);
  // await deployer.deploy(WBTC);
  await deployer.deploy(Exchange);
};
