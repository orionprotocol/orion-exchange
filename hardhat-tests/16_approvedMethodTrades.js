const { expect } = require("chai");
const { ethers } = require("hardhat");
const BN = ethers.BigNumber;
const { constants, expectEvent } = require('@openzeppelin/test-helpers');
const ZERO_ADDRESS = constants.ZERO_ADDRESS;

const { ToBN, ToORN, ToWETH, ToExchAny, ToUSDT, baseUnitToDecimal, decimalToBaseUnit } = require("./libUnit")
const { deployTokens, deployExchange, mintAndApprove, addLiquidity, addLiquidityETH, mintAndDeposit,
    setCollateralAndPriceOracles, printPosition } = require("./deploy-fixture");
const orders = require("../test/helpers/Orders.js");

describe("Exchange::orders with approve", () => {
    let owner, user1, user2, user3, user4, matcher, broker;
    let weth, orn, usdt;
    let exchange, router, priceOracle;
    let orn_units, usdt_units, weth_units;
    let ORN_AMOUNT, USDT_AMOUNT, WETH_AMOUNT;
    let WETH_RESERVE, USDT_RESERVE;
    const FEE = BN.from(350000);

    before(async function () {
        [owner, user1, user2, user3, user4, broker] = await ethers.getSigners();
        matcher = owner;
        ({ weth, orn, usdt } = await deployTokens());

        [orn_units, usdt_units, weth_units] = await Promise.all([orn.decimals(), usdt.decimals(), weth.decimals()]);
        [orn_units, usdt_units, weth_units] = [BN.from(10).pow(orn_units), BN.from(10).pow(usdt_units), BN.from(10).pow(weth_units)];
    });

    before(async function () {
        ({exchange, router, priceOracle} = await deployExchange(matcher, orn, weth, usdt));
        await setCollateralAndPriceOracles(priceOracle, exchange, owner, owner, orn, weth, usdt);
        const WETH_DESIRED = BN.from(100).mul(weth_units);
        const USDT_DESIRED = BN.from(200).mul(usdt_units);

        await addLiquidity(router, owner, weth, usdt, WETH_DESIRED, USDT_DESIRED);

        await mintAndApproveTokens();
    });

    async function mintAndApproveTokens() {
        USDT_AMOUNT = 1000;
        WETH_AMOUNT = 40;
        ORN_AMOUNT = 100;

        await mintAndApprove(usdt, owner, user1, ToUSDT(USDT_AMOUNT), exchange);
        await mintAndApprove(weth, owner, user2, ToWETH(WETH_AMOUNT), exchange);

        //For fees
        await mintAndApprove(orn, owner, user1, ToORN(ORN_AMOUNT), exchange);
        await mintAndApprove(orn, owner, user2, ToORN(ORN_AMOUNT), exchange);
    }

    it("Execute trade both users from wallet", async () => {
        // user 1 and 2 balances must be 0
        expect(await exchange.getBalances([usdt.address, weth.address], user1.address)).to.deep.equal([BN.from(0), BN.from(0)])
        expect(await exchange.getBalances([usdt.address, weth.address], user2.address)).to.deep.equal([BN.from(0), BN.from(0)])

        const user1_weth_1 = await weth.balanceOf(user1.address);
        const user2_weth_1 = await weth.balanceOf(user2.address);

        const weth_amount = 5;
        const weth_price = 0.04;
        const usdt_quote = weth_amount*weth_price; //0.2

        buyOrder  = await orders.generateOrderV4(
            user1, owner, 1,
            weth, usdt, orn,
            ToExchAny(weth_amount), //5 WETH * 10^8
            ToExchAny(weth_price), //0.04 WETH/USDT * 10^8
            FEE
        );

        sellOrder  = await orders.generateOrderV4(
            user2, owner, 0,
            weth, usdt, orn,
            ToExchAny(weth_amount), //5 WETH * 10^8
            ToExchAny(weth_price), //0.04 WETH/USDT * 10^8
            FEE
        );
        const tx = await (await exchange.connect(owner).fillOrders(
            buyOrder.order,
            sellOrder.order,
            ToExchAny(weth_price),
            ToExchAny(weth_amount)
        )).wait();

        expect(await exchange.getBalances([usdt.address, weth.address], user1.address)).to.deep.equal([BN.from(0), BN.from(0)])
        expect(await exchange.getBalances([usdt.address, weth.address], user2.address)).to.deep.equal([BN.from(0), BN.from(0)])

        expect(await weth.balanceOf(user1.address)).to.equal(user1_weth_1.add(ToWETH(weth_amount)));
        expect(await weth.balanceOf(user2.address)).to.equal(user2_weth_1.sub(ToWETH(weth_amount)));

        console.log("gas spent for fillOrders ↓↓↓↓: ", tx.gasUsed.toString());

    });

    it("deposit 40 WETH user 2", async () => {
        await exchange.connect(user2).depositAsset(weth.address, ToWETH(WETH_AMOUNT - 5))
        // mint and deposit 5 more to goes to original 40 WETH
        await mintAndApprove(weth, owner, user2, ToWETH(5), exchange);
    })

    it("Execute trade with approved balance and get tokens in wallet (user 1 wallet, user 2 contract)", async () => {
        console.log("user1:", user1.address, "user2: ", user2.address);
        const weth_amount = 5;
        const weth_price = 0.04;
        const usdt_quote = weth_amount*weth_price; //0.2

        buyOrder  = await orders.generateOrderV4(
            user1, owner, 1,
            weth, usdt, orn,
            ToExchAny(weth_amount), //5 WETH * 10^8
            ToExchAny(weth_price), //0.04 WETH/USDT * 10^8
            FEE
        );

        sellOrder  = await orders.generateOrderV4(
            user2, owner, 0,
            weth, usdt, orn,
            ToExchAny(weth_amount), //5 WETH * 10^8
            ToExchAny(weth_price), //0.04 WETH/USDT * 10^8
            FEE
        );

        const balance1Before = await exchange.getBalance(weth.address, user1.address);
        const balance2Before = await exchange.getBalance(usdt.address, user2.address);

        expect(await exchange.getBalance(weth.address, user1.address)).to.equal(0);
        expect(await exchange.getBalance(usdt.address, user2.address)).to.equal(0);

        const [user1_usdt_01, user1_orn_01] = [await usdt.balanceOf(user1.address), await orn.balanceOf(user1.address)];
        const [user1_usdt_1, user1_orn_1] = await exchange.getBalances([usdt.address, orn.address], user1.address);
        const [user2_weth_01, user2_orn_01] = [await weth.balanceOf(user2.address), await orn.balanceOf(user2.address)];
        const [user2_weth_1, user2_usdt_1, user2_orn_1] =
            await exchange.getBalances([weth.address, usdt.address, orn.address], user2.address);

        const tx = await (await exchange.connect(owner).fillOrders(
            buyOrder.order,
            sellOrder.order,
            ToExchAny(weth_price),
            ToExchAny(weth_amount)
        )).wait();

        console.log("gas spent for fillOrders ↓↓↓↓: ", tx.gasUsed.toString());

        const [user1_usdt_02, user1_orn_02] = [await usdt.balanceOf(user1.address), await orn.balanceOf(user1.address)];
        expect(await exchange.getBalance(weth.address, user1.address)).to.equal(0);
        expect(await weth.balanceOf(user1.address)).to.equal(ToWETH(weth_amount).mul(2)); // user1 have weth amount from previous test
        expect(user1_usdt_01.sub(user1_usdt_02)).to.equal(ToUSDT(usdt_quote));

        const [user2_weth_02, user2_orn_02] = [await weth.balanceOf(user2.address), await orn.balanceOf(user2.address)];
        const [user2_weth_2, user2_usdt_2, user2_orn_2] =
            await exchange.getBalances([weth.address, usdt.address, orn.address], user2.address);
        expect(user2_weth_1.sub(user2_weth_2)).to.equal(ToExchAny(weth_amount));
        expect(user2_usdt_2.sub(user2_usdt_1)).to.equal(ToExchAny(usdt_quote));

        //Matcher should get paid twice (take care that matcher already has 2 fees from previous test)
        expect(await exchange.getBalance(orn.address, owner.address)).to.equal(FEE.mul(2).mul(2));
        expect(user1_orn_01.sub(user1_orn_02)).to.equal(FEE);
        expect(user2_orn_01.sub(user2_orn_02)).to.equal(FEE);

        // Cleanup user2 balances
        await exchange.connect(user2).withdraw(usdt.address, ToUSDT(usdt_quote));
        const user2_weth = await exchange.getBalance(weth.address, user2.address);
        await exchange.connect(user2).withdraw(weth.address, await decimalToBaseUnit(weth, user2_weth));
    });

    it("Execute trade both users from wallet, fee in assetOut", async () => {
        const weth_amount = 5;
        const weth_price = 0.04;
        const usdt_quote = weth_amount*weth_price; //0.2
        const fee_in_usdt = 0.01;
        const fee_in_weth = 0.25;

        // user 1 and 2 balances must be 0
        expect(await exchange.getBalances([usdt.address, weth.address], user1.address)).to.deep.equal([BN.from(0), BN.from(0)])
        expect(await exchange.getBalances([usdt.address, weth.address], user2.address)).to.deep.equal([BN.from(0), BN.from(0)])

        await mintAndApprove(weth, owner, user2, ToWETH(weth_amount + fee_in_weth), exchange);

        const user1_weth_1 = await weth.balanceOf(user1.address);
        const user2_weth_1 = await weth.balanceOf(user2.address);

        const user1_usdt_1 = await usdt.balanceOf(user1.address);
        const user2_usdt_1 = await usdt.balanceOf(user2.address);

        buyOrder  = await orders.generateOrderV4(
            user1, owner, 1,
            weth, usdt, usdt,
            ToExchAny(weth_amount),
            ToExchAny(weth_price),
            ToExchAny(fee_in_usdt)
        );

        sellOrder  = await orders.generateOrderV4(
            user2, owner, 0,
            weth, usdt, weth,
            ToExchAny(weth_amount),
            ToExchAny(weth_price),
            ToExchAny(fee_in_weth)
        );


        const tx = await (await exchange.connect(owner).fillOrders(
            buyOrder.order,
            sellOrder.order,
            ToExchAny(weth_price),
            ToExchAny(weth_amount)
        )).wait();

        console.log("gas spent for fillOrders ↓↓↓↓: ", tx.gasUsed.toString());

        expect(await exchange.getBalances([usdt.address, weth.address], user1.address)).to.deep.equal([BN.from(0), BN.from(0)])
        expect(await exchange.getBalances([usdt.address, weth.address], user2.address)).to.deep.equal([BN.from(0), BN.from(0)])

        expect(await weth.balanceOf(user1.address)).to.equal(user1_weth_1.add(ToWETH(weth_amount)));
        expect(await weth.balanceOf(user2.address)).to.equal(user2_weth_1.sub(ToWETH(weth_amount)).sub(ToWETH(fee_in_weth)));

        expect(await usdt.balanceOf(user1.address)).to.equal(user1_usdt_1.sub(ToUSDT(usdt_quote)).sub(ToUSDT(fee_in_usdt)));
        expect(await usdt.balanceOf(user2.address)).to.equal(user2_usdt_1.add(ToUSDT(usdt_quote)));
    });

    it("Keep tokens on exchange when broker goes into liability", async () => {
        console.log("user1:", user1.address, "broker: ", broker.address);
        const weth_amount = WETH_AMOUNT + 1;
        const weth_price = 5;
        const usdt_quote = weth_amount*weth_price;


        await mintAndDeposit(orn, owner, broker, ToORN(150), exchange);
        await exchange.connect(broker).lockStake(ToORN(1));
        expect(await exchange.getBalance(orn.address, broker.address)).to.equal(ToExchAny(149));

        buyOrder  = await orders.generateOrderV4(
            user1, owner, 1,
            weth, usdt, orn,
            ToExchAny(weth_amount),
            ToExchAny(weth_price),
            FEE
        );

        sellOrder  = await orders.generateOrderV4(
            broker, owner, 0,
            weth, usdt, orn,
            ToExchAny(weth_amount),
            ToExchAny(weth_price),
            FEE
        );

        const [user1_weth_01, user1_usdt_01, user1_orn_01] = [await weth.balanceOf(user1.address), await usdt.balanceOf(user1.address), await orn.balanceOf(user1.address)];
        const [user1_usdt_1, user1_orn_1] = await exchange.getBalances([usdt.address, orn.address], user1.address);
        const [broker_weth_01, broker_orn_01] = [await weth.balanceOf(broker.address), await orn.balanceOf(broker.address)];
        const [broker_weth_1, broker_usdt_1, broker_orn_1] = await exchange.getBalances([weth.address, usdt.address, orn.address], broker.address);
        const matcher_orn_1 = await exchange.getBalance(orn.address, matcher.address);

        const tx = await (await exchange.connect(owner).fillOrders(
            buyOrder.order,
            sellOrder.order,
            ToExchAny(weth_price),
            ToExchAny(weth_amount)
        )).wait();
        console.log("gas spent for fillOrders ↓↓↓↓: ", tx.gasUsed.toString());

        // Verify liability amount
        const brokerPosition = await exchange.calcPosition(broker.address)
        expect(brokerPosition[3]).to.equal(ToExchAny(weth_amount).mul(-1))

        expect(await exchange.getBalance(weth.address, user1.address)).to.equal(ToExchAny(weth_amount));
        expect((await weth.balanceOf(user1.address)).sub(user1_weth_01)).to.equal(0);
        expect(user1_usdt_01.sub(await usdt.balanceOf(user1.address))).to.equal(ToUSDT(usdt_quote));


        expect(await exchange.getBalance(weth.address, broker.address)).to.equal(ToExchAny(weth_amount).mul(-1));
        expect(await exchange.getBalance(usdt.address, broker.address)).to.equal(ToExchAny(usdt_quote));

        //Matcher should get paid twice
        expect((await exchange.getBalance(orn.address, owner.address)).sub(matcher_orn_1)).to.equal(FEE.mul(2));
        expect(user1_orn_01.sub(await orn.balanceOf(user1.address))).to.equal(FEE);
        expect(broker_orn_1.sub(await exchange.getBalance(orn.address, broker.address))).to.equal(FEE);
    });

    it("Broker goes deeper into liability", async () => {
        const brokerPositionBefore = await exchange.calcPosition(broker.address);
        const weth_amount = 1
        const weth_price = 1
        const usdt_quote = weth_amount * weth_price

        buyOrder  = await orders.generateOrderV4(
            user1, owner, 1,
            weth, usdt, orn,
            ToExchAny(weth_amount),
            ToExchAny(weth_price),
            FEE
        );

        sellOrder  = await orders.generateOrderV4(
            broker, owner, 0,
            weth, usdt, orn,
            ToExchAny(weth_amount),
            ToExchAny(weth_price),
            FEE
        );

        await mintAndDeposit(weth, owner, user1, ToWETH(weth_amount), exchange);
        const [user1_weth_01, user1_usdt_01, user1_orn_01] = [await weth.balanceOf(user1.address), await usdt.balanceOf(user1.address), await orn.balanceOf(user1.address)];
        const [user1_weth_1, user1_usdt_1, user1_orn_1] = await exchange.getBalances([weth.address, usdt.address, orn.address], user1.address);
        const [broker_weth_01, broker_orn_01] = [await weth.balanceOf(broker.address), await orn.balanceOf(broker.address)];
        const [broker_weth_1, broker_usdt_1, broker_orn_1] = await exchange.getBalances([weth.address, usdt.address, orn.address], broker.address);
        const matcher_orn_1 = await exchange.getBalance(orn.address, matcher.address);

        expect(await weth.balanceOf(exchange.address)).to.gt(ToWETH(weth_amount));

        const tx = await (await exchange.connect(owner).fillOrders(
            buyOrder.order,
            sellOrder.order,
            ToExchAny(weth_price),
            ToExchAny(weth_amount)
        )).wait();
        console.log("gas spent for fillOrders ↓↓↓↓: ", tx.gasUsed.toString());

        //  Received tokens kept on contract as there was weth already on the contract before the trade
        expect((await exchange.getBalance(weth.address, user1.address)).sub(user1_weth_1)).to.equal(ToExchAny(weth_amount));
        expect(await weth.balanceOf(user1.address)).to.equal(user1_weth_01);

        // Verify liability amount
        const brokerPosition = await exchange.calcPosition(broker.address)
        expect(brokerPosition[3].sub(brokerPositionBefore[3])).to.equal(ToExchAny(weth_amount).mul(-1))
        console.log(`broker liability: ${brokerPosition[3].toString()}`)

        // Margin trade so exchange balance must be updated
        expect(user1_usdt_01.sub(await usdt.balanceOf(user1.address))).to.equal(ToUSDT(usdt_quote));


        expect(await exchange.getBalance(weth.address, broker.address)).to.equal(brokerPositionBefore[3].add(ToExchAny(weth_amount).mul(-1)));
        expect(await exchange.getBalance(usdt.address, broker.address)).to.equal(broker_usdt_1.add(ToExchAny(usdt_quote)));

        //Matcher should get paid twice
        expect((await exchange.getBalance(orn.address, owner.address)).sub(matcher_orn_1)).to.equal(FEE.mul(2));
        expect(user1_orn_01.sub(await orn.balanceOf(user1.address))).to.equal(FEE);
        expect(broker_orn_1.sub(await exchange.getBalance(orn.address, broker.address))).to.equal(FEE);
    })

    it("Execute the trade with ETH (not wrapped)", async () => {
        const eth_amount = 2;
        const eth_price = 0.5;
        const usdt_quote = eth_amount*eth_price;

        buyOrder  = await orders.generateOrderV4(
            user1, owner, 1,
            {address: constants.ZERO_ADDRESS}, usdt, orn,
            ToExchAny(eth_amount),
            ToExchAny(eth_price),
            FEE,
        );
        sellOrder  = await orders.generateOrderV4(
            user2, owner, 0,
            {address: constants.ZERO_ADDRESS}, usdt, orn,
            ToExchAny(eth_amount),
            ToExchAny(eth_price),
            FEE
        );

        await exchange.connect(user2).deposit({value: ToWETH(eth_amount)});

        expect(await exchange.getBalance(usdt.address, user1.address)).to.equal(0);
        expect(await exchange.getBalance(constants.ZERO_ADDRESS, user2.address)).to.equal(ToExchAny(eth_amount));
        expect(await usdt.balanceOf(user1.address)).to.be.gt(ToUSDT(usdt_quote));

        const [user1_eth_01, user1_usdt_01] = [await user1.getBalance(), await usdt.balanceOf(user1.address)];
        const [user1_eth_1, user1_usdt_1] = await exchange.getBalances([constants.ZERO_ADDRESS, usdt.address], user1.address);
        const [user2_eth_01] = [await user2.getBalance()];
        const [user2_eth_1, user2_usdt_1] = await exchange.getBalances([constants.ZERO_ADDRESS, usdt.address], user2.address);

        await printPosition(exchange,{user1});

        const tx = await (await exchange.connect(owner).fillOrders(
            buyOrder.order,
            sellOrder.order,
            ToExchAny(eth_price),
            ToExchAny(eth_amount)
        )).wait();

        console.log("gas spent for fillOrders ↓↓↓↓: ", tx.gasUsed.toString());

        expect(await exchange.getBalance(constants.ZERO_ADDRESS, user1.address)).to.equal(0);
        expect((await user1.getBalance()).sub(user1_eth_01)).to.equal(ToWETH(eth_amount));
        expect(user1_usdt_1.sub(await exchange.getBalance(usdt.address, user1.address))).to.equal(0);
        expect(user1_usdt_01.sub(await usdt.balanceOf(user1.address))).to.equal(ToUSDT(usdt_quote));

        expect((await user2.getBalance()).sub(user2_eth_01)).to.equal(0);
        expect(user2_eth_1.sub(await exchange.getBalance(constants.ZERO_ADDRESS, user2.address))).to.equal(ToExchAny(eth_amount));
        expect((await exchange.getBalance(usdt.address, user2.address)).sub(user2_usdt_1)).to.equal(ToExchAny(usdt_quote));
    });

    it("Execute the trade through pools with approve method (Buy side)", async () => {
        const FEE = BN.from(350000);
        const weth_amount = 9;
        const weth_price = 2.5 // 2.5 WETH/USDT (10^8 basis)

        const buyOrder = await orders.generateOrderV4(
            user3, owner, 1,
            weth, usdt, orn,
            ToExchAny(weth_amount),
            ToExchAny(weth_price),
            FEE
        );

        const usdt_to_spend = (await router.getAmountsIn(ToWETH(weth_amount), [usdt.address, weth.address]))[0];

        await mintAndApprove(usdt, owner, user3, usdt_to_spend, exchange);
        await mintAndApprove(orn, owner, user3, FEE, exchange);

        expect(await exchange.getBalance(usdt.address, user3.address)).to.equal(0);

        const tx = await (await exchange.connect(owner).fillThroughOrionPool(
            buyOrder.order,
            ToExchAny(weth_amount),
            buyOrder.order.matcherFee,
            [usdt.address, weth.address]
        )).wait();

        console.log("gas spent for fillThroughOrionPool ↓↓↓↓: ", tx.gasUsed.toString());

        expect(await weth.balanceOf(user3.address)).to.equal(ToWETH(weth_amount));
        expect(await usdt.balanceOf(user3.address)).to.equal(0);
    });

    it("Execute the trade through pools with approve method (Sell side)", async () => {
        const FEE = BN.from(350000);
        const weth_amount = 9;
        const weth_price = 1.5 // 2.5 WETH/USDT (10^8 basis)

        const sellOrder = await orders.generateOrderV4(
            user4, owner, 0,
            weth, usdt, orn,
            ToExchAny(weth_amount),
            ToExchAny(weth_price),
            FEE
        );

        const receivedAmount = (await router.getAmountsOut(ToWETH(weth_amount), [weth.address, usdt.address]))[1];

        await mintAndApprove(weth, owner, user4, ToWETH(weth_amount), exchange);
        await mintAndApprove(orn, owner, user4, FEE, exchange);

        expect(await exchange.getBalance(weth.address, user4.address)).to.equal('0');

        const tx = await (await exchange.connect(owner).fillThroughOrionPool(
            sellOrder.order,
            ToExchAny(weth_amount),
            sellOrder.order.matcherFee,
            [weth.address, usdt.address]
        )).wait();

        console.log("gas spent for fillThroughOrionPool ↓↓↓↓: ", tx.gasUsed.toString());

        expect(await usdt.balanceOf(user4.address)).to
            .equal(receivedAmount);
        expect(await weth.balanceOf(user4.address)).to.equal(0);

    });

    it("Execute depositless trade with broker when receiving assest is less than fee", async () => {
        const orn_amount = 25;
        const extra_orn_fee = 3;
        const orn_price = 8;
        const usdt_quote = orn_amount * orn_price;

        const buyOrder  = await orders.generateOrderV4(
            user1, owner, 1,
            orn, usdt, orn,
            ToExchAny(orn_amount),
            ToExchAny(orn_price),
            ToExchAny(orn_amount + extra_orn_fee)
        );

        const sellOrder  = await orders.generateOrderV4(
            broker, owner, 0,
            orn, usdt, orn,
            ToExchAny(orn_amount),
            ToExchAny(orn_price),
            FEE
        );

        await mintAndApprove(usdt, owner, user1, ToUSDT(usdt_quote), exchange);
        await mintAndApprove(orn, owner, user1, ToORN(extra_orn_fee), exchange);
        await mintAndDeposit(orn, owner, broker, ToORN(orn_amount).add(FEE), exchange);

        let [user1_usdt_1, user1_orn_1] = await exchange.getBalances([usdt.address, orn.address], user1.address);
        if (user1_orn_1.gt(0)) {
            await exchange.withdraw(orn.asset, await decimalToBaseUnit(orn, user1_orn_1));
        }
        if (user1_usdt_1.gt(0)) {
            await exchange.withdraw(usdt.asset, await decimalToBaseUnit(usdt, user1_usdt_1));
        }
        [user1_usdt_1, user1_orn_1] = await exchange.getBalances([usdt.address, orn.address], user1.address);
        const [user1_usdt_01, user1_orn_01] = [await usdt.balanceOf(user1.address), await orn.balanceOf(user1.address)];

        const [broker_usdt_01, broker_orn_01] = [await usdt.balanceOf(broker.address), await orn.balanceOf(broker.address)];
        const [broker_usdt_1, broker_orn_1] = await exchange.getBalances([usdt.address, orn.address], broker.address);
        const matcher_orn_1 = await exchange.getBalance(orn.address, matcher.address);

        const tx = await (await exchange.connect(owner).fillOrders(
            buyOrder.order,
            sellOrder.order,
            ToExchAny(orn_price),
            ToExchAny(orn_amount)
        )).wait();
        console.log("gas spent for fillOrders ↓↓↓↓: ", tx.gasUsed.toString());

        // User1 exchange balances
        expect(await exchange.getBalance(usdt.address, user1.address)).to.equal(user1_usdt_1);
        expect(await exchange.getBalance(orn.address, user1.address)).to.equal(user1_orn_1);


        // User1 wallet balances
        expect(await usdt.balanceOf(user1.address)).to.equal(user1_usdt_01.sub(ToUSDT(usdt_quote)));
        expect(await orn.balanceOf(user1.address)).to.equal(user1_orn_01.sub(ToORN(extra_orn_fee)));

        // Broker wallet balances
        expect(await usdt.balanceOf(broker.address)).to.equal(broker_usdt_01);
        expect(await orn.balanceOf(broker.address)).to.equal(broker_orn_01);

        // Broker exchange balances
        expect(await exchange.getBalance(usdt.address, broker.address)).to.equal(broker_usdt_1.add(ToExchAny(usdt_quote)));
        expect(await exchange.getBalance(orn.address, broker.address)).to.equal(broker_orn_1.sub(ToExchAny(orn_amount).add(FEE)));

        //Matcher should get fees
        expect(await exchange.getBalance(orn.address, owner.address)).to
            .equal(matcher_orn_1.add(FEE.add(ToExchAny(orn_amount + extra_orn_fee))));

    });

    it("If a user has some tokens on wallet and some on contract keeps receiving assets on the contract", async () => {
        const orn_amount = 25;
        const orn_price = 8;
        const usdt_quote = orn_amount * orn_price;
        const usdt_on_contract = 30;

        const buyOrder  = await orders.generateOrderV4(
            user1, owner, 1,
            orn, usdt, orn,
            ToExchAny(orn_amount),
            ToExchAny(orn_price),
            FEE
        );

        const sellOrder  = await orders.generateOrderV4(
            broker, owner, 0,
            orn, usdt, orn,
            ToExchAny(orn_amount),
            ToExchAny(orn_price),
            FEE
        );

        await mintAndDeposit(usdt, owner, user1, ToUSDT(usdt_on_contract), exchange);
        await mintAndApprove(usdt, owner, user1, ToUSDT(usdt_quote - usdt_on_contract), exchange);
        await mintAndDeposit(orn, owner, broker, ToORN(orn_amount).add(FEE), exchange);

        const [user1_usdt_1, user1_orn_1] = await exchange.getBalances([usdt.address, orn.address], user1.address);
        const [user1_usdt_01, user1_orn_01] = [await usdt.balanceOf(user1.address), await orn.balanceOf(user1.address)];

        const [broker_usdt_01, broker_orn_01] = [await usdt.balanceOf(broker.address), await orn.balanceOf(broker.address)];
        const [broker_usdt_1, broker_orn_1] = await exchange.getBalances([usdt.address, orn.address], broker.address);

        const tx = await (await exchange.connect(owner).fillOrders(
            buyOrder.order,
            sellOrder.order,
            ToExchAny(orn_price),
            ToExchAny(orn_amount)
        )).wait();
        console.log("gas spent for fillOrders ↓↓↓↓: ", tx.gasUsed.toString());

        // User1 exchange balances
        expect(await exchange.getBalance(usdt.address, user1.address)).to.equal(0);
        expect(await exchange.getBalance(orn.address, user1.address)).to
            .equal(user1_orn_1.add(ToExchAny(orn_amount)).sub(FEE));

        // User1 wallet balances
        expect(await usdt.balanceOf(user1.address)).to.equal(user1_usdt_01.sub(ToUSDT(usdt_quote - usdt_on_contract)));
        expect(await orn.balanceOf(user1.address)).to.equal(user1_orn_01);

        // Broker wallet balances
        expect(await usdt.balanceOf(broker.address)).to.equal(broker_usdt_01);
        expect(await orn.balanceOf(broker.address)).to.equal(broker_orn_01);

        // Broker exchange balances
        expect(await exchange.getBalance(usdt.address, broker.address)).to.equal(broker_usdt_1.add(ToExchAny(usdt_quote)));
        expect(await exchange.getBalance(orn.address, broker.address)).to.equal(broker_orn_1.sub(ToExchAny(orn_amount).add(FEE)));
    });

    it("If a user has tokens for fee on contract keeps receiving assets there as well", async () => {
        const weth_amount = 2;
        const weth_price = 4800;
        const usdt_quote = weth_amount * weth_price;

        const buyOrder  = await orders.generateOrderV4(
            user1, owner, 1,
            weth, usdt, orn,
            ToExchAny(weth_amount),
            ToExchAny(weth_price),
            FEE
        );

        const sellOrder  = await orders.generateOrderV4(
            broker, owner, 0,
            weth, usdt, orn,
            ToExchAny(weth_amount),
            ToExchAny(weth_price),
            0
        );

        await mintAndDeposit(orn, owner, user1, FEE, exchange);
        await mintAndApprove(usdt, owner, user1, ToUSDT(usdt_quote ), exchange);
        await mintAndDeposit(weth, owner, broker, ToWETH(weth_amount), exchange);

        const [user1_weth1_1, user1_usdt_1, user1_orn_1] = await exchange.getBalances([weth.address, usdt.address, orn.address], user1.address);
        const [user1_weth1_01, user1_usdt_01, user1_orn_01] = [await weth.balanceOf(user1.address), await usdt.balanceOf(user1.address), await orn.balanceOf(user1.address)];

        const tx = await (await exchange.connect(owner).fillOrders(
            buyOrder.order,
            sellOrder.order,
            ToExchAny(weth_price),
            ToExchAny(weth_amount)
        )).wait();
        console.log("gas spent for fillOrders ↓↓↓↓: ", tx.gasUsed.toString());

        // User1 exchange balances
        expect(await exchange.getBalance(weth.address, user1.address)).to.equal(user1_weth1_1.add(ToExchAny(weth_amount)));
        expect(await exchange.getBalance(usdt.address, user1.address)).to.equal(user1_usdt_1);
        expect(await exchange.getBalance(orn.address, user1.address)).to
            .equal(user1_orn_1.sub(FEE));

        // User1 wallet balances
        expect(await usdt.balanceOf(user1.address)).to.equal(user1_usdt_01.sub(ToUSDT(usdt_quote)));
        expect(await orn.balanceOf(user1.address)).to.equal(user1_orn_01);
        expect(await weth.balanceOf(user1.address)).to.equal(user1_weth1_01);

    });
});

