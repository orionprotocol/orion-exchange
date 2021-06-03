const { expect } = require("chai");
const { ethers } = require("hardhat");
const BN = ethers.BigNumber;
const ChainManipulation = require("../test/helpers/ChainManipulation");
const deploy = require("./deploy-fixture")

const orders = require("../test/helpers/Orders.js");
let theOne = '100000000';
require("chai")
    .use(require("chai-shallow-deep-equal"))
    .use(require("chai-as-promised"))
    .should();

describe("OrionPool::exchange", function () {
    let owner, broker, user1, user3, user4, matcher;
    let weth, orn, usdt;
    let factory, router;
    let exchange;
    let orn_units, usdt_units, weth_units;
    let ornApprove, usdtApprove, wethApprove;

    before(async function () {
        [owner, broker, user1, user3, user4] = await ethers.getSigners();
        matcher = owner;
        ({ weth, orn, usdt } = await deploy.deployTokens());

        [orn_units, usdt_units, weth_units] = await Promise.all([orn.decimals(), usdt.decimals(), weth.decimals()]);
        [orn_units, usdt_units, weth_units] = [BN.from(10).pow(orn_units), BN.from(10).pow(usdt_units), BN.from(10).pow(weth_units)];
    });

    before(async function () {
        ({factory, router} = await deploy.deployPool(weth));
        ({exchange} = await deploy.deployExchange(matcher, router, orn, weth, usdt));
        await addLiquidity();
    });

    async function addLiquidity() {
        const orionMint = BN.from(1000).mul(orn_units);
        const usdtMint = BN.from(800).mul(usdt_units);
        const wethMint = BN.from(800).mul(weth_units);

        await orn.mint(owner.address, orionMint);
        await usdt.mint(owner.address, usdtMint);
        await weth.mint(owner.address, wethMint);

        ornApprove = BN.from(100).mul(orn_units);
        usdtApprove = BN.from(100).mul(usdt_units);
        wethApprove = BN.from(100).mul(weth_units);

        await factory.createPair(orn.address, usdt.address);
        await factory.createPair(weth.address, usdt.address);
        await factory.createPair(weth.address, orn.address);

        await orn.approve(router.address, ornApprove);
        await usdt.approve(router.address, usdtApprove);

        const result = await router.addLiquidity(orn.address, usdt.address,
            ornApprove, usdtApprove,
            ornApprove, usdtApprove,
            owner.address, "2000000000"
        );

        await orn.approve(router.address, ornApprove);
        await weth.approve(router.address, wethApprove);

        const wethResult = await router.addLiquidity(orn.address, weth.address,
            ornApprove, wethApprove,
            ornApprove, wethApprove,
            owner.address, "2000000000"
        );


        await weth.approve(router.address, wethApprove);
        await usdt.approve(router.address, usdtApprove);
        await router.addLiquidity(weth.address, usdt.address,
            wethApprove, usdtApprove,
            wethApprove, usdtApprove,
            owner.address, "2000000000");
    }

    describe("ExchangeWithOrionPool::fillThroughOrionPool", function () {
        it("user1 deposits 10 ORN", async () => {
            console.log("user1 deposits 10 ORN")
            await orn.mint(user1.address, BN.from(10).mul(orn_units));
            await orn.connect(user1).approve(exchange.address, BN.from(10).mul(orn_units));
            await exchange.connect(user1).depositAsset(orn.address, BN.from(10).mul(orn_units));

            const balanceAsset = await exchange.getBalance(orn.address, user1.address);
            expect(balanceAsset).to.equal(BN.from(10).mul(orn_units));
        });

        it("user1 exchange through orionpool pair", async () => {
            const NOW = (await ChainManipulation.getBlokchainTime()) * 1000;
            const buyOrder = await orders.generateOrder(user1.address, matcher.address, 1,
                usdt, orn, orn,
                100000,
                BN.from(2).mul(1e8).toString(),
                2000,
                NOW,
                NOW + 29 * 24 * 60 * 60 * 1000,
                isV4 = true);
            console.log("Get amounts In:" + (await router.getAmountsIn(7000000, [orn.address, usdt.address])).toString());
            expect(await exchange.getBalance(orn.address, user1.address)).to.equal(BN.from(10).mul(orn_units));
            expect(await exchange.getBalance(usdt.address, user1.address)).to.equal(0);

            //  Trying the same but with own balance of user
            //  await orn.mint(user1.address, BN.from(10).mul(orn_units));
            //  let tx_receipt = await exchange.connect(user1).swapThroughOrionPool(100, 100000, [orn.address, usdt.address], false).should.be.fulfilled;

            const blockchainFee = 1000;
            let tx_receipt = await (await exchange.connect(matcher)).fillThroughOrionPool(
                buyOrder.order,
                100000,
                blockchainFee,
                [orn.address, usdt.address]
            ).should.be.fulfilled;

            expect(await exchange.getBalance(usdt.address, user1.address)).to.equal(100000);
            // (x-v)*(y+w)=k=xy, p=(y/x-v)/q, where q=0.998 0.2%, w=yv/(x-v)/q
            const [x, y] = [usdtApprove, ornApprove];
            const v = buyOrder.order.amount*usdt_units/1e8;
            const paid_orn = y.mul(v).div(x.sub(v)).mul(1000).div(998).add(1);
            const remaining_orn = BN.from(10).mul(orn_units).sub(paid_orn).sub(blockchainFee);
            expect(await exchange.getBalance(orn.address, user1.address)).to.equal(remaining_orn);

        });
    });
});
