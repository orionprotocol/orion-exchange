const EIP712 = require("./EIP712.js");
const eth_signTypedData = require("./GanacheSignatures.js");
const ChainManipulation = require("./ChainManipulation");
const privKeyHelper = require("./PrivateKeys")
const Long = require("long");

async function generateOrder( trader, matcher, buySide,
                        baseAsset = weth,
                        quoteAsset = wbtc,
                        feeAsset = wbtc,
                        amount = Math.ceil(3.5e8),
                        price = Math.ceil(0.021e8),
                        fee = Math.ceil(3.5e5),
                        nonce = undefined,
                        expiration = undefined) {
      const NOW = (await ChainManipulation.getBlokchainTime()) * 1000;
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
      let signature = await eth_signTypedData(trader, msgParams);
      order.signature = signature;
      return {order:order, msgParams: msgParams};
}
function longToBytes(long) {
    return web3.utils.bytesToHex(Long.fromNumber(long).toBytesBE());
}

async function generateOrderPersonalSign( sender, matcher, buySide,
                              baseAsset,
                              quoteAsset,
                              feeAsset = quoteAsset,
                              amount = Math.ceil(3.5e8),
                              price = Math.ceil(0.021e8),
                              fee = Math.ceil(3.5e5),
                              nonce = undefined,
                              expiration = undefined) {

    const NOW = (await ChainManipulation.getBlokchainTime()) * 1000;
    if(!nonce)
        nonce = NOW;
    if(!expiration)
        expiration = NOW + 29 * 24 * 60 * 60 * 1000;

    const message = web3.utils.soliditySha3(
        'order',
        sender,
        matcher,
        baseAsset.address,
        quoteAsset.address,
        feeAsset.address,
        longToBytes(amount),
        longToBytes(price),
        longToBytes(fee),
        longToBytes(nonce),
        longToBytes(expiration),
        buySide === 1 ? "0x01" : "0x00"
    );

    const msgParams = { data: message};
    const signature = web3.eth.accounts.sign(message, privKeyHelper.getPrivKey(sender).toString("hex"));
    //sigUtil.personalSign(privKeyHelper.getPrivKey(sender), msgParams);

    return {
        senderAddress: sender,
        matcherAddress: matcher,
        baseAsset: baseAsset.address,
        quoteAsset: quoteAsset.address,
        matcherFeeAsset: feeAsset.address,
        amount: amount,
        price: price,
        matcherFee: fee,
        nonce: nonce,
        expiration: expiration,
        buySide: buySide,
        isPersonalSign: true,
        signature: signature.signature
    };
}

module.exports = Object({
    generateOrder:generateOrder,
    generateOrderPersonalSign:generateOrderPersonalSign
});

