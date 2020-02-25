const Web3 = require("web3");
const web3 = new Web3("http://localhost:8545"); // ganache
// const web3 = new Web3("http://localhost:8545"); // gwan
const Long = require("long");

const exchangeArtifact = require("../abis/Exchange.json");
const WETHArtifact = require("../abis/WETH.json");
const WBTCArtifact = require("../abis/WBTC.json");

let accounts, netId, exchange;

//Input same timestamp as the one created order in client
nowTimestamp = 1571843003887;

const buyOrder =
{
  "senderAddress": "0x01b13ee728ea9cf4a3f1fc2a62bae08c9c9c63a9",
    "matcherAddress": "0xae549def8e6637e0e61973b8fefb46428890f13f",
    "baseAsset": "0xb4a3f5b8d096aa03808853db807f1233a2515df2",
    "quoteAsset": "0xe5af2cd77ba717055df4a59921c809ab2cd891c3",
    "matcherFeeAsset": "0xe5af2cd77ba717055df4a59921c809ab2cd891c3",
    "amount": 86000000,
    "price": 2013637,
    "matcherFee": 300000,
    "nonce": 1572462958378,
    "expiration": 1574968558378,
    "side": "buy"
}
//Result from client script
const signature1 =
    "0x67d274923e4c71d349847ef2ef60c3f42b89c79eb6c370acc8fe22f2d6df697f28e84107b5493384017e8f19dae1b21c42bc0a8d6d3e4992b1be87a9aecbd5c41b";

const sellOrder =
{
  "senderAddress": "0x01b13ee728ea9cf4a3f1fc2a62bae08c9c9c63a9",
    "matcherAddress": "0xae549def8e6637e0e61973b8fefb46428890f13f",
    "baseAsset": "0xb4a3f5b8d096aa03808853db807f1233a2515df2",
    "quoteAsset": "0xe5af2cd77ba717055df4a59921c809ab2cd891c3",
    "matcherFeeAsset": "0xe5af2cd77ba717055df4a59921c809ab2cd891c3",
    "amount": 86000000,
    "price": 1993500,
    "matcherFee": 300000,
    "nonce": 1572462965839,
    "expiration": 1574968565839,
    "side": "sell"
};

//Result from client script
signature2 =
    "0x38aa86acbda6d37f0ea3c4e3d8c1a1be6af053d68fe4e812b33b226becc22be64c4400d1923838fc5a61f56acf84a196481eeda8e545d58237bc8a8beac7d2b11c";


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
  //console.log("New Trade Event:\n", response.events.NewTrade.returnValues);
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

  // *** ==== FILL ORDER ==== *** //
  /*await fillOrdersByMatcher(
    buyOrder,
    sellOrder,
    signature1,
    signature2,
      2013637,
      85999960
  );*/
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
