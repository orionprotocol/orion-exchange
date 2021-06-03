require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-web3");
require("hardhat-gas-reporter");
require('hardhat-contract-sizer');

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.7.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./hardhat-tests",
    cache: "./cache",
    artifacts: "./artifacts"
  },

  networks: {
    hardhat: {
      allowUnlimitedContractSize: false
    },
  },
  mocha: {
    timeout: 20000
  }
};
