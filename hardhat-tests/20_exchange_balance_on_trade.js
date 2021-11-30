const { expect } = require("chai");
const { ethers } = require("hardhat");
const BN = ethers.BigNumber;
const { constants, expectEvent } = require('@openzeppelin/test-helpers');
const ZERO_ADDRESS = constants.ZERO_ADDRESS;

const { ToBN, ToORN, ToWETH, ToExchAny, ToUSDT, baseUnitToDecimal, decimalToBaseUnit } = require("./libUnit")
const { deployTokens, deployExchange, mintAndApprove, addLiquidity, addLiquidityETH, mintAndDeposit,
    setCollateralAndPriceOracles, printPosition } = require("./deploy-fixture");
const orders = require("../test/helpers/Orders.js");

describe("Exchange::exchange balance", () => {
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

  });

  it("Execute trade without exchange balance", async () => {
    expect(
      [ await weth.balanceOf(exchange.address),
        await usdt.balanceOf(exchange.address),
        await orn.balanceOf(exchange.address)
      ]).to.deep.equal(
        [ BN.from(0),
          BN.from(0),
          BN.from(0)])

    const weth_amount = 5;
    const weth_price = 0.04;
    const usdt_quote = weth_amount*weth_price; //0.2

    // Minimal for trade to be fulfilled
    await mintAndApprove(usdt, owner, user1, ToUSDT(usdt_quote), exchange)
    await mintAndApprove(weth, owner, user2, ToWETH(weth_amount), exchange)
    // Fees
    await mintAndApprove(orn, owner, user1, ToORN(FEE), exchange)
    await mintAndApprove(orn, owner, user2, ToORN(FEE), exchange)

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
    console.log("gas spent for fillOrders ↓↓↓↓: ", tx.gasUsed.toString());

    expect(
      [ await weth.balanceOf(exchange.address),
        await usdt.balanceOf(exchange.address),
        await orn.balanceOf(exchange.address)
      ]).to.deep.equal(
        [ BN.from(0),
          BN.from(0),
          FEE.mul(2)]) // Fees don't will transfered to matcher

      // withdraw fees
      await exchange.connect(matcher).withdraw(orn.address, FEE.mul(2))
  })

  it("Execute trade with user 1 with deposit and user 2 from wallet", async () => {
    expect(
      [ await weth.balanceOf(exchange.address),
        await usdt.balanceOf(exchange.address),
        await orn.balanceOf(exchange.address)
      ]).to.deep.equal(
        [ BN.from(0),
          BN.from(0),
          BN.from(0)
      ]);

    const weth_amount = 5;
    const weth_price = 0.04;
    const usdt_quote = weth_amount*weth_price; //0.2

    await mintAndDeposit(usdt, owner, user1, ToUSDT(usdt_quote), exchange)
    await mintAndApprove(weth, owner, user2, ToWETH(weth_amount), exchange)
    // Fees
    await mintAndApprove(orn, owner, user1, ToORN(FEE), exchange)
    await mintAndApprove(orn, owner, user2, ToORN(FEE), exchange)

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
    console.log("gas spent for fillOrders ↓↓↓↓: ", tx.gasUsed.toString());

    expect(
      [ await weth.balanceOf(exchange.address),
        await usdt.balanceOf(exchange.address),
        await orn.balanceOf(exchange.address)
      ]).to.deep.equal(
        [ ToWETH(weth_amount), // User 1 has made a trade with a previous deposit, assets will be kept
          BN.from(0),
          FEE.mul(2)])  // Fees don't will transfered to matcher

      // Withdraw all
      await exchange.connect(user1).withdraw(weth.address, ToWETH(weth_amount))
      await exchange.connect(matcher).withdraw(orn.address, FEE.mul(2))
  });

  it("Execute a trade both users with deposit", async () => {
    expect(
      [ await weth.balanceOf(exchange.address),
        await usdt.balanceOf(exchange.address),
        await orn.balanceOf(exchange.address)
      ]).to.deep.equal(
        [ BN.from(0),
          BN.from(0),
          BN.from(0)]
      )

    const weth_amount = 5;
    const weth_price = 0.04;
    const usdt_quote = weth_amount*weth_price; //0.2

    await mintAndDeposit(usdt, owner, user1, ToUSDT(usdt_quote), exchange)
    await mintAndDeposit(weth, owner, user2, ToWETH(weth_amount), exchange)
    // Fees
    await mintAndApprove(orn, owner, user1, ToORN(FEE), exchange)
    await mintAndApprove(orn, owner, user2, ToORN(FEE), exchange)

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
    console.log("gas spent for fillOrders ↓↓↓↓: ", tx.gasUsed.toString());

    expect(
      [ await weth.balanceOf(exchange.address),
        await usdt.balanceOf(exchange.address),
        await orn.balanceOf(exchange.address)
      ]).to.deep.equal( // Every asset will be kept into exchange
        [ ToWETH(weth_amount),
          ToUSDT(usdt_quote),
          FEE.mul(2)])

    // Withdraw all
    await exchange.connect(user1).withdraw(weth.address, ToWETH(weth_amount))
    await exchange.connect(user2).withdraw(usdt.address, ToUSDT(usdt_quote))
    await exchange.connect(matcher).withdraw(orn.address, FEE.mul(2))
  });

  it("Keep tokens on exchange when broker goes into liability", async () => {
    expect(
      [ await weth.balanceOf(exchange.address),
        await usdt.balanceOf(exchange.address),
        await orn.balanceOf(exchange.address)
      ]).to.deep.equal(
        [ BN.from(0),
          BN.from(0),
          BN.from(0)]
      )

      await mintAndDeposit(orn, owner, broker, ToORN(150), exchange);
      await exchange.connect(broker).lockStake(ToORN(1));
      expect(await exchange.getBalance(orn.address, broker.address)).to.equal(ToExchAny(149));

      const weth_amount = 5;
      const weth_price = 0.04;
      const usdt_quote = weth_amount*weth_price; //0.2

      await mintAndApprove(usdt, owner, user1, ToUSDT(usdt_quote), exchange)
      await mintAndApprove(orn, owner, user1, ToORN(FEE), exchange)

      buyOrder  = await orders.generateOrderV4(
        user1, owner, 1,
        weth, usdt, orn,
        ToExchAny(weth_amount), //5 WETH * 10^8
        ToExchAny(weth_price), //0.04 WETH/USDT * 10^8
        FEE
      );

      sellOrder  = await orders.generateOrderV4(
        broker, owner, 0,
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
      console.log("gas spent for fillOrders ↓↓↓↓: ", tx.gasUsed.toString());

      expect(await exchange.getBalance(weth.address, user1.address)).to.equal(ToExchAny(weth_amount));

      expect(
        [ await weth.balanceOf(exchange.address),
          await usdt.balanceOf(exchange.address),
          await orn.balanceOf(exchange.address)
        ]).to.deep.equal( // Every asset will be kept into exchange
          [ BN.from(0), // No WETH on exchange balance
            ToUSDT(usdt_quote),
            ToORN(150).add(FEE)]) // Only user1 fee was transfered, broker has "inside" funds
  });

  it("User 1 sell with contract balance (5 WETH from last trade) to user 2 from wallet", async () => {

    const weth_amount = 5;
    const weth_price = 0.04;
    const usdt_quote = weth_amount*weth_price; //0.2

    await mintAndApprove(usdt, owner, user2, ToUSDT(usdt_quote), exchange)
    // Fees
    await mintAndApprove(orn, owner, user1, ToORN(FEE), exchange)
    await mintAndApprove(orn, owner, user2, ToORN(FEE), exchange)

    // user 1 has 5 WETH in his balance
    expect(await exchange.getBalance(weth.address, user1.address)).to.equal(ToExchAny(weth_amount))

    buyOrder  = await orders.generateOrderV4(
      user2, owner, 1,
      weth, usdt, orn,
      ToExchAny(weth_amount), //5 WETH * 10^8
      ToExchAny(weth_price), //0.04 WETH/USDT * 10^8
      FEE
    );

    sellOrder  = await orders.generateOrderV4(
      user1, owner, 0,
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
    console.log("gas spent for fillOrders ↓↓↓↓: ", tx.gasUsed.toString());
  })

})
