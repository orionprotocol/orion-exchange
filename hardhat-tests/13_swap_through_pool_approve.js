const { expect } = require("chai");
const { ethers } = require("hardhat");
const BN = ethers.BigNumber;
const { constants, expectEvent } = require('@openzeppelin/test-helpers');

const { deployTokens, deployExchange, mintAndApprove, addLiquidity, addLiquidityETH } = require("./deploy-fixture");
const orders = require("../test/helpers/Orders.js");
const { ToBN, ToORN, ToWETH, ToExchAny, ToUSDT, baseUnitToDecimal, decimalToBaseUnit } = require("./libUnit");

//  Widely-used base ORN/USDT price
const QUOTE = 15.0;
const ORN_SUPPLY = 100;

const QUOTE_ETH_USDT = 3000.0;
const ETH_SUPPLY = 5.0;
const FEE_DIVIDER = 0.998;

//  Calculates ASK for ORN/USDT by constants given below, and
//  then amount in (how many we should give for BUY order)
//      1.1 buy price (ask) for desired_buy_orn will be
//          y / (x - v) = 1500 / (100 - 13) = 17,24137931
//      With commission, it would be 17,24137931 / 0,998 = 17,275931172690
//  2. Multiplying it to desired_buy_orn - we'll get the actual ORN price

function CalcAmountIn(desired_buy_orn) {
    return (ORN_SUPPLY * QUOTE / (ORN_SUPPLY - desired_buy_orn))   //  y / (x - v)
        / FEE_DIVIDER       //  with commission
        * desired_buy_orn   //  Get the actual amount
}

//  For some tests, we'll need the bid price
function CalcAmountOut(desired_sell_orn) {
    return (ORN_SUPPLY * QUOTE / (ORN_SUPPLY + desired_sell_orn))   //  y / (x + v)
        * FEE_DIVIDER;
}

