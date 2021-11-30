require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-web3");
require("hardhat-gas-reporter");
require('hardhat-contract-sizer');
require("@nomiclabs/hardhat-etherscan");
require('@openzeppelin/hardhat-upgrades');
require("dotenv").config();

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
    eth: {
      url: `https:/mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [`0x${process.env.MAINNET_DEPLOYER}`],
      gasPrice: 72e9
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [`0x${process.env.TESTNET_DEPLOYER}`],
    }
  },
  mocha: {
    timeout: 20000
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCANAPIKEY
  }
};
