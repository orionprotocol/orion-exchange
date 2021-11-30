// Private keys used for testing

function getPrivKey(address) {
  //Predefined list of private keys
  privkeys = {
    "0x53d3d7f780ddD042a7598Dc66d6b91C010f99A94":"b636b33b094b750a6b7648a39eb569a2c617801ca625fba2d1237ed63f5dc0d9",
    "0x7c6cb4481ab4B2E095FBc4891325bD9C65feCf78":"94b36a0b76a9a60d31e71677b97992c0b26cbfd39dfc8884914812d439e42d77",
    "0x2C3D281e47435ED4A81a7729CFF9e037ba26ad2b":"d712b8bc98f6489a13159d57490421091d79e0a19a19ef3b14eb05098709ecfb",
    "0x01384F74bfd3029c499b762D98F9f6f21e099Ff0":"02b3df9a94f7358ca74e6fb97c5b875e8202ec3be130944cbf9d56c5f7af7a62",
    "0x87A6561188b19c5ceEd935492F6827cf530e0B8A":"c09ae3abc13c501fb9ff1c3c8ad3256678416f73a41433411f1714ae7b547fe3",
    "0xDc966DCB447004dF677c8A509dd24A070AE93Bf2":"ecbcd49667c96bcf8b30ccb35234a0b217ea039a8e097d3a70de9d28624ba520"
  }
  return Buffer.from(privkeys[address], "hex");
};

module.exports = Object({
    getPrivKey: getPrivKey
});


