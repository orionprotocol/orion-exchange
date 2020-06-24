require("dotenv").config();

const Web3 = require("web3");
// const web3 = new Web3(`https://rinkeby.infura.io/v3/${process.env.INFURA_KEY}`);
const web3 = new Web3(`http://localhost:8545`);

const sigUtil = require("eth-sig-util");

const abi = require("./validateAbi");
const validateAddress = "0xA75F9416F8Cbe4c45f85eD45B6dD85a66B69Ec7b";

function compare(address1, address2) {
  return (
    web3.utils.toChecksumAddress(address1) ===
    web3.utils.toChecksumAddress(address2)
  );
}

function getSignatureObj(signature) {
  signature = signature.substr(2); //remove 0x
  const r = "0x" + signature.slice(0, 64);
  const s = "0x" + signature.slice(64, 128);
  let v = web3.utils.hexToNumber("0x" + signature.slice(128, 130));
  // v += 4 * 2;
  console.log(v, r, s);
  return { v, r, s };
}

async function validateSigSolidity(orderInfo, signature) {
  const contract = new web3.eth.Contract(abi, validateAddress);

  // getSignatureObj(signature);

  // const domain = await contract.methods.DOMAIN_SALT().call();
  // console.log(domain);

  // console.log(sig);

  const signer = await contract.methods
    .signerOfOrder(orderInfo, signature)
    .call();

  console.log(signer);

  return signer;
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
    { name: "side", type: "string" },
  ];

  // Get domain data from contract called
  const domainData = {
    name: "Orion Exchange",
    version: "1",
    chainId: 666,
    verifyingContract: "0x1C56346CD2A2Bf3202F771f50d3D14a367B48070",
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
  };

  const signature =
    "0xc5a48720278b8c8501374a3d61b7517b23e60f6863b44bc38bec120bf94375340fe7d7ca66c6304b44cd3b65262b02dbcc88e15f14edce9527c517ccfb4acecf1c";

  const sender = await validateSigJS(signature, order);
  console.log(
    "\nValid Signature for Order using JS? ",
    compare(sender, order.senderAddress)
  );

  const sender2 = await validateSigSolidity(order, signature);
  console.log(
    "\nValid Signature for Order using Solidity? ",
    compare(sender2, order.senderAddress)
  );
})();
