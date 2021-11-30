const { expect } = require("chai");
const { ethers } = require("hardhat");
const BN = ethers.BigNumber;
const { constants, expectEvent } = require('@openzeppelin/test-helpers');
const ZERO_ADDRESS = constants.ZERO_ADDRESS;

const orders = require("../test/helpers/Orders.js");
const { ToBN, ToORN, ToWETH, ToExchAny, ToUSDT, baseUnitToDecimal, decimalToBaseUnit } = require("./libUnit")
const { deployTokens, deployExchange, mintAndApprove, addLiquidity,
    addLiquidityETH, mintAndDeposit, setCollateralAndPriceOracles, printPosition } = require("./deploy-fixture");
const ChainManipulation = require("../test/helpers/ChainManipulation.js");

const initialOrionBalance = Math.floor(5000e8);
const initialWBTCBalance = Math.floor(1e7); //~430 ORN
const initialWETHBalance = Math.floor(3e8); //~430 ORN
const initialWXRPBalance = Math.floor(4300e8); //~430 ORN
const initialRawETHBalance = Math.floor(3e18); //~430 ORN
const initialETHBalance = Math.floor(initialRawETHBalance/1e10);
const stakeAmount = Math.floor(200e8);
const lockingDuration = 3600*24;
const overdueDuration = 3600*24;
const priceOverdue = 3600*3;

const OrionPrice = 1e8;
const WBTCPrice = 4321e8; //4321 orions per one btc
const WXRPPrice = 1e7; //0.1 orions per one xrp
const WETHPrice = 143e8; //143 orions per one ether
const ETHPrice = 143e8; //143 orions per one ether

// Weights for position calculation
const orionWeight = 220;
const wbtcWeight = 200;
const ethWeight = 190;
const wethWeight = 190;
const stakeRisk = 242;
const liquidationPremium = 12;

function calcCollateral(orionStake, orn, wbtc, weth, eth) {
    let weighted = stakeRisk*Math.floor(orionStake/255) +
        Math.floor(orn/255)*orionWeight  +
        Math.floor(Math.floor(wbtc* WBTCPrice/1e8) /255) * wbtcWeight +
        Math.floor(Math.floor(weth* WETHPrice/1e8) /255) * wethWeight  +
        Math.floor(Math.floor(eth* ETHPrice/1e8) /255) * ethWeight;
    let total = orionStake + orn + Math.floor(wbtc* WBTCPrice/1e8) +
        Math.floor(weth* WETHPrice/1e8) +
        Math.floor(eth* ETHPrice/1e8);
    return {weightedPosition: weighted, totalPosition: total};
}

