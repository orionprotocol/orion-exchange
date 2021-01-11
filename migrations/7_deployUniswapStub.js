const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');

const UniswapFactory = artifacts.require("UniswapV2Factory");
const UniswapRouter = artifacts.require("UniswapV2Router02");
const UniswapLibrary = artifacts.require("UniswapV2Library");
const TransferHelper = artifacts.require("TransferHelper");
const WETH = artifacts.require("WETH");
const Orion = artifacts.require("Orion");
const USDT = artifacts.require("USDT");
const PriceOracle = artifacts.require("PriceOracle");
const Exchange = artifacts.require("ExchangeWithUniswap");

const LibValidator = artifacts.require("LibValidator");
const LibUnitConverter = artifacts.require("LibUnitConverter");
const MarginalFunctionality = artifacts.require("MarginalFunctionality");

module.exports = async (deployer, network, accounts) => {
  if (network === "development") {

    await deployer.deploy(UniswapFactory, accounts[0]);
    var factory = await UniswapFactory.deployed();
    var weth = await WETH.deployed();
    await deployer.deploy(UniswapRouter, factory.address, weth.address);
    var router = await UniswapRouter.deployed();
    oraclePubkey = accounts[2];

    await deployer.link(LibValidator, Exchange);
    await deployer.link(LibUnitConverter, Exchange);
    await deployer.link(MarginalFunctionality,Exchange);

    let priceOracleInstance = await deployer.deploy(PriceOracle, oraclePubkey, Orion.address);
    let exchangeInstance = await deployProxy(Exchange, {unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true});

    var orn = await Orion.deployed();
    var usdt = await USDT.deployed();
    const ETH = "0x0000000000000000000000000000000000000000";

    await exchangeInstance.setBasicParams(Orion.address, PriceOracle.address, accounts[0], router.address);
    await exchangeInstance.updateMarginalSettings([orn.address, ETH, usdt.address], 220, 12, 10000, 86400);
    await exchangeInstance.updateAssetRisks([orn.address, ETH, usdt.address], [200, 200, 200]);

  }
  if (network === "ropsten") {
  }
  if (network === "mainnet") {
  }

};
