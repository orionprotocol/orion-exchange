require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

const sigUtil = require("eth-sig-util");

const Exchange = artifacts.require("Exchange");
const WETH = artifacts.require("WETH");
const WBTC = artifacts.require("WBTC");
const LibValidator = artifacts.require("LibValidator");
const domain = [
                 { name: "name", type: "string" },
                 { name: "version", type: "string" },
                 { name: "chainId", type: "uint256" },
                 { name: "salt", type: "bytes32" },
               ];
const domainData = {
          name: "Orion Exchange",
          version: "1",
          chainId: 666,
          salt: "0xf2d857f4a3edcb9b78b4d503bfe733db1e3f6cdc2b7971ee739626c97e86a557",
};
const orderTypes =  [
            { name: "senderAddress", type: "address" },
            { name: "matcherAddress", type: "address" },
            { name: "baseAsset", type: "address" },
            { name: "quoteAsset", type: "address" },
            { name: "matcherFeeAsset", type: "address" },
            { name: "amount", type: "uint64" },
            { name: "price", type: "uint64" },
            { name: "matcherFee", type: "uint64" },
            { name: "nonce", type: "uint64" },
            { name: "expiration", type: "uint64" },
            { name: "side", type: "string" },
];

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"; // WAN or ETH "asset" address in balanaces

let exchange, weth, wbtc, lib, msgParams1, msgParams2, buyOrder, sellOrder;

async function getLastTradeEvent(buyer, seller) {
  let events = await exchange.getPastEvents("NewTrade", {
    buyer,
    seller
  });

  return events[0].returnValues;
}

// Used for fillOrders function
const FILL_AMOUNT = 150000000; // WETH
const FILL_PRICE = 2100000; // 0.021 WBTC/WETH

const NOW = Date.now();

