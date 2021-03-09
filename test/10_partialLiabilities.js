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

let PriceOracle = artifacts.require("PriceOracle");

const LibValidator = artifacts.require("LibValidator");
const MarginalFunctionality = artifacts.require("MarginalFunctionality");



let exchange, orion, wbtc, wxrp, priceOracle, lib, marginalFunctionality;
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
const initialOrionBalance = Math.floor(50000*10e8);
const initialWbcBalance = Math.floor(0.1*10e8);
const initialWxrpBalance = Math.floor(1*10e8);
const initialRawETHBalance = Math.floor(3e18); //~430 ORN
const stakeAmount = Math.floor(200e8);

const lockingDuration = 3600*24;
const overdueDuration = 3600*24;

const newStakeRisk = 127, newPremium = 10, newPriceOverdue = 2*3600, newPositionOverdue = 25*3600;

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
contract("Exchange", ([owner, broker, user3, user4, user5, user6, user7]) => {
    describe("Exchange::instance", () => {
        it("deploy", async () => {
            exchange = await Exchange.deployed();
            orion = await Orion.deployed();
            wbtc = await Wbtc.deployed();
            wxrp = await Wxrp.deployed();
            priceOracle = await PriceOracle.deployed();
            priceProvider = oraclePub = user5; //Defined in migrations
            matcher = owner;
        });
        it("set collaterals & oracle prices", async () => {
            await exchange.updateMarginalSettings(
                [wbtc.address, wxrp.address, orion.address],
                newStakeRisk, newPremium,
                newPriceOverdue, newPositionOverdue,
                {from: owner})
                .should.be.fulfilled;
            let collaterals = await exchange.getCollateralAssets();

            let newTs = Math.floor(Date.now()/1000);
            prices= {
                assetAddresses: [wbtc.address, wxrp.address],
                prices: [23000*10e8,9*10e8],
                timestamp: newTs,
                signature: "0x00"
            };
            priceOracle.changePriceProviderAuthorization([user3], [], {from: owner}).should.be.fulfilled;
            priceOracle.provideDataAddressAuthorization(prices, {from: user3}).should.be.fulfilled;
            await exchange.updateAssetRisks([wbtc.address, wxrp.address, orion.address], [250, 250, 250], {from: owner});
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
            for (let user of [broker, user6, user7]) {
                await depositAsset(orion, initialOrionBalance*100, user);
                await exchange.lockStake(initialOrionBalance*50, {from:user}).should.be.fulfilled;
                await depositAsset(wbtc, initialWbcBalance*100, user);
                await depositAsset(wxrp, initialWxrpBalance*500, user);
            }
        });

        it("make liability", async () => {

            let sellOrder  = await orders.generateOrder(user6, matcher, 0,
                wbtc, wxrp, orion,
                0.2*10e8,
                10940919037199); // 1/0.00000914*10^8
            let buyOrder  = await orders.generateOrder(user7, matcher, 1,
                wbtc, wxrp, orion,
                0.2*10e8,
                10940919037199
                );

            await exchange.fillOrders(
                buyOrder.order,
                sellOrder.order,
                10940919037199,
                0.005*10e8,
                { from: matcher }
            ).should.be.fulfilled;

            let user7XrpBalance = await exchange.getBalance(Wxrp.address, user7);

            let sellOrder2  = await orders.generateOrder(user6, matcher, 0,
                wxrp, orion, orion,
                10000000,
                1*10e8);
            let buyOrder2  = await orders.generateOrder(user7, matcher, 1,
                wxrp, orion, orion,
                10000000,
                1*10e8
            );

            await exchange.fillOrders(
                buyOrder2.order,
                sellOrder2.order,
                1*10e8,
                0.005*10e8,
                { from: matcher }
            ).should.be.fulfilled;

            let user7Liabilities2 = await exchange.getLiabilities(user7);
            let user7XrpBalance2 = await exchange.getBalance(Wxrp.address, user7);
            (user7XrpBalance2 - user7XrpBalance).toString().should.be.equal("5000000");
            (user7Liabilities2[0].outstandingAmount*1 + user7XrpBalance2*1).should.be.equal(0);
        });

    });
});
