const ORN = artifacts.require("ORN");
const Exchange = artifacts.require("Exchange");

module.exports = function(deployer) {
  deployer.deploy(ORN).then(() => deployer.deploy(Exchange));
};
