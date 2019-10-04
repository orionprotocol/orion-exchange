const Web3 = require("web3");
const Long = require("long");
const ethers = require("ethers");
const web3 = new Web3("http://localhost:8544");

const exchangeArtifact = require("../build/contracts/Exchange.json");
const WETHArtifact = require("../build/contracts/WETH.json");
const WBTCArtifact = require("../build/contracts/WBTC.json");

let accounts, netId, exchange;

// === CONTRACT INSTANCE === //

async function setupContracts() {
  netId = await web3.eth.net.getId();

  exchange = new web3.eth.Contract(
    exchangeArtifact.abi,
    exchangeArtifact.networks[netId].address
  );

  accounts = await web3.eth.getAccounts();
}

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

// === VALIDATE ORDER === //
async function validateSignature(signature, orderInfo) {
  let message = getOrderMessage(orderInfo);
  message = "0x" + message.toString("hex");

  let sender = await web3.eth.accounts.recover(message, signature);

  return sender;
}
// ======================== //

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
  await setupContracts();

  //Input same timestamp as created order in client
  nowTimestamp = 1570173742523;

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

  //Result from client script
  signature =
    "0x8fb309783dd6fee6549fbd32c111b394f71cd896d3626b25408a382010eb248e5f070e032d587e0c31276c189a328b94f37cd244d9acccffb368fee0d92120bc00";

  //Matcher validates order
  let sender = await validateSignature(signature, orionOrder);
  console.log(
    "\nValid Signature? ",
    sender === web3.utils.toChecksumAddress(orionOrder.senderAddress)
  );

  //Retrieves r, s, and v values
  signature = signature.substr(2); //remove 0x
  const r = "0x" + signature.slice(0, 64);
  const s = "0x" + signature.slice(64, 128);
  const v = web3.utils.hexToNumber("0x" + signature.slice(128, 130)) + 27;
  console.log(r, s, v);

  //Validate in smart contract
  let message = getOrderMessage(orionOrder);
  let messageHash = web3.utils.soliditySha3(message);
  let response = await exchange.methods
    .validateOrder(orionOrder, messageHash, v, r, s)
    .send({ from: accounts[0] });

  console.log(
    "\nRecovered Address from smart contract:",
    response.events.RecoveredAddress.returnValues.sender
  );
})();
