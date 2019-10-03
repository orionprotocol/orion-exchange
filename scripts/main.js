const Web3 = require("web3");
const web3 = new Web3("http://localhost:8544");

const exchangeArtifact = require("../build/contracts/Exchange.json");
const WETHArtifact = require("../build/contracts/WETH.json");
const WBTCArtifact = require("../build/contracts/WBTC.json");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

let exchange;

let accounts;

let netId;

// === CONTRACT INSTANCE === //

async function setupContracts() {
  netId = await web3.eth.net.getId();

  exchange = new web3.eth.Contract(
    exchangeArtifact.abi,
    exchangeArtifact.networks[netId].address
  );

  accounts = await web3.eth.getAccounts();
}

// === HASH ORDER === //

function hashOrder(orderInfo) {
  let message = web3.utils.soliditySha3(
    "order",
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

// === VALIDATE ORDER === //
async function validateSignature(signature, orderInfo) {
  let message = hashOrder(orderInfo);

  console.log("length", signature.length);

  let sender = await web3.eth.accounts.recover(message, signature);

  return sender;
}
// ======================== //

// // === MAIN FLOW === //

(async function main() {
  await setupContracts();

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

  //Validate in smart contract
  let response = await exchange.methods
    .validateOrder(orionOrder, v, r, s)
    .send({ from: accounts[0] });

  console.log(
    "\nRecovered Address from smart contract:",
    response.events.RecoveredAddress.returnValues.sender
  );
})();
