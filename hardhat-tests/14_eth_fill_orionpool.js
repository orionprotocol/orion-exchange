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
const ORN_SUPPLY = 1000;


describe("ExchangeWithOrionPool::fillThroughOrionPool ETH native", function () {
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
        console.log("Exchange:", exchange.address);

        orn_reserve = ToORN(ORN_SUPPLY);
        weth_reserve = ToWETH(100);
        usdt_reserve = ToUSDT(ORN_SUPPLY*QUOTE);

        // pair ORN/USDT
        await addLiquidity(router, owner, orn, usdt, orn_reserve, usdt_reserve);

        // pair WETH/ORN
        await addLiquidityETH(router, owner, weth_reserve, orn, orn_reserve);

        // pair WETH/USDT
        await addLiquidityETH(router, owner, '12823859435580473085', usdt, '17564395475');

        await mintAndApprove(orn, owner, balancer, ToORN(1000000), router);
        await mintAndApprove(usdt, owner, balancer, ToUSDT(1000000), router);
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

    it("Sell ETH/USDT through OrionPool", async () => {
        //    Deposit ETH to exchange
        await exchange.connect(user1).deposit({value: ToWETH(2)});

        await mintAndApprove(orn, owner, user1, FEE, exchange);

        const sell_eth = 1;
        //    Make order
        const sellOrder  = await orders.generateOrderV4(user1, matcher, 0,
            {address: ZERO_ADDRESS}, usdt, orn,
            ToExchAny(1),
            '119316700000',
            FEE
        );

        const eth_before = await exchange.getBalance(ZERO_ADDRESS, user1.address);
        const amountsOut = await router.getAmountsOut(ToWETH(sell_eth), [weth.address, usdt.address]);
        const orn_before = await orn.balanceOf(user1.address);
        const usdt_before = await exchange.getBalance(usdt.address, user1.address);

        const tx = await(await exchange.connect(matcher).fillThroughOrionPool(
            sellOrder.order,
            sellOrder.order.amount,
            sellOrder.order.matcherFee,
            [ZERO_ADDRESS, usdt.address],
        )).wait();
        console.log("gas spent for swap ↓↓↓↓: ", tx.gasUsed.toString());

        expect(orn_before.sub(await orn.balanceOf(user1.address))).to.equal(FEE);
        expect(eth_before.sub(await exchange.getBalance(ZERO_ADDRESS, user1.address))).to.equal(ToExchAny(1));

        expect((await exchange.getBalance(usdt.address, user1.address)).sub(usdt_before)).to
            .equal(await baseUnitToDecimal(usdt, amountsOut[1]));
    });

    it('Buy ETH/USDT through OrionPool', async () => {
        const buy_eth = 1;
        const max_price = 1500;

        //    Deposit a little more ETH to exchange to pay network fee
        await exchange.connect(user1).deposit({value: ToWETH(2)});
        await mintAndApprove(orn, owner, user1, FEE, exchange);
        await mintAndDeposit(usdt, owner, user1, ToUSDT(buy_eth*max_price), exchange);

        const buyOrder = await orders.generateOrderV4(user1, matcher, 1,
            {address: ZERO_ADDRESS}, usdt, orn,
            ToExchAny(buy_eth),
            ToExchAny(max_price),
            FEE
        );

        const amountsIn = await router.getAmountsIn(ToWETH(buy_eth), [usdt.address, weth.address]);
        console.log("getAmountsIn: ", amountsIn.toString());
        const eth_before = await exchange.getBalance(ZERO_ADDRESS, user1.address);
        const orn_before = await orn.balanceOf(user1.address);
        const usdt_before = await exchange.getBalance(usdt.address, user1.address);

        expect(await exchange.getBalance(usdt.address, user1.address)).to.gte(ToExchAny(buy_eth*max_price));
        expect(await ethers.provider.getBalance(exchange.address)).to.gte(ToWETH(2));

        const tx = await(await exchange.connect(matcher).fillThroughOrionPool(
            buyOrder.order,
            buyOrder.order.amount,
            buyOrder.order.matcherFee,
            [usdt.address, ZERO_ADDRESS],
        )).wait();
        console.log("gas spent for swap ↓↓↓↓: ", tx.gasUsed.toString());

        expect(orn_before.sub(await orn.balanceOf(user1.address))).to.equal(FEE);
        expect(eth_before.sub(await exchange.getBalance(ZERO_ADDRESS, user1.address))).to
            .equal(ToExchAny(buy_eth).mul(-1));


        expect(usdt_before.sub(await exchange.getBalance(usdt.address, user1.address))).to
            .equal(await baseUnitToDecimal(usdt, amountsIn[0]));
    });

    it('Do a hop buy trade ORN/ETH/USDT', async () => {
        console.log("User1:", user1.address);
        const buy_usdt = 1200;
        const usdt_price = 0.01;

        await mintAndDeposit(orn, owner, user1, ToExchAny(120), exchange);
        //Buy USDT for ORN with ETH as intermediate asset using buy-side
        const buyOrder = await orders.generateOrderV4(user1, matcher, 1,
            usdt, orn, orn,
            ToExchAny(buy_usdt), //amount
            ToExchAny(usdt_price), //price
            FEE //fee
        );

        const amountsIn = await router.getAmountsIn(ToUSDT(buy_usdt), [orn.address, weth.address, usdt.address]);
        console.log("amountsIn = ", amountsIn.toString());
        const orn_before = await exchange.getBalance(orn.address, user1.address);
        const usdt_before = await exchange.getBalance(usdt.address, user1.address);

        const tx = await(await exchange.connect(matcher).fillThroughOrionPool(
            buyOrder.order,
            buyOrder.order.amount,
            buyOrder.order.matcherFee,
            [orn.address, ZERO_ADDRESS, usdt.address],
        )).wait();
        console.log("gas spent for swap ↓↓↓↓: ", tx.gasUsed.toString());

        const orn_after = await exchange.getBalance(orn.address, user1.address);
        const usdt_after = await exchange.getBalance(usdt.address, user1.address);

        expect(usdt_after.sub(usdt_before).toString()).to.equal(ToExchAny(1200));
        expect(orn_before.sub(orn_after).toString()).to.equal(amountsIn[0].add(FEE));

        //Sell USDT for LINK with BNB as intermediate asset, using sell side
        const sell_usdt = 1000;
        const sellOrder  = await orders.generateOrderV4(user1, matcher, 0,
            usdt, orn, orn,
            ToExchAny(sell_usdt),
            '1',
            FEE
        );

        const amountsOut = await router.getAmountsOut(ToUSDT(sell_usdt), [usdt.address, weth.address, orn.address]);

        const tx2 = await(await exchange.connect(matcher).fillThroughOrionPool(
            sellOrder.order,
            sellOrder.order.amount,
            sellOrder.order.matcherFee,
            [usdt.address, ZERO_ADDRESS, orn.address],
        )).wait();
        console.log("gas spent for swap ↓↓↓↓: ", tx2.gasUsed.toString());

        const orn_final = await exchange.getBalance(orn.address, user1.address);
        const usdt_final= await exchange.getBalance(usdt.address, user1.address);

        expect(usdt_after.sub(usdt_final).toString()).to.equal(ToExchAny(sell_usdt));
        expect(orn_final.sub(orn_after).toString()).to.equal(amountsOut[2].sub(FEE));
    });

    it('Do a hop trade ETH/USDT/ORN', async () => {
        //    Deposit a little more ETH to exchange to pay network fee
        await exchange.connect(user1).deposit({value: ToWETH(2)});

        const sell_eth = 1;
        let sellOrder = await orders.generateOrderV4(user1, matcher, 0,
            {address: ZERO_ADDRESS}, orn, orn,
            ToExchAny(1),
            '1193',
            FEE
        );

        const orn_before = await exchange.getBalance(orn.address, user1.address);
        const eth_before = await exchange.getBalance(ZERO_ADDRESS, user1.address);
        const amountsOut = await router.getAmountsOut(ToWETH(sell_eth), [weth.address, usdt.address, orn.address]);

        const tx = await(await exchange.connect(matcher).fillThroughOrionPool(
            sellOrder.order,
            sellOrder.order.amount,
            sellOrder.order.matcherFee,
            [ZERO_ADDRESS, usdt.address, orn.address],
        )).wait();
        console.log("gas spent for swap ↓↓↓↓: ", tx.gasUsed.toString());

        const orn_after = await exchange.getBalance(orn.address, user1.address);
        const eth_after = await exchange.getBalance(ZERO_ADDRESS, user1.address);

        expect(orn_after.sub(orn_before)).to.equal(amountsOut[2].sub(FEE));
        expect(eth_before.sub(eth_after)).to.equal(ToExchAny(sell_eth));
    })
});
