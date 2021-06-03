const BN = require("bn.js");

const orders = require("./helpers/Orders.js");
const sigUtil = require("eth-sig-util");
const EIP712 = require("./helpers/EIP712.js");
const ChainManipulation = require("./helpers/ChainManipulation");
const eth_signTypedData = require("./helpers/GanacheSignatures.js");
const truffleAssert = require('truffle-assertions');

const ExchangeWithOrionPool = artifacts.require("ExchangeWithOrionPool");
const WETH9 = artifacts.require("WETH9");
const Orion = artifacts.require("Orion");
let USDT = artifacts.require("USDT");
let PriceOracle = artifacts.require("PriceOracle");

const LibValidator = artifacts.require("LibValidator");
const MarginalFunctionality = artifacts.require("MarginalFunctionality");

const OrionPoolRouter = artifacts.require("OrionPoolV2Router02Ext");
const Factory = artifacts.require("OrionPoolV2Factory");
const OrionPoolLibrary = artifacts.require("OrionPoolV2Library");
const Pair = artifacts.require("OrionPoolV2Pair");

let exchangeWithOrionPool, router, orion, usdt, weth9, priceOracle, lib, marginalFunctionality, matcher, factory;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const FEE_DIVIDER = 0.998;

//  Just random address
const FAKE_TOKEN_ADDRESS = '0x32Be343B94f860124dC4fEe278FDCBD38C102D88';

//  Widely-used ethalon ORN/USDT price
const QUOTE_ORN_USDT = 15.0;
const ORN_SUPPLY = 100;

const QUOTE_ETH_USDT = 3000.0;
const ETH_SUPPLY = 5.0;


const chai = require('chai');

require("chai")
    .use(require("chai-shallow-deep-equal"))
    .use(require("chai-as-promised"))
    .should();

//  Precision = 0.1%
chai.Assertion.addMethod('bnEqualsPrecise', function (type) {
    //  var obj = this._obj;

    //  new chai.Assertion(this._obj).to.be.instanceof(BN); // OKk
    //  new chai.Assertion(typeof this._obj.toString()).to.be.a('string'); // OK

    var b = new BN(type);
    var a = new BN(this._obj);

    let zero = new BN('0');

    if(a.eq(zero) || b.eq(zero))
    {
        new chai.Assertion(a.eq(b)).eql(true, "'"+a.toString() + "' should be equal to '" + b.toString()+"'");
    }
    else
    {
        //  10^12 is enough
        //  Both are non-zero
        let ratio = a.mul(new BN ('1000000000000')).div(b);

        new chai.Assertion(
            ratio.gt(new BN('999000000000')) && ratio.lt(new BN('1001000000000'))
        ).eql(true, a.toString() + " should be almost equal to " + b.toString());
    }
});

//  Precision = 1%
chai.Assertion.addMethod('bnEquals', function (type) {
    //  var obj = this._obj;

    //  new chai.Assertion(this._obj).to.be.instanceof(BN); // OKk
    //  new chai.Assertion(typeof this._obj.toString()).to.be.a('string'); // OK

    var b = new BN(type);
    var a = new BN(this._obj);

    let zero = new BN('0');

    if(a.eq(zero) || b.eq(zero))
    {
        new chai.Assertion(a.eq(b)).eql(true, "'"+a.toString() + "' should be equal to '" + b.toString()+"'");
    }
    else
    {
        //  10^12 is enough
        //  Both are non-zero
        let ratio = a.mul(new BN ('1000000000000')).div(b);

        new chai.Assertion(
            ratio.gt(new BN('990000000000')) && ratio.lt(new BN('1010000000000'))
        ).eql(true, a.toString() + " should be almost equal to " + b.toString());
    }
});

function ToBN(doubleVal, digits)
{
    const multiplier = 1e9;
    let nom = new BN(Math.round(doubleVal * multiplier).toString()).mul( new BN('10').pow(new BN(digits)) );
    let dv = new BN(multiplier);
    return nom.div(dv);
}

function ToORN(ornVal) { return ToBN(ornVal, 8);}
function ToWETH(ornVal) { return ToBN(ornVal, 18);}
function ToUSDT(ornVal) { return ToBN(ornVal, 6);}

//  Any exchange amount is 8-digits
function ToExchAny(val) { return ToBN(val, 8);}

