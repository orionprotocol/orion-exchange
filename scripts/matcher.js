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

  //Input same timestamp as the one created order in client
  nowTimestamp = 1570722872347;

  const buyOrder = {
    senderAddress: accounts[1],
    matcherAddress: accounts[0],
    baseAsset: WETHArtifact.networks[netId].address,
    quotetAsset: WBTCArtifact.networks[netId].address, // WBTC
    matcherFeeAsset: WETHArtifact.networks[netId].address, // WETH
    amount: 350000000,
    price: 2100000,
    matcherFee: 350000,
    nonce: nowTimestamp,
    expiration: nowTimestamp + 29 * 24 * 60 * 60,
    side: true //true = buy, false = sell
  };

  //Result from client script
  signature1 =
    "0x2aa3d4091783310bb9d33d5f3d892a389ba0a5f3dcd5c282fdcd3176a9946d9652b56e7e512f52664ae68b9106f5e91d49bd284ee3fbac9337c60168b9c722aa01";

  const sellOrder = {
    senderAddress: accounts[2],
    matcherAddress: accounts[0],
    baseAsset: WETHArtifact.networks[netId].address,
    quotetAsset: WBTCArtifact.networks[netId].address, // WBTC
    matcherFeeAsset: WETHArtifact.networks[netId].address, // WETH
    amount: 150000000,
    price: 2000000,
    matcherFee: 150000,
    nonce: nowTimestamp,
    expiration: nowTimestamp + 29 * 24 * 60 * 60,
    side: false //true = buy, false = sell
  };

  //Result from client script
  signature2 =
    "0x36b3697f8fd6b66f164a82eb4fe1b0de4c588f0276bc5c28eff5a32fd403015865768200a3bea86a64292c75f070017deed5f80a5a12fb24a75ff231245a3ddf01";

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

  //FILL ORDERS
  let response = await exchange.methods
    .fillOrders(buyOrder, sellOrder, 2100000, 150000000)
    .send({ from: accounts[0] }); //matcher address is accounts 0

  console.log(response);
  // sender = await validateSolidity(signature, orionOrder);
  // console.log(
  //   "\nValid Signature in solidity? ",
  //   sender === web3.utils.toChecksumAddress(orionOrder.senderAddress)
  // );
})();

//remix
// ["0xd632Db06A2AE8D1Be142b3309AB48BED08f9DeBF", "0xD88E683DD82458C400bcA10E708Eb0fB6D068e19", "0x0b8260891a9464056951963a0C03d3a531cAaF0B", "0x164D698328068b8740128FCE204f9F0c2632e157", "0x0b8260891a9464056951963a0C03d3a531cAaF0B", 150000000, 2000000, 150000, 1570220723491, 1572726323491, true]
