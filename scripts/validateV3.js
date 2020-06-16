const Web3 = require("web3");
const web3 = new Web3(
  `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`
);

const sigUtil = require("eth-sig-util");

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

  return sigUtil.recoverTypedMessage(params, "V3");
}
// ======================== //

function getMsgParams(orderInfo) {
  const domain = [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
    { name: "salt", type: "bytes32" },
  ];
  const order = [
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
    { name: "version", type: "string" },
  ];

  // Get domain data from contract called
  const domainData = {
    name: "Orion Exchange",
    version: "1",
    chainId: 4,
    verifyingContract: "0xb4a3f5b8d096aa03808853db807f1233a2515df2", // Update to exchange Contract
    salt: "0xf2d857f4a3edcb9b78b4d503bfe733db1e3f6cdc2b7971ee739626c97e86a557",
  };

  const data = {
    types: {
      EIP712Domain: domain,
      Order: order,
    },
    domain: domainData,
    primaryType: "Order",
    message: orderInfo,
  };

  return data;
}

(async function main() {
  nowTimestamp = 1571843003887; //Date.now();

  const order = {
    senderAddress: "0x72D103691E468C34830550544fbf5276Ee812118",
    matcherAddress: "0xFF800d38664b546E9a0b7a72af802137629d4f11",
    baseAsset: "0xCcC7e9b85eA98AC308E14Bef1396ea848AA3fc2C", // WETH
    quoteAsset: "0x8f07FA50C14ed117771e6959f2265881bB919e00", // WBTC
    matcherFeeAsset: "0xCcC7e9b85eA98AC308E14Bef1396ea848AA3fc2C", // WETH
    amount: 350000000, //3.5 ETH * 10^8
    price: 2100000, //0.021 WBTC/WETH * 10^8
    matcherFee: 350000,
    nonce: nowTimestamp,
    expiration: nowTimestamp + 29 * 24 * 60 * 60 * 1000, // milliseconds
    side: "buy",
    signature:
      "0x70e582953913b514ec7acd24f1970dcb07535bc985069110b1b98203c0cc750543c423b4c1a928abbf7a518b8132c120c6394dc66a0ba7494937e6b2f64b66651c",
  };

  const sender = await validateSigJS(order.signature, order);
  console.log(
    "\nValid Signature for Order using JS? ",
    compare(sender, order.senderAddress)
  );
})();
