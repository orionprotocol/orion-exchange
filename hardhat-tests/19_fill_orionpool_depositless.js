const {expect} = require("chai");
const {ethers} = require("hardhat");
const BN = ethers.BigNumber;
const { constants, expectEvent } = require('@openzeppelin/test-helpers');
const ZERO_ADDRESS = constants.ZERO_ADDRESS;

const { ToBN, ToORN, ToWETH, ToExchAny, ToUSDT, baseUnitToDecimal, decimalToBaseUnit } = require("./libUnit")
const { deployTokens, deployExchange, mintAndApprove, addLiquidity, addLiquidityETH, mintAndDeposit } = require("./deploy-fixture");
const orders = require("../test/helpers/Orders.js");

let theOne = '100000000';

describe("ExchangeWithOrionPool::fillThroughOrionPool depositless", () => {
    let owner, broker, user1, user2, user3, user4;
    let orn, usdt, weth;
    let factory, router;
    let exchange;
    let orn_units, usdt_units, weth_units;

    before(async function () {
        [owner, user1, user2, user3, user4] = await ethers.getSigners();
        console.log("User1 address: ", user1.address);
        matcher = owner;
        ({weth, orn, usdt} = await deployTokens());

        [orn_units, usdt_units, weth_units] = await Promise.all([orn.decimals(), usdt.decimals(), weth.decimals()]);
        [orn_units, usdt_units, weth_units] = [BN.from(10).pow(orn_units), BN.from(10).pow(usdt_units), BN.from(10).pow(weth_units)];
    });

    before(async function () {
        ({exchange, router, factory} = await deployExchange(matcher, orn, weth, usdt));

        await mintAndApproveTokens();

        const orn_reserve = ToORN(1000);
        const weth_reserve = ToWETH(1000);
        const usdt_reserve = ToUSDT(1000);

        // pair ORN/USDT
        await addLiquidity(router, owner, orn, usdt, orn_reserve, usdt_reserve);

        // pair WETH/USDT
        await addLiquidityETH(router, owner, weth_reserve, usdt, usdt_reserve);

        // pair WETH/ORN
        await addLiquidityETH(router, owner, weth_reserve, orn, orn_reserve);


    });

    async function mintAndApproveTokens() {
        USDT_AMOUNT = ToUSDT(200);
        WETH_AMOUNT = ToWETH(200);
        ORN_AMOUNT = ToORN(100);

        await mintAndApprove(usdt, owner, user1, USDT_AMOUNT, exchange);
    }

    it("user1 try to exchange through orionpool pair without enough approve", async () => {
        buyOrder = await orders.generateOrderV4(user1, matcher, 1,
            orn, usdt, orn,
            ORN_AMOUNT,
            ToExchAny(1),
            2000);

        expect(await orn.balanceOf(user1.address)).to.equal(0);
        expect(await exchange.getBalance(orn.address, user1.address)).to.equal(0);
        expect(await exchange.getBalance(usdt.address, user1.address)).to.equal(0);

        await expect(exchange.connect(matcher).fillThroughOrionPool(
            buyOrder.order,
            ORN_AMOUNT,
            buyOrder.order.matcherFee,
            [usdt.address, orn.address]
        )).to.be.revertedWith("E1PF"); // Because fees was applied

        expect(await orn.balanceOf(user1.address)).to.equal(0);
    });

    it("user1 exchange through orionpool pair fee in assetIn", async () => {
        const orn_amount = 10;
        const orn_price = 2; //max price
        const fee = BN.from(2000);

        await orn.connect(user1).approve(exchange.address, fee);

        buyOrder = await orders.generateOrderV4(user1, matcher, 1,
            orn, usdt, orn,
            ToExchAny(orn_amount),
            ToExchAny(orn_price), //2*10^8
            fee);

        //expect(await orn.balanceOf(user1.address)).to.equal(ORN_AMOUNT);
        expect(await usdt.balanceOf(user1.address)).to.equal(USDT_AMOUNT);
        expect(await exchange.getBalance(orn.address, user1.address)).to.equal(0);
        expect(await exchange.getBalance(usdt.address, user1.address)).to.equal(0);

        const usdt_bal_before = await usdt.balanceOf(user1.address);
        const orn_bal_before = await orn.balanceOf(user1.address);
        console.log("orn_bal_before = ", orn_bal_before.toString());
        const usdt_to_spend = (await router.getAmountsIn(ToORN(orn_amount), [usdt.address, orn.address]))[0];
        console.log("usdt_to_spend = ", usdt_to_spend.toString());

        const tx = await (await exchange.connect(matcher).fillThroughOrionPool(
            buyOrder.order,
            ToExchAny(orn_amount),
            buyOrder.order.matcherFee,
            [usdt.address, orn.address]
        )).wait();

        console.log("gas spent for swap ↓↓↓↓: ", tx.gasUsed.toString());
        expect(await usdt.balanceOf(user1.address)).to.equal(usdt_bal_before.sub(usdt_to_spend));
        expect(await orn.balanceOf(user1.address)).to.equal(orn_bal_before.add(ToORN(orn_amount)).sub(fee));
        expect(await exchange.getBalance(orn.address, user1.address)).to.equal(0);
        expect(await exchange.getBalance(usdt.address, user1.address)).to.equal(0);
        expect(await exchange.getBalance(orn.address, matcher.address)).to.equal(fee);
        expect(await orn.balanceOf(exchange.address)).to.equal(fee);
    });

    it("user1 exchange through orionpool pair fee in assetOut", async () => {
        const orn_amount = 10;
        const orn_price = 0.5; //max price
        const fee = BN.from(2000);

        const sellOrder = await orders.generateOrderV4(user1, matcher, 0,
            orn, usdt, orn,
            ToExchAny(orn_amount),
            ToExchAny(orn_price), //1*10^8
            fee);

        await mintAndApprove(orn, owner, user1, ToORN(orn_amount).add(fee), exchange);

        expect(await exchange.getBalance(orn.address, user1.address)).to.equal(0);
        expect(await exchange.getBalance(usdt.address, user1.address)).to.equal(0);

        const usdt_bal_before = await usdt.balanceOf(user1.address);
        const orn_bal_before = await orn.balanceOf(user1.address);
        console.log("orn_bal_before = ", orn_bal_before.toString());
        const usdt_to_receive = (await router.getAmountsOut(ToORN(orn_amount), [orn.address, usdt.address]))[1];
        console.log("usdt_to_receive = ", usdt_to_receive.toString());
        const matcher_usdt_before = await exchange.getBalance(orn.address, matcher.address);

        const tx = await (await exchange.connect(matcher).fillThroughOrionPool(
            sellOrder.order,
            ToExchAny(orn_amount),
            sellOrder.order.matcherFee,
            [orn.address, usdt.address]
        )).wait();

        console.log("gas spent for swap ↓↓↓↓: ", tx.gasUsed.toString());
        expect(await usdt.balanceOf(user1.address)).to.equal(usdt_bal_before.add(usdt_to_receive));
        expect(await orn.balanceOf(user1.address)).to.equal(orn_bal_before.sub(ToORN(orn_amount)).sub(fee));
        expect(await exchange.getBalance(orn.address, user1.address)).to.equal(0);
        expect(await exchange.getBalance(usdt.address, user1.address)).to.equal(0);
        expect(await exchange.getBalance(orn.address, matcher.address)).to.equal(matcher_usdt_before.add(fee));
        expect(await orn.balanceOf(exchange.address)).to.equal(await exchange.getBalance(orn.address, matcher.address));
    });

    it("user1 exchange through orionpool 1-hop path fee in assetOut", async () => {
        const eth_amount = 2;
        const eth_price = 2; //max price
        const fee_base_units = BN.from(2000);

        let buyOrder = await orders.generateOrderV4(user1, matcher, 1,
            {address: constants.ZERO_ADDRESS}, orn, orn,
            ToExchAny(eth_amount),
            ToExchAny(eth_price), //2*10^8, // this is the price so we need to mint this in orion
            fee_base_units);

        await mintAndApprove(orn, owner, user1, ToORN(eth_price*eth_amount).add(fee_base_units), exchange);

        expect(await exchange.getBalance(orn.address, user1.address)).to.equal(0);
        expect(await exchange.getBalance(usdt.address, user1.address)).to.equal(0);

        const ethBefore = await user1.getBalance();
        console.log("user1 has ethBefore = " + ethBefore);
        const ornBefore = await orn.balanceOf(user1.address);
        console.log("user1 has ornBefore = " + ornBefore);

        const orn_to_spend = (await router.getAmountsIn(ToWETH(eth_amount), [orn.address, usdt.address, weth.address]))[0];
        const matcher_orn_before = await exchange.getBalance(orn.address, matcher.address);

        const tx = await (await exchange.connect(owner).fillThroughOrionPool(
            buyOrder.order,
            ToExchAny(eth_amount),
            buyOrder.order.matcherFee,
            [orn.address, usdt.address, constants.ZERO_ADDRESS]
        )).wait();
        console.log("gas spent for swap ↓↓↓↓: ", tx.gasUsed.toString());

        // Fees are taken from swap

        expect(await exchange.getBalance(orn.address, user1.address)).to.equal(0);
        expect(await exchange.getBalance(usdt.address, user1.address)).to.equal(0);
        const ethAfter = await user1.getBalance();
        expect(ethAfter.sub(ethBefore)).to.equals(ToWETH(eth_amount));
        expect(await orn.balanceOf(user1.address)).to.equal(ornBefore.sub(orn_to_spend.add(fee_base_units)));
        expect(await exchange.getBalance(orn.address, matcher.address)).to.equal(matcher_orn_before.add(fee_base_units));
        expect(await orn.balanceOf(exchange.address)).to.equal(await exchange.getBalance(orn.address, matcher.address));
    });

    //sell orders go here
    it("SELL ORDER user1 exchange through orionpool pair fee in assetIn", async () => {
        const orn_amount = 5;
        const orn_price = 0.9; //max price
        const fee = 1.5

        await usdt.connect(user2).approve(exchange.address, ToUSDT(fee));

        let sellOrder = await orders.generateOrderV4(user2, matcher, 0,
            orn, usdt, usdt,
            ToExchAny(orn_amount),
            ToExchAny(orn_price),
            ToExchAny(fee)
        );

        await mintAndApprove(orn, owner, user2, ToORN(orn_amount), exchange);

        const usdt_to_receive = (await router.getAmountsOut(ToORN(orn_amount), [orn.address, usdt.address]))[1];
        const matcher_usdt_before = await exchange.getBalance(usdt.address, matcher.address);

        const tx = await (await exchange.connect(matcher).fillThroughOrionPool(
            sellOrder.order,
            ToExchAny(orn_amount),
            ToExchAny(fee),
            [orn.address, usdt.address]
        )).wait();

        // Fees are taken from swap
        console.log("gas spent for swap ↓↓↓↓: ", tx.gasUsed.toString());

        expect(await exchange.getBalance(orn.address, user2.address)).to.equal(0);
        expect(await exchange.getBalance(usdt.address, user2.address)).to.equal(0);

        expect(await orn.balanceOf(user2.address)).to.equal(0);
        expect(await usdt.balanceOf(user2.address)).to.equal(usdt_to_receive.sub(ToUSDT(fee)));


        expect(await exchange.getBalance(usdt.address, matcher.address)).to
            .equal(matcher_usdt_before.add(ToExchAny(fee)));
        expect(await baseUnitToDecimal(usdt, await usdt.balanceOf(exchange.address))).to
            .equal(await exchange.getBalance(usdt.address, matcher.address));

    });

    it("user3 in contract swap through orionpool, fee in assetOut", async () => {
        const orn_amount = 7;
        const orn_price = 0.5; //max price
        const fee = BN.from(2000);

        const sellOrder = await orders.generateOrderV4(user3, matcher, 0,
            orn, usdt, orn,
            ToExchAny(orn_amount),
            ToExchAny(orn_price), //1*10^8
            fee);

        await mintAndDeposit(orn, owner, user3, ToORN(orn_amount).add(fee), exchange);

        expect(await exchange.getBalance(orn.address, user3.address)).to.equal(ToORN(orn_amount).add(fee));
        expect(await exchange.getBalance(usdt.address, user3.address)).to.equal(0);

        const usdt_to_receive = (await router.getAmountsOut(ToORN(orn_amount), [orn.address, usdt.address]))[1];
        console.log("usdt_to_receive = ", usdt_to_receive.toString());
        const matcher_usdt_before = await exchange.getBalance(orn.address, matcher.address);

        const tx = await (await exchange.connect(matcher).fillThroughOrionPool(
            sellOrder.order,
            ToExchAny(orn_amount),
            sellOrder.order.matcherFee,
            [orn.address, usdt.address]
        )).wait();

        console.log("gas spent for swap ↓↓↓↓: ", tx.gasUsed.toString());

        expect(await usdt.balanceOf(user3.address)).to.equal(0);
        expect(await orn.balanceOf(user3.address)).to.equal(0);

        expect(await exchange.getBalance(orn.address, user3.address)).to.equal(0);
        expect(await exchange.getBalance(usdt.address, user3.address)).to
            .equal(await baseUnitToDecimal(usdt, usdt_to_receive));

        expect(await exchange.getBalance(orn.address, matcher.address)).to.equal(matcher_usdt_before.add(fee));
        expect(await orn.balanceOf(exchange.address)).to.equal(await exchange.getBalance(orn.address, matcher.address));

        // Cleanup user3 balances
        await exchange.connect(user3).withdraw(usdt.address, await decimalToBaseUnit(usdt,
            await exchange.getBalance(usdt.address, user3.address)));
    });

    it("swap usdt through OrionPool to eth, fee in assetIn", async () => {
        const eth_amount = 2;
        const eth_price = 1.5; //max price
        const fee = 0.2;
        const actual_fee = 0.1;

        const buyOrder = await orders.generateOrderV4(user3, matcher, 1,
            {address: ZERO_ADDRESS}, usdt, {address: ZERO_ADDRESS},
            ToExchAny(eth_amount),
            ToExchAny(eth_price),
            ToExchAny(fee));

        await mintAndApprove(usdt, owner, user3, ToUSDT(eth_amount*eth_price), exchange);

        expect(await exchange.getBalance(ZERO_ADDRESS, user3.address)).to.equal(0);
        expect(await exchange.getBalance(usdt.address, user3.address)).to.equal(0);

        const usdt_before = await usdt.balanceOf(user3.address);
        const eth_before = await user3.getBalance();
        const usdt_to_spend = (await router.getAmountsIn(ToWETH(eth_amount), [usdt.address, weth.address]))[0];
        console.log("usdt_to_spend = ", usdt_to_spend.toString());

        const matcher_eth_before = await exchange.getBalance(ZERO_ADDRESS, matcher.address);

        const tx = await (await exchange.connect(matcher).fillThroughOrionPool(
            buyOrder.order,
            ToExchAny(eth_amount),
            ToExchAny(actual_fee),
            [usdt.address, ZERO_ADDRESS]
        )).wait();

        console.log("gas spent for swap ↓↓↓↓: ", tx.gasUsed.toString());

        expect(await usdt.balanceOf(user3.address)).to.equal(usdt_before.sub(usdt_to_spend));
        expect(await user3.getBalance()).to.equal(eth_before.add(ToWETH(eth_amount)).sub(ToWETH(actual_fee)));

        expect(await exchange.getBalance(ZERO_ADDRESS, user3.address)).to.equal(0);
        expect(await exchange.getBalance(usdt.address, user3.address)).to.equal(0);

        expect(await exchange.getBalance(ZERO_ADDRESS, matcher.address)).to.equal(matcher_eth_before.add(ToExchAny(actual_fee)));
        expect(await ethers.provider.getBalance(exchange.address)).to.equal(ToWETH(actual_fee));
    });
});
