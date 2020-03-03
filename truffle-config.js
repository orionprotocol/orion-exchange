require('dotenv').config();
const HDWalletProvider = require('truffle-hdwallet-provider');

module.exports = {
  compilers: {
    solc: {
      version: "0.5.10",
      // evmVersion: "byzantium",
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    gwan: {
      host: "localhost",
      port: 8545,
      network_id: "3",
      gas: 4712388,
      gasPrice: 180e9,
      from: "0xae549def8e6637e0e61973b8fefb46428890f13f" // change this to the unlocked account in your gwan node
    },
    wanache: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "5777",
      gas: 6721975
    },
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "5777",
      gas: 6721975
    },
    testnet: {
      provider: () => {
        return new HDWalletProvider(
            process.env.MNEMOMIC,
            `https://ropsten.infura.io/v3/${process.env.INFURA_API_KEY}`
        );
      },
      network_id: "3",
      gasPrice: 25e9,
      gas: 6721975
    }
  },
  mocha: {
    enableTimeouts: false,
    useColors: true,
    reporter: "eth-gas-reporter",
    reporterOptions: {
      currency: "USD",
      gasPrice: 10
    }
  }
};
