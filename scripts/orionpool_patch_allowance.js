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

        

    } catch (e) {
        callback(e);
    }
    callback()
};
