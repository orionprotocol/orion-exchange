const Web3 = require("web3");
var net = require("net");
var web3 = new Web3("/home/wafflemakr/.wanchain/testnet/gwan.ipc", net);

const tokenContract = require("../../build/contracts/WBTC.json");

let token = new web3.eth.Contract(tokenContract.abi);
token
  .deploy({
    data: tokenContract.bytecode
  })
  .send({
    from: "0xb35d39bb41c69e4377a16c08eda54999175c1cdd", //account must be unlocked in node
    gas: "4700000"
  })
  .on("error", e => console.log(e))
  .on("receipt", receipt => {
    console.log("New Token Address: ", receipt.contractAddress);
  });
