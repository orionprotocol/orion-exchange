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
        let ornUstPairAddress = await factory.getPair(orion.address, usdt.address);
        console.log("ornUsdtPairAddress:" + ornUstPairAddress);
        let ornUsdtPair = await Pair.at(ornUstPairAddress);

        let matcher = "0x643C50b0A4C844eB1aF33c702727BBEeB0DE9DF6";

        // await orion.mint(owner, String(10e8), {from: owner});
        // await orion.approve(exchangeWithOrionPool.address, String(10e8));
        // await exchangeWithOrionPool.depositAsset(orion.address, String(10e8), {
        //     from: owner
        // }).should.be.fulfilled;

        // let balanceAsset = await exchangeWithOrionPool.getBalance(orion.address, owner);
        // console.log("asset Balance=" + balanceAsset.toString());
        // if(balanceAsset.toString() >= String(10e8)){
        //     console.log("Amount ok");
        // }

        let reserves= await ornUsdtPair.getReserves();
        orionReserve = reserves[0];
        usdtReserve = reserves[1];
        console.log('orionReserve=',orionReserve.toString(), 'usdtReserve=',usdtReserve.toString());
        let usdtAmount=new BN(500000000);
        let orionAmount = await router.quote(usdtAmount, orionReserve, usdtReserve);
        console.log('orionAmount='+orionAmount + ' usdtAmount='+usdtAmount);

        await orion.mint(owner,orionAmount.toString());
        await usdt.mint(owner, usdtAmount);
        console.log("Minted ORN & USDT");

        await orion.approve(routerAddress,orionAmount.toString());
        await usdt.approve(routerAddress, usdtAmount);
        console.log("Approved ORN & USDT");

        console.log("orionAddress=" + orion.address + " usdt.address=" + usdt.address + " amountADesired=" + orionAmount + " amountBDesired=" + usdtAmount +
            " amountAMin=" + orionAmount.sub(new BN(10000000)) + " amountBMin=" + usdtAmount.sub(new BN(10000000)));
        let alTx = await router.addLiquidity(
            orion.address,
            usdt.address,
            orionAmount,
            usdtAmount,
            orionAmount.sub(new BN(10000000)),
            usdtAmount.sub(new BN(10000000)),
            owner,
            1716394259
        );
        console.log("Liquidity added:", alTx);

        await orion.mint(owner,orionAmount.toString());
        await orion.approve(exchangeWithOrionPool.address,orionAmount.toString());

        buyOrder  = await orders.generateOrderWithPrivateKey("5ff8a685a54fb149857490f1ac4fca92cf455918e991cd561d282cf187aa5ed5",
            matcher,
            1,
            usdt, orion, orion,
            orionAmount.div(new BN("2")).toString(),
            "200000000",
            2000000);
        console.log("Order:", buyOrder);

        let result = await exchangeWithOrionPool.fillThroughOrionPool(
            buyOrder.order,
            usdtAmount.div(new BN("2")),
            [orion.address, usdt.address]
            //[orion.address, usdt.address]
        );
        console.log("Result:", result);
    } catch (e) {
        callback(e);
    }
    callback()
};
