const WXRP = artifacts.require("WXRP");
const WBTC = artifacts.require("WBTC");
const WETH = artifacts.require("WETH");
const Orion = artifacts.require("Orion");
const Exchange = artifacts.require("Exchange");
const OrionProxy = artifacts.require("OrionProxy");
const SafeMath = artifacts.require("SafeMath");
const LibValidator = artifacts.require("LibValidator");
const LibUnitConverter = artifacts.require("LibUnitConverter");

const oraclePubkey = "0xDc966DCB447004dF677c8A509dd24A070AE93Bf2";

module.exports = async (deployer, network) => {
  if (network === "development") {
    await deployer.deploy(WXRP);
    await deployer.deploy(WBTC);
    await deployer.deploy(WETH);
    await deployer.deploy(Orion);


    await deployer.deploy(SafeMath);
    await deployer.deploy(LibValidator);
    await deployer.deploy(LibUnitConverter);

    await deployer.link(SafeMath, Exchange);
    await deployer.link(LibValidator, Exchange);
    await deployer.link(LibUnitConverter, Exchange);

    await deployer.deploy(Exchange, Orion.address, oraclePubkey);
    await deployer.deploy(OrionProxy, Exchange.address);
  }
};