contract("Exchange", ([matcher, user1, user2]) => {
  describe("Exchange::instance", async () => {
    exchange = await Exchange.deployed();
    weth = await WETH.deployed();
    wbtc = await WBTC.deployed();
    lib = await LibValidator.deployed();
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

    it("user1 deposits 1 ETH to exchange", async () => {
      exchange.deposit({ from: user1, value: String(1e18) });

      let balanceAsset = await exchange.getBalance(ZERO_ADDRESS, user1);
      balanceAsset.toString().should.be.equal(String(1e8));
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

    it("user2 deposits 1 ETH to exchange", async () => {
      exchange.deposit({ from: user2, value: String(1e18) });

      let balanceAsset = await exchange.getBalance(ZERO_ADDRESS, user2);
      balanceAsset.toString().should.be.equal(String(1e8));
    });

    it("buy order creation and sign", async () => {
      // Ganache user 1 pirvate key using fake mnemonics
      const privKey1 =
        "c09ae3abc13c501fb9ff1c3c8ad3256678416f73a41433411f1714ae7b547fe3";
      const privKey = Buffer.from(privKey1, "hex");

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
        nonce: NOW,
        expiration: NOW + 29 * 24 * 60 * 60 * 1000, // milliseconds
        side: "buy"
      };

      let msgParams = {
             types: {
               EIP712Domain: domain,
               Order: orderTypes,
             },
             domain: domainData,
             primaryType: "Order",
             message: buyOrder,
           };

      msgParams1 = { data: msgParams };
      // User 1 signs buy Order
      signature1 = sigUtil.signTypedData_v4(privKey, msgParams1);

      buyOrder.signature = signature1;
    });

    it("buy order validation in js", async () => {
      const recovered = sigUtil.recoverTypedSignature_v4({
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

      //Client2 Order
      sellOrder = {
        senderAddress: user2,
        matcherAddress: matcher,
        baseAsset: weth.address,
        quoteAsset: wbtc.address, // WBTC
        // matcherFeeAsset: weth.address, // WETH
        matcherFeeAsset: "0x0000000000000000000000000000000000000000", // WETH

        amount: 150000000,
        price: 2000000,
        matcherFee: 150000,
        nonce: NOW,
        expiration: NOW + 29 * 24 * 60 * 60 * 1000, // milliseconds
        side: "buy"
      };

      let msgParams = {
             types: {
               EIP712Domain: domain,
               Order: orderTypes,
             },
             domain: domainData,
             primaryType: "Order",
             message: sellOrder,
           };

      msgParams2 = { data: msgParams };

      // User 2 signs sell Order
      signature2 = sigUtil.signTypedData_v4(privKey, msgParams2);

      sellOrder.signature = signature2;
    });

    it("sell order validation in js", async () => {
      const recovered = sigUtil.recoverTypedSignature_v4({
        data: msgParams2.data,
        sig: sellOrder.signature
      });

      web3.utils.toChecksumAddress(recovered).should.be.equal(user2);
    });
  });

  describe("Exchange::fill orders", () => {
    it("validate buy order in exchange contract", async () => {
      let isValid = await exchange.validateOrder(buyOrder, { from: matcher });
      isValid.should.be.true;
    });

    it("validate sell order in exchange contract", async () => {
      let isValid = await exchange.validateOrder(sellOrder, { from: matcher });
      isValid.should.be.true;
    });

    it("incorrect fill price should be rejected", async () => {
      await exchange.fillOrders(
        buyOrder,
        sellOrder,
        1900000, //fill Price 0.019
        150000000, // fill Amount 1.5 WETH
        { from: matcher }
      ).should.be.rejected;
    });

    it("only matcher can fill orders", async () => {
      await exchange.fillOrders(
        buyOrder,
        sellOrder,
        2100000, //fill Price 0.021
        150000000, // fill Amount 1.5 WETH
        { from: user1 }
      ).should.be.rejected;
    });

    it("matcher can fill orders", async () => {
      await exchange.fillOrders(
        buyOrder,
        sellOrder,
        FILL_PRICE, //fill Price 0.021
        FILL_AMOUNT, // fill Amount 1.5 WETH
        { from: matcher }
      ).should.be.fulfilled;

      const event = await getLastTradeEvent(
        buyOrder.senderAddress,
        sellOrder.senderAddress
      );

      event.buyer.should.be.equal(buyOrder.senderAddress);
      event.seller.should.be.equal(sellOrder.senderAddress);
      event.baseAsset.should.be.equal(buyOrder.baseAsset);
      event.filledPrice.should.be.equal(String(FILL_PRICE));
    });

    it("trade cannot exceed order amount", async () => {
      // Calling fillOrders with same params, will cause fill amount to exceed sell order amount
      await exchange.fillOrders(
        buyOrder,
        sellOrder,
        FILL_PRICE, //fill Price 0.021
        FILL_AMOUNT, // fill Amount 1.5 WETH
        { from: matcher }
      ).should.be.rejected;
    });
  });

  describe("Exchange::order info", () => {
    it("can retrieve trades of a specific order", async () => {
      let trades = await exchange.getOrderTrades(buyOrder, { from: matcher });
      trades.length.should.be.equal(1);
      trades[0].filledAmount.should.be.equal(String(FILL_AMOUNT));
    });

    it("correct buy order status", async () => {
      let status = await exchange.getOrderStatus(buyOrder, { from: matcher });
      status.toNumber().should.be.equal(0); // status 0 = NEW 1 = PARTIALLY_FILLED
    });

    it("correct sell order status", async () => {
      let status = await exchange.getOrderStatus(sellOrder, { from: matcher });
      status.toNumber().should.be.equal(2); // status 0 = NEW 1 = PARTIALLY_FILLED
    });

    it("correct buy order filled amounts", async () => {
      let amounts = await exchange.getFilledAmounts(sellOrder, {
        from: matcher
      });
      String(amounts.totalFilled).should.be.equal(String(FILL_AMOUNT));
      String(amounts.totalFeesPaid).should.be.equal(
        String((buyOrder.matcherFee * FILL_AMOUNT) / buyOrder.amount)
      );
    });
  });

  describe("Exchange::balance check", () => {
    it("correct buyer WETH balance after trade", async () => {
      // WETH received = fill amount (150000000)
      let balance = await exchange.getBalance(weth.address, user1);
      balance.toString().should.be.equal(String(FILL_AMOUNT));
    });

    it("correct buyer WBTC balance after trade", async () => {
      // WBTC deducted = initialbalance - (fillPrice * fillAmount ) - matcherFee *  ( fillAmount/orderAmount)
      // WBTC deducted = 10 WBTC - 0.021 WBTC/WETH * 1.5 WETH - 0.0035 WTBC * (1.5*3.5) = 9.967 WBTC
      let balance = await exchange.getBalance(wbtc.address, user1);
      balance
        .toString()
        .should.be.equal(
          String(
            10e8 -
              (FILL_PRICE * FILL_AMOUNT) / 1e8 -
              buyOrder.matcherFee * (FILL_AMOUNT / buyOrder.amount)
          )
        );
    });

    it("correct seller WETH balance after trade", async () => {
      // WETH deducted = initialBalance- fill amount
      // WETH deducted = 10 WETH - 1.5 WETH = 8.5 WETH
      let balance = await exchange.getBalance(weth.address, user2);
      balance.toString().should.be.equal(String(10e8 - FILL_AMOUNT));
    });

    it("correct seller ETH balance after trade", async () => {
      // ETH deducted = matcherFee *  ( fillAmount/sellOrder amount)
      // ETH deducted = 1 ETH 0.0015 - ETH * (1.5/1.5) = 8.4985 WETH
      let balance = await exchange.getBalance(ZERO_ADDRESS, user2);
      balance
        .toString()
        .should.be.equal(
          String(1e8 - sellOrder.matcherFee * (FILL_AMOUNT / sellOrder.amount))
        );
    });

    it("correct seller WBTC balance after trade", async () => {
      // WBTC received = (fillPrice * fillAmount )
      // WBTC received = 0.021 WBTC/WETH * 1.5 WETH = 0.0315 WBTC
      let balance = await exchange.getBalance(wbtc.address, user2);
      balance
        .toString()
        .should.be.equal(String((FILL_AMOUNT * FILL_PRICE) / 1e8));
    });

    it("correct total exchange balance in WBTC after trade", async () => {
      // WBTC = depositUser1 - feeMatcher(buyOrder) *  ( fillAmount/buyOrderAmount)
      // WBTC = 10WBTC - 0.0035 WTBC * (1.5*3.5)
      let WBTCbalance = await wbtc.balanceOf(exchange.address);
      WBTCbalance.toString().should.be.equal(
        String(10e8 - buyOrder.matcherFee * (FILL_AMOUNT / buyOrder.amount))
      );
    });

    it("correct total exchange balance in WETH after trade", async () => {
      // WETH = depositUser2
      // WETH = 10WETH
      let WETHbalance = await weth.balanceOf(exchange.address);
      WETHbalance.toString().should.be.equal(String(10e18));
    });

    it("correct total exchange balance in ETH after trade", async () => {
      // ETH = depositUser1 + depositUser2 - feeMatcher (sellOrder ) *  ( fillAmount/sellOrderAmount)
      // ETH = 1 ETH + 1 ETH - 0.0015 ETH
      let WETHbalance = await web3.eth.getBalance(exchange.address);
      WETHbalance.toString().should.be.equal(
        String(
          1e18 +
            1e18 -
            sellOrder.matcherFee * (FILL_AMOUNT / sellOrder.amount) * 1e10
        )
      );
    });

    it("correct matcher fee in WETH", async () => {
      let WETHbalance = await weth.balanceOf(matcher);
      WETHbalance.toString().should.be.equal(String(0));
    });

    it("correct matcher fee in WBTC", async () => {
      let WBTCbalance = await wbtc.balanceOf(matcher);
      WBTCbalance.toString().should.be.equal(
        String(buyOrder.matcherFee * (FILL_AMOUNT / buyOrder.amount))
      );
    });
  });

  describe("Exchange::cancel orders", () => {
    it("user can't cancel an order that does not own", async () => {
      await exchange.cancelOrder(sellOrder, { from: user1 }).should.be.rejected;
    });

    it("user can cancel an order", async () => {
      await exchange.cancelOrder(buyOrder, { from: user1 }).should.be.fulfilled;
    });

    it("correct order status after cancelled", async () => {
      let status = await exchange.getOrderStatus(buyOrder, { from: matcher });
      status.toNumber().should.be.equal(3); // status 0 = NEW 1 = PARTIALLY_FILLED 2 = FILLED, 3 = PARTIALLY_CANCELLED, 4 = CANCELLED
    });

    it("order can't be filled after cancelled", async () => {
      await exchange.fillOrders(
        buyOrder,
        sellOrder,
        2100000, //fill Price 0.021
        50000000, // fill Amount 0.5 WETH
        { from: matcher }
      ).should.be.rejected;
    });

    it("user can't cancel an already cancelled order", async () => {
      await exchange.cancelOrder(buyOrder, { from: user1 }).should.be.rejected;
    });
  });
});
