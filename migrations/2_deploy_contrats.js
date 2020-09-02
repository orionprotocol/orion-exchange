const WXRP = artifacts.require("WXRP");
const WBTC = artifacts.require("WBTC");
const WETH = artifacts.require("WETH");
const Exchange = artifacts.require("Exchange");
const OrionProxy = artifacts.require("OrionProxy");
const SafeMath = artifacts.require("SafeMath");
const LibValidator = artifacts.require("LibValidator");
const LibUnitConverter = artifacts.require("LibUnitConverter");

module.exports = async (deployer, network) => {
  if (network === "development") {
    await deployer.deploy(WXRP);
    await deployer.deploy(WBTC);
    await deployer.deploy(WETH);

    await deployer.deploy(SafeMath);
    await deployer.deploy(LibValidator);
    await deployer.deploy(LibUnitConverter);

    await deployer.link(SafeMath, Exchange);
    await deployer.link(LibValidator, Exchange);
    await deployer.link(LibUnitConverter, Exchange);

    await deployer.deploy(Exchange);
    await deployer.deploy(OrionProxy, Exchange.address);
  }
};