describe("exchange::depositless swapThroughOrionPool", () => {
    let owner, user1, user2, user3, user4, matcher;
    let weth, orn, usdt;
    let exchange, router, factory;
    let orn_units, usdt_units, weth_units;
    let ORN_AMOUNT, USDT_AMOUNT, WETH_AMOUNT;
    const FEE = BN.from(350000);

    before(async function () {
        [owner, user1, user2, user3, user4] = await ethers.getSigners();
        matcher = owner;
        ({ weth, orn, usdt } = await deployTokens());

        [orn_units, usdt_units, weth_units] = await Promise.all([orn.decimals(), usdt.decimals(), weth.decimals()]);
        [orn_units, usdt_units, weth_units] = [BN.from(10).pow(orn_units), BN.from(10).pow(usdt_units), BN.from(10).pow(weth_units)];
    });

    before(async function () {
        ({exchange, router, factory} = await deployExchange(matcher, orn, weth, usdt));

        const orn_reserve = ToORN(1000);
        const weth_reserve = ToWETH(1000);
        const usdt_reserve = ToUSDT(1000);

        await addLiquidity(router, owner, orn, usdt, ToORN(ORN_SUPPLY), ToUSDT(ORN_SUPPLY * QUOTE));
        await addLiquidityETH(router, owner, ToWETH(ETH_SUPPLY), usdt, ToUSDT(ETH_SUPPLY * QUOTE_ETH_USDT));
        await addLiquidityETH(router, owner, ToWETH(5), orn, ToORN(1000));
        await mintAndApproveTokens();
    });

    async function mintAndApproveTokens() {
        USDT_AMOUNT = ToUSDT(10000);
        WETH_AMOUNT = ToWETH(40)
        ORN_AMOUNT = ToORN(100000);

        await mintAndApprove(usdt, owner, user1, USDT_AMOUNT, exchange);
    }

    it("Swap through Orion Pool (base)", async () => {
        await orn.connect(user1).approve(exchange.address, ToORN(14));
        console.log("User1 address:", user1.address);
        console.log("User1 has", (await exchange.getBalance(usdt.address, user1.address)).toString(), "USDT before swaps");
        await exchange.connect(user1).swapThroughOrionPool(
            ToExchAny(1000),    //  No matter how to spend
            ToExchAny(13),      //  Exactly 13 ORN
            [usdt.address, orn.address],
            false                   //  Exactly receive, not spend
        );

        console.log("User1 has", (await exchange.getBalance(usdt.address, user1.address)).toString(), "USDT after 1 swap");
        
        await exchange.connect(user1).swapThroughOrionPool(
            ToExchAny(1000),   //  Much less than needed
            ToExchAny(1),      //  Exactly 1 ORN
            [usdt.address, orn.address],
            false                  //  Exactly receive, not spend
        );

        await expect(exchange.connect(user1).swapThroughOrionPool(
            ToExchAny(1),    //  Much less than needed
            ToExchAny(10),      //  Exactly 10 ORN
            [usdt.address, orn.address],
            false                   //  Exactly receive, not spend
        )).to.be.reverted;

        //  Now let's change back exact out 14 tokens (succesfully swapped before)
        await exchange.connect(user1).swapThroughOrionPool(
            ToExchAny(14),    //  Exactly 13+1 = 14 ORN
            ToExchAny(1),      //  to any amount of USDT
            [orn.address, usdt.address],
            true,                   //  Exactly spend, not receive
        );

        //  And now we should have 0 orn at exchange contract itself....
        expect(await orn.balanceOf(exchange.address)).to.equal(0);

        //  And balance of user1 in ORN shoule be also equal to 0
        expect(await exchange.getBalance(orn.address, user1.address)).to.equal(0);

        //  And what's the difference :)
        const usdt_exchange_balance = await exchange.getBalance(usdt.address, user1.address);
        const usdt_contract_balance = (await usdt.balanceOf(exchange.address)).mul(100);

        expect(usdt_exchange_balance).to.equal(usdt_contract_balance);
        console.log("User1 has", usdt_exchange_balance.toString(), "USDT after swaps");
    });


    it("Make a swap with enough approval to completDeficit", async () => {
        console.log("User1 address:", user1.address);
        const orn_amount = ToORN(20);
        await mintAndApprove(orn, owner, user1, orn_amount, exchange);
        // Should allow to sell 20 ORN (Balance is now 0)
        // User only have 10 ORN in balance
        expect(await exchange.getBalance(orn.address, user1.address)).to.equal(0);
        const usdt_received = (await router.getAmountsOut(orn_amount, [orn.address, usdt.address]))[1];

        await expect(() =>
            exchange.connect(user1).swapThroughOrionPool(
                ToExchAny(20),
                ToExchAny(1),      //  to any amount of USDT
                [orn.address, usdt.address],
                true,                  //  Exactly spend, not receive
            ))
            .to.changeTokenBalance(usdt, user1, usdt_received);

        expect(await exchange.getBalance(usdt.address, user1.address)).to.equal(0);
    })

    it("Swap exact ETH-USDT (through Exchange)", async () => {
        //  Direct deposit from user should not be fulfilled
        await expect(user1.sendTransaction({
            to: exchange.address,
            value: ToWETH(1)
        })).to.be.reverted;

        //  Deposit some ETH to exchange from user1
        await exchange.connect(user1).deposit({value: ToWETH(1)});
        expect(await exchange.getBalance(constants.ZERO_ADDRESS, user1.address)).to.equal(ToExchAny(1));

        //  Now let's make sure that user1 CANNOT
        //      exchange more than his 1 ETH
        await expect(exchange.connect(user1).swapThroughOrionPool(
            ToExchAny(1.1),
            1,  //  Not important how much we will receive
            [constants.ZERO_ADDRESS, usdt.address],
            true   //  Exact spend
        )).to.be.reverted;

        const usdt_to_receive = (await router.getAmountsOut(ToWETH(1), [weth.address, usdt.address]))[1];

        const usdt_bal_before = await exchange.getBalance(usdt.address, user1.address);
        console.log("User1 balance before swap", usdt_bal_before.toString());
        const tx = await(await exchange.connect(user1).swapThroughOrionPool(
                ToExchAny(1),
                1,      //  to any amount of USDT
                [constants.ZERO_ADDRESS, usdt.address],
                true,                  //  Exactly spend, not receive
        )).wait();
        const usdt_bal_after = await exchange.getBalance(usdt.address, user1.address);
        console.log("User1 balance after swap", usdt_bal_after.toString());

        expect(await exchange.getBalance(constants.ZERO_ADDRESS, user1.address)).to.equal(0);

        console.log("gas spent for swap ↓↓↓↓: ", tx.gasUsed.toString());
        expect(await decimalToBaseUnit(usdt, usdt_bal_after.sub(usdt_bal_before))).to.equal(usdt_to_receive);
    });

    it("Swap exact USDT-ETH (through Exchange)", async () => {
        const usdt_amount = 1000;
        await mintAndApprove(usdt, owner, user2, ToUSDT(usdt_amount), exchange);

        const eth_to_receive = (await router.getAmountsOut(ToUSDT(usdt_amount), [usdt.address, weth.address]))[1];

        expect(await exchange.getBalance(usdt.address, user2.address)).to.equal(0);
        expect(await exchange.getBalance(constants.ZERO_ADDRESS, user2.address)).to.equal(0);

        await expect(() =>
            exchange.connect(user2).swapThroughOrionPool(
                ToExchAny(usdt_amount),
                1,  //  Not important how much we will receive
                [usdt.address, constants.ZERO_ADDRESS],
                true,   //  Exact spend
            ))
            .to.changeEtherBalance(user2, eth_to_receive);

        expect(await exchange.getBalance(usdt.address, user2.address)).to.equal(0);
        expect(await exchange.getBalance(constants.ZERO_ADDRESS, user2.address)).to.equal(0);
    });

    it("Swap exact ORN-USDT-ETH (through Exchange)", async () => {
        const orn_amount = 1000;
        await mintAndApprove(orn, owner, user2, ToORN(orn_amount), exchange);

        const eth_to_receive = (await router.getAmountsOut(ToORN(orn_amount), [orn.address, usdt.address, weth.address]))[2];

        expect(await exchange.getBalance(orn.address, user2.address)).to.equal(0);
        expect(await exchange.getBalance(usdt.address, user2.address)).to.equal(0);
        expect(await exchange.getBalance(constants.ZERO_ADDRESS, user2.address)).to.equal(0);

        await expect(() =>
            exchange.connect(user2).swapThroughOrionPool(
                ToExchAny(orn_amount),
                1,  //  Not important how much we will receive
                [orn.address, usdt.address, constants.ZERO_ADDRESS],
                true,   //  Exact spend
            ))
            .to.changeEtherBalance(user2, eth_to_receive);

        expect(await exchange.getBalance(orn.address, user2.address)).to.equal(0);
        expect(await exchange.getBalance(usdt.address, user2.address)).to.equal(0);
        expect(await exchange.getBalance(constants.ZERO_ADDRESS, user2.address)).to.equal(0);
    });

    it("Swap exact ORN-ETH-USDT (through Exchange)", async () => {
        const orn_amount = 1000;
        await mintAndApprove(orn, owner, user2, ToORN(orn_amount), exchange);

        const usdt_to_receive = (await router.getAmountsOut(ToORN(orn_amount),
            [orn.address, weth.address, usdt.address]))[2];

        expect(await exchange.getBalance(orn.address, user2.address)).to.equal(0);
        expect(await exchange.getBalance(usdt.address, user2.address)).to.equal(0);
        expect(await exchange.getBalance(constants.ZERO_ADDRESS, user2.address)).to.equal(0);

        await expect(() =>
            exchange.connect(user2).swapThroughOrionPool(
                ToExchAny(orn_amount),
                1,  //  Not important how much we will receive
                [orn.address, constants.ZERO_ADDRESS, usdt.address],
                true,   //  Exact spend
            ))
            .to.changeTokenBalance(usdt, user2, usdt_to_receive);

        expect(await exchange.getBalance(orn.address, user2.address)).to.equal(0);
        expect(await exchange.getBalance(usdt.address, user2.address)).to.equal(0);
        expect(await exchange.getBalance(constants.ZERO_ADDRESS, user2.address)).to.equal(0);
    });

    //usdt.address = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
    //weth.address = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
    //orn.address = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
    it("Swap ORN-ETH-USDT exact (through Exchange)", async () => {
        let orn_enough_amount = 10000;
        let usdt_exact_amount = 10;
        await mintAndApprove(orn, owner, user3, ToORN(orn_enough_amount), exchange);

        const orn_to_spend = (await router.getAmountsIn(ToUSDT(usdt_exact_amount),
            [orn.address, weth.address, usdt.address]))[0];

        expect(await exchange.getBalance(orn.address, user3.address)).to.equal(0);
        expect(await exchange.getBalance(usdt.address, user3.address)).to.equal(0);
        expect(await exchange.getBalance(constants.ZERO_ADDRESS, user3.address)).to.equal(0);

        const usdt_bal_before = await usdt.balanceOf(user3.address);
        await expect(() =>
            exchange.connect(user3).swapThroughOrionPool(
                ToExchAny(orn_enough_amount),
                ToExchAny(usdt_exact_amount),
                [orn.address, constants.ZERO_ADDRESS, usdt.address],
                false,
            ))
            .to.changeTokenBalance(orn, user3, -1*orn_to_spend);

        const usdt_bal_after = await usdt.balanceOf(user3.address);
        expect(usdt_bal_after - usdt_bal_before).to.equal(ToUSDT(usdt_exact_amount));
        expect(await exchange.getBalance(orn.address, user2.address)).to.equal(0);
        expect(await exchange.getBalance(usdt.address, user2.address)).to.equal(0);
        expect(await exchange.getBalance(constants.ZERO_ADDRESS, user2.address)).to.equal(0);
    });
});

