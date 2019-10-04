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

  //Input same timestamp as created order in client
  nowTimestamp = 1570228600024;

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
    "0x65a5849f14846b0180a9e3a88c7d544caec0f5ef961949da36443c596beb359c1d8f7d865576f58f93144435fa6fc278fc70f81c6a977ef09809141cb10aa0d900";

  //Matcher validates order
  let sender = await validateSignature(signature, orionOrder);
  console.log(
    "\nValid Signature in matcher? ",
    sender === web3.utils.toChecksumAddress(orionOrder.senderAddress)
  );

  sender = await validateSolidity(signature, orionOrder);

  console.log(
    "\nValid Signature in solidity? ",
    sender === web3.utils.toChecksumAddress(orionOrder.senderAddress)
  );
})();

//remix
// ["0xd632Db06A2AE8D1Be142b3309AB48BED08f9DeBF", "0xD88E683DD82458C400bcA10E708Eb0fB6D068e19", "0x0b8260891a9464056951963a0C03d3a531cAaF0B", "0x164D698328068b8740128FCE204f9F0c2632e157", "0x0b8260891a9464056951963a0C03d3a531cAaF0B", 150000000, 2000000, 150000, 1570220723491, 1572726323491, true]
