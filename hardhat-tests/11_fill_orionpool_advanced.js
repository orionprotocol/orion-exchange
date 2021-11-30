const { expect } = require("chai");
const { ethers } = require("hardhat");
const BN = ethers.BigNumber;
const { constants, expectEvent } = require('@openzeppelin/test-helpers');
const ZERO_ADDRESS = constants.ZERO_ADDRESS;

const { ToBN, ToORN, ToWETH, ToExchAny, ToUSDT, baseUnitToDecimal, decimalToBaseUnit } = require("./libUnit")
const { deployTokens, deployExchange, mintAndApprove, addLiquidity, addLiquidityETH, mintAndDeposit, burnToken } = require("./deploy-fixture");
const orders = require("../test/helpers/Orders.js");
const ChainManipulation = require("../test/helpers/ChainManipulation.js");

//  Widely-used base ORN/USDT price
const QUOTE = 15.0;
const ORN_SUPPLY = 100;

const QUOTE_ETH_USDT = 3000.0;
const ETH_SUPPLY = 5.0;
const FEE_DIVIDER = 0.998;

function GasToORN(gas_val) {
    //  Assume that gas price is 300 GWei, and ETH / ORN ratio is 3000 / 15 = 200
    let fee_in_wei = BN.from(gas_val * 300).mul(1e9);

    //  In fact, the fee * 200 * 10^8 / 10^18 = fee  * 200 / 10^10
    return fee_in_wei.mul(BN.from(200)).div(1e10);
}

