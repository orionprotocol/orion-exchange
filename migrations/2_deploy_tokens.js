const WXRP = artifacts.require("WXRP");
const WBTC = artifacts.require("WBTC");
const WETH = artifacts.require("WETH");
const USDT = artifacts.require("USDT");
const Orion = artifacts.require("Orion");
const PriceOracle = artifacts.require("PriceOracle");
const Exchange = artifacts.require("Exchange");
const SafeMath = artifacts.require("SafeMath");
const LibValidator = artifacts.require("LibValidator");
const LibUnitConverter = artifacts.require("LibUnitConverter");
const MarginalFunctionality = artifacts.require("MarginalFunctionality");

let oraclePubkey = "0xDc966DCB447004dF677c8A509dd24A070AE93Bf2";

module.exports = async (deployer, network) => {
  if (network === "development") {
    await deployer.deploy(WXRP);
    await deployer.deploy(WBTC);
    await deployer.deploy(WETH);
    await deployer.deploy(Orion);
    await deployer.deploy(USDT);


  }
};
