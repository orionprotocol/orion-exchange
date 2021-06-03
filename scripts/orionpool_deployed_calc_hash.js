const orders = require("../test/helpers/Orders.js");
const sigUtil = require("eth-sig-util");
const EIP712 = require("../test/helpers/EIP712.js");
const ChainManipulation = require("../test/helpers/ChainManipulation");
const BN = require("bn.js");

const ExchangeWithOrionPool = artifacts.require("ExchangeWithOrionPool");
const WETH = artifacts.require("GenericToken");
const Orion = artifacts.require("Orion");
let USDT = artifacts.require("USDT");
let PriceOracle = artifacts.require("PriceOracle");

const LibValidator = artifacts.require("LibValidator");
const MarginalFunctionality = artifacts.require("MarginalFunctionality");

const OrionPoolRouter = artifacts.require("OrionPoolV2Router02");
const Factory = artifacts.require("OrionPoolV2Factory");
const OrionPoolLibrary = artifacts.require("OrionPoolV2Library");
const Pair = artifacts.require("OrionPoolV2Pair");

module.exports = async callback => {
    try {
        //console.log("Account:", await web3.eth.getAccounts());
        owner = (await web3.eth.getAccounts())[0];
        global.web3=web3;
        console.log(owner);

        let orionPse = Orion.at("0xBC2CeD7092Ba48BE66358F542B1822d45FFb420b");
        let usdtPse = USDT.at("0x0ea5b3b76A674Be198c1634Df1529727E754189D");
        let wethPse = WETH.at("0xF3B9A50c9fB4c9A5E38639467Bf00168bbac318E");
        let routerAddress = "0x34f305a89ecb65918acda094a1c1530bdb30d07a";
        let routerPse = OrionPoolRouter.at(routerAddress);
        let exchangeWithOrionPoolPse = ExchangeWithOrionPool.at("0xB1c38C5d69b5e9514EdE6C0cBaDC50F76BcFb988");

        let orion, usdt, weth, router, exchangeWithOrionPool;
        await Promise.all([orionPse, usdtPse, wethPse, routerPse, exchangeWithOrionPoolPse]).then(values=>{
            [orion, usdt, weth, router, exchangeWithOrionPool]=values;
            console.log("Promises [orion, usdt, weth, router, exchangeWithOrionPool] finished");
        });

        let factoryAddress = await router.factory();
        console.log("Factory address:" + factoryAddress);
        let factory = await Factory.at(factoryAddress);

        await factory.createPair(orion.address, routerAddress);
    } catch (e) {
        callback(e);
    }
    callback()
};
