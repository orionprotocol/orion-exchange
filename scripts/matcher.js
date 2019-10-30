const Web3 = require("web3");
// const web3 = new Web3("http://localhost:8544"); // ganache
// const web3 = new Web3("http://localhost:8545"); // gwan
const web3 = new Web3("http://localhost:7545"); // wanache
const Long = require("long");

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

// CONVERT LONG TO BYTES
function longToBytes(long) {
  return web3.utils.bytesToHex(Long.fromNumber(long).toBytesBE());
}

// === GET ORDER HASH=== //
function hashOrder(orderInfo) {
  let message = web3.utils.soliditySha3(
    "0x03",
    orderInfo.senderAddress,
    orderInfo.matcherAddress,
    orderInfo.baseAsset,
    orderInfo.quoteAsset,
    orderInfo.matcherFeeAsset,
    longToBytes(orderInfo.amount),
    longToBytes(orderInfo.price),
    longToBytes(orderInfo.matcherFee),
    longToBytes(orderInfo.nonce),
    longToBytes(orderInfo.expiration),
    orderInfo.side === "buy" ? "0x00" : "0x01"
  );

  return message;
}

// === VALIDATE ORDER IN MATCHER === //
async function validateSignature(signature, orderInfo) {
  let message = hashOrder(orderInfo);
  let sender = await web3.eth.accounts.recover(message, signature);

  return sender;
}
// ======================== //

// === GET SIGATURE OBJECT === //
function getSignatureObj(signature) {
  signature = signature.substr(2); //remove 0x
  const r = "0x" + signature.slice(0, 64);
  const s = "0x" + signature.slice(64, 128);
  let v = web3.utils.hexToNumber("0x" + signature.slice(128, 130)); //gwan
  if (netId !== 3) v += 27; //ganache
  return { v, r, s };
}
// ======================== //

// === VALIDATE ORDER IN SOLIDITY === //
async function validateSolidity(orderInfo, signature) {
  //Validate in smart contract
  let response = await exchange.methods
    .isValidSignature(orderInfo, getSignatureObj(signature))
    .call();

  return response;
}
// ======================== //

// === FILL ORDERS ===
async function fillOrdersByMatcher(
  buyOrder,
  sellOrder,
  signature1,
  signature2,
  fillPrice,
  fillAmount
) {
  let response = await exchange.methods
    .fillOrders(
      buyOrder,
      sellOrder,
      getSignatureObj(signature1),
      getSignatureObj(signature2),
      fillPrice,
      fillAmount
    )
    .send({ from: accounts[0], gas: 1e6 }); //matcher address is accounts 0

  console.log("\nTransaction successful? ", response.status);
  console.log("New Trade Event:\n", response.events.NewTrade.returnValues);
}

// // === MAIN FLOW === //

(async function main() {
  await setupContracts();

  let wbtcAddress = WBTCArtifact.networks[netId].address;
  let wethAddress = WETHArtifact.networks[netId].address;

  //Input same timestamp as the one created order in client
  nowTimestamp = 1571843003887;

  const buyOrder = {
    senderAddress: accounts[1],
    matcherAddress: accounts[0],
    baseAsset: wethAddress,
    quoteAsset: wbtcAddress, // WBTC
    matcherFeeAsset: wethAddress, // WETH
    amount: 350000000,
    price: 2100000,
    matcherFee: 350000,
    nonce: nowTimestamp,
    expiration: nowTimestamp + 29 * 24 * 60 * 60 * 1000, // milliseconds
    side: "buy"
  };

  //Result from client script
  signature1 =
    "0xfe8781a37ef5e29f7822068c9f3f8b7381ab0fa8609184b880281aec82a6cc2a17e39669bff543af970924e69306f1344528af71adcfa6a0fc38335b3395715201";

  const sellOrder = {
    senderAddress: accounts[2],
    matcherAddress: accounts[0],
    baseAsset: wethAddress,
    quoteAsset: wbtcAddress, // WBTC
    matcherFeeAsset: wethAddress, // WETH
    amount: 150000000,
    price: 2000000,
    matcherFee: 150000,
    nonce: nowTimestamp,
    expiration: nowTimestamp + 29 * 24 * 60 * 60 * 1000, // milliseconds
    side: "sell"
  };

  //Result from client script
  signature2 =
    "0x7b79f18eb01fe3b9d63c2834de30a1e659950d52db9beea989450b417689e7951a1bd06839f3031b19d0d08b025f542a77798352379476a296fb6d7184ed9be801";

  //Matcher validates orders
  let sender1 = await validateSignature(signature1, buyOrder);
  console.log(
    "\nValid Signature for Buy Order? ",
    sender1 === web3.utils.toChecksumAddress(buyOrder.senderAddress)
  );

  let sender2 = await validateSignature(signature2, sellOrder);
  console.log(
    "\nValid Signature for Sell Order? ",
    sender2 === web3.utils.toChecksumAddress(sellOrder.senderAddress)
  );

  //Initial Balances
  let balances1 = await exchange.methods
    .getBalances([wethAddress, wbtcAddress], accounts[1])
    .call();
  console.log("\nInitial Balances");
  console.log(
    "BUYER INITIAL BALANCES:\nWETH: ",
    balances1[0],
    "WBTC: ",
    balances1[1]
  );

  let balances2 = await exchange.methods
    .getBalances([wethAddress, wbtcAddress], accounts[2])
    .call();
  console.log(
    "SELLER INITIAL BALANCES:\nWETH: ",
    balances2[0],
    "WBTC: ",
    balances2[1]
  );

  // *** ==== FILL ORDER ==== *** //
  await fillOrdersByMatcher(
    buyOrder,
    sellOrder,
    signature1,
    signature2,
    2100000,
    150000000
  );
  // ============================= //

  //Final Balances
  balances1 = await exchange.methods
    .getBalances([wethAddress, wbtcAddress], accounts[1])
    .call();
  console.log(
    "\nBUYER FINAL BALANCES:\nWETH: ",
    balances1[0],
    "WBTC: ",
    balances1[1]
  );

  balances2 = await exchange.methods
    .getBalances([wethAddress, wbtcAddress], accounts[2])
    .call();
  console.log(
    "SELLER FINAL BALANCES:\nWETH: ",
    balances2[0],
    "WBTC: ",
    balances2[1]
  );

  // VALIDATE ORDER SIGNATURES WITH SOLIDITY FUNCTION
  let isValid = await validateSolidity(buyOrder, signature1);
  console.log("\nValid Signature for Buy Order in solidity? ", isValid);

  isValid = await validateSolidity(sellOrder, signature2);
  console.log("Valid Signature for Sell Order in solidity? ", isValid);
})();
