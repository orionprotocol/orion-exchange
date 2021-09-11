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

          it("Swap through Orion Pool (base)", async () => {

              let orn_to_pool = ToORN(ORN_SUPPLY);
              let usdt_to_pool = ToUSDT(ORN_SUPPLY * QUOTE);

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

              const usdt_amount_before = 10000

              //  Mint and deposit 1000
              await usdt.mint(user1, ToUSDT(usdt_amount_before), { from: owner }).should.be.fulfilled;

              await exchangeWithOrionPool.depositAsset(usdt.address, ToUSDT(usdt_amount_before),
                  {from: user1}).should.be.fulfilled;

              let tx_receipt;
              tx_receipt = await exchangeWithOrionPool.swapThroughOrionPool(
                  ToExchAny(1000),    //  No matter how to spend
                  ToExchAny(13),      //  Exactly 13 ORN
                  [usdt.address, orion.address],
                  false,                   //  Exactly receive, not spend
                  {from: user1, gas: 6e6 }
              ).should.be.fulfilled;

              truffleAssert.eventEmitted(tx_receipt, 'NewSwapOrionPool', (ev) => {
                  return ev.amount_received.toString() === ToExchAny(13).toString();
              });

              tx_receipt = await exchangeWithOrionPool.swapThroughOrionPool(
                  ToExchAny(1000),    //  Much less than needed
                  ToExchAny(1),      //  Exactly 1 ORN
                  [usdt.address, orion.address],
                  false,                   //  Exactly receive, not spend
                  {from: user1, gas: 6e6 }
              ).should.be.fulfilled;

              tx_receipt = await exchangeWithOrionPool.swapThroughOrionPool(
                  ToExchAny(1),    //  Much less than needed
                  ToExchAny(10),      //  Exactly 10 ORN
                  [usdt.address, orion.address],
                  false,                   //  Exactly receive, not spend
                  {from: user1, gas: 6e6 }
              ).should.not.be.fulfilled;

              //  Now let's change back exact out 14 tokens (succesfully swapped before)
              tx_receipt = await exchangeWithOrionPool.swapThroughOrionPool(
                  ToExchAny(14),    //  Exactly 13+1 = 14 ORN
                  ToExchAny(1),      //  to any amount of USDT
                  [orion.address, usdt.address],
                  true,                   //  Exactly spend, not receive
                  {from: user1, gas: 6e6 }
              ).should.be.fulfilled;

              //  And now we should have 0 orn at exchange contract itself....
              (await orion.balanceOf(exchangeWithOrionPool.address)).toString().should.be.equal('0');

              //  And balance of user1 in ORN shoule be also equal to 0
              (await exchangeWithOrionPool.getBalance(orion.address, user1)).toString().should.be.equal('0');

              //  And what's the difference :)
              let usdt_exchange_balance = await exchangeWithOrionPool.getBalance(usdt.address, user1);
              let usdt_contract_balance = (await usdt.balanceOf(exchangeWithOrionPool.address)).mul(new BN(100));

              usdt_exchange_balance.should.bnEquals(usdt_contract_balance);
          });

          it("Cannot exchange staked ORNs", async () => {
              //  After prev test we have 0 ORN.
              //      So, let's mint, deposit and stake

              let total_orn = 100;
              let staked_orn = 90;

              await orion.mint(user1, ToORN(100000000), { from: owner }).should.be.fulfilled;

              await exchangeWithOrionPool.depositAsset(orion.address, ToORN(total_orn),
                  {from: user1}).should.be.fulfilled;

              await exchangeWithOrionPool.lockStake(ToExchAny(staked_orn),
                  {from: user1}).should.be.fulfilled;

              //  Should not allow to sell 20 ORN
              let tx_receipt;

              tx_receipt = await exchangeWithOrionPool.swapThroughOrionPool(
                  ToExchAny(20),
                  ToExchAny(1),      //  to any amount of USDT
                  [orion.address, usdt.address],
                  true,                  //  Exactly spend, not receive
                  {from: user1, gas: 6e6 }
              ).should.not.be.fulfilled;

              //  But allow to sell 10
              tx_receipt = await exchangeWithOrionPool.swapThroughOrionPool(
                  ToExchAny(10),
                  ToExchAny(1),      //  to any amount of USDT
                  [orion.address, usdt.address],
                  true,                  //  Exactly spend, not receive
                  {from: user1, gas: 6e6 }
              ).should.be.fulfilled;

              //  And NOT even 1 ORN
              tx_receipt = await exchangeWithOrionPool.swapThroughOrionPool(
                  ToExchAny(10),
                  ToExchAny(1),      //  to any amount of USDT
                  [orion.address, usdt.address],
                  true,                  //  Exactly spend, not receive
                  {from: user1, gas: 6e6 }
              ).should.not.be.fulfilled;
          });

      it("Check ETH liquidity adding...", async () => {
          let eth_to_pool = ToWETH(ETH_SUPPLY);
          let usdt_to_pool = ToUSDT(ETH_SUPPLY * QUOTE_ETH_USDT);

          //
          await BurnUSDT(owner);
          await usdt.mint(owner, usdt_to_pool, {from: owner}).should.be.fulfilled;

          //    console.log((await web3.eth.getBalance(owner)).toString());

          //  Adding liquidity to set the
          await router.addLiquidityETH(usdt.address,
              usdt_to_pool.toString(), usdt_to_pool.toString(),
              eth_to_pool.toString(),
              owner,
              await ChainManipulation.getBlokchainTime() + 100000,
              {value: eth_to_pool.toString(), from: owner, gas: 6e6}
          ).should.be.fulfilled;

          //  Get pair address
          let pair = await factory.getPair(weth9.address, usdt.address);
          pair.should.not.be.equal(ZERO_ADDRESS);
          //  BTW check that non-existend pair gives zero
          (await factory.getPair(weth9.address, FAKE_TOKEN_ADDRESS)).should.be.equal(ZERO_ADDRESS);
          //  BTW check that reverse pair address is the same
          pair.should.be.equal(await factory.getPair(usdt.address, weth9.address));
      });

      it("Swap exact ETH-USDT (through Exchange)", async () => {
          let tx_receipt;

          //  Direct deposit from user should not be fulfilled
          await exchangeWithOrionPool.send(ToWETH(1), {from: user1}).should.not.be.fulfilled;

          //  Deposit some ETH to exchange from user1
          await exchangeWithOrionPool.deposit({from: user1, value: ToWETH(1)}).should.be.fulfilled;

          //  Also make some deposit from balancer (to make sure that Exchange has enough eth)
          await exchangeWithOrionPool.deposit({from: balancer, value: ToWETH(1)}).should.be.fulfilled;

          //  Now let's make sure that user1 CANNOT
          //      exchange more than his 1 ETH
          tx_receipt = await exchangeWithOrionPool.swapThroughOrionPool(
              ToExchAny(1.1),
              1,  //  Not important how much we will receive
              [ZERO_ADDRESS, usdt.address],
              true,   //  Exact spend
              {from: user1, gas: 6e6}
          ).should.not.be.fulfilled;

          tx_receipt = await exchangeWithOrionPool.swapThroughOrionPool(
              ToExchAny(0.9),
              1,  //  Not important how much we will receive
              [ZERO_ADDRESS, usdt.address],
              true,   //  Exact spend
              {from: user1, gas: 6e6}
          ).should.be.fulfilled;

          console.log("gas spent for swap ↓↓↓↓: ", tx_receipt.receipt.gasUsed.toString());
      });

      it("Swap exact USDT-ETH (through Exchange)", async () => {
          let tx_receipt;

          let usdt_amount = 1000;

          //  We need carefully calculate there.
          //    So, withdraw all USDT from exchange
          let user1_usdt_balance = await exchangeWithOrionPool.getBalance(usdt.address, user1);
          //    console.log('user1_usdt_balance', user1_usdt_balance.toString());

          //    We need to withdraw in base units (why?).
          //        So for USDT divide by 100 ('cause we need usdt * 10^6 instead of user * 10^8)
          if (user1_usdt_balance.toString() !== '0')
              await exchangeWithOrionPool.withdraw(usdt.address, user1_usdt_balance.div(new BN(100)), {from: user1});

          //    Now let's deposit the correct sum
          await usdt.mint(user1, ToUSDT(usdt_amount), {from: owner}).should.be.fulfilled;
          await exchangeWithOrionPool.depositAsset(usdt.address, ToExchAny(usdt_amount), {from: user1}).should.be.fulfilled;

          //    First of all - let's check, how much we
          //        CAN receive
          let pair_address = await factory.getPair(usdt.address, weth9.address);
          pair_address.should.not.be.equal(ZERO_ADDRESS);
          let pair = await Pair.at(pair_address);
          let reserves = await pair.getReserves().should.be.fulfilled;

          if((await pair.token0()) === weth9.address)
          {
              let tmp = reserves[0];
              reserves[0] = reserves[1];
              reserves[1] = tmp;
          }

          //    Also we should divide virtual eth amount to 10^10
          let virtual_eth_amount = (await router.getAmountOut(ToUSDT(usdt_amount), reserves[0], reserves[1]))
              .div((new BN(10).pow(new BN(10))));

          let usdt_before = await exchangeWithOrionPool.getBalance(usdt.address, user1).should.be.fulfilled;
          let eth_before = await exchangeWithOrionPool.getBalance(ZERO_ADDRESS, user1).should.be.fulfilled;
          //    Let's swap
          tx_receipt = await exchangeWithOrionPool.swapThroughOrionPool(
              ToExchAny(usdt_amount),
              1,  //  Not important how much we will receive
              [usdt.address, ZERO_ADDRESS],
              true,   //  Exact spend
              {from: user1, gas: 6e6}
          ).should.be.fulfilled;

          //    Check balances again
          let usdt_diff = usdt_before.sub(await exchangeWithOrionPool.getBalance(usdt.address, user1));
          let eth_diff = (await exchangeWithOrionPool.getBalance(ZERO_ADDRESS, user1)).sub(eth_before);

          usdt_diff.should.bnEqualsPrecise(ToExchAny(usdt_amount));
          eth_diff.should.bnEqualsPrecise(virtual_eth_amount);

          console.log("gas spent for swap ↓↓↓↓: ", tx_receipt.receipt.gasUsed.toString());
      });

      it("Swap exact ORN-USDT-ETH (through Exchange)", async () => {
          let tx_receipt;

          let eth_amount = 1;

          //    Deposit 1 ETH
          await exchangeWithOrionPool.deposit({value: ToWETH(eth_amount), from: user1}).should.be.fulfilled;
          //    And 1 ORN
          await orion.mint(user1, ToORN(eth_amount), { from: owner }).should.be.fulfilled;
          await exchangeWithOrionPool.depositAsset(orion.address, ToORN(eth_amount), { from: user1 }).should.be.fulfilled;

          //    To calculate gas cost, we need the ETH balance before
          tx_receipt = await exchangeWithOrionPool.swapThroughOrionPool(
              ToExchAny(eth_amount),
              1,  //  Not important how much we will receive
              [orion.address, usdt.address, ZERO_ADDRESS],
              true,   //  Exact spend
              {from: user1, gas: 6e6}
          ).should.be.fulfilled;

          console.log("gas spent for swap ↓↓↓↓: ", tx_receipt.receipt.gasUsed.toString());
      });

      it("Swap exact ORN-USDT-ETH (through AutoRoute)", async () => {
          let tx_receipt;

          let eth_amount = 1;

          await orion.mint(user1, ToORN(eth_amount), { from: owner }).should.be.fulfilled;
          let eth_balance = await web3.eth.getBalance(user1);
          tx_receipt = await router.swapExactTokensForTokensAutoRoute(
              ToORN(eth_amount),
              1,  //  Not important how much we will receive
              [orion.address, usdt.address, ZERO_ADDRESS],
              user1,   //  Exact spend
              {from: user1, gas: 6e6}
          ).should.be.fulfilled;
          console.log("gas spent for swap ↓↓↓↓: ", tx_receipt.receipt.gasUsed.toString());

          truffleAssert.eventEmitted(tx_receipt, 'OrionPoolSwap', (ev) => {
              return true;
          });
      });

      it("Swap exact ORN-USDT-WETH (through native call)", async () => {
          let tx_receipt;

          let eth_amount = 1;

          await orion.mint(user1, ToORN(eth_amount), { from: owner }).should.be.fulfilled;
          let eth_balance = await web3.eth.getBalance(user1);
          tx_receipt = await router.swapExactTokensForETH(
              ToORN(eth_amount),
              1,  //  Not important how much we will receive
              [orion.address, usdt.address, weth9.address],
              user1,   //  Exact spend
              2000000000,
              {from: user1, gas: 6e6}
          ).should.be.fulfilled;
          console.log("gas spent for swap ↓↓↓↓: ", tx_receipt.receipt.gasUsed.toString());
      });

      it("Swap exact ORN-ETH-USDT (through Exchange)", async () => {
          let eth_to_pool = ToWETH(5);

          let orion_to_pool = ToORN(1000);

          //    Mint ORN to owner
          await orion.mint(owner, orion_to_pool, { from: owner }).should.be.fulfilled;

          //    Adding liquidity to remaining pair
          await router.addLiquidityETH(orion.address,
              orion_to_pool.toString(), orion_to_pool.toString(),
              eth_to_pool.toString(),
              owner,
              await ChainManipulation.getBlokchainTime() + 100000,
              {value: eth_to_pool.toString(), from: owner, gas: 6e6}
          ).should.be.fulfilled;



          let tx_receipt;

          let orn_amount = 10;

          await orion.mint(user1, ToORN(orn_amount), { from: owner }).should.be.fulfilled;
          await exchangeWithOrionPool.depositAsset(orion.address, ToORN(orn_amount), { from: user1 }).should.be.fulfilled;

          //    To calculate gas cost, we need the ETH balance before
          tx_receipt = await exchangeWithOrionPool.swapThroughOrionPool(
              ToExchAny(orn_amount),
              1,  //  Not important how much we will receive
              [orion.address, ZERO_ADDRESS, usdt.address],
              true,   //  Exact spend
              {from: user1, gas: 6e6}
          ).should.be.fulfilled;

          console.log("gas spent for swap ↓↓↓↓: ", tx_receipt.receipt.gasUsed.toString());
      });

      it("Swap exact ORN-ETH-USDT (through native call)", async () => {

          let orion_to_pool = ToORN(100);

          let tx_receipt;

          let orn_amount = 10;

          await orion.mint(user1, ToORN(orn_amount), { from: owner }).should.be.fulfilled;

          //    To calculate gas cost, we need the ETH balance before
          tx_receipt = await router.swapExactTokensForTokensAutoRoute(
              ToORN(orn_amount),
              1,  //  Not important how much we will receive
              [orion.address, usdt.address, weth9.address],
              user1,   //  Exact spend
              {from: user1, gas: 6e6}
          ).should.be.fulfilled;

          console.log("gas spent for swap ↓↓↓↓: ", tx_receipt.receipt.gasUsed.toString());
      });

      ///////////////////////////////////////////////
      //    Checking swap tokens for exact tokens
      it("Swap ORN-ETH-USDT exact (through Exchange)", async () => {
          let tx_receipt;
          //    Mint enough ORN
          let orn_enough_amount = 10000;
          let usdt_receive_amount = 10;

          await orion.mint(user1, ToORN(orn_enough_amount), { from: owner }).should.be.fulfilled;
          await exchangeWithOrionPool.depositAsset(orion.address, ToORN(orn_enough_amount), { from: user1 }).should.be.fulfilled;

          //    Save the balances in orion and usdt before swap
          let usdt_user1_balance = await exchangeWithOrionPool.getBalance(usdt.address, user1);
          let orion_user1_balance = await exchangeWithOrionPool.getBalance(orion.address, user1);
          let usdt_exchange_balance = await usdt.balanceOf(exchangeWithOrionPool.address);
          let orion_exchange_balance = await orion.balanceOf(exchangeWithOrionPool.address);

          //    We want to swap as many ORN as it needed to 10 USDT
          //    To calculate gas cost, we need the ETH balance before
          tx_receipt = await exchangeWithOrionPool.swapThroughOrionPool(
              ToExchAny(orn_enough_amount), //  Not important how much we will spend
              ToExchAny(usdt_receive_amount),  //  We want to receive exact 10 USDT
              [orion.address, ZERO_ADDRESS, usdt.address],
              false,   //  Exact receive
              {from: user1, gas: 6e6}
          ).should.be.fulfilled;

          let usdt_user1_balance_after = await exchangeWithOrionPool.getBalance(usdt.address, user1);
          let orion_user1_balance_after = await exchangeWithOrionPool.getBalance(orion.address, user1);
          let usdt_exchange_balance_after = await usdt.balanceOf(exchangeWithOrionPool.address);
          let orion_exchange_balance_after = await orion.balanceOf(exchangeWithOrionPool.address);

          //    Check that balances were changed to the same value
          //    Also we need to divide usdt (from Exchange) to 100...
          //    F.. this syntax and BN!
          (usdt_user1_balance_after.sub(usdt_user1_balance).div(new BN(100)).toString()).should.be.equal(usdt_exchange_balance_after.sub(usdt_exchange_balance).toString());
          (orion_user1_balance_after.sub(orion_user1_balance).toString()).should.be.equal(orion_exchange_balance_after.sub(orion_exchange_balance).toString());

          //    Also let's check that we've received exactly 10 USDT
          (usdt_user1_balance_after.sub(usdt_user1_balance).div(new BN(100)).toString()).should.be.equal(ToUSDT(usdt_receive_amount).toString());

          //    And that we've spent some ORN
          expect(orion_user1_balance_after.lt(orion_user1_balance)).to.be.true;

          console.log("gas spent for swap ↓↓↓↓: ", tx_receipt.receipt.gasUsed.toString());
      });
  });
});
