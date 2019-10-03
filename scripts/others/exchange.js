const Web3 = require("web3");
let web3 = new Web3("http://localhost:8545");

const exchangeArtifact = require("../build/contracts/Exchange.json");
const orionTokenArtifact = require("../build/contracts/ORN.json");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"; //this is WAN "asset address" for querying exchange balances

const owner = "0xb35d39bb41c69e4377a16c08eda54999175c1cdd";

// === CONTRACT INSTANCES === //

let exchange = new web3.eth.Contract(
  exchangeArtifact.abi,
  exchangeArtifact.networks[3].address
);

let orionToken = new web3.eth.Contract(
  orionTokenArtifact.abi,
  orionTokenArtifact.networks[3].address
);

// ======================== //

// === CONTRACT METHODS === //

//Orion token

async function totalSupply(user) {
  let supply = await orionToken.methods.totalSupply().call();
  console.log(web3.utils.fromWei(supply));
}

async function mint(user, amount) {
  await orionToken.methods
    .mint(user, web3.utils.toWei(String(amount)))
    .send({ from: owner });
  let balance = await orionToken.methods.balanceOf(user).call();
  console.log("New User Balance: ", web3.utils.fromWei(balance), "ORN");
}

async function balance(user) {
  let balance = await orionToken.methods.balanceOf(user).call();
  console.log("User Balance: ", web3.utils.fromWei(balance), "ORN");
}

//Exchange contracts
async function depositWan(value, from) {
  await exchange.methods.depositWan().send({ from, value });
}

async function getBalance(asset, user) {
  let balance = await exchange.methods.getBalance(asset, user).call();
  console.log(asset, web3.utils.fromWei(balance));
}

async function depositWan(value, from) {
  await exchange.methods.depositWan().send({ from, value });
  let balance = await exchange.methods.getBalance(ZERO_ADDRESS, from).call();
  console.log("Balance in Exchange:", web3.utils.fromWei(balance), "WAN");
}

// ======================== //

// === FUNCTION CALLS === //

// depositWan(web3.utils.toWei("1"), "0xb35d39bb41c69e4377a16c08eda54999175c1cdd");

// getBalance(ZERO_ADDRESS, "0xb35d39bb41c69e4377a16c08eda54999175c1cdd");

// totalSupply();

// mint("0xf8a1775286dddb8a0d2d35598d00f46873b4f8f6", 100);