describe("Exchange::margin trading", () => {
    let owner, broker, oracle, user, matcher, liquidator;
    let orn, wbtc, usdt, weth, wxrp;
    let exchange, router, priceOracle;
    let ORN_INITIAL_AMOUNT;

    before(async function () {
        [owner, broker, oracle, user, liquidator] = await ethers.getSigners();
        matcher = owner;
        ({weth, orn, usdt, wbtc, wxrp} = await deployTokens());

        ORN_INITIAL_AMOUNT = ToORN(250);
    })

    async function providePriceData(wethPrice = WETHPrice, wbtcPrice = WBTCPrice, wxrpPrice= WXRPPrice) {
        let newTs = await ChainManipulation.getBlokchainTime();
        prices= {
            assetAddresses: [weth.address, wbtc.address, orn.address, ZERO_ADDRESS, wxrp.address],
            prices: [wethPrice, wbtcPrice, OrionPrice, wethPrice, WXRPPrice],
            timestamp: newTs,
            signature: "0x00"
        };
        await priceOracle.connect(oracle).provideDataAddressAuthorization(prices);
    }

    async function provideRisks() {
        await exchange.connect(owner).updateMarginalSettings(
            [orn.address, weth.address, wbtc.address, ZERO_ADDRESS],
            stakeRisk, liquidationPremium,
            priceOverdue, overdueDuration);

        await exchange.connect(owner).updateAssetRisks(
            [orn.address, wbtc.address, ZERO_ADDRESS, weth.address],
            [orionWeight, wbtcWeight, ethWeight, wethWeight]
        );
    }


    async function initialDeposits() {
        for(const u of [broker, user]) {
            await mintAndDeposit(orn, owner, u, BN.from(initialOrionBalance), exchange);
            await mintAndDeposit(wbtc, owner, u, BN.from(initialWBTCBalance) , exchange);
            await mintAndDeposit(weth, owner, u, ToWETH(3), exchange);
            await mintAndDeposit(wxrp, owner, u, BN.from(initialWXRPBalance), exchange);

            await exchange.connect(u).deposit({value: ToWETH(3)});
            expect(await exchange.getBalance(ZERO_ADDRESS, u.address)).to.equal(initialETHBalance);
        }

        await exchange.connect(broker).lockStake(BN.from(stakeAmount));
    }

    before(async function () {
        ({exchange, priceOracle, router} = await deployExchange(matcher, orn, weth, usdt));
        await setCollateralAndPriceOracles(priceOracle, exchange, owner, oracle, orn, weth, usdt);
        await providePriceData();
        await provideRisks();

        await initialDeposits();
    })

    it("unsophisticated user has correct position", async () => {
        let userPosition = await exchange.calcPosition(user.address);
        let userPositionJs = calcCollateral(0,
            initialOrionBalance,
            initialWBTCBalance,
            initialWETHBalance,
            initialETHBalance);
        expect(userPosition.weightedPosition).to.equal(String(userPositionJs.weightedPosition));
        expect(userPosition.totalPosition).to.equal(String(userPositionJs.totalPosition));
    });

    it("broker has correct initial position", async () => {
        const brokerPosition = await exchange.calcPosition(broker.address);
        const brokerPositionJs = calcCollateral(stakeAmount,
            (initialOrionBalance-stakeAmount),
            initialWBTCBalance,
            initialWETHBalance,
            initialETHBalance);
        expect(brokerPosition.weightedPosition).to.equal(String(brokerPositionJs.weightedPosition));
        expect(brokerPosition.totalPosition).to.equal(String(brokerPositionJs.totalPosition));
    });

    it("broker can make marginal trades", async () => {
        expect(await exchange.getBalance(orn.address, broker.address)).to.equal(initialOrionBalance - stakeAmount);
        //first get rid of all non-orion tokens
        const trades = [[wbtc, initialWBTCBalance, WBTCPrice],
            [weth, initialWETHBalance, WETHPrice],
            [wxrp, initialWXRPBalance, WXRPPrice],
            [{address:ZERO_ADDRESS}, initialETHBalance, ETHPrice]
        ];

        for (const trade of trades) {
            let sellOrder  = await orders.generateOrderV4(broker, matcher, 0,
                trade[0], orn, orn,
                trade[1],
                trade[2],
                350000);
            let buyOrder  = await orders.generateOrderV4(user, matcher, 1,
                trade[0], orn, orn,
                trade[1],
                trade[2],
                350000);

            await exchange.connect(matcher).fillOrders(
                buyOrder.order,
                sellOrder.order,
                trade[2],
                trade[1]
            );
        }

        const brokerPosition = await exchange.calcPosition(broker.address);
        const expectedOrionAmount = initialOrionBalance-stakeAmount +
            Math.floor(initialWBTCBalance*WBTCPrice/1e8) +
            Math.floor(initialWETHBalance*WETHPrice/1e8) +
            Math.floor(initialWXRPBalance*WXRPPrice/1e8) +
            Math.floor(initialETHBalance*ETHPrice/1e8) -
            4*350000;


        const orionAmount = await exchange.getBalance(orn.address, broker.address);
        expect(orionAmount).to.equal(expectedOrionAmount);
        const brokerPositionJs = calcCollateral(stakeAmount,
            expectedOrionAmount,
            0, 0, 0);

        expect(brokerPosition.weightedPosition).to.equal(brokerPositionJs.weightedPosition);
        expect(brokerPosition.totalPosition).to.equal(brokerPositionJs.totalPosition);
        const sellOrder = await orders.generateOrderV4(broker, matcher, 0,
            wbtc, orn, orn,
            1e5,
            WBTCPrice,
            350000);
        const buyOrder  = await orders.generateOrderV4(user, matcher, 1,
            wbtc, orn, orn,
            1e5,
            WBTCPrice,
            350000);

        await exchange.connect(matcher).fillOrders(
            buyOrder.order,
            sellOrder.order,
            WBTCPrice,
            1e5
        );
    });

    it("stake can not be withdrawn if there is liability", async () => {
        await expect(exchange.connect(broker).requestReleaseStake()).to.be.reverted;
    });
    it("asset with negative balance can not be withdrawn", async () => {
        await expect(exchange.connect(broker).withdraw(wbtc.address, 1)).to.be.reverted;
    });

    it("correct broker position after marginal trade", async () => {
        const brokerPosition = await exchange.calcPosition(broker.address);
        const expectedLiability = -(WBTCPrice*1e5/1e8);
        const expectedOrionAmount = initialOrionBalance-stakeAmount + (WBTCPrice*1e5/1e8)+
            Math.floor(initialWBTCBalance*WBTCPrice/1e8) +
            Math.floor(initialWETHBalance*WETHPrice/1e8) +
            Math.floor(initialWXRPBalance*WXRPPrice/1e8) +
            Math.floor(initialETHBalance*ETHPrice/1e8) - 350000*5;
        const orionAmount = await exchange.getBalance(orn.address, broker.address);
        const expectedCollaterals = calcCollateral(stakeAmount, expectedOrionAmount,
            0, 0, 0);
        const expectedWeightedPosition = expectedCollaterals.weightedPosition + expectedLiability;
        const expectedTotalPosition = expectedCollaterals.totalPosition + expectedLiability;

        expect(orionAmount).to.equal(expectedOrionAmount);
        expect(expectedLiability).to.equal(brokerPosition.totalLiabilities);
        expect(brokerPosition.weightedPosition).to.equal(expectedWeightedPosition);
        expect(brokerPosition.totalPosition).to.equal(expectedTotalPosition);
    });

    it("can not withdraw if negative position after", async () => {

        //make position deep enough to make stake alone insufficient for collateral
        const sellOrder  = await orders.generateOrderV4(broker, matcher, 0,
            wbtc, orn, orn,
            1e7,
            WBTCPrice,
            0);
        const buyOrder  = await orders.generateOrderV4(user, matcher, 1,
            wbtc, orn, orn,
            1e7,
            WBTCPrice,
            0);

        await exchange.connect(matcher).fillOrders(
            buyOrder.order,
            sellOrder.order,
            WBTCPrice,
            1e7
        );


        let orionAmount = await exchange.getBalance(orn.address, broker.address);
        await expect(exchange.connect(broker).withdraw(orn.address, orionAmount)).to.be.reverted;

        //return back

        const sellOrder1  = await orders.generateOrderV4(broker, matcher, 1,
            wbtc, orn, orn,
            1e7,
            WBTCPrice,
            0);
        const buyOrder1  = await orders.generateOrderV4(user, matcher, 0,
            wbtc, orn, orn,
            1e7,
            WBTCPrice,
            0);

        await exchange.connect(matcher).fillOrders(
            sellOrder1.order,
            buyOrder1.order,
            WBTCPrice,
            1e7
        );
    });


    it("correct liability list after marginal trade", async () => {
        let l1 = await exchange.liabilities(broker.address, 0);
        await expect(exchange.liabilities(broker.address, 1)).to.be.reverted;
        expect(l1.asset).to.equal(wbtc.address);
    });

    it("broker can open up to 3 liabilities", async () => {
        let trades = [
            [weth, 1e8, WETHPrice],
            [wxrp, 1e8, WXRPPrice]
        ];
        for (const trade of trades) {
            let sellOrder = await orders.generateOrderV4(broker, matcher, 0,
                trade[0], orn, orn,
                trade[1],
                trade[2],
                350000);
            let buyOrder  = await orders.generateOrderV4(user, matcher, 1,
                trade[0], orn, orn,
                trade[1],
                trade[2],
                350000);
            await exchange.connect(matcher).fillOrders(
                buyOrder.order,
                sellOrder.order,
                trade[2],
                trade[1]
            );
        }
        let expectedOrionAmount = initialOrionBalance-stakeAmount +
            Math.floor(initialWBTCBalance*WBTCPrice/1e8) + (WBTCPrice*1e5/1e8) +
            Math.floor(initialWETHBalance*WETHPrice/1e8) + (WETHPrice*1e8/1e8) +
            Math.floor(initialWXRPBalance*WXRPPrice/1e8) + (WXRPPrice*1e8/1e8) +
            Math.floor(initialETHBalance*ETHPrice/1e8) - 350000*7;
        let orionAmount = await exchange.getBalance(orn.address, broker.address);
        expect(orionAmount).to.equal(expectedOrionAmount);
        let expectedCollaterals = calcCollateral(stakeAmount, expectedOrionAmount,
            0, 0, 0);
        let expectedLiability = -(WBTCPrice*1e5/1e8) - (WETHPrice*1e8/1e8) - (WXRPPrice*1e8/1e8);
        let expectedWeightedPosition = expectedCollaterals.weightedPosition + expectedLiability;
        let expectedTotalPosition = expectedCollaterals.totalPosition + expectedLiability;
        let brokerPosition = await exchange.calcPosition(broker.address);
        expect(expectedLiability).to.equal(brokerPosition.totalLiabilities);
        expect(brokerPosition.weightedPosition).to.equal(expectedWeightedPosition);
        expect(brokerPosition.totalPosition).to.equal(expectedTotalPosition);
    });

    it("broker can reimburse liability via deposit", async () => {
        await mintAndDeposit(wbtc, owner, broker, 2e5, exchange);
        await expect(exchange.liabilities(broker, 2)).to.be.reverted;
        let fL = await exchange.liabilities(broker.address, 0);
        let sL = await exchange.liabilities(broker.address, 1);
        // Note: due to new remove Liability mechanism, order is not preserved
        expect(sL.asset).to.equal(weth.address);
        expect(fL.asset).to.equal(wxrp.address);
        expect(await exchange.getBalance(wbtc.address, broker.address)).to.equal(1e5);
    });

    it("broker can reimburse liability via trade", async () => {
        let trades = [
            [wxrp, 2e8, WXRPPrice]
        ];
        for(const trade of trades) {
            let buyOrder  = await orders.generateOrderV4(broker, matcher, 1,
                trade[0], orn, orn,
                trade[1],
                trade[2],
                350000);
            let sellOrder  = await orders.generateOrderV4(user, matcher, 0,
                trade[0], orn, orn,
                trade[1],
                trade[2],
                350000);
            await exchange.connect(matcher).fillOrders(
                buyOrder.order,
                sellOrder.order,
                trade[2],
                trade[1]
            );
        }
        await expect(exchange.liabilities(broker.address, 1)).to.be.reverted;
        expect((await exchange.liabilities(broker.address, 0)).asset).to.equal(weth.address);
    });

    it("broker can deepen existing liability", async () => {
        let fL = await exchange.liabilities(broker.address, 0);
        const firstLiabilityTime = fL.timestamp.toString();
        const trades = [
            [weth, 1e8, WETHPrice]
        ];
        for (const trade of trades) {
            const sellOrder = await orders.generateOrderV4(broker, matcher, 0,
                trade[0], orn, orn,
                trade[1],
                trade[2],
                350000);
            const buyOrder = await orders.generateOrderV4(user, matcher, 1,
                trade[0], orn, orn,
                trade[1],
                trade[2],
                350000);
            await exchange.connect(matcher).fillOrders(
                buyOrder.order,
                sellOrder.order,
                trade[2],
                trade[1]
            );
        }
        await expect(exchange.liabilities(broker.address, 1)).to.be.reverted; //No new liabilities
        let nL = await exchange.liabilities(broker.address, 0);
        const newLiabilityTime = nL.timestamp.toString();
        expect(firstLiabilityTime).to.equal(newLiabilityTime);
        expect(await exchange.getBalance(weth.address, broker.address)).to.equal(-2e8);
    });

    it("broker can't open new liability if he overdue old one", async () => {
        await ChainManipulation.advanceTime(overdueDuration+1);
        await ChainManipulation.advanceBlock();
        await providePriceData();
        const trades = [
            [{address:ZERO_ADDRESS}, 1e8, ETHPrice]
        ];
        for (const trade of trades) {
            const sellOrder  = await orders.generateOrderV4(broker, matcher, 0,
                trade[0], orn, orn,
                trade[1],
                trade[2],
                350000);
            const buyOrder  = await orders.generateOrderV4(user, matcher, 1,
                trade[0], orn, orn,
                trade[1],
                trade[2],
                350000);
            await expect(exchange.connect(matcher).fillOrders(
                buyOrder.order,
                sellOrder.order,
                trade[2],
                trade[1]
            )).to.be.reverted;
        }
    });

    it("broker can't deepen old liability if he overdue it", async () => {
        console.log("Broker:", broker.address, "User:", user.address);
        await ChainManipulation.advanceTime(overdueDuration + 1);
        await ChainManipulation.advanceBlock();
        await providePriceData();
        const trades = [
            [weth, 1e8, WETHPrice]
        ];
        for(const trade of trades) {
            const sellOrder  = await orders.generateOrderV4(broker, matcher, 0,
                trade[0], orn, orn,
                trade[1],
                trade[2],
                350000);
            const buyOrder  = await orders.generateOrderV4(user, matcher, 1,
                trade[0], orn, orn,
                trade[1],
                trade[2],
                350000);

            await expect(exchange.connect(matcher).fillOrders(
                buyOrder.order,
                sellOrder.order,
                trade[2],
                trade[1]
            )).to.be.revertedWith('E1PS');
        }
        await mintAndDeposit(weth, owner, broker, ToWETH(2), exchange);
        await expect(exchange.liabilities(broker.address, 0)).to.be.reverted; //No liabilities
    });
    
    it("correct overdue time calculation", async () => {
        // Create liability
        let addWethLiability = async (amount) => {
            await ChainManipulation.advanceBlock();
            await providePriceData();
            const trades = [
                [weth, amount, WETHPrice]
            ];
            for (const trade of trades) {
                let sellOrder  = await orders.generateOrderV4(broker, matcher, 0,
                    trade[0], orn, orn,
                    trade[1],
                    trade[2],
                    350000);
                let buyOrder  = await orders.generateOrderV4(user, matcher, 1,
                    trade[0], orn, orn,
                    trade[1],
                    trade[2],
                    350000);
                await exchange.connect(matcher).fillOrders(
                    buyOrder.order,
                    sellOrder.order,
                    trade[2],
                    trade[1]
                );
            }
        }

        //Create liability
        const initialAmount = 1;
        await addWethLiability(ToExchAny(initialAmount));
        let liability = await exchange.liabilities(broker.address, 0);
        expect(liability.asset).to.equal(weth.address);
        const liabilityTimestamp = liability.timestamp;
        expect(liability.outstandingAmount).to.equal(ToExchAny(initialAmount));
        // liability.timestamp should be roughly equal blockchain subjective time
        expect(Math.abs(liability.timestamp - await ChainManipulation.getBlokchainTime())).to.lt(5);

        await ChainManipulation.advanceTime(1000);

        //Deepen liability
        const additionalAmount = 0.003;
        await addWethLiability(ToExchAny(additionalAmount));
        let updatedLiability = await exchange.liabilities(broker.address, 0);
        // liability.timestamp and outstandingAmount should not be updated
        expect(updatedLiability.outstandingAmount).to.equal(ToExchAny(initialAmount));
        expect(updatedLiability.timestamp).to.equal(liabilityTimestamp);


        await ChainManipulation.advanceTime(1000);

        //partially reimburse liability
        let partialAmount = Math.floor(initialAmount/3);
        await mintAndDeposit(weth, owner, broker, ToWETH(partialAmount), exchange);

        let updatedLiability2 = await exchange.liabilities(broker.address, 0);
        // outstandingAmount should be decreased by partial amount
        expect(updatedLiability2.outstandingAmount).to.equal(ToExchAny(initialAmount - partialAmount));
        // since initial liability is not reimbursed timestamp should not be updated
        expect(updatedLiability2.timestamp).to.equal(liabilityTimestamp);


        //fully reimburse 1st liability and partially second
        const partialAmount2 = initialAmount - partialAmount + Math.floor(additionalAmount/3);
        await mintAndDeposit(weth, owner, broker, ToWETH(partialAmount2), exchange);

        let updatedLiability3 = await exchange.liabilities(broker.address, 0);
        // outstandingAmount should be now be equal current total liability
        expect(updatedLiability3.outstandingAmount).to
            .equal(ToExchAny(initialAmount + additionalAmount - partialAmount - partialAmount2));
        // since initial liability is reimbursed timestamp should be roughly equal blockchain subjective time
        expect(Math.abs(updatedLiability3.timestamp - (await ChainManipulation.getBlokchainTime()))).to.lt(5);

        const partialAmount3 = initialAmount + additionalAmount - partialAmount - partialAmount2;
        await mintAndDeposit(weth, owner, broker, ToWETH(partialAmount3), exchange);
        await expect(exchange.liabilities(broker.address, 0)).to.be.reverted; //No liabilities
    });

    describe("Exchange::Liquidation", () => {
        it("positive position can not be liquidated", async () => {
            await mintAndDeposit(orn, owner, user, ToORN(50000), exchange);

            await mintAndDeposit(weth, owner, liquidator, ToWETH(1100), exchange);
            
            const trades = [
                [{address: weth.address}, ToExchAny(200), WETHPrice]
            ];
            for (const trade of trades) {
                const sellOrder = await orders.generateOrderV4(broker, matcher, 0,
                    trade[0], orn, orn,
                    trade[1],
                    trade[2],
                    350000);
                const buyOrder = await orders.generateOrderV4(user, matcher, 1,
                    trade[0], orn, orn,
                    trade[1],
                    trade[2],
                    350000);
                await exchange.connect(matcher).fillOrders(
                    buyOrder.order,
                    sellOrder.order,
                    trade[2],
                    trade[1]
                );
            }
            await expect(exchange.connect(liquidator).partiallyLiquidate(broker.address, weth.address, 10e8)).to.be.reverted;
        });

        it("negative position can be liquidated", async () => {
            await providePriceData(160e8);
            const position = await exchange.calcPosition(broker.address);
            expect(position.state).to.equal(1); //Negative
            const brokerOrionAmount = await exchange.getBalance(orn.address, broker.address);

            await exchange.connect(liquidator).partiallyLiquidate(broker.address, weth.address, 10e8);
            const newBrokerOrionAmount = await exchange.getBalance(orn.address, broker.address);
            const liquidatorOrionAmount = await exchange.getBalance(orn.address, liquidator.address);
            const liquidationAmount = Math.floor(10e8 * 160e8 / 1e8);
            const premium = Math.floor(liquidationAmount / 255) * liquidationPremium;
            expect(newBrokerOrionAmount - brokerOrionAmount).to.equal(-(liquidationAmount + premium));
            expect(liquidatorOrionAmount).to.equal(liquidationAmount + premium);
            console.log("Broker position:", (await exchange.calcPosition(broker.address)).state);
        });

        it("correct balances after liquidation", async () => {
            let liquidationAmount = Math.floor(10e8 * 160e8 / 1e8);
            let premium = Math.floor(liquidationAmount / 255) * liquidationPremium;
            let liquidatorOrionAmount = await exchange.getBalance(orn.address, liquidator.address);
            expect(liquidatorOrionAmount).to.equal(liquidationAmount + premium);
        });

        it("liquidation can not make balance very positive", async () => {
            await expect(exchange.connect(liquidator).partiallyLiquidate(broker.address, weth.address, 220e8))
                .to.be.reverted;
        });

        it("overdue position can be liquidated", async () => {
            await ChainManipulation.advanceTime(overdueDuration + 1);
            await ChainManipulation.advanceBlock();
            const position = await exchange.calcPosition(broker.address);
            await providePriceData(160e8);

            let liquidatorOrionAmount = await exchange.getBalance(orn.address, liquidator.address);
            await exchange.connect(liquidator).partiallyLiquidate(broker.address, weth.address, 180e8);
            let newLiquidatorOrionAmount = await exchange.getBalance(orn.address, liquidator.address);

            const liquidationAmount = Math.floor(180e8 * 160e8 / 1e8);
            const premium = Math.floor(liquidationAmount / 255) * liquidationPremium;
            expect(newLiquidatorOrionAmount - liquidatorOrionAmount).to.equal((liquidationAmount + premium));
        });
    });
});