const Web3 = require("web3");
var net = require("net");
var web3 = new Web3("/home/wafflemakr/.wanchain/testnet/gwan.ipc", net);

const orionTokenArtifact = require("../build/contracts/ORN.json");

let orion = new web3.eth.Contract(orionTokenArtifact.abi);
orion
  .deploy({
    data: orionTokenArtifact.bytecode
  })
  .send({
    from: "0xb35d39bb41c69e4377a16c08eda54999175c1cdd", //account must be unlocked in node
    gas: "4700000"
  })
  .on("error", e => console.log(e))
  .on("receipt", receipt => {
    console.log("New Contract Address: ", receipt.contractAddress);
  });