describe("ExchangeWithOrionPool::fillThroughOrionPool advanced", function () {
    let Pair;
    let owner, broker, balancer, matcher, user1, user2, user3;
    let weth, orn, usdt;
    let exchange, factory, router;
    let orn_reserve, weth_reserve, usdt_reserve
    const FEE = BN.from(2000);

    before(async function () {
        [owner, broker, balancer, matcher, user1, user2, user3] = await ethers.getSigners();
        Pair = await ethers.getContractFactory("OrionPoolV2Pair")
        matcher = owner;
        ({ weth, orn, usdt } = await deployTokens());
    });

    before(async function () {
        ({exchange, router, factory} = await deployExchange(matcher, orn, weth, usdt));

        orn_reserve = ToORN(ORN_SUPPLY);
        weth_reserve = ToWETH(1);
        usdt_reserve = ToUSDT(ORN_SUPPLY*QUOTE);

        // pair ORN/USDT
        await addLiquidity(router, owner, orn, usdt, orn_reserve, usdt_reserve);

        // pair WETH/ORN
        await addLiquidityETH(router, owner, weth_reserve, orn, orn_reserve);

        await mintAndApprove(orn, owner, balancer, ToORN(1000000), router);
        await mintAndApprove(usdt, owner, balancer, ToUSDT(1000000), router);
    });

    it("Sanity checking that swapTokensForExactTokens won't get more than amountInMax", async () => {
        const ornUsdt = await Pair.attach(await factory.getPair(orn.address, usdt.address));

        const reserves = await ornUsdt.getReserves();
        console.log("Reserves:", reserves.toString());
        const token0 = await ornUsdt.token0();
        const ornReserve = token0 === orn.address ? reserves[0] : reserves[1];
        const usdtReserve = token0 === usdt.address ? reserves[0] : reserves[1];

        // Let's buy 17 ORN
        const desired_buy_orn = ToORN(17);

        const virtual_usdt_amount = await router.getAmountIn(
            desired_buy_orn,
            usdtReserve, //  USDT
            ornReserve  //  ORN
        );

        const usdt_addition = ToUSDT(33);
        const increased_usdt_amount = virtual_usdt_amount.add(usdt_addition);

        await burnToken(orn, owner);
        await burnToken(usdt, owner);

        //    And mint just USDT amount
        await mintAndApprove(usdt, owner, owner, increased_usdt_amount, router);

        //    Let's change
        await router.connect(owner).swapTokensForExactTokens(
            desired_buy_orn,
            increased_usdt_amount,
            [usdt.address, orn.address],
            owner.address,
            await ChainManipulation.getBlokchainTime() + 100000
        );

        //  Check balances of owner
        expect(await orn.balanceOf(owner.address)).to.equal(desired_buy_orn);
        expect(await usdt.balanceOf(owner.address)).to.equal(usdt_addition);

        //    Make reverse change (to make price again AROUND 15)
        await router.connect(balancer).swapExactTokensForTokens(
            desired_buy_orn,
            1,    //  No matter how many we'll take
            [orn.address, usdt.address],
            balancer.address,
            await ChainManipulation.getBlokchainTime() + 100000
        );

        //    Get price
        const reserves1 = await ornUsdt.getReserves();
        console.log("reserves1 = ", reserves1[0].toString(), reserves1[1].toString())
    });

    it("Create buy order via fillThroughOrionPool (at worst price, low matcher fee)", async () => {
        //    Want to buy 13 ORN for USDT
        const buy_orn = 13;
        //    And our price.. let it be be really bad
        const price = 20.0;
        const usdt_quote =buy_orn * price;

        await mintAndDeposit(usdt, owner, user1, ToUSDT(usdt_quote), exchange);
        const user1_orn_before0 = await exchange.getBalance(orn.address, user1.address);

        //    And ORN - exactly for fee payment
        const orn_gas_fee = GasToORN(6e5);
        //    And ORN as 0.2% of order size
        const orn_matcher_fee = ToORN(buy_orn * 0.002);
        const order_total_fee = orn_gas_fee.add(orn_matcher_fee);

        //    And our fee - let it be
        let buyOrder  = await orders.generateOrderV4(user1, matcher, 1,
            orn, usdt, orn,
            ToExchAny(buy_orn),
            ToExchAny(price),
            order_total_fee);

        await mintAndDeposit(orn, owner, user1, order_total_fee, exchange);

        //    Save the matcher balance (on exchange)
        const matcher_orn_before = await exchange.getBalance(orn.address, matcher.address);
        const user1_orn_before = await exchange.getBalance(orn.address, user1.address);
        const user1_usdt_before = await exchange.getBalance(usdt.address, user1.address);

        const amountsIn = await router.getAmountsIn(ToORN(buy_orn), [usdt.address, orn.address]);

        const tx_receipt = await(await exchange.connect(matcher).fillThroughOrionPool(
            buyOrder.order,
            buyOrder.order.amount,
            orn_gas_fee,
            [usdt.address, orn.address]
        )).wait();
        console.log("gas spent for swap ↓↓↓↓: ", tx_receipt.gasUsed.toString());

        //    Let's see what we have there.
        //    1. Matcher should only take "gas fee"
        expect((await exchange.getBalance(orn.address, matcher.address)).sub(matcher_orn_before))
            .to.equal(orn_gas_fee);

        //    2. user1 should receive buy_orn minus gas fee
        //    TODO! Check why it could be negative balance
        const user1_orn_after = await exchange.getBalance(orn.address, user1.address);
        console.log("user1_orn_after = ", user1_orn_after.toString());
        expect(user1_orn_before.sub(user1_orn_after)).to.equal(orn_gas_fee.sub(ToORN(buy_orn)));

        //    3. user1 should give away ABOUT (buy_orn * actual_quote) in USDT.
        //        Knowing
        expect(user1_usdt_before.sub(await exchange.getBalance(usdt.address, user1.address))).to.equal
            (await baseUnitToDecimal(usdt, amountsIn[0]));

        //    NB that actually we bought ORN n ot by 20.0 USDT, but rather at ~17.3
        //    Make reverse change (to make price again AROUND 15)
        await router.connect(balancer).swapExactTokensForTokens(
            ToORN(buy_orn),
            1,    //  No matter how many we'll take
            [orn.address, usdt.address],
            balancer.address,
            await ChainManipulation.getBlokchainTime() + 100000
        );
    });

    it("Create sell order via fillThroughOrionPool", async () => {
        //    Mint enough ORN
        await mintAndDeposit(orn, owner, user1,  ToORN(10000), exchange);
        //    Want to sell 17 ORN for USDT
        const sell_orn = 17;

        const sellOrder = await orders.generateOrderV4(user1, matcher, 0,
            orn, usdt, orn,
            ToExchAny(sell_orn),
            ToExchAny(20), //unreachable price
            FEE
        );

        //    This should fail - as price=20 is unreachable
        //        In new version it WILL be executed, but with 0 amount
        const tx1 = await(await exchange.connect(matcher).fillThroughOrionPool(
            sellOrder.order,
            sellOrder.order.amount,
            sellOrder.order.matcherFee,
            [orn.address, usdt.address],
        )).wait();
        console.log("gas spent for swap ↓↓↓↓: ", tx1.gasUsed.toString());

        expectEvent({logs: tx1.events}, 'NewTrade',
            { filledAmount: 0});

        //    Now let's calculate price for sell order
        const amountsOut = await router.getAmountsOut(ToORN(sell_orn), [orn.address, usdt.address]);
        const price = amountsOut[1].div(BN.from(10).pow(6))/sell_orn;
        //    And if price_bn is greater by 1% - order would not be executed
        //        In new version it WILL be executed, but with 0 amount
        const priceAbout1Percent_bn = ToBN(price, 8).mul(101).div(100);

        const sellOrder2 = await orders.generateOrderV4(user1, matcher, 0,
            orn, usdt, orn,
            ToExchAny(sell_orn),
            priceAbout1Percent_bn,
            FEE
        );

        let matcher_orn_before = await exchange.getBalance(orn.address, matcher.address);
        let orn_before = await exchange.getBalance(orn.address, user1.address);
        let usdt_before = await exchange.getBalance(usdt.address, user1.address);

        const tx2 = await(await exchange.connect(matcher).fillThroughOrionPool(
            sellOrder2.order,
            sellOrder2.order.amount,
            sellOrder2.order.matcherFee,
            [orn.address, usdt.address],
        )).wait();
        console.log("gas spent for swap ↓↓↓↓: ", tx2.gasUsed.toString());

        expectEvent({logs: tx2.events}, 'NewTrade',
            { filledAmount: 0});

        //    Sanity checking that no tokens were moved (only ORN fee)
        expect(await exchange.getBalance(usdt.address, user1.address)).to.equal(usdt_before);
        expect((await exchange.getBalance(orn.address, matcher.address)).sub(matcher_orn_before)).to.equal(FEE);
        expect((await exchange.getBalance(orn.address, user1.address)).sub(orn_before)).to.equal(-1*FEE);

        const sellOrder3 = await orders.generateOrderV4(user1, matcher, 0,
            orn, usdt, orn,
            ToExchAny(sell_orn),
            ToExchAny(price),
            FEE
        );

        matcher_orn_before = await exchange.getBalance(orn.address, matcher.address);
        orn_before = await exchange.getBalance(orn.address, user1.address);
        usdt_before = await exchange.getBalance(usdt.address, user1.address);

        const tx3 = await(await exchange.connect(matcher).fillThroughOrionPool(
            sellOrder3.order,
            sellOrder3.order.amount,
            sellOrder3.order.matcherFee,
            [orn.address, usdt.address],
        )).wait();
        console.log("gas spent for swap ↓↓↓↓: ", tx3.gasUsed.toString());

        expectEvent({logs: tx3.events}, 'NewTrade',
            { filledAmount: ToExchAny(sell_orn)});

        //    So, user1 would sell exact sell_orn tokens
        expect((await exchange.getBalance(orn.address, matcher.address)).sub(matcher_orn_before)).to.equal(FEE);
        expect(orn_before.sub(await exchange.getBalance(orn.address, user1.address))).to.equal(ToORN(sell_orn).add(FEE));
        expect((await exchange.getBalance(usdt.address, user1.address)).sub(usdt_before)).to
            .equal(await baseUnitToDecimal(usdt, amountsOut[1]));

    });

    it("Check partial fills and overflows", async () => {
        await mintAndDeposit(orn, owner, user1,  ToORN(100), exchange);
        const sell_orn = 2;

        //    Minimum possible sell price just to not suffer from quotes
        const price_bn = BN.from(1);

        const sellOrder = await orders.generateOrderV4(user1, matcher, 0,
            orn, usdt, orn,
            ToExchAny(sell_orn).toString(),
            price_bn.toString(),
            FEE
        );

        //  Get previous balance of user1 in ORN
        const orn_before = await exchange.getBalance(orn.address, user1.address);

        const tx = await(await exchange.connect(matcher).fillThroughOrionPool(
            sellOrder.order,
            ToExchAny(sell_orn / 2),
            sellOrder.order.matcherFee,
            [orn.address, usdt.address],
        )).wait();
        console.log("gas spent for swap ↓↓↓↓: ", tx.gasUsed.toString());

        const tx2 = await(await exchange.connect(matcher).fillThroughOrionPool(
            sellOrder.order,
            ToExchAny(sell_orn / 2),
            sellOrder.order.matcherFee,
            [orn.address, usdt.address],
        )).wait();
        console.log("gas spent for swap ↓↓↓↓: ", tx2.gasUsed.toString());

        await expect(exchange.connect(matcher).fillThroughOrionPool(
            sellOrder.order,
            ToExchAny(sell_orn / 2),
            sellOrder.order.matcherFee,
            [orn.address, usdt.address],
        )).to.be.reverted;

        expect(orn_before.sub(await exchange.getBalance(orn.address, user1.address))).to
            .equal(ToORN(sell_orn).add(FEE.mul(2)));
    });

    it("Check ORN-ETH (native token)", async () => {
        const sell_orn = 10;
        await mintAndDeposit(orn, owner, user2, ToORN(sell_orn).add(FEE), exchange);

        //    Make order (SELL 10 ORN for X eth)
        let sellOrder  = await orders.generateOrderV4(user2, matcher, 0,
            orn,  {address: ZERO_ADDRESS}, orn,
            ToExchAny(sell_orn),
            ToExchAny(0.000001),  //  Min possible price (about 0.000001)
            FEE //  Fee Not important
        );

        const amountsOut = await router.getAmountsOut(ToORN(sell_orn), [orn.address, weth.address]);
        const orn_before = await exchange.getBalance(orn.address, user2.address);
        console.log("orn_before = ", orn_before.toString());
        const eth_before = await user2.getBalance();

        const tx = await(await exchange.connect(matcher).fillThroughOrionPool(
            sellOrder.order,
            sellOrder.order.amount,
            FEE,
            [orn.address, ZERO_ADDRESS],
        )).wait();
        console.log("gas spent for swap ↓↓↓↓: ", tx.gasUsed.toString());

        expect(orn_before.sub(await exchange.getBalance(orn.address, user2.address))).to
            .equal(ToORN(sell_orn).add(FEE));

        expect((await user2.getBalance()).sub(eth_before)).to.equal(0);

        expect(await exchange.getBalance(ZERO_ADDRESS, user2.address)).to
            .equal(await baseUnitToDecimal(weth, amountsOut[1]));
    });

});
