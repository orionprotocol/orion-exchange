const BigNumber = web3.utils.BN;
require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

let Exchange = artifacts.require("Exchange");
let WETH = artifacts.require("WETH");
let WBTC = artifacts.require("WBTC");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"; // WAN or ETH "asset" address in balanaces

let exchange, weth, wbtc, signature, orderHash, orionOrder;

contract("Exchange", ([owner, user1, user2]) => {
  describe("Exchange::instance", async () => {
    exchange = await Exchange.deployed();
    weth = await WETH.deployed();
    wbtc = await WBTC.deployed();
  });

  describe("Exchange::order validation", () => {
    it("client can create and sign order", async () => {
      const nowTimestamp = Date.now();

      orionOrder = {
        senderAddress: user1,
        matcherAddress: user2,
        baseAsset: weth.address,
        quotetAsset: wbtc.address, // WBTC
        matcherFeeAsset: weth.address, // WETH
        amount: 150000000,
        price: 2000000,
        matcherFee: 150000,
        nonce: nowTimestamp,
        expiration: nowTimestamp + 29 * 24 * 60 * 60 * 1000,
        side: true //true = buy, false = sell
      };

      orderHash = web3.utils.soliditySha3(
        3,
        orionOrder.senderAddress,
        orionOrder.matcherAddress,
        orionOrder.baseAsset,
        orionOrder.quotetAsset,
        orionOrder.matcherFeeAsset,
        orionOrder.amount,
        orionOrder.price,
        orionOrder.matcherFee,
        orionOrder.nonce,
        orionOrder.expiration,
        orionOrder.side
      );

      let signedMessage = await web3.eth.sign(
        orderHash,
        orionOrder.senderAddress
      );
      signedMessage.length.should.be.equal(132);

      signature = signedMessage;
    });

    it("order signature validation by matcher", async () => {
      let sender = await web3.eth.accounts.recover(orderHash, signature);
      sender.should.be.equal(web3.utils.toChecksumAddress(user1));
    });

    it("order signature validation by smart contract", async () => {
      //Retrieves r, s, and v values
      signature = signature.substr(2); //remove 0x
      const r = "0x" + signature.slice(0, 64);
      const s = "0x" + signature.slice(64, 128);
      const v = web3.utils.hexToNumber("0x" + signature.slice(128, 130)) + 27;

      //Validate in smart contract
      let response = await exchange.validateOrder(orionOrder, v, r, s);

      response.receipt.logs[0].args.sender.should.be.equal(user1);
    });
  });
});
