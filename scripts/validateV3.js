require("dotenv").config();

const Web3 = require("web3");
const web3 = new Web3(`http://localhost:8545`);

const sigUtil = require("eth-sig-util");

const artifact = require("../build/contracts/Exchange.json");
const exchangeAddress = artifact.networks["666"].address;

function compare(address1, address2) {
  return (
    web3.utils.toChecksumAddress(address1) ===
    web3.utils.toChecksumAddress(address2)
  );
}

async function validateSigSolidity(orderInfo, signature) {
  const contract = new web3.eth.Contract(artifact.abi, exchangeAddress);

  const isValid = await contract.methods.validateOrder(orderInfo).call();

  return isValid;
}

async function validateSigJS(orderInfo) {
  let msgParams = getMsgParams(orderInfo);

  params = { data: msgParams };
  params.sig = orderInfo.signature;

  return sigUtil.recoverTypedMessage(params, "V3");
}
// ======================== //

function getMsgParams(orderInfo) {
  const domain = [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
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
    { name: "side", type: "string" },
  ];

  // Get domain data from contract called
  const domainData = {
    name: "Orion Exchange",
    version: "1",
    chainId: 666,
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
    senderAddress: "0x606BB818AC81a2e96Eca87EbfAfBcEFbF2Ee6D34",
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
      "0xf2a3b900f21a4b78397c6ae0bcb510007dfb2503c5e0bf40e5eaee3608c61b8523bc92b4d8736c627b9b27c19513f06c681e276629c0f4acf186be22d81a88131b",
  };

  const sender = await validateSigJS(order);
  console.log(
    "\nValid Signature for Order using JS? ",
    compare(sender, order.senderAddress)
  );

  const isValid = await validateSigSolidity(order);
  console.log("\nValid Signature for Order using Solidity? ", isValid);
})();
