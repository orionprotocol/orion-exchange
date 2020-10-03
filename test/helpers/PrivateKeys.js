// Private keys used for testing

function getPrivKey(address) {
  //Predefined list of private keys
  privkeys = {
    "0x87A6561188b19c5ceEd935492F6827cf530e0B8A":"c09ae3abc13c501fb9ff1c3c8ad3256678416f73a41433411f1714ae7b547fe3",
    "0xDc966DCB447004dF677c8A509dd24A070AE93Bf2":"ecbcd49667c96bcf8b30ccb35234a0b217ea039a8e097d3a70de9d28624ba520"
  }
  return Buffer.from(privkeys[address], "hex");
};

module.exports = Object({
    getPrivKey: getPrivKey
});


