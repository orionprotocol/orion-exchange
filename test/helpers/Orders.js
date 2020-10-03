const privKeyHelper = require("./PrivateKeys.js");
const EIP712 = require("./EIP712.js");

function generateOrder( trader, matcher, buySide,
                        baseAsset = weth, 
                        quoteAsset = wbtc,
                        amount = Math.ceil(3.5e8),
                        price = Math.ceil(0.021e8),
                        fee = Math.ceil(3.5e5),
                        nonce = undefined,
                        expiration = undefined) {
      let privKey = privKeyHelper.getPrivKey(trader);
      const NOW = Date.now();
      if(!nonce)
        nonce = NOW;
      if(!expiration)
        expiration = NOW + 29 * 24 * 60 * 60 * 1000;
      order = {
        senderAddress: buyer,
        matcherAddress: matcher,
        baseAsset: baseAsset.address, // WETH
        quoteAsset: quoteAsset.address, // WBTC
        matcherFeeAsset: quoteAsset.address,
        amount: amount,
        price: price, 
        matcherFee: Math.ceil(fee*amount*price),
        nonce: NOW,
        expiration: NOW + 29 * 24 * 60 * 60 * 1000, // milliseconds
        buySide: buySide
      };
      let msgParams = {
             types: {
               EIP712Domain: EIP712.domain,
               Order: EIP712.orderTypes,
             },
             domain: EIP712.domainData,
             primaryType: "Order",
             message: order,
           };

      msg = { data: msgParams };
      _signature = sigUtil.signTypedData_v4(privKey, msg);
      order.signature = signature;
      return {order:order, msgParams: msgParams};
}

module.exports = Object({
    generateOrder:generateOrder
});

