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
const FEE_DIVIDER = 0.997;

//  Just random address
const FAKE_TOKEN_ADDRESS = '0x32Be343B94f860124dC4fEe278FDCBD38C102D88';

//  Widely-used ethalon ORN/USDT price
const QUOTE = 15.0;
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
    return (ORN_SUPPLY * QUOTE / (ORN_SUPPLY - desired_buy_orn))   //  y / (x - v)
        / FEE_DIVIDER       //  with commissiom
        * desired_buy_orn   //  Get the actual amount
}

//  For some tests, we'll need the bid price
function CalcBid(desired_sell_orn)
{
    return (ORN_SUPPLY * QUOTE / (ORN_SUPPLY + desired_sell_orn))   //  y / (x - v)
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
          let wethMint = ToWETH(800);

          await orion.mint(owner, orionMint, { from: owner }).should.be.fulfilled;
          await usdt.mint(owner, usdtMint, { from: owner }).should.be.fulfilled;
          //    await weth.mint(owner, wethMint, { from: owner }).should.be.fulfilled;

          //    For out 'balancing' user - mint some tokens
          await orion.mint(balancer, ToORN(100000000), { from: owner }).should.be.fulfilled;
          await usdt.mint(balancer, ToUSDT(10000000), { from: owner }).should.be.fulfilled;
          //    await weth.mint(balancer, ToWETH(1000000), { from: owner }).should.be.fulfilled;

          //    Approve everything as ~uint256 (10^76)
          await orion.approve(router.address, ToBN(1, 76), {from: owner}).should.be.fulfilled;
          await usdt.approve(router.address, ToBN(1, 76), {from: owner}).should.be.fulfilled;
          //    await weth.approve(router.address, ToBN(1, 76), {from: owner}).should.be.fulfilled;

          //    To balancer as well
          await orion.approve(router.address, ToBN(1, 76), {from: balancer}).should.be.fulfilled;
          await usdt.approve(router.address, ToBN(1, 76), {from: balancer}).should.be.fulfilled;
          //    await weth.approve(router.address, ToBN(1, 76), {from: balancer}).should.be.fulfilled;
          await orion.approve(router.address, ToBN(1, 76), {from: matcher}).should.be.fulfilled;
          await usdt.approve(router.address, ToBN(1, 76), {from: matcher}).should.be.fulfilled;
          //    await weth.approve(router.address, ToBN(1, 76), {from: matcher}).should.be.fulfilled;
          await orion.approve(router.address, ToBN(1, 76), {from: user1}).should.be.fulfilled;
          await usdt.approve(router.address, ToBN(1, 76), {from: user1}).should.be.fulfilled;

          //    And exchange bot all users
          await orion.approve(exchangeWithOrionPool.address, ToBN(1, 76), {from: owner}).should.be.fulfilled;
          await usdt.approve(exchangeWithOrionPool.address, ToBN(1, 76), {from: owner}).should.be.fulfilled;
          //    await weth.approve(exchangeWithOrionPool.address, ToBN(1, 76), {from: owner}).should.be.fulfilled;
          await orion.approve(exchangeWithOrionPool.address, ToBN(1, 76), {from: user1}).should.be.fulfilled;
          await usdt.approve(exchangeWithOrionPool.address, ToBN(1, 76), {from: user1}).should.be.fulfilled;
          //    await weth.approve(exchangeWithOrionPool.address, ToBN(1, 76), {from: user1}).should.be.fulfilled;
          await orion.approve(exchangeWithOrionPool.address, ToBN(1, 76), {from: matcher}).should.be.fulfilled;
          await usdt.approve(exchangeWithOrionPool.address, ToBN(1, 76), {from: matcher}).should.be.fulfilled;
          //    await weth.approve(exchangeWithOrionPool.address, ToBN(1, 76), {from: matcher}).should.be.fulfilled;

          await factory.createPair(orion.address, usdt.address);
          await factory.createPair(weth9.address, usdt.address);

          //    Also create WETH/ORION pair to check some cases
          await factory.createPair(weth9.address, orion.address);

          //    await factory.createPair(weth.address, orion.address);
      });
  });
  describe("OrionPool::Exchanges", () => {

          it("Sell BNB/USDT through OrionPool", async () => {

              let orn_to_pool = ToORN(ORN_SUPPLY);
              let usdt_to_pool = ToUSDT(ORN_SUPPLY * QUOTE);

              await usdt.mint(user1, ToUSDT('10000'), { from: owner }).should.be.fulfilled;


              //  Adding liquidity to set the
              await router.addLiquidityETH(usdt.address,
                  '17564395475',
                  '17564395475',
                  '12823859435580473085',
                  owner,
                  await ChainManipulation.getBlokchainTime() + 100000,
                  {from: owner, gas: 6e6, value: '12823859435580473085' }
              ).should.be.fulfilled;

              //    Deposit BNB to exchange
              await exchangeWithOrionPool.deposit({from: user1, value: ToWETH(2)}).should.be.fulfilled;

              await orion.mint(user1, ToORN(25), { from: owner }).should.be.fulfilled;
              await exchangeWithOrionPool.depositAsset(orion.address, ToORN(20),
                  {from: user1}).should.be.fulfilled;

              //    Make order
              let sellOrder  = await orders.generateOrder(user1, matcher, 0,
                  {address: ZERO_ADDRESS}, usdt, orion,
                  ToExchAny(1).toString(),
                  '119316700000',
                  '5000'
              );

              let balance_bnb_before = await web3.eth.getBalance(exchangeWithOrionPool.address);

              let tx_receipt;
              tx_receipt = await exchangeWithOrionPool.fillThroughOrionPool(
                  sellOrder.order,
                  sellOrder.order.amount,
                  sellOrder.order.matcherFee,
                  [ZERO_ADDRESS, usdt.address],
                  { from: matcher }
              ).should.be.fulfilled;

              //    We should have decreased balance in Exchange contract
              let balance_bnb_after = await web3.eth.getBalance(exchangeWithOrionPool.address);

              let diff = (new BN(balance_bnb_before.toString())).sub(new BN(balance_bnb_after.toString()));

              diff.toString().should.be.equals("1000000000000000000");
          });
      });
});
