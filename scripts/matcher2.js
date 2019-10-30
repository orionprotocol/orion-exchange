const Web3 = require("web3");

// Networks
// const web3 = new Web3("http://localhost:8544"); // ganache
const web3 = new Web3("http://localhost:8545"); // gwan
// const web3 = new Web3("http://localhost:7545"); // wanache

const Long = require("long");

const exchangeArtifact = require("../build/contracts/Exchange.json");
const WETHArtifact = require("../build/contracts/WETH.json");
const WBTCArtifact = require("../build/contracts/WBTC.json");

let accounts, netId, exchange;

//Input same timestamp as the one created order in client
nowTimestamp = 1571843003887;

// const buyOrder = {
//   "senderAddress": "0xb7744e270d1d64a85e8db9cf62e130ed389af2b6",
//   "matcherAddress": "0x861a7e6904e0ac2717a4e3b7a9f815279fce3a21",
//   "baseAsset": "0xb4a3f5b8d096aa03808853db807f1233a2515df2",
//   "quoteAsset": "0xe5af2cd77ba717055df4a59921c809ab2cd891c3",
//   "matcherFeeAsset": "0xe5af2cd77ba717055df4a59921c809ab2cd891c3",
//   "amount": 91000000,
//   "price": 2017979,
//   "matcherFee": 300000,
//   "nonce": 1572449890043,
//   "expiration": 1574955490043,
//   "side": "buy"
// };
// //Result from client script
// const signature1 =
//     "0xb7ef1c81ae3978824e97802f39eb6219c26ca97f35568c8f5a0c3c162bd7a03802ec006c3dd0621756751d692ca735c223cae69cafcaad366a11b6112a83545b1c";

// const sellOrder =  {
//   "senderAddress": "0x01b13ee728ea9cf4a3f1fc2a62bae08c9c9c63a9",
//   "matcherAddress": "0x861a7e6904e0ac2717a4e3b7a9f815279fce3a21",
//   "baseAsset": "0xb4a3f5b8d096aa03808853db807f1233a2515df2",
//   "quoteAsset": "0xe5af2cd77ba717055df4a59921c809ab2cd891c3",
//   "matcherFeeAsset": "0xe5af2cd77ba717055df4a59921c809ab2cd891c3",
//   "amount": 91000000,
//   "price": 1998000,
//   "matcherFee": 300000,
//   "nonce": 1572449894349,
//   "expiration": 1574955494349,
//   "side": "sell"
// };

// //Result from client script
// signature2 =
//     "0x0be7d49a79e4a893c53da2d3d76852074312b166ff4743b50d2b859a04e85203557d51634a0fe73e008011904a805ba29671dfe6bf80044e1714ecccd8dce9c31b";


const buyOrder = {
  "senderAddress": "0xF8a1775286DDDB8A0D2D35598D00F46873B4f8F6",
  "matcherAddress": "0xB35d39BB41C69E4377A16C08EDA54999175c1cdD",
  "baseAsset": "0x16D0770f8Dd8B3F3Ce75f39ce6A7626EDf7c2af4",
  "quoteAsset": "0x092Ca292Ba7b104c551c89013F10e366203a4E5e",
  "matcherFeeAsset": "0x16D0770f8Dd8B3F3Ce75f39ce6A7626EDf7c2af4",
  "amount": 350000000,
  "price": 2100000,
  "matcherFee": 350000,
  "nonce": 1571843003887,
  "expiration": 1574348603887,
  "side": "buy"
};
//Result from client script
const signature1 =
    "0xea938d6f50f33984570673c989c87183ef27d23610806e4f0e51451e837db4f308785470bccd4e53418cfc183a82758018dfe0e1499b859b8a9ae08dd1c62bb11c";

const sellOrder =  {
  "senderAddress": "0x3E6F7d8AAb3f0191943d8e175033A8B2C48de327",
  "matcherAddress": "0xB35d39BB41C69E4377A16C08EDA54999175c1cdD",
  "baseAsset": "0x16D0770f8Dd8B3F3Ce75f39ce6A7626EDf7c2af4",
  "quoteAsset": "0x092Ca292Ba7b104c551c89013F10e366203a4E5e",
  "matcherFeeAsset": "0x16D0770f8Dd8B3F3Ce75f39ce6A7626EDf7c2af4",
  "amount": 150000000,
  "price": 2000000,
  "matcherFee": 150000,
  "nonce": 1571843003887,
  "expiration": 1574348603887,
  "side": "sell"
};

//Result from client script
signature2 =
    "0x5cff86cd79b21cfd5d8cafdd6cba66a290967ab809a007cc49426d94e61918511fd1c095bd3f9f3e1df83e1777085bb3e43c8112e08defa400d70eddd983f1a81b";


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

  // VALIDATE ORDER SIGNATURES WITH SOLIDITY FUNCTION
  let isValid = await validateSolidity(buyOrder, signature1);
  console.log("\nValid Signature for Buy Order in solidity? ", isValid);

  isValid = await validateSolidity(sellOrder, signature2);
  console.log("Valid Signature for Sell Order in solidity? ", isValid);

  //Initial Balances
  let balances1 = await exchange.methods
    .getBalances([wethAddress, wbtcAddress], buyOrder.senderAddress)
    .call();
  console.log("\nInitial Balances");
  console.log(
    "BUYER INITIAL BALANCES:\nWETH: ",
    balances1[0],
    "WBTC: ",
    balances1[1]
  );

  let balances2 = await exchange.methods
    .getBalances([wethAddress, wbtcAddress], sellOrder.senderAddress)
    .call();
  console.log(
    "SELLER INITIAL BALANCES:\nWETH: ",
    balances2[0],
    "WBTC: ",
    balances2[1]
  );

  console.log();
  // *** ==== FILL ORDER ==== *** //
  await fillOrdersByMatcher(
    buyOrder,
    sellOrder,
    signature1,
    signature2,
    sellOrder.price,
    Math.min(buyOrder.amount, sellOrder.amount)
  );
  // ============================= //

  //Final Balances
  balances1 = await exchange.methods
    .getBalances([wethAddress, wbtcAddress], buyOrder.senderAddress)
    .call();
  console.log(
    "\nBUYER FINAL BALANCES:\nWETH: ",
    balances1[0],
    "WBTC: ",
    balances1[1]
  );

  balances2 = await exchange.methods
    .getBalances([wethAddress, wbtcAddress], sellOrder.senderAddress)
    .call();
  console.log(
    "SELLER FINAL BALANCES:\nWETH: ",
    balances2[0],
    "WBTC: ",
    balances2[1]
  );
})();
