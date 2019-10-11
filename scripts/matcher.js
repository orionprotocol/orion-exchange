const Web3 = require("web3");
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

// === VALIDATE ORDER IN MATCHER === //
async function validateSignature(signature, orderInfo) {
  let message = hashOrder(orderInfo);

  let sender = await web3.eth.accounts.recover(message, signature);

  return sender;
}
// ======================== //

// === FILL ORDERS BY MATCHER === //
async function fillOrders(buyOrder, sellOrder, fillAmount, fillPrice) {
  let response = await exchange.methods
    .validateOrder(orderInfo, v, r, s)
    .send({ from: accounts[0] }); //matcher address is accounts 0

  return response;
}
// ======================== //

// === VALIDATE ORDER IN SOLIDITY === //
async function validateSolidity(signature, orderInfo) {
  //Retrieves r, s, and v values
  signature = signature.substr(2); //remove 0x
  const r = "0x" + signature.slice(0, 64);
  const s = "0x" + signature.slice(64, 128);
  const v = web3.utils.hexToNumber("0x" + signature.slice(128, 130)) + 27;

  //Validate in smart contract
  let response = await exchange.methods
    .validateOrder(orderInfo, v, r, s)
    .send({ from: accounts[0] });

  return response.events.RecoveredAddress.returnValues.sender;
}
// ======================== //

// // === MAIN FLOW === //

(async function main() {
  await setupContracts();

  let wbtcAddress = WBTCArtifact.networks[netId].address;
  let wethAddress = WETHArtifact.networks[netId].address;

  //Input same timestamp as the one created order in client
  nowTimestamp = 1570752916653;

  const buyOrder = {
    senderAddress: accounts[1],
    matcherAddress: accounts[0],
    baseAsset: wethAddress,
    quotetAsset: wbtcAddress, // WBTC
    matcherFeeAsset: wethAddress, // WETH
    amount: 350000000,
    price: 2100000,
    matcherFee: 350000,
    nonce: nowTimestamp,
    expiration: nowTimestamp + 29 * 24 * 60 * 60,
    side: true //true = buy, false = sell
  };

  //Result from client script
  signature1 =
    "0xba5f9f696136c5956b7cba6a6fcf5016204a7fb0c8057db01784558f5263a3b07fa902cb364509a448e8ca6a76e2e81abd40576ff0170773f3cc69b33e4d6c0a00";

  const sellOrder = {
    senderAddress: accounts[2],
    matcherAddress: accounts[0],
    baseAsset: wethAddress,
    quotetAsset: wbtcAddress, // WBTC
    matcherFeeAsset: wethAddress, // WETH
    amount: 150000000,
    price: 2000000,
    matcherFee: 150000,
    nonce: nowTimestamp,
    expiration: nowTimestamp + 29 * 24 * 60 * 60,
    side: false //true = buy, false = sell
  };

  //Result from client script
  signature2 =
    "0x6682dba84661891be4f1df50e12e46d89fb7e7e1e1a917fd17cd9d7ab82d2c615d6bccf1c5960e107bc768bb27d9680c040f8a5bae9f1d74789f914d1540a50100";

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

  // FILL ORDERS
  let response = await exchange.methods
    .fillOrders(buyOrder, sellOrder, 2100000, 150000000)
    .send({ from: accounts[0], gas: 1e6 }); //matcher address is accounts 0

  console.log("\nTransaction successful? ", response.status);
  console.log("New Trade Event:\n", response.events.NewTrade.returnValues);

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

  //Validate order in solidity
  // sender = await validateSolidity(signature, orionOrder);
  // console.log(
  //   "\nValid Signature in solidity? ",
  //   sender === web3.utils.toChecksumAddress(orionOrder.senderAddress)
  // );
})();

//remix
// ["0xd632Db06A2AE8D1Be142b3309AB48BED08f9DeBF", "0xD88E683DD82458C400bcA10E708Eb0fB6D068e19", "0x0b8260891a9464056951963a0C03d3a531cAaF0B", "0x164D698328068b8740128FCE204f9F0c2632e157", "0x0b8260891a9464056951963a0C03d3a531cAaF0B", 150000000, 2000000, 150000, 1570220723491, 1572726323491, true]
