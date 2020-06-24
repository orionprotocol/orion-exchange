const Web3 = require("web3");
// const web3 = new Web3(
//   `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`
// );
const web3 = new Web3(`http://localhost:8545`);

const abi = require("./validateV1Abi");
const validatorAddress = "0x31B7644844Aa7F6E0B158485286e7fc794aCC5CF";
const sigUtil = require("eth-sig-util");
// console.log(sigUtil);

require("dotenv").config();

function compare(address1, address2) {
  return (
    web3.utils.toChecksumAddress(address1) ===
    web3.utils.toChecksumAddress(address2)
  );
}

async function validateSigSolidity(orderInfo) {
  const contract = new web3.eth.Contract(abi, validatorAddress);
  const isSigner = await contract.methods.validateV1(orderInfo).call();

  // console.log(isSigner);

  return isSigner;
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
    senderAddress: "0x606BB818AC81a2e96Eca87EbfAfBcEFbF2Ee6D34",
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
      "0x8384260e87a6b8739711b0de0e53c9673cf2d8b2044be4981e58a9229b4aef512a57939ce2fa7bc4f1b18d88c4348280c4c9294c977a2300c5ab064c4a7671b41b",
  };

  const sender = await validateSigJS(order.signature, order);
  console.log(
    "\nValid Signature for Order using JS? ",
    compare(sender, order.senderAddress)
  );

  const isSigner = await validateSigSolidity(order);
  console.log("\nValid Signature for Order using Solidity? ", isSigner);
})();
