window.onload = function(e) {
  let res = document.getElementById("response");
  res.style.display = "none";

  let signBtn = document.getElementById("signBtn");

  wan3 = web3; // change to web3 and metamask

  signBtn.onclick = function(e) {
    if (wan3.eth.accounts[0] == null) {
      return;
    }

    const domain = [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
      { name: "salt", type: "bytes32" }
    ];
    const order = [
      { name: "senderAddress", type: "address" },
      { name: "matcherAddress", type: "address" },
      { name: "baseAsset", type: "address" },
      { name: "quoteAsset", type: "address" },
      { name: "matcherFeeAsset", type: "address" },
      { name: "amount", type: "uint64" },
      { name: "price", type: "uint64" },
      { name: "matcherFee", type: "uint64" },
      { name: "nonce", type: "uint64" },
      { name: "expiration", type: "uint64" },
      { name: "version", type: "string" }
    ];

    // Get domain data from contract called
    const domainData = {
      name: "Orion Exchange",
      version: "1",
      chainId: Number(wan3.version.network),
      verifyingContract: "0xb4a3f5b8d096aa03808853db807f1233a2515df2", // Update to exchange Contract
      salt: "0xf2d857f4a3edcb9b78b4d503bfe733db1e3f6cdc2b7971ee739626c97e86a557"
    };

    nowTimestamp = 1571843003887; //Date.now();

    const message = {
      senderAddress: "0x6Cac5eeB01d56E889AFac1f8D7f6666b344225E3",
      matcherAddress: "0xFF800d38664b546E9a0b7a72af802137629d4f11",
      baseAsset: "0xCcC7e9b85eA98AC308E14Bef1396ea848AA3fc2C", // WETH
      quoteAsset: "0x8f07FA50C14ed117771e6959f2265881bB919e00", // WBTC
      matcherFeeAsset: "0xCcC7e9b85eA98AC308E14Bef1396ea848AA3fc2C", // WETH
      amount: 350000000, //3.5 ETH * 10^8
      price: 2100000, //0.021 WBTC/WETH * 10^8
      matcherFee: 350000,
      nonce: nowTimestamp,
      expiration: nowTimestamp + 29 * 24 * 60 * 60 * 1000, // milliseconds
      side: "buy"
    };

    const data = JSON.stringify({
      types: {
        EIP712Domain: domain,
        Order: order
      },
      domain: domainData,
      primaryType: "Order",
      message: message
    });

    const signer = wan3.toChecksumAddress(wan3.eth.accounts[0]);

    wan3.currentProvider.sendAsync(
      // wan3.currentProvider.send(
      {
        method: "eth_signTypedData_v3",
        params: [signer, data],
        from: signer
      },
      function(err, result) {
        if (err || result.error) {
          return console.error(result);
        }
        const signature = result.result.substring(2);
        const r = "0x" + signature.substring(0, 64);
        const s = "0x" + signature.substring(64, 128);
        const v = parseInt(signature.substring(128, 130), 16);
        res.style.display = "block";
        res.value = `Signature: \nr:${r}\ns:${s}\nv:${v}`;
      }
    );
  };
};
