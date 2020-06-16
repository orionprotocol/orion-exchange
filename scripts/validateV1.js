const Web3 = require("web3");
const web3 = new Web3(
  `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`
);

const sigUtil = require("eth-sig-util");
// console.log(sigUtil);

require("dotenv").config();

function compare(address1, address2) {
  return (
    web3.utils.toChecksumAddress(address1) ===
    web3.utils.toChecksumAddress(address2)
  );
}

async function validateSigJS(signature, orderInfo) {
  let msgParams = getMsgParams(orderInfo);

  params = { data: msgParams };
  params.sig = signature;

  return sigUtil.recoverTypedMessage(params, "V1");
}
// ======================== //

function getMsgParams(orderInfo) {
  let msgParams = [
    { type: "uint8", name: "version", value: 3 },
    { name: "senderAddress", type: "address", value: orderInfo.senderAddress },
    {
      name: "matcherAddress",
      type: "address",
      value: orderInfo.matcherAddress,
    },
    { name: "baseAsset", type: "address", value: orderInfo.baseAsset },
    { name: "quoteAsset", type: "address", value: orderInfo.quoteAsset },
    {
      name: "matcherFeeAsset",
      type: "address",
      value: orderInfo.matcherFeeAsset,
    },
    { name: "amount", type: "uint64", value: orderInfo.amount },
    { name: "price", type: "uint64", value: orderInfo.price },
    { name: "matcherFee", type: "uint64", value: orderInfo.matcherFee },
    { name: "nonce", type: "uint64", value: orderInfo.nonce },
    { name: "expiration", type: "uint64", value: orderInfo.expiration },
    { name: "side", type: "string", value: orderInfo.side },
  ];

  return msgParams;
}

(async function main() {
  nowTimestamp = 1571843003887; //Date.now();

  const order = {
    version: 3,
    senderAddress: "0x72D103691E468C34830550544fbf5276Ee812118",
    matcherAddress: "0xB35d39BB41C69E4377A16C08EDA54999175c1cdD",
    baseAsset: "0x16D0770f8Dd8B3F3Ce75f39ce6A7626EDf7c2af4", // WETH
    quoteAsset: "0x092Ca292Ba7b104c551c89013F10e366203a4E5e", // WBTC
    matcherFeeAsset: "0x16D0770f8Dd8B3F3Ce75f39ce6A7626EDf7c2af4", // WETH
    amount: 350000000, //3.5 ETH * 10^8
    price: 2100000, //0.021 WBTC/WETH * 10^8
    matcherFee: 350000,
    nonce: nowTimestamp,
    expiration: nowTimestamp + 29 * 24 * 60 * 60 * 1000, // milliseconds
    side: "buy",
    signature:
      "0x096bc4dd1ae008f223461490948db65fb3a86ac449a0bcc9c394cdbd9c5a0bce0f16df1f71b1e6e9ff479d259514c37bf18a5bb52aeb6fb3dbf094081347e9621c",
  };

  const sender = await validateSigJS(order.signature, order);
  console.log(
    "\nValid Signature for Order using JS? ",
    compare(sender, order.senderAddress)
  );
})();
