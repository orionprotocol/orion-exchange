require("chai")
    .use(require("chai-shallow-deep-equal"))
    .use(require("chai-as-promised"))
    .should();

const orders = require("./helpers/Orders.js");
const sigUtil = require("eth-sig-util");
const EIP712 = require("./helpers/EIP712.js");
const ChainManipulation = require("./helpers/ChainManipulation");
const eth_signTypedData = require("./helpers/GanacheSignatures.js");

const Exchange = artifacts.require("Exchange");
const Orion = artifacts.require("Orion");
const Wbtc = artifacts.require("WBTC");
const Wxrp = artifacts.require("WXRP");
const Usdt = artifacts.require("USDT");

let PriceOracle = artifacts.require("PriceOracle");

const LibValidator = artifacts.require("LibValidator");
const MarginalFunctionality = artifacts.require("MarginalFunctionality");



let exchange, orion, wbtc, wxrp, usdt, priceOracle, lib, marginalFunctionality;
let oraclePub, matcher, priceProvider;

const totalTokensNum = 20;
let tokens = [];

const OrionPrice = 1e8;
const ETHPrice = 143e8;
const tokenPrices = 0.5e8;

const orionWeight = 220;
const ethWeight = 190;

const stakeRisk = 242;
const liquidationPremium = 12;
const initialOrionBalance = Math.floor(1000*1e8);
const initialWbtcBalance = Math.floor(10*1e8);
const initialWxrpBalance = Math.floor(10*1e8);
const initialRawETHBalance = Math.floor(3e18); //~430 ORN
const stakeAmount = Math.floor(200e8);

const lockingDuration = 3600*24;
const overdueDuration = 3600*24;

//const newStakeRisk = 254, newPremium = 10, newPriceOverdue = Math.floor(Date.now()/1000+24*3600), newPositionOverdue = Math.floor(Date.now()/1000+25*3600);
const newStakeRisk = 254, newPremium = 10, newPriceOverdue = Math.floor(24*3600), newPositionOverdue = Math.floor(25*3600);

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

let generateData = async(assets,priceData) => {
    prices= {
        assetAddresses: assets,
        prices: priceData,
        timestamp: await ChainManipulation.getBlokchainTime(),
        signature: "0x00"
    };
    return prices;
}
contract("Exchange", ([owner, broker, oracle, user, user1, user2, user3, user4]) => {
    describe("Exchange::instance", () => {
        it("deploy", async () => {
            exchange = await Exchange.deployed();
            orion = await Orion.deployed();
            wbtc = await Wbtc.deployed();
            wxrp = await Wxrp.deployed();
            usdt = await Usdt.deployed();
            priceOracle = await PriceOracle.deployed();
            priceProvider = oraclePub = oracle; //Defined in migrations
            matcher = owner;
        });
        it("set collaterals & oracle prices", async () => {
            await exchange.updateMarginalSettings(
                [wbtc.address, wxrp.address, orion.address],
                newStakeRisk, newPremium,
                newPriceOverdue, newPositionOverdue,
                {from: owner})
                .should.be.fulfilled;

            let newTs = Math.floor(Date.now()/1000+50);
            prices= {
                assetAddresses: [wbtc.address, wxrp.address, orion.address],
                prices: [Math.floor(1*1e8),Math.floor(1*1e8),Math.floor(1*1e8)],
                timestamp: newTs,
                signature: "0x00"
            };
            await priceOracle.changePriceProviderAuthorization([oracle], [], {from: owner}).should.be.fulfilled;
            await priceOracle.provideDataAddressAuthorization(prices, {from: oracle}).should.be.fulfilled;
            await exchange.updateAssetRisks([wbtc.address, wxrp.address, orion.address], [254, 254, 254], {from: owner});
        });

        //Helper
        let depositAsset = async (asset, amount, user) => {
            let balanceBefore = await exchange.getBalance(asset.address, user);
            let _amount = String(amount);
            await asset.mint(user, _amount, {from: owner}).should.be
                .fulfilled;
            await asset.approve(exchange.address, _amount, {
                from: user
            });
            await exchange.depositAsset(asset.address, _amount, {
                from: user
            }).should.be.fulfilled;
            let balanceAfter = await exchange.getBalance(asset.address, user);
            (balanceAfter - balanceBefore).toString().should.be.equal(String(amount));
        };

        it("users deposit assets to exchange", async () => {
            for (let _user of [broker, user]) {
                await depositAsset(orion, initialOrionBalance, _user);
                await exchange.lockStake(1e7, {from:_user}).should.be.fulfilled;
                await depositAsset(wbtc, initialWbtcBalance, _user);
                await depositAsset(wxrp, initialWxrpBalance, _user);
            }
        });

        it("make liability", async () => {
            const amount = Math.floor(1.6*10e8), price=Math.floor(1e8);
            let sellOrder  = await orders.generateOrder(user, matcher, 0,
                wbtc, wxrp, orion,
                amount,
                price);
            let buyOrder  = await orders.generateOrder(broker, matcher, 1,
                wbtc, wxrp, orion,
                amount,
                price
                );

            await exchange.fillOrders(
                buyOrder.order,
                sellOrder.order,
                price,
                amount,
                { from: matcher }
            ).should.be.fulfilled;

            let brokerXrpBalance = await exchange.getBalance(Wxrp.address, broker);
            let secondAmount = Math.abs(brokerXrpBalance/10);

            let sellOrder2  = await orders.generateOrder(user, matcher, 0,
                wxrp, orion, orion,
                secondAmount,
                price);
            let buyOrder2  = await orders.generateOrder(broker, matcher, 1,
                wxrp, orion, orion,
                secondAmount,
                price
            );

            await  exchange.fillOrders(
                buyOrder2.order,
                sellOrder2.order,
                price,
                secondAmount,
                { from: matcher }
            ).should.be.fulfilled;

            let brokerLiabilities2 = await exchange.getLiabilities(broker);
            let userLiabilities2 = await exchange.getLiabilities(user);
            let brokerXrpBalance2 = await exchange.getBalance(Wxrp.address, broker);
            (brokerXrpBalance2 - brokerXrpBalance).toString().should.be.equal(String(secondAmount));
            (brokerLiabilities2[0].outstandingAmount*1 + brokerXrpBalance2*1).should.be.equal(0);
        });

    });
});
