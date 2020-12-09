const Orion = artifacts.require("Orion");
const PriceOracle = artifacts.require("PriceOracle");
const Exchange = artifacts.require("Exchange");
const LibValidator = artifacts.require("LibValidator");
const LibUnitConverter = artifacts.require("LibUnitConverter");
const MarginalFunctionality = artifacts.require("MarginalFunctionality");

module.exports = async (deployer, network) => {
  if (network === "mainnet") {
    const oracleAddress = "0x3b9E04C53B45A9386de378ab9c27dddd4E15725F";
    const priceOracleInstance = await PriceOracle.deployed();
    await priceOracleInstance.changePriceProviderAuthorization([oracleAddress],[]);
  }
};




