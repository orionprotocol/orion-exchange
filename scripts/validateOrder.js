const Web3 = require("web3");
const web3 = new Web3("http://localhost:8545");
const _ = require("lodash");

const BigNumber = web3.utils.BN;

const exchangeArtifact = require("../build/contracts/Exchange.json");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// === CONTRACT INSTANCE === //

let exchange = new web3.eth.Contract(
  exchangeArtifact.abi,
  exchangeArtifact.networks[3].address
);

// === CREATE ORDER === //

async function validateSignature(signature, orderInfo) {
  let message = await web3.utils.soliditySha3(
    "order",
    orderInfo.senderAddress,
    orderInfo.matcherAddress,
    orderInfo.baseAsset,
    orderInfo.quotetAsset,
    orderInfo.amount,
    orderInfo.price
  );

  let sender = await web3.eth.accounts.recover(message, signature);

  console.log(
    "Valid Signature? ",
    sender === web3.utils.toChecksumAddress(orderInfo.senderAddress)
  );

  //Solidity receives structs as an array of values
  let orderStruct = _.values(orderInfo);
}

// ======================== //

// === FUNCTION CALLS === //

let signedMessage =
  "0x528828ae5c3aaeb54624d61d2923e5af3d1d9aca6baccef774672ed028e45fa975acc7a1b702605f0e3b8695193ad310c3937b0b000533c4f3c4d74eb0e512ed1c"; // taken from createAndSign result

let order = {
  senderAddress: "0xf8a1775286dddb8a0d2d35598d00f46873b4f8f6",
  matcherAddress: "0xb35d39bb41c69e4377a16c08eda54999175c1cdd",
  baseAsset: ZERO_ADDRESS,
  quotetAsset: "0x0284fd64d75d76948076C5f0918159D86bC0Af6D",
  matcherFeeAsset: ZERO_ADDRESS,
  amount: 150000000,
  price: 2000000,
  matcherFee: 150000,
  nonce: new BigNumber(
    String(
      57675312108271870174940375766051716042774949863626198027393730181877528245725
    )
  ),
  side: "buy"
};

validateSignature(signedMessage, order);
