const { expect } = require("chai");
const { ethers } = require("hardhat");
const BN = ethers.BigNumber;
const { constants, expectEvent } = require('@openzeppelin/test-helpers');
const ZERO_ADDRESS = constants.ZERO_ADDRESS;

const deploy = require("./deploy-fixture")
const orders = require("../test/helpers/Orders.js");
const { ToBN, ToORN, ToWETH, ToExchAny, ToUSDT, baseUnitToDecimal, decimalToBaseUnit } = require("./libUnit")
const { deployTokens, deployExchange, mintAndApprove, mintAndDeposit, addLiquidity, addLiquidityETH, cleanupDeposit } = require("./deploy-fixture");

//  Widely-used base ORN/USDT price
const QUOTE = 15.0;
const ORN_SUPPLY = 100;

const QUOTE_ETH_USDT = 3000.0;
const ETH_SUPPLY = 5.0;


describe("ExchangeWithOrionPool::depositless swapThroughOrionPool", () => {
    let owner, user1, user2, user3, user4, matcher;
    let weth, orn, usdt;
    let exchange, router;
    let orn_units, usdt_units, weth_units;
    let ORN_AMOUNT, USDT_AMOUNT, WETH_AMOUNT;
    let ORN_RESERVE, WETH_RESERVE, USDT_RESERVE;
    const FEE = BN.from(350000);

    before(async function () {
        [owner, user1, user2, user3, user4] = await ethers.getSigners();
        matcher = owner;
        ({ weth, orn, usdt } = await deployTokens());

        [orn_units, usdt_units, weth_units] = await Promise.all([orn.decimals(), usdt.decimals(), weth.decimals()]);
        [orn_units, usdt_units, weth_units] = [BN.from(10).pow(orn_units), BN.from(10).pow(usdt_units), BN.from(10).pow(weth_units)];
    });

    before(async function () {
        ({exchange, router} = await deployExchange(matcher, orn, weth, usdt));

        ORN_RESERVE = ToORN(ORN_SUPPLY);
        USDT_RESERVE = ToUSDT(ORN_SUPPLY * QUOTE);

        await mintAndApprove(orn, owner, owner, ORN_RESERVE, router);
        await mintAndApprove(usdt, owner, owner, USDT_RESERVE, router);

        await addLiquidity(router, owner, orn, usdt, ORN_RESERVE, USDT_RESERVE);

        // pair WETH/USDT
        await addLiquidityETH(router, owner, ToWETH(100), usdt, ToUSDT(100*4000));

        await mintAndApproveTokens();
    });

    async function mintAndApproveTokens() {
        USDT_AMOUNT = ToUSDT(2000);
        WETH_AMOUNT = ToWETH(40)
        ORN_AMOUNT = ToORN(100000);

        await mintAndApprove(usdt, owner, user1, USDT_AMOUNT, exchange);
        await mintAndApprove(usdt, owner, user2, USDT_AMOUNT, exchange);
        await mintAndApprove(usdt, owner, user3, USDT_AMOUNT, exchange);
    }

    it("After deposit swap received tokens in contract", async () => {
        await exchange.connect(user1).depositAsset(usdt.address, ToUSDT(500));

        const tx = await (await exchange.connect(user1).swapThroughOrionPool(
            ToExchAny(500),    //  No matter how to spend
            ToExchAny(13),      //  Exactly 13 ORN
            [usdt.address, orn.address],
            false                   //  Exactly receive, not spend
        )).wait();

        console.log("gas spent for swapThroughOrionPool ↓↓↓↓: ", tx.gasUsed.toString());

        expect(await exchange.getBalance(orn.address, user1.address)).to.equal(ToExchAny(13));
        console.log("User1 has", (await exchange.getBalance(usdt.address, user1.address)).toString(), "USDT after 1 swap");

        const tx2 = await (await exchange.connect(user1).swapThroughOrionPool(
            ToExchAny(200),
            ToExchAny(1),
            [usdt.address, orn.address],
            false
        )).wait();
        console.log("gas spent for swapThroughOrionPool 2nd call ↓↓↓↓: ", tx2.gasUsed.toString());

        const usdt_bal = await exchange.getBalance(usdt.address, user1.address);
        console.log("User1 has", usdt_bal.toString(), "USDT after 2 swap");

        await exchange.connect(user1).withdraw(usdt.address, await decimalToBaseUnit(usdt, usdt_bal));

        console.log("User1 has", (await usdt.balanceOf(user1.address)).toString(), "USDT before 3 swap");
        const tx3 = await (await exchange.connect(user1).swapThroughOrionPool(
            ToExchAny(1000),    //  No matter how to spend
            ToExchAny(13),      //  Exactly 13 ORN
            [usdt.address, orn.address],
            false                   //  Exactly receive, not spend
        )).wait();

        console.log("gas spent for depositless swapThroughOrionPoolDirect ↓↓↓↓: ", tx3.gasUsed.toString());
    });

    it("After depositless swap received tokens in wallet", async () => {
        await usdt.connect(user2).transfer(exchange.address, ToUSDT(1000));
        console.log("User2 has", (await usdt.balanceOf(user2.address)).toString(), "USDT before swap");
        //await exchange.connect(user2).depositAsset(usdt.address, ToUSDT(250));

        const tx = await (await exchange.connect(user2).swapThroughOrionPool(
            ToExchAny(1000),    //  No matter how to spend
            ToExchAny(13),      //  Exactly 13 ORN
            [usdt.address, orn.address],
            false                   //  Exactly receive, not spend
        )).wait();
        console.log("User2 has", (await usdt.balanceOf(user2.address)).toString(), "USDT after 1 swap");

        console.log("gas spent for swapThroughOrionPool ↓↓↓↓: ", tx.gasUsed.toString());

        expect(await orn.balanceOf(user2.address)).to.equal(ToExchAny(13));

        const tx2 = await (await exchange.connect(user2).swapThroughOrionPool(
            ToExchAny(500),    //  No matter how to spend
            ToExchAny(5),      //  Exactly 13 ORN
            [usdt.address, orn.address],
            false                   //  Exactly receive, not spend
        )).wait();

        console.log("gas spent for 2nd swapThroughOrionPool ↓↓↓↓: ", tx2.gasUsed.toString());

        expect(await orn.balanceOf(user2.address)).to.equal(ToExchAny(18));
    });

    it("After direct depositless swap received tokens in wallet", async () => {
        const tx = await (await exchange.connect(user3).swapThroughOrionPool(
            ToExchAny(1000),
            ToExchAny(13),
            [usdt.address, orn.address],
            false
        )).wait();
        console.log("gas spent for swapThroughOrionPoolDirect ↓↓↓↓: ", tx.gasUsed.toString());

        expect(await orn.balanceOf(user3.address)).to.equal(ToORN(13));

        const tx2 = await (await exchange.connect(user3).swapThroughOrionPool(
            ToExchAny(500),    //  No matter how to spend
            ToExchAny(5),      //  Exactly 13 ORN
            [usdt.address, orn.address],
            false                   //  Exactly receive, not spend
        )).wait();

        console.log("gas spent for 2nd swapThroughOrionPoolDirect ↓↓↓↓: ", tx2.gasUsed.toString());

        expect(await orn.balanceOf(user3.address)).to.equal(ToExchAny(18));
    });

    it("Failed swap if position is not enough after swap", async () => {
        const orn_amount = 15;
        const lack = 5;
        await mintAndDeposit(orn, owner, user4, ToORN(orn_amount - lack), exchange);
        await mintAndDeposit(orn, owner, matcher, ToORN(lack), exchange);

        await expect(exchange.connect(user4).swapThroughOrionPool(
            ToExchAny(orn_amount),
            ToExchAny(100),
            [orn.address, usdt.address],
            true
        )).to.be.revertedWith("E1PS");

        await cleanupDeposit(exchange, user4, orn);
    });

    it("Failed swap of native token from wallet", async () => {
        const eth_amount = 15;

        await exchange.connect(owner).deposit({value: ToWETH(eth_amount + 1)});

        await expect(exchange.connect(user4).swapThroughOrionPool(
            ToExchAny(eth_amount),
            ToExchAny(0),
            [ZERO_ADDRESS, usdt.address],
            true
        )).to.be.revertedWith("TransferFrom: this");

    });

    it("Payable swap of native token from wallet", async () => {
        const eth_amount = 15;

        await exchange.connect(owner).deposit({value: ToWETH(eth_amount + 1)});

        const eth_before = await user4.getBalance();
        const usdt_before = await usdt.balanceOf(user4.address);
        const amountsOut = await router.getAmountsOut(ToWETH(eth_amount), [weth.address, usdt.address]);

        const tx = await (await exchange.connect(user4).swapThroughOrionPool(
            ToExchAny(eth_amount),
            ToExchAny(1),
            [ZERO_ADDRESS, usdt.address],
            true,
            {value: ToWETH(eth_amount)}
        )).wait();
        console.log("gas spent for swapThroughOrionPool ↓↓↓↓: ", tx.gasUsed.toString());

        expect(await user4.getBalance()).to.equal(eth_before.sub(ToWETH(eth_amount))
            .sub(tx.cumulativeGasUsed.mul(tx.effectiveGasPrice)));
        const usdt_after = await usdt.balanceOf(user4.address);
        expect(usdt_after).to.equal(usdt_before.add(amountsOut[1]));

        const usdt_amount = 1000;
        const eth_before_2 = await user4.getBalance();
        const amountsIn = await router.getAmountsIn(ToUSDT(usdt_amount), [weth.address, usdt.address]);
        const eth_amount_2_in_base = amountsIn[0].mul(105).div(100); // 5% deviation
        const eth_amount_2 = await baseUnitToDecimal(weth, eth_amount_2_in_base); // 5% deviation

        const tx2 = await (await exchange.connect(user4).swapThroughOrionPool(
            eth_amount_2,
            ToExchAny(usdt_amount),
            [ZERO_ADDRESS, usdt.address],
            false,
            {value: eth_amount_2_in_base}
        )).wait();
        console.log("gas spent for swapThroughOrionPool2 ↓↓↓↓: ", tx2.gasUsed.toString());

        const diff = (await user4.getBalance()).sub(eth_before_2.sub(amountsIn[0])).sub(tx2.gasUsed.mul(tx2.effectiveGasPrice));
        expect(diff).to.lt(1e8);
        expect(await usdt.balanceOf(user4.address)).to.equal(usdt_after.add(ToUSDT(usdt_amount)));

        await cleanupDeposit(exchange, user4, usdt);
    });

    it("Dual native swap paybale and from wallet", async () => {
        const eth_amount = 15;

        await exchange.connect(user4).deposit({value: ToWETH(5)});

        const eth_before = await user4.getBalance();
        const usdt_before = await usdt.balanceOf(user4.address);
        const usdt_before_e = await exchange.getBalance(usdt.address, user4.address);
        const amountsOut = await router.getAmountsOut(ToWETH(eth_amount), [weth.address, usdt.address]);

        const tx = await (await exchange.connect(user4).swapThroughOrionPool(
            ToExchAny(eth_amount),
            ToExchAny(1),
            [ZERO_ADDRESS, usdt.address],
            true,
            {value: ToWETH(10)}
        )).wait();
        console.log("gas spent for swapThroughOrionPool ↓↓↓↓: ", tx.gasUsed.toString());

        expect(await user4.getBalance()).to.equal(eth_before.sub(ToWETH(10))
            .sub(tx.cumulativeGasUsed.mul(tx.effectiveGasPrice)));
        expect(await usdt.balanceOf(user4.address)).to.equal(usdt_before);
        expect(await exchange.getBalance(usdt.address, user4.address)).to.equal(usdt_before_e
            .add(await baseUnitToDecimal(usdt, amountsOut[1])));

    });
});

