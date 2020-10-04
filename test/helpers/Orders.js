const sigUtil = require("eth-sig-util");
const privKeyHelper = require("./PrivateKeys.js");
const EIP712 = require("./EIP712.js");


function generateOrder( trader, matcher, buySide,
                        baseAsset = weth, 
                        quoteAsset = wbtc,
                        feeAsset = wbtc,
                        amount = Math.ceil(3.5e8),
                        price = Math.ceil(0.021e8),
                        fee = Math.ceil(3.5e5),
                        nonce = undefined,
                        expiration = undefined) {
      let privKey = privKeyHelper.getPrivKey(trader);
      const NOW = Date.now();
      console.log(nonce,expiration, NOW);
      if(!nonce)
        nonce = NOW;
      if(!expiration)
        expiration = NOW + 29 * 24 * 60 * 60 * 1000;
      let order = {
        senderAddress: trader,
        matcherAddress: matcher,
        baseAsset: baseAsset.address, // WETH
        quoteAsset: quoteAsset.address, // WBTC
        matcherFeeAsset: feeAsset.address,
        amount: amount,
        price: price,
        matcherFee: fee,
        nonce: nonce,
        expiration: expiration,
        buySide: buySide
      };
      console.log(order);
      let msgParams = {
             types: {
               EIP712Domain: EIP712.domain,
               Order: EIP712.orderTypes,
             },
             domain: EIP712.domainData,
             primaryType: "Order",
             message: order,
           };

      let msg = { data: msgParams };
      let signature = sigUtil.signTypedData_v4(privKey, msg);
      order.signature = signature;
      return {order:order, msgParams: msgParams};
}

module.exports = Object({
    generateOrder:generateOrder
});

