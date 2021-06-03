require("chai")
    .use(require("chai-shallow-deep-equal"))
    .use(require("chai-as-promised"))
    .should();

const orders = require("./helpers/Orders.js");
const sigUtil = require("eth-sig-util");
const EIP712 = require("./helpers/EIP712.js");
const ChainManipulation = require("./helpers/ChainManipulation");
const eth_signTypedData = require("./helpers/GanacheSignatures.js");

const Exchange = artifacts.require("ExchangeWithOrionPool");
const WETH = artifacts.require("WETH");
const WBTC = artifacts.require("WBTC");
const WXRP = artifacts.require("WXRP");
const USDT = artifacts.require("USDT");
const Orion = artifacts.require("Orion");
let PriceOracle = artifacts.require("PriceOracle");

const LibValidator = artifacts.require("LibValidator");
const MarginalFunctionality = artifacts.require("MarginalFunctionality");


const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"; // WAN or ETH "asset" address in balanaces

let exchange, weth, wbtc, wxrp, orion, wusdt, orionVault, priceOracle, lib, marginalFunctionality;
let oraclePub, matcher;
const initialOrionBalance = Math.floor(5000e8);
const initialWBTCBalance = Math.floor(1e7); //~430 ORN
const initialWETHBalance = Math.floor(3e8); //~430 ORN
const initialWXRPBalance = Math.floor(4300e8); //~430 ORN
const initialRawETHBalance = Math.floor(3e18); //~430 ORN
const initialETHBalance = Math.floor(initialRawETHBalance/1e10);
const initialUSDTBalance = Math.floor(2500 * 1e8);
const stakeAmount = Math.floor(200e8);
const lockingDuration = 3600*24;
const overdueDuration = 3600*24;
const priceOverdue = 3600*3;

const OrionPrice = 1e8;
const WBTCPrice = 4321e8; //4321 orions per one btc
const WXRPPrice = 1e7; //0.1 orions per one xrp
const WETHPrice = 143e8; //143 orions per one ether
const ETHPrice = 143e8; //143 orions per one ether
const WUSDTPrice=4e8;

const newStakeRisk = 127, newPremium = 10, newPriceOverdue = 2*3600, newPositionOverdue = 25*3600;

