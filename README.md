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

Note, order tests are now imply that second and third accounts have private keys `0xc09ae3abc13c501fb9ff1c3c8ad3256678416f73a41433411f1714ae7b547fe3` and `ecbcd49667c96bcf8b30ccb35234a0b217ea039a8e097d3a70de9d28624ba520` correspondignly.

Tests can be run with:
```
truffle test
```
