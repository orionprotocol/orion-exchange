const Web3 = require("web3");
const Long = require("long");
const ethers = require("ethers");
const web3 = new Web3("http://localhost:8544");

const WETHArtifact = require("../build/contracts/WETH.json");
const WBTCArtifact = require("../build/contracts/WBTC.json");

// === Hash Order=== //

function hashOrder(orderInfo) {
  let message = web3.utils.soliditySha3(
    3,
    orderInfo.senderAddress,
    orderInfo.matcherAddress,
    orderInfo.baseAsset,
    orderInfo.quotetAsset,
    orderInfo.matcherFeeAsset,
    orderInfo.amount,
    orderInfo.price,
    orderInfo.matcherFee,
    orderInfo.nonce,
    orderInfo.expiration,
    orderInfo.side
  );

  return message;
}

// === SIGN ORDER === //
async function signOrder(orderInfo) {
  let message = hashOrder(orderInfo);
  //Wanmask
  //   let signedMessage = await window.wan3.eth.sign(
  //     sender,
  //     message
  //   );

  //Web3 v1
  let signedMessage = await web3.eth.sign(message, orderInfo.senderAddress);

  //Web3 v0.2
  //   let signedMessage = await web3.eth.sign(sender, message);

  return signedMessage;
}

// // === MAIN FLOW === //

(async function main() {
  const netId = await web3.eth.net.getId();
  const accounts = await web3.eth.getAccounts();

  const nowTimestamp = Date.now();

  const orionOrder = {
    senderAddress: accounts[0],
    matcherAddress: accounts[1],
    baseAsset: WETHArtifact.networks[netId].address,
    quotetAsset: WBTCArtifact.networks[netId].address, // WBTC
    matcherFeeAsset: WETHArtifact.networks[netId].address, // WETH
    amount: 150000000,
    price: 2000000,
    matcherFee: 150000,
    nonce: nowTimestamp,
    expiration: nowTimestamp + 29 * 24 * 60 * 60 * 1000,
    side: true //true = buy, false = sell
  };

  //Client signs order
  let signature = await signOrder(orionOrder);
  console.log("Signed Data: ", signature);
  console.log("Signed By: ", orionOrder.senderAddress);
  console.log("Order Struct: \n", orionOrder);
})();
