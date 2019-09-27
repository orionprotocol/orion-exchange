const ORN = artifacts.require("ORN");
const Exchange = artifacts.require("Exchange");

module.exports = function(deployer, network) {
  deployer.deploy(ORN).then(() => deployer.deploy(Exchange));
};