function GasToORN(gas_val)
{
    //  Assume that gas price is 300 GWei, and ETH / ORN ratio is 3000 / 15 = 200
    let fee_in_wei = (new BN(gas_val * 300)).mul(new BN(1e9));

    //  In fact, the fee * 200 * 10^8 / 10^18 = fee  * 200 / 10^10
    return fee_in_wei.mul(new BN(200)).div(new BN(1e10));
}

async function BurnORN(wallet)
{
    let balance = (await orion.balanceOf(wallet)).toString();
    await orion.transfer('0xDc966DCB447004dF677c8A509dd24A070AE93Bf2', balance, {from: wallet}).should.be.fulfilled;
}

async function BurnUSDT(wallet)
{
    let balance = (await usdt.balanceOf(wallet)).toString();
    await usdt.transfer('0xDc966DCB447004dF677c8A509dd24A070AE93Bf2', balance, {from: wallet}).should.be.fulfilled;
}

//  Calculates ASK for ORN/USDT by constants given below, and
//  then amount in (how many we should give for BUY order)
//      1.1 buy price (ask) for desired_buy_orn will be
//          y / (x - v) = 1500 / (100 - 13) = 17,24137931
//      With commission, it would be 17,24137931 / 0,998 = 17,275931172690
//  2. Multiplying it to desired_buy_orn - we'll get the actual ORN price

function CalcAmountIn(desired_buy_orn)
{
    return (ORN_SUPPLY * QUOTE_ORN_USDT / (ORN_SUPPLY - desired_buy_orn))   //  y / (x - v)
        / FEE_DIVIDER       //  with commissiom
        * desired_buy_orn   //  Get the actual amount
}

//  For some tests, we'll need the bid price
function CalcBid(desired_sell_orn)
{
    return (ORN_SUPPLY * QUOTE_ORN_USDT / (ORN_SUPPLY + desired_sell_orn))   //  y / (x - v)
        * FEE_DIVIDER;
}

