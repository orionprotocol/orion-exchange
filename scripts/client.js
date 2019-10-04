const Web3 = require("web3");
const Long = require("long");
const ethers = require("ethers");
const web3 = new Web3("http://localhost:8544");

const WETHArtifact = require("../build/contracts/WETH.json");
const WBTCArtifact = require("../build/contracts/WBTC.json");

let accounts;

let netId;

// === CREATE ORDER BYTES=== //

function getOrderMessage(order) {
  return Buffer.concat([
    byte(3),
    ethers.utils.arrayify(order.senderAddress),
    ethers.utils.arrayify(order.matcherAddress),
    assetBytes(order.baseAsset),
    assetBytes(order.quotetAsset),
    byte(order.side),
    longToBytes(order.price),
    longToBytes(order.amount),
    longToBytes(order.nonce),
    longToBytes(order.expirationTimestamp),
    longToBytes(order.matcherFee),
    assetBytes(order.matcherFeeAsset)
  ]);
}

// === SIGN ORDER === //
async function signOrder(orderInfo) {
  let message = getOrderMessage(orderInfo);
  message = "0x" + message.toString("hex");
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

// === UTILS === //

function longToBytes(long) {
  return Uint8Array.from(Long.fromNumber(long).toBytesBE());
}

function byte(num) {
  return Uint8Array.from([num]);
}

function assetBytes(asset) {
  return ethers.utils.concat([byte(1), ethers.utils.arrayify(asset)]);
}

// // === MAIN FLOW === //

(async function main() {
  const nowTimestamp = Date.now();

  accounts = await web3.eth.getAccounts();
  netId = await web3.eth.net.getId();

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
