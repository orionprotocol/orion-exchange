require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

const sigUtil = require("eth-sig-util");

const Exchange = artifacts.require("Exchange");
const WETH = artifacts.require("WETH");
const WBTC = artifacts.require("WBTC");

let exchange, weth, wbtc, msgParams1, msgParams2, buyOrder, sellOrder;

async function getLastTradeEvent(buyer, seller) {
  let events = await exchange.getPastEvents("NewTrade", {
    buyer,
    seller
  });

  return events[0].returnValues;
}

contract("Exchange", ([matcher, user1, user2]) => {
  describe("Exchange::instance", async () => {
    exchange = await Exchange.deployed();
    weth = await WETH.deployed();
    wbtc = await WBTC.deployed();
  });

  describe("Exchange::orders creation", () => {
    it("user1 deposits 10 WBTC to exchange", async () => {
      await wbtc.mint(user1, String(10e8), { from: matcher }).should.be
        .fulfilled;
      await wbtc.approve(exchange.address, String(10e8), {
        from: user1
      });
      await exchange.depositAsset(wbtc.address, String(10e8), {
        from: user1
      }).should.be.fulfilled;

      let balanceAsset = await exchange.getBalance(wbtc.address, user1);
      balanceAsset.toString().should.be.equal(String(10e8));
    });

    it("user2 deposits 10 WETH to exchange", async () => {
      await weth.mint(user2, web3.utils.toWei("10"), { from: matcher }).should
        .be.fulfilled;

      await weth.approve(exchange.address, web3.utils.toWei("10"), {
        from: user2
      });

      await exchange.depositAsset(weth.address, web3.utils.toWei("10"), {
        from: user2
      }).should.be.fulfilled;

      let balanceAsset = await exchange.getBalance(weth.address, user2);
      balanceAsset.toString().should.be.equal(String(10e8));
    });

    it("buy order creation and sign", async () => {
      // Ganache user 1 pirvate key using fake mnemonics
      const privKey1 =
        "c09ae3abc13c501fb9ff1c3c8ad3256678416f73a41433411f1714ae7b547fe3";
      const privKey = Buffer.from(privKey1, "hex");

      const nowTimestamp = 1571843003887; //Date.now();

      //Client1 Order
      buyOrder = {
        senderAddress: user1,
        matcherAddress: matcher,
        baseAsset: weth.address, // WETH
        quoteAsset: wbtc.address, // WBTC
        matcherFeeAsset: wbtc.address, // WBTC
        amount: 350000000, //3.5 ETH * 10^8
        price: 2100000, //0.021 WBTC/WETH * 10^8
        matcherFee: 350000,
        nonce: nowTimestamp,
        expiration: nowTimestamp + 29 * 24 * 60 * 60 * 1000, // milliseconds
        side: "buy"
      };

      let msgParams = [
        { type: "uint8", name: "version", value: 3 },
        {
          name: "senderAddress",
          type: "address",
          value: buyOrder.senderAddress
        },
        {
          name: "matcherAddress",
          type: "address",
          value: buyOrder.matcherAddress
        },
        { name: "baseAsset", type: "address", value: buyOrder.baseAsset },
        { name: "quoteAsset", type: "address", value: buyOrder.quoteAsset },
        {
          name: "matcherFeeAsset",
          type: "address",
          value: buyOrder.matcherFeeAsset
        },
        { name: "amount", type: "uint64", value: buyOrder.amount },
        { name: "price", type: "uint64", value: buyOrder.price },
        { name: "matcherFee", type: "uint64", value: buyOrder.matcherFee },
        { name: "nonce", type: "uint64", value: buyOrder.nonce },
        { name: "expiration", type: "uint64", value: buyOrder.expiration },
        { name: "side", type: "string", value: buyOrder.side }
      ];

      msgParams1 = { data: msgParams };

      // User 1 signs buy Order
      signature1 = sigUtil.signTypedDataLegacy(privKey, msgParams1);

      buyOrder.signature = signature1;
    });

    it("buy order validation in js", async () => {
      const recovered = sigUtil.recoverTypedSignatureLegacy({
        data: msgParams1.data,
        sig: buyOrder.signature
      });

      web3.utils.toChecksumAddress(recovered).should.be.equal(user1);
    });

    it("sell order creation and sign", async () => {
      // Ganache user 1 pirvate key using fake mnemonics
      const privKey2 =
        "ecbcd49667c96bcf8b30ccb35234a0b217ea039a8e097d3a70de9d28624ba520";
      const privKey = Buffer.from(privKey2, "hex");

      const nowTimestamp = 1571843003887; //Date.now();

      //Client2 Order
      sellOrder = {
        senderAddress: user2,
        matcherAddress: matcher,
        baseAsset: weth.address,
        quoteAsset: wbtc.address, // WBTC
        matcherFeeAsset: weth.address, // WETH
        amount: 150000000,
        price: 2000000,
        matcherFee: 150000,
        nonce: nowTimestamp,
        expiration: nowTimestamp + 29 * 24 * 60 * 60 * 1000, // milliseconds
        side: "buy"
      };

      let msgParams = [
        { type: "uint8", name: "version", value: 3 },
        {
          name: "senderAddress",
          type: "address",
          value: sellOrder.senderAddress
        },
        {
          name: "matcherAddress",
          type: "address",
          value: sellOrder.matcherAddress
        },
        { name: "baseAsset", type: "address", value: sellOrder.baseAsset },
        { name: "quoteAsset", type: "address", value: sellOrder.quoteAsset },
        {
          name: "matcherFeeAsset",
          type: "address",
          value: sellOrder.matcherFeeAsset
        },
        { name: "amount", type: "uint64", value: sellOrder.amount },
        { name: "price", type: "uint64", value: sellOrder.price },
        { name: "matcherFee", type: "uint64", value: sellOrder.matcherFee },
        { name: "nonce", type: "uint64", value: sellOrder.nonce },
        { name: "expiration", type: "uint64", value: sellOrder.expiration },
        { name: "side", type: "string", value: sellOrder.side }
      ];

      msgParams2 = { data: msgParams };

      // User 2 signs sell Order
      signature2 = sigUtil.signTypedDataLegacy(privKey, msgParams2);

      sellOrder.signature = signature2;
    });

    it("sell order validation in js", async () => {
      const recovered = sigUtil.recoverTypedSignatureLegacy({
        data: msgParams2.data,
        sig: sellOrder.signature
      });

      web3.utils.toChecksumAddress(recovered).should.be.equal(user2);
    });
  });

  describe("Exchange::fill orders", () => {
    it("validate buy order in exchange contract", async () => {
      let isValid = await exchange.validateV1(buyOrder, { from: matcher });
      isValid.should.be.true;
    });

    it("validate sell order in exchange contract", async () => {
      let isValid = await exchange.validateV1(sellOrder, { from: matcher });
      isValid.should.be.true;
    });

    it("matcher can fill orders", async () => {
      await exchange.fillOrders(
        buyOrder,
        sellOrder,
        2100000, //fill Price 0.021
        150000000, // fill Amount
        { from: matcher }
      ).should.be.fulfilled;

      const event = await getLastTradeEvent(
        buyOrder.senderAddress,
        sellOrder.senderAddress
      );

      event.buyer.should.be.equal(buyOrder.senderAddress);
      event.seller.should.be.equal(sellOrder.senderAddress);
      event.baseAsset.should.be.equal(buyOrder.baseAsset);
      event.filledPrice.should.be.equal(String(2100000));
    });

    it("correct buyer WETH balance after trade", async () => {
      // WETH received = fill amount (150000000)
      let balance = await exchange.getBalance(weth.address, user1);
      balance.toString().should.be.equal(String(1.5e8));
    });

    it("correct buyer WBTC balance after trade", async () => {
      // WBTC deducted = initialbalance - (fillPrice * fillAmount ) - matcherFee
      // WBTC deducted = 10 WBTC - 0.021 WBTC/WETH * 1.5 WETH - 0.0035 WTBC = 9.965 WBTC
      let balance = await exchange.getBalance(wbtc.address, user1);
      balance.toString().should.be.equal(String(9.965e8));
    });

    it("correct seller WETH balance after trade", async () => {
      // WETH deducted = initialBalance- fill amount
      // WETH deducted = 10 WETH - 1.5 WETH - 0.0015 WETH = 8.4985 WETH
      let balance = await exchange.getBalance(weth.address, user2);
      balance.toString().should.be.equal(String(8.4985e8));
    });

    it("correct seller WBTC balance after trade", async () => {
      // WBTC received = (fillPrice * fillAmount )
      // WBTC received = 0.021 WBTC/WETH * 1.5 WETH = 0.0315 WBTC
      let balance = await exchange.getBalance(wbtc.address, user2);
      balance.toString().should.be.equal(String(0.0315e8));
    });

    it("correct total exchange balance in WBTC after trade", async () => {
      // WBTC = depositUser1 - feeMatcher
      // WBTC = 10WBTC - 0.0035 WBTC
      let WBTCbalance = await wbtc.balanceOf(exchange.address);
      WBTCbalance.toString().should.be.equal(String(10e8 - 0.0035e8));
    });

    it("correct total exchange balance in WETH after trade", async () => {
      // WETH = depositUser2 - feeMatcher
      // WETH = 10WETH - 0.0015 WETH
      let WETHbalance = await weth.balanceOf(exchange.address);
      WETHbalance.toString().should.be.equal(String(10e18 - 0.0015e18));
    });

    it("correct matcher fee in WETH", async () => {
      let WETHbalance = await weth.balanceOf(matcher);
      WETHbalance.toString().should.be.equal(String(0.0015e18)); // 0.0015 WETH
    });

    it("correct matcher fee in WBTC", async () => {
      let WBTCbalance = await wbtc.balanceOf(matcher);
      WBTCbalance.toString().should.be.equal(String(0.0035e8));
    });
  });
});