contract("ExchangeWithOrionPool", ([owner, broker, user1, balancer, user4]) => {
    describe("OrionPool::instance", () => {
    before(async function () {
    });

      it("Create pair", async () => {
          const gas_in_orn = GasToORN(300000);

          exchangeWithOrionPool = await ExchangeWithOrionPool.deployed();
          orion = await Orion.deployed();
          usdt = await USDT.deployed();
          weth9 = await WETH9.deployed(); //new("Wrapped Ethereum", "WETH", web3.utils.toWei("10000000"), 18);
          factory = await Factory.deployed();
          router = await OrionPoolRouter.deployed();

          priceOracle = await PriceOracle.deployed();
          matcher = owner;

          let orionMint = ToORN(10000);
          let usdtMint = ToUSDT(800000);
          //    let wethMint = ToWETH(800);

          await orion.mint(owner, orionMint, { from: owner }).should.be.fulfilled;
          await usdt.mint(owner, usdtMint, { from: owner }).should.be.fulfilled;
          //    await weth9.mint(owner, wethMint, { from: owner }).should.be.fulfilled;

          //    For out 'balancing' user - mint some tokens
          await orion.mint(balancer, ToORN(100000000), { from: owner }).should.be.fulfilled;
          await usdt.mint(balancer, ToUSDT(10000000), { from: owner }).should.be.fulfilled;
          //    await weth9.mint(balancer, ToWETH(1000000), { from: owner }).should.be.fulfilled;

          //    Approve everything as ~uint256 (10^76)
          await orion.approve(router.address, ToBN(1, 76), {from: owner}).should.be.fulfilled;
          await usdt.approve(router.address, ToBN(1, 76), {from: owner}).should.be.fulfilled;
          //    await weth9.approve(router.address, ToBN(1, 76), {from: owner}).should.be.fulfilled;

          //    To balancer as well
          await orion.approve(router.address, ToBN(1, 76), {from: balancer}).should.be.fulfilled;
          await usdt.approve(router.address, ToBN(1, 76), {from: balancer}).should.be.fulfilled;
          //    await weth9.approve(router.address, ToBN(1, 76), {from: balancer}).should.be.fulfilled;
          await orion.approve(router.address, ToBN(1, 76), {from: matcher}).should.be.fulfilled;
          await usdt.approve(router.address, ToBN(1, 76), {from: matcher}).should.be.fulfilled;
          //    await weth9.approve(router.address, ToBN(1, 76), {from: matcher}).should.be.fulfilled;

          //    And exchange bot all users
          await orion.approve(exchangeWithOrionPool.address, ToBN(1, 76), {from: owner}).should.be.fulfilled;
          await usdt.approve(exchangeWithOrionPool.address, ToBN(1, 76), {from: owner}).should.be.fulfilled;
          //    await weth9.approve(exchangeWithOrionPool.address, ToBN(1, 76), {from: owner}).should.be.fulfilled;
          await orion.approve(exchangeWithOrionPool.address, ToBN(1, 76), {from: user1}).should.be.fulfilled;
          await usdt.approve(exchangeWithOrionPool.address, ToBN(1, 76), {from: user1}).should.be.fulfilled;
          //    await weth9.approve(exchangeWithOrionPool.address, ToBN(1, 76), {from: user1}).should.be.fulfilled;
          await orion.approve(exchangeWithOrionPool.address, ToBN(1, 76), {from: matcher}).should.be.fulfilled;
          await usdt.approve(exchangeWithOrionPool.address, ToBN(1, 76), {from: matcher}).should.be.fulfilled;
          //    await weth9.approve(exchangeWithOrionPool.address, ToBN(1, 76), {from: matcher}).should.be.fulfilled;

          await factory.createPair(orion.address, usdt.address);

          //    ETH/USDT pair
          await factory.createPair(weth9.address, usdt.address);
          //    await factory.createPair(weth9.address, usdt.address);
          //    await factory.createPair(weth9.address, orion.address);
      });
  });
  describe("OrionPool::Exchanges", () => {

      it("Adding liquidity to ORN/USDT (ORN=15 USDT), checking rates", async () => {

        let orn_to_pool = ToORN(ORN_SUPPLY);
        let usdt_to_pool = ToUSDT(ORN_SUPPLY * QUOTE_ORN_USDT);

        //  Adding liquidity to set the
        await router.addLiquidity(orion.address, usdt.address,
            orn_to_pool.toString(), usdt_to_pool.toString(),
            orn_to_pool.toString(), usdt_to_pool.toString(),
            owner,
            await ChainManipulation.getBlokchainTime() + 100000,
            {from: owner, gas: 6e6 }
        ).should.be.fulfilled;

        //  Get pair address
        let pair = await factory.getPair(orion.address, usdt.address);
        pair.should.not.be.equal(ZERO_ADDRESS);
        //  BTW check that non-existend pair gives zero
        (await factory.getPair(orion.address, FAKE_TOKEN_ADDRESS)).should.be.equal(ZERO_ADDRESS);
        //  BTW check that reverse pair address is the same
        pair.should.be.equal(await factory.getPair(usdt.address, orion.address));

        //  Pair address to interact with
        let ornUsdt = await Pair.at(pair);

        let reserves = await ornUsdt.getReserves().should.be.fulfilled;

        //  We need reserves[0] be ORN.
        //      Depending of token address, token0() could be ORN or USDT
        //      If it's USDT - just swap the reserves
        if((await ornUsdt.token0()) === usdt.address)
        {
            let tmp = reserves[0];
            reserves[0] = reserves[1];
            reserves[1] = tmp;
        }

        //  And check them
        reserves[0].toString().should.be.equal(orn_to_pool.toString());     //  x
        reserves[1].toString().should.be.equal(usdt_to_pool.toString());    //  y

        const desired_buy_orn = 13;

        let virtual_usdt_amount = await router.getAmountIn(
            ToORN(desired_buy_orn).toString(),
            reserves[1].toString(), //  USDT
            reserves[0].toString()  //  ORN
        );

        virtual_usdt_amount.should.be.bnEqualsPrecise(
            ToUSDT(CalcAmountIn(desired_buy_orn))
        );
    });

      it("Sanity checking that swapTokensForExactTokens won't get more than amountInMax", async () => {
          let ornUsdt = await Pair.at(await factory.getPair(orion.address, usdt.address));
          let reserves = await ornUsdt.getReserves().should.be.fulfilled;
          if((await ornUsdt.token0()) === usdt.address)
            { let tmp = reserves[0]; reserves[0] = reserves[1]; reserves[1] = tmp; }

          // Let's buy 17 ORN
          let desired_buy_orn = ToORN(13);

          let virtual_usdt_amount = await router.getAmountIn(
              desired_buy_orn.toString(),
              reserves[1].toString(), //  USDT
              reserves[0].toString()  //  ORN
          );

          let usdt_addition = ToUSDT(33);
          let increased_usdt_amount = virtual_usdt_amount.add(usdt_addition);

          //    Clean our 'owner'
          await BurnORN(owner);
          await BurnUSDT(owner);

          //    And mint just USDT amount
          await usdt.mint(owner, increased_usdt_amount).should.be.fulfilled;

          //    Let's change
          await router.swapTokensForExactTokens(
                desired_buy_orn,
                increased_usdt_amount,
                [usdt.address, orion.address],
                owner,
                await ChainManipulation.getBlokchainTime() + 100000,
                {from: owner, gas: 6e6 }
          ).should.be.fulfilled;

          //  Check balances of owner
          (await orion.balanceOf(owner)).toString().should.be.equal(desired_buy_orn.toString());
          (await usdt.balanceOf(owner)).toString().should.be.equal(usdt_addition.toString());

          //    Make reverse change (to make price again AROUND 15)
          await router.swapExactTokensForTokens(
              desired_buy_orn,
              1,    //  No matter how many we'll take
              [orion.address, usdt.address],
              balancer,
              await ChainManipulation.getBlokchainTime() + 100000,
              {from: balancer, gas: 6e6 }
          ).should.be.fulfilled;

          //    Get price
          reserves = await ornUsdt.getReserves();
          //    console.log("reserves = ", reserves[0].toString(), reserves[1].toString())
      });


      it("Create buy order via fillThroughOrionPool (at worst price, low matcher fee)", async () => {

          let ornUsdt = await Pair.at(await factory.getPair(orion.address, usdt.address));

          //  TODO:  Sanity check. Check that QUOTE_ORN_USDT is still the same (15)

          //    User should deposit some ORN and USDT
          //    Create order
          //    Want to buy 13 ORN for USDT
          const buy_orn = 13;

          //    And our price.. let it be be really bad
          const price = 20.0;

          const price_bn = ToBN(price, 8);  //  All prices are 8-digits

          const usdt_amount = ToUSDT(buy_orn * price);
          //    We deposit to exchange exactly desired amount of USDT
          await usdt.mint(user1, usdt_amount).should.be.fulfilled;
          await exchangeWithOrionPool.depositAsset(usdt.address, usdt_amount,
              {from: user1}).should.be.fulfilled;

          //    And ORN - exactly for fee payment
          let orn_gas_fee = GasToORN(6e5);
          //    And ORN as 0.2% of order size
          let orn_matcher_fee = ToORN(buy_orn * 0.002);
          let order_total_fee = orn_gas_fee.add(orn_matcher_fee);

          //    And our fee - let it be
          let buyOrder  = await orders.generateOrder(user1, matcher, 1,
              orion, usdt, orion,
              ToExchAny(buy_orn).toString(),
              price_bn.toString(),
              order_total_fee.toString()
          );

          //    Let's do exchange
          //    We "forgot" to mint+deposit the fee in ORN, so it should fail
          await exchangeWithOrionPool.fillThroughOrionPool(
              buyOrder.order,
              buyOrder.order.amount,
              buyOrder.order.matcherFee,
              [usdt.address, orion.address],
              { from: matcher }
          ).should.not.be.fulfilled;

          await orion.mint(user1, order_total_fee).should.be.fulfilled;
          await exchangeWithOrionPool.depositAsset(orion.address, order_total_fee,
              {from: user1}).should.be.fulfilled;

          //    Save the matcher balance (on exchange)
          let matcher_orn_balance_before_order = await exchangeWithOrionPool.getBalance(orion.address, matcher);
          let user1_orn_balance_before_order = await exchangeWithOrionPool.getBalance(orion.address, user1);
          let user1_usdt_balance_before_order = await exchangeWithOrionPool.getBalance(usdt.address, user1);


          //    Now it will be OK. And we will pass only gas fee (not who;e fee_
          await exchangeWithOrionPool.fillThroughOrionPool(
              buyOrder.order,
              buyOrder.order.amount,
              orn_gas_fee.toString(),
              [usdt.address, orion.address],
              { from: matcher }
          ).should.be.fulfilled;

          //    console.log("orn_gas_fee = ", orn_gas_fee.toString());
          //    console.log("orn_matcher_fee = ", orn_matcher_fee.toString());

          //    Let's see what we have there.
          //    1. Matcher should only take "gas fee"
          (await exchangeWithOrionPool.getBalance(orion.address, matcher) - matcher_orn_balance_before_order)
              .toString().should.be.equal(orn_gas_fee.toString());

          //    2. user1 should receive buy_orn minus gas fee
          //    TODO! Check why it could be negative balance
          (await exchangeWithOrionPool.getBalance(orion.address, user1) - user1_orn_balance_before_order)
              .toString().should.be.equal(ToORN(buy_orn).sub(orn_gas_fee).toString());

          //    3. user1 should give away ABOUT (buy_orn * actual_quote) in USDT.
          //        Knowing 
          (user1_usdt_balance_before_order - await exchangeWithOrionPool.getBalance(usdt.address, user1))
              .should.be.bnEquals(ToExchAny(CalcAmountIn(buy_orn)));

          //    NB that actually we bought ORN n ot by 20.0 USDT, but rather at ~17.3
          //    Make reverse change (to make price again AROUND 15)
          await router.swapExactTokensForTokens(
              ToExchAny(buy_orn),
              1,    //  No matter how many we'll take
              [orion.address, usdt.address],
              balancer,
              await ChainManipulation.getBlokchainTime() + 100000,
              {from: balancer, gas: 6e6 }
          ).should.be.fulfilled;
      });

      it("Create sell order via fillThroughOrionPool (and pers.sign)", async () => {
          //    Want to sell 13 ORN for USDT
          //    Mint enough ORN
          await orion.mint(user1, ToORN(10000), { from: owner }).should.be.fulfilled;
          await exchangeWithOrionPool.depositAsset(orion.address, ToORN(10000),
              {from: user1}).should.be.fulfilled;

          const sell_orn = 17;

          //    TODO: We'll carefully calculate price there
          let price = 20.0;
          let price_bn = ToBN(price, 8);

          //    No care about fee there
          const order_total_fee = ToORN(1);

          let sellOrder;
          sellOrder = await orders.generateOrder(user1, matcher, 0,
              orion, usdt, orion,
              ToExchAny(sell_orn).toString(),
              price_bn.toString(),
              order_total_fee.toString()
          );

          let tx_receipt;

          //    This should fail - as price=20 is unreachable
          //        In new version it WILL be executed, but with 0 amount
          tx_receipt = await exchangeWithOrionPool.fillThroughOrionPool(
              sellOrder.order,
              sellOrder.order.amount,
              sellOrder.order.matcherFee,
              [orion.address, usdt.address],
              { from: matcher }
          ).should.be.fulfilled;

          truffleAssert.eventEmitted(tx_receipt, 'NewTrade', (ev) => {
              return ev.filledAmount.toString() === '0';
          });

          //    Now let's calculate price for sell order
          price = CalcBid(sell_orn);

          //    And if price_bn is greater by 1% - order would not be executed
          //        In new version it WILL be executed, but with 0 amount
          price_bn = ToBN(price, 8).mul(new BN(101)).div(new BN(100));

          sellOrder = await orders.generateOrder(user1, matcher, 0,
              orion, usdt, orion,
              ToExchAny(sell_orn).toString(),
              price_bn.toString(),
              order_total_fee.toString()
          );

          //
          let prev_orn_balance = await exchangeWithOrionPool.getBalance(orion.address, matcher);
          let prev_usdt_balance = await exchangeWithOrionPool.getBalance(usdt.address, matcher);

          tx_receipt = await exchangeWithOrionPool.fillThroughOrionPool(
              sellOrder.order,
              sellOrder.order.amount,
              sellOrder.order.matcherFee,
              [orion.address, usdt.address],
              { from: matcher }
          ).should.be.fulfilled

          truffleAssert.eventEmitted(tx_receipt, 'NewTrade', (ev) => {
              return ev.filledAmount.toString() === '0';
          });

          //    Sanity checking that no tokens were moved (only ORN fee)
          (await exchangeWithOrionPool.getBalance(usdt.address, matcher)).should.bnEquals(prev_usdt_balance);
          (await exchangeWithOrionPool.getBalance(orion.address, matcher)).sub(prev_orn_balance).should.bnEquals(order_total_fee);

          //    But if it's not greater than - the order would be executed
          price_bn = ToBN(price, 8);

          let sellOrderPersonalSign = await orders.generateOrderPersonalSign(user1, matcher, 0,
              orion, usdt, orion,
              ToExchAny(sell_orn).toString(),
              price_bn.toString(),
              order_total_fee.toString()
          );

          let user1_orn_balance_before_order = await exchangeWithOrionPool.getBalance(orion.address, user1);
          let user1_usdt_balance_before_order = await exchangeWithOrionPool.getBalance(usdt.address, user1);

          await exchangeWithOrionPool.fillThroughOrionPool(
              sellOrderPersonalSign,
              sellOrderPersonalSign.amount,
              sellOrderPersonalSign.matcherFee,
              [orion.address, usdt.address],
              { from: matcher }
          ).should.be.fulfilled;

          //    So, user1 would sell exact sell_orn tokens
          (user1_orn_balance_before_order - await exchangeWithOrionPool.getBalance(orion.address, user1))
              .toString().should.be.equal(ToORN(sell_orn).add(order_total_fee).toString());

          //    And USDT
          (await exchangeWithOrionPool.getBalance(usdt.address, user1) - user1_usdt_balance_before_order)
              .should.be.bnEquals(ToExchAny(price * sell_orn));

          //    TODO: make revert order
      });

      it("Check partial fills and overflows", async () => {
          await orion.mint(user1, ToORN(100), { from: owner }).should.be.fulfilled;
          await exchangeWithOrionPool.depositAsset(orion.address, ToORN(100),
              {from: user1}).should.be.fulfilled;

          const sell_orn = 2;

          //    Minimum possible sell price
          //        Just to not suffer from quotes
          const price_bn = new BN(1);

          //    No care about fee there
          const order_total_fee = ToORN(1);

          let sellOrder;
          sellOrder = await orders.generateOrder(user1, matcher, 0,
              orion, usdt, orion,
              ToExchAny(sell_orn).toString(),
              price_bn.toString(),
              order_total_fee.toString()
          );

          //  Get previous balance of user1 in ORN
          let prev_balance_in_orn = await exchangeWithOrionPool.getBalance(orion.address, user1);

          await exchangeWithOrionPool.fillThroughOrionPool(
              sellOrder.order,
              ToExchAny(sell_orn / 2).toString(),
              order_total_fee.toString(),
              [orion.address, usdt.address],
              { from: matcher }
          ).should.be.fulfilled;

          await exchangeWithOrionPool.fillThroughOrionPool(
              sellOrder.order,
              ToExchAny(sell_orn / 2).toString(),
              order_total_fee.toString(),
              [orion.address, usdt.address],
              { from: matcher }
          ).should.be.fulfilled;

          await exchangeWithOrionPool.fillThroughOrionPool(
              sellOrder.order,
              ToExchAny(sell_orn / 2).toString(),
              order_total_fee.toString(),
              [orion.address, usdt.address],
              { from: matcher }
          ).should.not.be.fulfilled;

          let balance_diff = prev_balance_in_orn.sub(await exchangeWithOrionPool.getBalance(orion.address, user1));

          //    It should be size of order + double-commission
          balance_diff.should.be.bnEquals(order_total_fee.mul(new BN(2)).add(ToORN(sell_orn)));
      });

      it("Check ORN-ETH (native token)", async () => {
          //  Adding liquidity to ORN-ETH
          //    Let 1 ETH will be 100 ORN
          let eth_to_pool = ToWETH(1);
          let orion_to_pool = ToORN(100);
          let orn_deposit_amount = ToORN(12);
          let orn_order_amount = ToExchAny(10);

          //    Approve router
          //    await orion.approve()
          //    await orion.approve(router.address, ToBN(1, 76), {from: owner}).should.be.fulfilled;
          await orion.mint(owner, orion_to_pool, { from: owner }).should.be.fulfilled;

          await router.addLiquidityETH(orion.address,
              orion_to_pool.toString(), orion_to_pool.toString(),
              eth_to_pool.toString(),
              owner,
              await ChainManipulation.getBlokchainTime() + 100000,
              {value: eth_to_pool.toString(), from: owner, gas: 6e6}
          ).should.be.fulfilled;

          //    Deposit 10 ORN from user1 and make order
          await orion.mint(user1, orn_deposit_amount.toString(), {from: owner});
          await exchangeWithOrionPool.depositAsset(orion.address, orn_deposit_amount,
              {from: user1}).should.be.fulfilled;

          //    Make order (SELL 10 ORN for X eth)
          let buyOrder  = await orders.generateOrder(user1, matcher, 0,
              orion,  {address: ZERO_ADDRESS}, orion,
              orn_order_amount.toString(),
              100,  //  Min possible price (about 0.000001)
              '1000'    //  Fee Not important
          );

          await exchangeWithOrionPool.fillThroughOrionPool(
              buyOrder.order,
              orn_order_amount.toString(),
              '1000',
              [orion.address,ZERO_ADDRESS],
              { from: matcher }
          ).should.be.fulfilled;
      });
  });
});
