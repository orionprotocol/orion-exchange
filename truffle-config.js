require("dotenv").config();
const HDWalletProvider = require("@truffle/hdwallet-provider");
const providerFactory = (network) =>
    new HDWalletProvider(
        process.env.MNEMONIC,
        `https://${network}.infura.io/v3/${process.env.INFURA_API_KEY}`,
        Number(process.env.MNEMONIC_ADDRESS_INDEX)
    );

module.exports = {
  plugins: [
    'truffle-plugin-verify'
  ],
  api_keys: {
    bscscan: process.env.BSCSCANAPIKEY
  },
  compilers: {
    solc: {
      version: '0.7.4',
      parser: "solcjs",
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
    },
    bsc_testnet: {
      provider: () => new HDWalletProvider(
          process.env.MNEMONIC,
          `https://data-seed-prebsc-1-s2.binance.org:8545`,
          Number(process.env.MNEMONIC_ADDRESS_INDEX)),
      network_id: 97,
      timeoutBlocks: 200,
      skipDryRun: true,
      production: true
    },
    bsc: {
      provider: () => new HDWalletProvider(
          process.env.MNEMONIC,
          `https://bsc-dataseed3.binance.org/`,
          Number(process.env.MNEMONIC_ADDRESS_INDEX)),
      network_id: 56,
      timeoutBlocks: 200,
      skipDryRun: true,
      gasPrice: 20e9,
      gas: 6721975
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
