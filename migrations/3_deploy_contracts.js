const WXRP = artifacts.require("WXRP");
const WBTC = artifacts.require("WBTC");
const WETH = artifacts.require("WETH");
const Orion = artifacts.require("Orion");
const Staking = artifacts.require("Staking");
const PriceOracle = artifacts.require("PriceOracle");
const Exchange = artifacts.require("Exchange");
const OrionProxy = artifacts.require("OrionProxy");
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

    await deployer.deploy(Staking, Orion.address);
    await deployer.deploy(PriceOracle, oraclePubkey);
    await deployer.deploy(Exchange, Staking.address, Orion.address, PriceOracle.address, "0x0000000000000000000000000000000000000000");

    await deployer.deploy(OrionProxy, Exchange.address);

    let stakingInstance = await Staking.deployed();
    let exchangeInstance = await Exchange.deployed();
    await stakingInstance.setExchangeAddress(exchangeInstance.address, {from:deployer});

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

    await deployer.deploy(Staking, Orion.address);
    await deployer.deploy(PriceOracle, oraclePubkey);
    await deployer.deploy(Exchange, Staking.address, Orion.address, PriceOracle.address, "0x1FF516E5ce789085CFF86d37fc27747dF852a80a");

    await deployer.deploy(OrionProxy, Exchange.address);
  }
};
