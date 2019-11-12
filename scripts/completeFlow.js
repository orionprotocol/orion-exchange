const Web3 = require("web3");
const web3 = new Web3("http://localhost:8545"); // gwan
// const web3 = new Web3("http://localhost:8544"); // ganache

const sigUtil = require("eth-sig-util");

const Long = require("long");

require("dotenv").config();

const WETHArtifact = require("../build/contracts/WETH.json");
const WBTCArtifact = require("../build/contracts/WBTC.json");
const exchangeArtifact = require("../build/contracts/Exchange.json");

// === CONTRACT INSTANCES === //

let exchange, weth, wbtc, netId, matcher;

async function setupContracts() {
  netId = await web3.eth.net.getId();

  exchange = new web3.eth.Contract(
    exchangeArtifact.abi,
    exchangeArtifact.networks[netId].address
  );

  weth = new web3.eth.Contract(
    WETHArtifact.abi,
    WETHArtifact.networks[netId].address
  );

  wbtc = new web3.eth.Contract(
    WBTCArtifact.abi,
    WBTCArtifact.networks[netId].address
  );

  const accounts = await web3.eth.getAccounts();

  matcher = accounts[0];
}

// === SIGN ORDER === //
async function signOrder(orderInfo, privKeyHex) {
  const privKey = Buffer.from(privKeyHex, "hex");

  let msgParams = getMsgParams(orderInfo);

  msgParams = { data: msgParams };

  return sigUtil.signTypedDataLegacy(privKey, msgParams);
}

// === FILL ORDERS ===
async function fillOrdersByMatcher(buyOrder, sellOrder, fillPrice, fillAmount) {
  let response = await exchange.methods
    .fillOrders(buyOrder, sellOrder, fillPrice, fillAmount)
    .send({ from: matcher, gas: 1e6 }); //matcher address is accounts 0

  console.log("\nTransaction successful? ", response.status);
  console.log("New Trade Event:\n", response.events.NewTrade.returnValues);
}

// === VALIDATE ORDER IN SOLIDITY === //
async function validateSigSolidity(orderInfo) {
  //Validate in smart contract
  let response = await exchange.methods.validateV1(orderInfo).call();

  return response;
}
// ======================== //

// === VALIDATE ORDER IN MATCHER === //
async function validateSigJS(signature, orderInfo) {
  let msgParams = getMsgParams(orderInfo);

  msgParams = { data: msgParams };

  return sigUtil.recoverTypedSignatureLegacy({
    data: msgParams.data,
    sig: signature
  });
}
// ======================== //

function getMsgParams(orderInfo) {
  let msgParams = [
    { type: "uint8", name: "version", value: 3 },
    { name: "senderAddress", type: "address", value: orderInfo.senderAddress },
    {
      name: "matcherAddress",
      type: "address",
      value: orderInfo.matcherAddress
    },
    { name: "baseAsset", type: "address", value: orderInfo.baseAsset },
    { name: "quoteAsset", type: "address", value: orderInfo.quoteAsset },
    {
      name: "matcherFeeAsset",
      type: "address",
      value: orderInfo.matcherFeeAsset
    },
    { name: "amount", type: "uint64", value: orderInfo.amount },
    { name: "price", type: "uint64", value: orderInfo.price },
    { name: "matcherFee", type: "uint64", value: orderInfo.matcherFee },
    { name: "nonce", type: "uint64", value: orderInfo.nonce },
    { name: "expiration", type: "uint64", value: orderInfo.expiration },
    { name: "side", type: "string", value: orderInfo.side }
  ];

  return msgParams;
}

// // === MAIN FLOW === //

function toMatcherOrder(bo) {
  return {
    version: 3,
    senderPublicKey: bo.senderAddress,
    matcherPublicKey: bo.matcherAddress,
    orderType: bo.side,
    assetPair: {
      amountAsset: bo.baseAsset,
      priceAsset: bo.quoteAsset
    },
    price: bo.price,
    amount: bo.amount,
    timestamp: bo.nonce,
    expiration: bo.expiration,
    matcherFee: bo.matcherFee,
    matcherFeeAssetId: bo.matcherFeeAsset,
    proofs: [bo.signature]
  };
}

function compare(address1, address2) {
  return (
    web3.utils.toChecksumAddress(address1) ===
    web3.utils.toChecksumAddress(address2)
  );
}

async function mint(wbtcAddress, wethAddress, exchangeAddress, buyer, seller) {
  //Mint WBTC to Buyer
  await wbtc.methods.mint(buyer, String(10e8)).send({ from: matcher });

  //Buyer Approves Token Transfer to exchange
  await wbtc.methods
    .approve(exchangeAddress, String(10e8))
    .send({ from: buyer });

  //Buyer Deposits all WBTC
  await exchange.methods
    .depositAsset(wbtcAddress, String(10e8))
    .send({ from: buyer });

  //Mint WETH to Seller
  await weth.methods
    .mint(seller, web3.utils.toWei("10"))
    .send({ from: matcher });

  //Seller Approves Token Transfer to exchange
  await weth.methods
    .approve(exchangeAddress, web3.utils.toWei("10"))
    .send({ from: seller });

  //Seller Deposits all WETH
  await exchange.methods
    .depositAsset(wethAddress, web3.utils.toWei("10"))
    .send({ from: seller });
}

