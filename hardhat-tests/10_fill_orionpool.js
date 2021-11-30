const { expect } = require("chai");
const { ethers } = require("hardhat");
const BN = ethers.BigNumber;
const { constants, expectEvent } = require('@openzeppelin/test-helpers');
const ZERO_ADDRESS = constants.ZERO_ADDRESS;

const { ToBN, ToORN, ToWETH, ToExchAny, ToUSDT, baseUnitToDecimal, decimalToBaseUnit } = require("./libUnit")
const { deployTokens, deployExchange, mintAndApprove, addLiquidity, addLiquidityETH, mintAndDeposit } = require("./deploy-fixture");
const orders = require("../test/helpers/Orders.js");

describe("ExchangeWithOrionPool::fillThroughOrionPool", function () {
    let owner, broker, user1, user3, user4, matcher;
    let weth, orn, usdt;
    let exchange, factory, router;
    let orn_reserve, weth_reserve, usdt_reserve
    const FEE = BN.from(2000);

    before(async function () {
        [owner, broker, user1, user3, user4] = await ethers.getSigners();
        matcher = owner;
        ({ weth, orn, usdt } = await deployTokens());
    });

    before(async function () {
        ({exchange, router, factory} = await deployExchange(matcher, orn, weth, usdt));

        orn_reserve = ToORN(1000);
        weth_reserve = ToWETH(800);
        usdt_reserve = ToUSDT(800);

        // pair ORN/USDT
        await addLiquidity(router, owner, orn, usdt, orn_reserve, usdt_reserve);

        // pair WETH/USDT
        await addLiquidityETH(router, owner, weth_reserve, usdt, usdt_reserve);

        // pair WETH/ORN
        await addLiquidityETH(router, owner, weth_reserve, orn, orn_reserve);
    });

    it("user1 exchange through orionpool pair", async () => {
        const usdt_amount = 0.07;
        await mintAndDeposit(orn, owner, user1, ToORN(10), exchange);
        const buyOrder = await orders.generateOrderV4(user1.address, matcher.address, 1,
            usdt, orn, orn,
            ToExchAny(usdt_amount),
            ToExchAny(2),
            FEE);

        console.log("Get amounts In:" + (await router.getAmountsIn(ToUSDT(usdt_amount), [orn.address, usdt.address])).toString());
        expect(await exchange.getBalance(orn.address, user1.address)).to.equal(ToORN(10));
        expect(await exchange.getBalance(usdt.address, user1.address)).to.equal(0);

        //  Trying the same but with own balance of user
        //  await orn.mint(user1.address, BN.from(10).mul(orn_units));
        //  let tx_receipt = await exchange.connect(user1).swapThroughOrionPool(100, 100000, [orn.address, usdt.address], false).should.be.fulfilled;

        const blockchainFee = 1000;
        let tx_receipt = await (await exchange.connect(matcher).fillThroughOrionPool(
            buyOrder.order,
            buyOrder.order.amount,
            blockchainFee,
            [orn.address, usdt.address]
        )).wait();

        console.log("gas spent for swap ↓↓↓↓: ", tx_receipt.gasUsed.toString());

        expect(await exchange.getBalance(usdt.address, user1.address)).to.equal(ToExchAny(usdt_amount));
        // (x-v)*(y+w)=k=xy, p=(y/x-v)/q, where q=0.998 0.2%, w=yv/(x-v)/q
        const [x, y] = [usdt_reserve, orn_reserve];
        const v = await decimalToBaseUnit(usdt, buyOrder.order.amount);
        const w = y.mul(v).mul(1000).div(x.sub(v)).div(997).add(1);
        console.log("w = ", w.toString());
        const remaining_orn = ToORN(10).sub(w).sub(blockchainFee);
        expect(await exchange.getBalance(orn.address, user1.address)).to.equal(remaining_orn);

    });

    it("user1 exchange through orionpool pair again (initiated balances)", async () => {
        await mintAndDeposit(orn, owner, user1, ToORN(1), exchange);
        buyOrder = await orders.generateOrderV4(user1, matcher, 1,
            usdt, orn, orn,
            ToExchAny(0.001),
            ToExchAny(2),
            FEE);

        let tx_receipt = await (await exchange.connect(matcher).fillThroughOrionPool(
            buyOrder.order,
            buyOrder.order.amount,
            FEE,
            [orn.address, usdt.address]
        )).wait();

        console.log("gas spent for swap ↓↓↓↓: ", tx_receipt.gasUsed.toString());
    });


    it("user1 exchange through orionpool 2-hop path", async () => {
        const eth_amount = 2;
        const eth_price = 2; //max price
        const orn_quote = eth_amount*eth_price;

        let buyOrder  = await orders.generateOrderV4(user1, matcher, 1,
            {address: ZERO_ADDRESS}, orn, orn,
            ToExchAny(eth_amount),
            ToExchAny(eth_price),
            FEE);

        //we will sell orion and buy weth, so we need to mint orion equals to usdt
        await mintAndDeposit(orn, owner, user1, ToORN(orn_quote + FEE), exchange);

        let orn_before = await exchange.getBalance(orn.address, user1.address);
        let eth_before_w = await user1.getBalance(); //wallet balance
        let eth_before = await exchange.getBalance(ZERO_ADDRESS, user1.address);

        const path = [orn.address, usdt.address, weth.address];
        const amountsIn = await router.getAmountsIn(ToWETH(eth_amount), path);
        console.log("Get amounts In:", amountsIn.toString());

        const tx_receipt = await(await exchange.connect(matcher).fillThroughOrionPool(
            buyOrder.order,
            ToExchAny(eth_amount),
            buyOrder.order.matcherFee,
            [orn.address, usdt.address, ZERO_ADDRESS],
        )).wait();

        console.log("gas spent for swap ↓↓↓↓: ", tx_receipt.gasUsed.toString());

        let orn_after = await exchange.getBalance(orn.address, user1.address);
        let eth_after = await exchange.getBalance(ZERO_ADDRESS, user1.address);
        let eth_after_w = await user1.getBalance();

        expect(orn_before.sub(orn_after).sub(FEE)).to.equal(amountsIn[0]);
        expect(eth_after_w).to.equal(eth_before_w);
        expect(eth_after).to.equal(ToExchAny(eth_amount));
    });

    //sell orders go here
    it("SELL ORDER user1 exchange through orionpool pair", async () => {
        const orn_amount = 2;
        const orn_price = 0.5;
        const usdt_quote = orn_amount*orn_price;

        const sellOrder  = await orders.generateOrderV4(user1, matcher, 0,
            orn, usdt, orn,
            ToExchAny(orn_amount),
            ToExchAny(orn_price),
            FEE
        );

        await mintAndDeposit(orn, owner, user1, ToORN(orn_amount + FEE), exchange);

        const orn_before = await exchange.getBalance(orn.address, user1.address);
        const usdt_before = await exchange.getBalance(usdt.address, user1.address);
        const amountsOut = await router.getAmountsOut(ToORN(orn_amount), [orn.address, usdt.address]);
        console.log("Get amounts Out:", amountsOut.toString());

        const tx_receipt = await(await exchange.connect(matcher).fillThroughOrionPool(
            sellOrder.order,
            ToExchAny(orn_amount),
            sellOrder.order.matcherFee,
            [orn.address, usdt.address],
        )).wait();

        console.log("gas spent for swap ↓↓↓↓: ", tx_receipt.gasUsed.toString());
        const orn_after = await exchange.getBalance(orn.address, user1.address);
        const usdt_after = await exchange.getBalance(usdt.address, user1.address);

        expect(usdt_after.sub(usdt_before)).to.equal(await baseUnitToDecimal(usdt, amountsOut[1]));
        expect(orn_before.sub(orn_after)).to.equal(ToExchAny(orn_amount).add(FEE));
    });
});
