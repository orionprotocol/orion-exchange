const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');

const OrionPoolFactory = artifacts.require("OrionPoolV2Factory");
const OrionPoolRouter = artifacts.require("OrionPoolV2Router02Ext");
const OrionPoolLibrary = artifacts.require("OrionPoolV2Library");
const TransferHelper = artifacts.require("TransferHelper");
const WETH9 = artifacts.require("WETH9");
const Orion = artifacts.require("Orion");
const USDT = artifacts.require("USDT");
const PriceOracle = artifacts.require("PriceOracle");
const Exchange = artifacts.require("Exchange");
const ExchangeWithOrionPool = artifacts.require("ExchangeWithOrionPool");

const LibValidator = artifacts.require("LibValidator");
const LibUnitConverter = artifacts.require("LibUnitConverter");
const MarginalFunctionality = artifacts.require("MarginalFunctionality");

module.exports = async (deployer, network, accounts) => {
  if (network === "development") {
    let weth = await WETH9.deployed();
    let orn = await Orion.deployed();
    console.log("Account:"+accounts[0]);

    console.log("Deployer:" + accounts[0]);
    await deployer.deploy(OrionPoolFactory, accounts[0], {from: accounts[0]});
    let orionpoolFactory = await OrionPoolFactory.deployed();
    await deployer.deploy(OrionPoolLibrary);
    await deployer.link(OrionPoolLibrary, OrionPoolRouter);
    await deployer.deploy(OrionPoolRouter, orionpoolFactory.address, weth.address, {from: accounts[0]});
    let router = await OrionPoolRouter.deployed();
    console.log("Router deployed at:"+router.address);

    oraclePubkey = accounts[2];
    await deployer.link(LibValidator, ExchangeWithOrionPool);
    await deployer.link(LibUnitConverter, ExchangeWithOrionPool);
    await deployer.link(MarginalFunctionality,ExchangeWithOrionPool);
    let priceOracleInstance = await PriceOracle.deployed();

    let exchangeInstanceWithOrionPool = await deployProxy(ExchangeWithOrionPool, {unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true});
    var usdt = await USDT.deployed();
    const ETH = "0x0000000000000000000000000000000000000000";
 
    await exchangeInstanceWithOrionPool.setBasicParams(orn.address, priceOracleInstance.address, accounts[0], router.address);
    await exchangeInstanceWithOrionPool.updateMarginalSettings([orn.address, ETH, usdt.address], 220, 12, 10000, 86400);
    await exchangeInstanceWithOrionPool.updateAssetRisks([orn.address, ETH, usdt.address], [200, 200, 200]);
  }
  if (network==="bsc_testnet") {

    //  Example: npx truffle migrate --f 7 --to 7 --network bsc_testnet --compile-none
    //  TODO: review this later!
    let weth = {address: '0x23eE96bEaAB62abE126AA192e677c52bB7d274F0'};
    console.log("Account:"+accounts[0]);

    console.log("Deployer:" + accounts[0]);

    //  STEP BY STEP:
    //  await deployer.deploy(OrionPoolFactory, accounts[0], {from: accounts[0]});
    let orionpoolFactory = await OrionPoolFactory.deployed();
    console.log("orionpoolFactory ", orionpoolFactory.address);

    //  await deployer.deploy(OrionPoolLibrary);
    let orionPoolLibrary = await OrionPoolLibrary.deployed();
    console.log("orionPoolLibrary ", orionPoolLibrary.address);

    await deployer.link(OrionPoolLibrary, OrionPoolRouter);
    await deployer.deploy(OrionPoolRouter, orionpoolFactory.address, weth.address, {from: accounts[0]});
    let router = await OrionPoolRouter.deployed();
    console.log("Router deployed at:"+router.address);

    /*
    const ORN = "0xBC2CeD7092Ba48BE66358F542B1822d45FFb420b";
    const priceOracleAddress = "0x68DbBB83f42Ca21aFecA25bBd6cC5233973442F2";
    const WETH = '0xF3B9A50c9fB4c9A5E38639467Bf00168bbac318E';

    await deployer.deploy(OrionPoolFactory, accounts[0]);
    var orionpoolFactory = await OrionPoolFactory.deployed();
    console.log("OrionPool address:"+ orionpoolFactory.address);

    await deployer.deploy(OrionPoolRouter, orionpoolFactory.address, WETH);
    var router = await OrionPoolRouter.deployed();
    console.log("Router address:"+ router.address);

    await deployer.link(LibValidator, ExchangeWithOrionPool);
    await deployer.link(LibUnitConverter, ExchangeWithOrionPool);
    await deployer.link(MarginalFunctionality, ExchangeWithOrionPool);

    var exchangeWithOrionPoolProxy = await deployProxy(ExchangeWithOrionPool, {unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true});
    console.log("ExchangeWithOrionPool proxy address:" + exchangeWithOrionPoolProxy.address);
    await exchangeWithOrionPoolProxy.setBasicParams(ORN, priceOracleAddress, accounts[0], router.address);
     */
  }
  if (network === "ropsten") {
    //  let weth = await WETH.deployed();
    //  let orn = await Orion.deployed();
    let weth = {address: ''};
    console.log("Account:"+accounts[0]);

    console.log("Deployer:" + accounts[0]);

    await deployer.deploy(OrionPoolFactory, accounts[0], {from: accounts[0]});
    let orionpoolFactory = await OrionPoolFactory.deployed();

    await deployer.deploy(OrionPoolLibrary);
    await deployer.link(OrionPoolLibrary, OrionPoolRouter);
    await deployer.deploy(OrionPoolRouter, orionpoolFactory.address, weth.address, {from: accounts[0]});
    let router = await OrionPoolRouter.deployed();
    console.log("Router deployed at:"+router.address);
  }

  if (network==="bsc") {

    //  Example: npx truffle migrate --f 7 --to 7 --network bsc
    let wbnb = {address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'};
    console.log("Account:" + accounts[0]);

    console.log("Deployer:" + accounts[0]);

    //  STEP BY STEP:
    await deployer.deploy(OrionPoolFactory, accounts[0], {from: accounts[0]});
    let orionpoolFactory = await OrionPoolFactory.deployed();
    console.log("orionpoolFactory ", orionpoolFactory.address);

    await deployer.deploy(OrionPoolLibrary);
    let orionPoolLibrary = await OrionPoolLibrary.deployed();
    console.log("orionPoolLibrary ", orionPoolLibrary.address);

    await deployer.link(OrionPoolLibrary, OrionPoolRouter);
    await deployer.deploy(OrionPoolRouter, orionpoolFactory.address, wbnb.address, {from: accounts[0]});
    let router = await OrionPoolRouter.deployed();
    console.log("Router deployed at:" + router.address);
  }

  if (network==="mainnet") {

    //  Example: npx truffle migrate --f 7 --to 7 --network mainnet
    let wbnb = {address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'};
    console.log("Account:" + accounts[0]);

    console.log("Deployer:" + accounts[0]);

    //  STEP BY STEP:
    await deployer.deploy(OrionPoolFactory, accounts[0], {from: accounts[0]});
    let orionpoolFactory = await OrionPoolFactory.deployed();
    console.log("orionpoolFactory ", orionpoolFactory.address);

    await deployer.deploy(OrionPoolLibrary);
    let orionPoolLibrary = await OrionPoolLibrary.deployed();
    console.log("orionPoolLibrary ", orionPoolLibrary.address);

    await deployer.link(OrionPoolLibrary, OrionPoolRouter);
    await deployer.deploy(OrionPoolRouter, orionpoolFactory.address, wbnb.address, {from: accounts[0]});
    let router = await OrionPoolRouter.deployed();
    console.log("Router deployed at:" + router.address);
  }
};