contract("Exchange", ([owner, user1, user2, user3, priceProvider]) => {
    describe("Exchange::instance", () => {
        it("deploy", async () => {
            exchange = await Exchange.deployed();
            weth = await WETH.deployed();
            wbtc = await WBTC.deployed();
            wxrp = await WXRP.deployed();
            orion = await Orion.deployed();
            wusdt = await USDT.deployed();
            lib = await LibValidator.deployed();
            priceOracle = await PriceOracle.deployed();
            orionVault = exchange; //await OrionVault.deployed(orion.address);
            marginalFunctionality = await MarginalFunctionality.deployed();
            oraclePub = user2; //Defined in migrations
            matcher = owner;

            await priceOracle.changePriceProviderAuthorization([owner],[], {from: owner}).should.be.fulfilled;
            let newPrice = 1e7;
            let newTs = Math.floor(Date.now()/1000);
            prices= {
                assetAddresses: [wxrp.address, wusdt.address],
                prices: [WXRPPrice, WUSDTPrice],
                timestamp: newTs,
                signature: "0x00"
            };
            await priceOracle.provideDataAddressAuthorization(prices).should.be.fulfilled;
        });
    });

    let depositAsset = async (asset, amount, user) => {
        let balanceBefore = await exchange.getBalance(asset.address, user);
        let _amount = String(amount);
        if(asset.address==weth.address){
            _amount = _amount+"0000000000";
        }
        await asset.mint(user, _amount, { from: owner }).should.be
            .fulfilled;
        await asset.approve(exchange.address, _amount, {
            from: user
        });
        await exchange.depositAsset(asset.address, _amount, {
            from: user
        }).should.be.fulfilled;
        let balanceAsset = await exchange.getBalance(asset.address, user);
        (balanceAsset-balanceBefore).toString().should.be.equal(String(amount));
    };

    describe("Exchange::margin setup", () => {
        it("users deposit assets to exchange", async () => {
            await exchange.updateMarginalSettings(
                [orion.address, wusdt.address, wxrp.address],
                newStakeRisk, newPremium,
                newPriceOverdue, newPositionOverdue,
                {from: owner})
                .should.be.fulfilled;

            for (let user of [user1, user2]) {
                await depositAsset(orion, initialOrionBalance, user);
                await depositAsset(wbtc, initialWBTCBalance, user);
                await depositAsset(weth, initialWETHBalance, user);
                await depositAsset(wxrp, initialWXRPBalance, user);

            }
            await orion.mint(user3, initialOrionBalance, { from: owner }).should.be
                .fulfilled;
            await orion.approve(exchange.address, initialOrionBalance, {
                from: user3
            });
            await exchange.depositAsset(orion.address, initialOrionBalance*0.9, {
                from: user3
            }).should.be.fulfilled;

        });
    });

    describe("Exchange:set&test assetRisks to 127",  ()=>{
        it("set asset risks",async ()=>{
            await exchange.updateAssetRisks(
                [orion.address, wusdt.address, wxrp.address],
                [127, 127, 127],
                {from: owner}
            ).should.be.fulfilled;
        });
    });

    describe("Exchange:try to exchange", ()=>{
        it("Do exchange", async () => {
            let balanceBefore = await exchange.getBalance(orion.address, user2);
            balanceBefore=balanceBefore*0.9;
            //console.log("balanceBefore:" + balanceBefore);
            let sellOrder = await orders.generateOrder(user2, matcher, 0,
                wxrp, orion, orion,
                balanceBefore.toString(),
                WXRPPrice.toString(),
                350000);

            let buyOrder = await orders.generateOrder(user3, matcher, 1,
                wxrp, orion, orion,
                balanceBefore.toString(),
                WXRPPrice.toString(),
                350000);

            //console.log("WXRPPrice:", WXRPPrice, " toString():", WXRPPrice.toString());
            await exchange.fillOrders(
                buyOrder.order,
                sellOrder.order,
                WXRPPrice.toString(),
                balanceBefore,
                {from: matcher}
            ).should.be.rejected;
        })
    });

    describe("Exchange:set&test assetRisks to 255",  ()=>{
        it("set asset risks",async ()=>{
            await exchange.updateAssetRisks(
                [orion.address, wusdt.address, wxrp.address],
                [255, 255, 255],
                {from: owner}
            ).should.be.fulfilled;
        });
    });

    describe("Exchange:do real exchange", ()=>{
        it("Do exchange", async () => {
            let orionUser2BalanceBefore = await exchange.getBalance(orion.address, user2);
            orionUser2BalanceBefore=orionUser2BalanceBefore*95;
            await exchange.updateMarginalSettings(
                [orion.address, wusdt.address, wxrp.address],
                255, newPremium,
                newPriceOverdue, newPositionOverdue,
                {from: owner})
                .should.be.fulfilled;

            await wusdt.mint(user2, initialUSDTBalance, { from: owner }).should.be
                .fulfilled;
            await wusdt.approve(exchange.address, initialUSDTBalance, {
                from: user2
            }).should.be.fulfilled;
            await exchange.depositAsset(wusdt.address, initialUSDTBalance, {
                from: user2
            }).should.be.fulfilled;

            await wusdt.mint(user3, initialUSDTBalance*200, { from: owner }).should.be
                .fulfilled;
            await wusdt.approve(exchange.address, initialUSDTBalance*200, {
                from: user3
            }).should.be.fulfilled;
            await exchange.depositAsset(wusdt.address, initialUSDTBalance*200, {
                from: user3
            }).should.be.fulfilled;

            let sellOrder = await orders.generateOrder(user2, matcher, 0,
                wxrp, orion, orion,
                orionUser2BalanceBefore.toString(),
                WXRPPrice.toString(),
                350000);

            let buyOrder = await orders.generateOrder(user3, matcher, 1,
                wxrp, orion, orion,
                orionUser2BalanceBefore.toString(),
                WXRPPrice.toString(),
                350000);
            let buyerPosition = await exchange.calcPosition(user2);
            //console.log("Buyer position before:" + buyerPosition);

            //console.log("WXRPPrice:", WXRPPrice, " toString():", WXRPPrice.toString());
            await exchange.fillOrders(
                buyOrder.order,
                sellOrder.order,
                WXRPPrice.toString(),
                orionUser2BalanceBefore,
                {from: matcher}
            ).should.be.not.fulfilled;
        })
    });

});
