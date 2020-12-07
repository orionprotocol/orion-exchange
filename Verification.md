# Etherscan verification
## Requirements
Install `truffle-plugin-verify` (`npm install truffle-plugin-verify`). Also, get etherscan API and put it into truffle-config like this
```
  plugins: ["truffle-contract-size", 'truffle-plugin-verify', ....],
  api_keys: {
    etherscan: process.env.ETHERSCAN_APIKEY
  }
```

## Verification
Due to proxy usage some contracts can be verified directly via plugin while others require more sophisticated method.

### Libs and PriceOracle verification
Libs and PriceOracle can be verified directly via:
```
truffle run verify MarginalFunctionality --network mainnet
truffle run verify LibUnitConverter --network mainnet
truffle run verify LibValidator --network mainnet
truffle run verify PriceOracle --network mainnet
```

### Exchange-proxy and Exchange
To verify proxy and exchange first it is necessary to identify them. To do it it is necessary to match migration script with contract creation transactions. Note that `deployProxy` may deploy 2 or 3 contracts: during first transaction in creates ProxyAdmin, target contract and AdminUpgradeabilityProxy; during subsequent - only target contract and AdminUpgradeabilityProxy.

To verify ProxyAdmin and AdminUpgradeabilityProxy it is necessary to find openzeppelin code (and compiler commands) which is used for compiling Proxy (at the time of writing they can be in [openzeppelin-upgrades github](https://github.com/OpenZeppelin/openzeppelin-upgrades/tree/master/packages/core/contracts/proxy)).

Most probably AdminUpgradeabilityProxy will be already verified (since it is commonly used contract).

To verify Exchange find correct address (for instance it is `0x5966E2A40e65954D229F020E989be296EC116746`) and verify it via command:
```
truffle run verify Exchange@0x5966E2A40e65954D229F020E989be296EC116746 --network mainnet
```

