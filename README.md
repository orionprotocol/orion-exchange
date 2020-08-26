# orion-exchange
Exchange contracts for the Orion Protocol
# Compiling
Compilation rely onto Truffle. Truffle can be installed by
```
npm install -g truffle
```

Contract compilation
```
git clone https://github.com/orionprotocol/orion-exchange
cd orion-exchange
npm install
truffle compile
```
## Testing
Adjust `truffle-config.js`: update ip and port of testing network node (ganache is recommended).

Note, order tests are now imply that second and third accounts have private keys `0x4f1c10dbf5a4c833e0f1e091ce06ba339c3194d249de8906a2b2ca642be07966` and `0x4f1c10dbf5a4c833e0f1e091ce06ba339c3194d249de8906a2b2ca642be07966` correspondignly.

Tests can be run with:
```
truffle test
```
