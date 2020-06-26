window.onload = function (e) {
  const Web3 = window.Web3;

  const web3 = new Web3(window.ethereum);
  window.web3 = web3;

  const verifyBtn = document.getElementById("verifyBtn");
  const signBtn = document.getElementById("signBtn");

  var res = document.getElementById("response");
  var res2 = document.getElementById("validation");

  let from, signature, message;
  const exchangeAddress = "0xfe932D9B595C6f30b60338E4005c628Dee361c39";

  (async function connect() {
    await ethereum.enable();
    const accounts = await web3.eth.getAccounts();
    from = accounts[0];
    console.log(from);
  })();

  // eth_signTypedData_v3
  signBtn.onclick = async () => {
    const domain = [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "salt", type: "bytes32" },
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
      { name: "side", type: "string" },
    ];

    console.log("Chain ID: ", Number(web3.givenProvider.networkVersion));

    // Get domain data from contract called
    const domainData = {
      name: "Orion Exchange",
      version: "1",
      chainId: Number(web3.givenProvider.networkVersion),
      salt:
        "0xf2d857f4a3edcb9b78b4d503bfe733db1e3f6cdc2b7971ee739626c97e86a557",
    };

    nowTimestamp = 1571843003887; //Date.now();

    message = {
      senderAddress: web3.utils.toChecksumAddress(from),
      matcherAddress: "0xFF800d38664b546E9a0b7a72af802137629d4f11",
      baseAsset: "0xCcC7e9b85eA98AC308E14Bef1396ea848AA3fc2C", // WETH
      quoteAsset: "0x8f07FA50C14ed117771e6959f2265881bB919e00", // WBTC
      matcherFeeAsset: "0xCcC7e9b85eA98AC308E14Bef1396ea848AA3fc2C", // WETH
      amount: 350000000, //3.5 ETH * 10^8
      price: 2100000, //0.021 WBTC/WETH * 10^8
      matcherFee: 350000,
      nonce: nowTimestamp,
      expiration: nowTimestamp + 29 * 24 * 60 * 60 * 1000, // milliseconds
      side: "buy",
    };

    console.log("Order: ", [
      message.senderAddress,
      message.matcherAddress,
      message.baseAsset,
      message.quoteAsset,
      message.matcherFeeAsset,
      message.amount,
      message.price,
      message.matcherFee,
      message.nonce,
      message.expiration,
      message.side,
    ]);

    const data = JSON.stringify({
      types: {
        EIP712Domain: domain,
        Order: order,
      },
      domain: domainData,
      primaryType: "Order",
      message: message,
    });

    const signer = web3.utils.toChecksumAddress(from);

    web3.currentProvider.sendAsync(
      {
        method: "eth_signTypedData_v3",
        params: [signer, data],
        from: signer,
      },
      function (err, result) {
        if (err || result.error) {
          return console.error(result);
        }
        signature = result.result.substring(2);
        const r = "0x" + signature.substring(0, 64);
        const s = "0x" + signature.substring(64, 128);
        const v = parseInt(signature.substring(128, 130), 16);
        console.log(`Signature: \nr:${r}\ns:${s}\nv:${v}`);
        res.value = `EthSignTypedV3: \n0x${signature}`;
      }
    );
  };

  verifyBtn.onclick = async () => {
    message.signature = "0x" + signature;
    const contract = new web3.eth.Contract(abi, exchangeAddress);

    const isValid = await contract.methods.validateOrder(message).call();

    res2.value = `Valid Signature for Order using Solidity? ${isValid}`;
  };
};
