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
      network_id: "*",
      gas: 4712388,
      gasPrice: 180e9,
      from: "0xb35d39bb41c69e4377a16c08eda54999175c1cdd" // change this to the unlocked account in your gwan node
    },
    wanache: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "5777",
      gas: 6721975
    },
    development: {
      host: "127.0.0.1",
      port: 8544,
      network_id: "999",
      gas: 6000000
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
