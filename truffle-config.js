require("dotenv").config();
const HDWalletProvider = require("@truffle/hdwallet-provider");
const providerFactory = (network) =>
    new HDWalletProvider(
        process.env.MNEMONIC,
        `https://${network}.infura.io/v3/${process.env.INFURA_API_KEY}`,
        Number(process.env.MNEMONIC_ADDRESS_INDEX)
    );

module.exports = {
  compilers: {
    solc: {
      version: '0.7.4',
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        },
      }
    }
  },
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
      gas: 6721975
    },
    ropsten: {
      provider: () => providerFactory("ropsten"),
      network_id: "3",
      gasPrice: 25e9,
      gas: 6721975,
    },
    mainnet: {
      provider: () => providerFactory("mainnet"),
      network_id: "1",
      gasPrice: 37e9,
      gas: 6721975,
    }
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
