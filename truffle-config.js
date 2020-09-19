require("dotenv").config();
const HDWalletProvider = require("truffle-hdwallet-provider");

module.exports = {
  compilers: {
    solc: {
      version: "0.6.2",
      // evmVersion: "byzantium",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "999",
      gas: 6721975,
      from: "0x964a4993cDA8441c6f0b980107C4B6eFdE424de4"
    },
    ropsten: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMOMIC,
          `https://ropsten.infura.io/v3/${process.env.INFURA_API_KEY}`
        );
      },
      network_id: "3",
      gasPrice: 25e9,
      gas: 6721975,
    },
  },
  mocha: {
    enableTimeouts: false,
    useColors: true,
    reporter: "eth-gas-reporter",
    reporterOptions: {
      currency: "USD",
      gasPrice: 10,
    },
  },
};
