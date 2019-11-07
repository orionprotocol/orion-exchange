const Web3 = require("web3");
// const Wan3 = require("wan3");

const web3 = new Web3("http://localhost:8545"); // gwan
// const wan3 = new Wan3("http://localhost:8545"); // gwan

const Long = require("long");

const WETHArtifact = require("../build/contracts/WETH.json");
const WBTCArtifact = require("../build/contracts/WBTC.json");
const exchangeArtifact = require("../build/contracts/Exchange.json");

// === CONTRACT INSTANCES === //

let exchange, weth, wbtc, netId, accounts;

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

  accounts = await web3.eth.getAccounts();
}

function longToBytes(long) {
  return web3.utils.bytesToHex(Long.fromNumber(long).toBytesBE());
}

// === Hash Order=== //

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

// === SIGN ORDER === //
async function signOrder(orderInfo) {
  const msgParams = [
    { name: "senderAddress", type: "address", value:orderInfo.senderAddress },
    { name: "matcherAddress", type: "address", value:orderInfo.matcherAddress  },
    { name: "baseAsset", type: "address", value:orderInfo.baseAsset  },
    { name: "quoteAsset", type: "address", value:orderInfo.quoteAsset  },
    { name: "matcherFeeAsset", type: "address", value:orderInfo.matcherFeeAsset  },
    { name: "amount", type: "uint64", value:orderInfo.amount  },
    { name: "price", type: "uint64", value:orderInfo.price  },
    { name: "matcherFee", type: "uint64", value:orderInfo.matcherFee  },
    { name: "nonce", type: "uint64", value:orderInfo.nonce  },
    { name: "expiration", type: "uint64", value:orderInfo.expiration  },
    { name: "side", type: "string", value:orderInfo.side  }
  ];
  // console.log(orderInfo.senderAddress)
  let from = web3.utils.toChecksumAddress(orderInfo.senderAddress);
  // let from = wan3.utils.toChecksumAddress(orderInfo.senderAddress);
  let params = [msgParams, from];
  // console.log(params);
  let method = "eth_signTypedData";

  // web3.currentProvider.send({ jsonrpc: '2.0', method: 'evm_increaseTime', params: ['60']


  // web3.currentProvider.send(
  //   {
  //     jsonrpc: '1.0',
  //     method,
  //     params,
  //     id:'10',
  //     from
  //   },
  //   function(err, result) {
  //     if (err) return console.dir(err);
  //     if (result.error) {
  //       return console.log(result.error);
  //     }
  //     let sign = result.result;
  //     console.log("EthSignTyped SIGNED:" + JSON.stringify(sign));
      
  //   }
  // );
  await web3.currentProvider.send(
    {
      method,
      params,
      from
    }
  );

  
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

async function mint(wbtcAddress, wethAddress, exchangeAddress) {
  //Mint WBTC to Buyer
  await wbtc.methods
    .mint(accounts[1], String(10e8))
    .send({ from: accounts[0] });

  //Buyer Approves Token Transfer to exchange
  await wbtc.methods
    .approve(exchangeAddress, String(10e8))
    .send({ from: accounts[1] });

  //Buyer Deposits all WBTC
  await exchange.methods
    .depositAsset(wbtcAddress, String(10e8))
    .send({ from: accounts[1] });

  //Mint WETH to Seller
  await weth.methods
    .mint(accounts[2], web3.utils.toWei("10"))
    .send({ from: accounts[0] });

  //Seller Approves Token Transfer to exchange
  await weth.methods
    .approve(exchangeAddress, web3.utils.toWei("10"))
    .send({ from: accounts[2] });

  //Seller Deposits all WETH
  await exchange.methods
    .depositAsset(wethAddress, web3.utils.toWei("10"))
    .send({ from: accounts[2] });
}

(async function main() {
  await setupContracts();
  let wbtcAddress = WBTCArtifact.networks[netId].address;
  let wethAddress = WETHArtifact.networks[netId].address;
  let exchangeAddress = exchangeArtifact.networks[netId].address;

  // await mint(wbtcAddress, wethAddress, exchangeAddress);

  nowTimestamp = 1571843003887; //Date.now();

  //Client1 Order
  const buyOrder = {
    senderAddress: accounts[1],
    matcherAddress: accounts[0],
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
  let signature1 = await signOrder(buyOrder);

  return null;
  console.log("Message: ", hashOrder(buyOrder));
  console.log("Signature: ", signature1);
  buyOrder.signature = signature1;
  console.log("Signed By: ", buyOrder.senderAddress);
  console.log("Buy Order Struct: \n", buyOrder);
  console.log(
    "\nBuy Matcher Order Struct: \n",
    JSON.stringify(toMatcherOrder(buyOrder), null, 2)
  );

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

  //Client2 signs sell order
  let signature2 = await signOrder(sellOrder);
  console.log("\nMessage: ", hashOrder(sellOrder));
  sellOrder.signature = signature2;
  console.log("Signed Data: ", signature2);
  console.log("Signed By: ", sellOrder.senderAddress);
  console.log("Sell Order Struct: \n", sellOrder);
  console.log(
    "\nSell Matcher Order Struct: \n",
    JSON.stringify(toMatcherOrder(sellOrder), null, 2)
  );
})();