(async function main() {
  await setupContracts();

  // === CLIENT FLOW === //

  let buyer, seller;

  if (netId === 3) {
    console.log("Using Local Gwan Node");
    buyer = {
      account: "0x29c76e6ad8f28bb1004902578fb108c507be341b",
      privKey: process.env.BUYER_PVK
    };

    seller = {
      account: "0x872EBd28680753C942DD7FAFf0332F7B3F83aD73",
      privKey: process.env.SELLER_PVK
    };
  }

  if (netId === 999) {
    console.log("Using Ganache Network");
    buyer = {
      account: "0x87a6561188b19c5ceed935492f6827cf530e0b8a",
      privKey:
        "c09ae3abc13c501fb9ff1c3c8ad3256678416f73a41433411f1714ae7b547fe3"
    };

    seller = {
      account: "0xdc966dcb447004df677c8a509dd24a070ae93bf2",
      privKey:
        "ecbcd49667c96bcf8b30ccb35234a0b217ea039a8e097d3a70de9d28624ba520"
    };
  }

  const wbtcAddress = WBTCArtifact.networks[netId].address;
  const wethAddress = WETHArtifact.networks[netId].address;
  const exchangeAddress = exchangeArtifact.networks[netId].address;

  // await mint(
  //   wbtcAddress,
  //   wethAddress,
  //   exchangeAddress,
  //   buyer.account,
  //   seller.account
  // );

  nowTimestamp = 1571843003887; //Date.now();

  //Client1 Order
  const buyOrder = {
    senderAddress: buyer.account,
    matcherAddress: matcher,
    baseAsset: wethAddress,
    quoteAsset: wbtcAddress, // WBTC
    matcherFeeAsset: wethAddress, // WETH
    amount: 350000000, //3.5 ETH * 10^8
    price: 2100000, //0.021 WBTC/WETH * 10^8
    matcherFee: 350000,
    nonce: nowTimestamp,
    expiration: nowTimestamp + 29 * 24 * 60 * 60 * 1000, // milliseconds
    side: "buy"
  };

  //Client1 signs buy order
  let signature1 = await signOrder(buyOrder, buyer.privKey);

  console.log("\nSignature: ", signature1);
  buyOrder.signature = signature1;
  console.log("Signed By: ", buyOrder.senderAddress);
  // console.log("Buy Order Struct: \n", buyOrder);
  console.log(
    "Buy Matcher Order Struct: \n",
    JSON.stringify(toMatcherOrder(buyOrder), null, 2)
  );

  const sellOrder = {
    senderAddress: seller.account,
    matcherAddress: matcher,
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

  //Client2 signs sell order
  let signature2 = await signOrder(sellOrder, seller.privKey);
  sellOrder.signature = signature2;
  console.log("\nSigned Data: ", signature2);
  console.log("Signed By: ", sellOrder.senderAddress);
  // console.log("Sell Order Struct: \n", sellOrder);
  console.log(
    "Sell Matcher Order Struct: \n",
    JSON.stringify(toMatcherOrder(sellOrder), null, 2)
  );

  // === MATCHER FLOW === //

  //Matcher validates orders in JS
  let sender1 = await validateSigJS(buyOrder.signature, buyOrder);
  console.log(
    "\nValid Signature for Buy Order using JS? ",
    compare(sender1, buyOrder.senderAddress)
  );

  let sender2 = await validateSigJS(sellOrder.signature, sellOrder);
  console.log(
    "Valid Signature for Sell Order using JS? ",
    compare(sender2, sellOrder.senderAddress)
  );

  //Matcher validates orders in Solidity
  sender1 = await validateSigSolidity(buyOrder);
  console.log(
    "\nValid Signature for Buy Order using Solidity? ",
    sender1 === buyOrder.senderAddress
  );

  sender2 = await validateSigSolidity(sellOrder);
  console.log(
    "Valid Signature for Sell Order using Solidity? ",
    sender2 === sellOrder.senderAddress
  );
  return;

  // *** ==== FILL ORDERS ==== *** //

  //Initial Balances
  let balances1 = await exchange.methods
    .getBalances([wethAddress, wbtcAddress], buyer.account)
    .call();
  console.log("\nInitial Balances");
  console.log(
    "BUYER INITIAL BALANCES:\nWETH: ",
    balances1[0],
    "WBTC: ",
    balances1[1]
  );

  let balances2 = await exchange.methods
    .getBalances([wethAddress, wbtcAddress], seller.account)
    .call();
  console.log(
    "SELLER INITIAL BALANCES:\nWETH: ",
    balances2[0],
    "WBTC: ",
    balances2[1]
  );

  // Call FillOrders function in Exchange Contract
  await fillOrdersByMatcher(buyOrder, sellOrder, 2100000, 150000000);

  //Final Balances
  balances1 = await exchange.methods
    .getBalances([wethAddress, wbtcAddress], buyer.account)
    .call();
  console.log(
    "\nBUYER FINAL BALANCES:\nWETH: ",
    balances1[0],
    "WBTC: ",
    balances1[1]
  );

  balances2 = await exchange.methods
    .getBalances([wethAddress, wbtcAddress], seller.account)
    .call();
  console.log(
    "SELLER FINAL BALANCES:\nWETH: ",
    balances2[0],
    "WBTC: ",
    balances2[1]
  );
  // ============================= //
})();
