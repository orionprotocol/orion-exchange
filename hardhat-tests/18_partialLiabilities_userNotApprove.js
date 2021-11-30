const { expect } = require("chai");
const { ethers } = require("hardhat");
const BN = ethers.BigNumber;
const { expectEvent } = require('@openzeppelin/test-helpers');

const orders = require("../test/helpers/Orders.js");
const { ToBN, ToORN, ToWETH, ToExchAny, ToUSDT, baseUnitToDecimal, decimalToBaseUnit } = require("./libUnit")
const { deployTokens, deployExchange, mintAndApprove, addLiquidity,
    addLiquidityETH, mintAndDeposit, setCollateralAndPriceOracles, printPosition } = require("./deploy-fixture");

describe("Exchange::partial liabilities", () => {
    let owner, broker, oracle, user, matcher;
    let orn, wbtc, usdt, weth;
    let exchange, router, priceOracle;
    let ORN_INITIAL_AMOUNT;

    before (async function () {
        [owner, broker, oracle, user] = await ethers.getSigners();
        matcher = owner;
        ({weth, orn, usdt, wbtc} = await deployTokens());

        ORN_INITIAL_AMOUNT = ToORN(250);
    })

    before(async function (){
        ({exchange, priceOracle, router} = await deployExchange(matcher, orn, weth, usdt));
        await setCollateralAndPriceOracles(priceOracle, exchange, owner, oracle, orn, weth, usdt);

        await initialDeposit();
    })

    async function initialDeposit() {
        await mintAndDeposit(orn, owner, user, ORN_INITIAL_AMOUNT, exchange);
        await mintAndDeposit(wbtc, owner, user, ToExchAny(20), exchange);

        await mintAndDeposit(orn, owner, broker, ORN_INITIAL_AMOUNT, exchange);
        await mintAndDeposit(usdt, owner, broker, ToUSDT(10), exchange);
        await exchange.connect(broker).lockStake(String(1e7));
    }

    it("Broker goes in 2 liabilities", async () => {
        const btc_amount = 16;
        const btc_price = 1;

        let sellOrder  = await orders.generateOrderV4(user, matcher, 0,
            wbtc, usdt, orn,
            ToExchAny(btc_amount),
            ToExchAny(btc_price));
        let buyOrder  = await orders.generateOrderV4(broker, matcher, 1,
            wbtc, usdt, orn,
            ToExchAny(btc_amount),
            ToExchAny(btc_price));

        console.log("user wbtc:", (await exchange.getBalance(wbtc.address, user.address)).toString());

        await printPosition(exchange,{broker});
        await printPosition(exchange, {user});

        const tx =  await (await exchange.connect(matcher).fillOrders(
            buyOrder.order,
            sellOrder.order,
            ToExchAny(btc_price),
            ToExchAny(btc_amount)
        )).wait();

        await printPosition(exchange,{broker});
        await printPosition(exchange, {user});

        const broker_usdt_balance = await exchange.getBalance(usdt.address, broker.address);
        const orn_amount = broker_usdt_balance.abs().div(1e8).add(15);
        const orn_price = 1;

        const sellOrder2  = await orders.generateOrderV4(user, matcher, 0,
            orn, usdt, orn,
            ToExchAny(orn_amount),
            ToExchAny(btc_price));

        const buyOrder2  = await orders.generateOrderV4(broker, matcher, 1,
            orn, usdt, orn,
            ToExchAny(orn_amount),
            ToExchAny(btc_price)
        );

        await exchange.connect(matcher).fillOrders(
            buyOrder2.order,
            sellOrder2.order,
            ToExchAny(orn_price),
            ToExchAny(orn_amount),
        );

        const broker_liabilities = await exchange.getLiabilities(broker.address);
        await printPosition(exchange,{broker});
        await printPosition(exchange, {user});

        const broker_usdt_balance2 = await exchange.getBalance(usdt.address, broker.address);
        expect(broker_usdt_balance2.sub(broker_usdt_balance).abs()).to.equal(ToORN(orn_amount));
        expect(broker_liabilities[0].outstandingAmount.add(broker_usdt_balance)).to.equal(0);
    });
});
