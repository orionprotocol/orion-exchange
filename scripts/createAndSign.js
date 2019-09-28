const Web3 = require("web3");
let web3 = new Web3("http://localhost:8545");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// === CREATE ORDER === //

async function createAndSign(
  sender,
  matcher,
  base,
  quotet,
  feeAsset,
  amount,
  price,
  nonce
) {
  let message = await web3.utils.soliditySha3(
    "order",
    sender,
    matcher,
    base,
    quotet,
    amount,
    price
  );

  //Wanmask
  //   let signedMessage = await window.wan3.eth.sign(
  //     sender,
  //     message
  //   );

  //Web3 v1
  let signedMessage = await web3.eth.sign(message, sender);

  //Web3 v0.2
  //   let signedMessage = await web3.eth.sign(sender, message);

  console.log("Signed Data: ", signedMessage);
}

// ======================== //

// === FUNCTION CALLS === //
let senderAddress = "0xf8a1775286dddb8a0d2d35598d00f46873b4f8f6";
let matcherAddress = "0xb35d39bb41c69e4377a16c08eda54999175c1cdd";
let baseAsset = ZERO_ADDRESS; //ETH or WAN (base currency)
let quotetAsset = "0x0284fd64d75d76948076C5f0918159D86bC0Af6D"; // ORN token
let matcherFeeAsset = ZERO_ADDRESS;
let amount = 150000000;
let price = 2000000;
let matcherFee = 150000;
let nonce = web3.utils.hexToNumberString(web3.utils.randomHex(32));
let side;

createAndSign(
  senderAddress,
  matcherAddress,
  baseAsset,
  quotetAsset,
  matcherFeeAsset,
  amount,
  price,
  nonce
);
