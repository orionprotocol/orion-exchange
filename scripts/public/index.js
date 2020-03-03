window.onload = function(e) {
  const myWeb3 = window.Web3;

  const mywan3 = new myWeb3(window.wan3.currentProvider); // wanmask
  // const mywan3 = new myWeb3(window.web3.currentProvider); // metamask
  // console.log(mywan3);

  // const wan3 = window.web3;
  // const wan3 = new Web3(window.web3.currentProvider); // metamask

  const signBtn = document.getElementById("signBtn");
  const signBtn2 = document.getElementById("signBtn2");
  const signBtn3 = document.getElementById("signBtn3");

  var res = document.getElementById("response");
  res.style.display = "none";

  // Personal Sign
  signBtn.onclick = async () => {
    // const accounts = await wan3.eth.getAccounts();

    const accounts = wan3.eth.accounts;

    if (accounts[0] == null) {
      alert("Connect to web3 Wallet");
      return;
    }

    // === Hash Order=== //

    function hashOrder(orderInfo) {
      let message = mywan3.utils.soliditySha3(
        "0x03",
        orderInfo.senderAddress,
        orderInfo.matcherAddress,
        orderInfo.baseAsset,
        orderInfo.quoteAsset,
        orderInfo.matcherFeeAsset,
        "0x0000000014dc9380",
        "0x0000000000200b20",
        "0x0000000000055730",
        "0x0000016df924d5ef",
        "0x0000016e8e7d41ef",
        orderInfo.side === "buy" ? "0x00" : "0x01"
      );

      return message;
    }

    nowTimestamp = 1571843003887; //Date.now();

    const orderInfo = {
      senderAddress: accounts[0],
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

    let message = hashOrder(orderInfo);

    console.log("Message signed: ", message);

    wan3.eth.sign(orderInfo.senderAddress, message, (e, r) => {
      console.log(r);
      res.style.display = "block";
      res.value = "\nPersonal Signature: " + r;
    });
  };

  // eth_signTypedData
  signBtn2.onclick = async () => {
    // const accounts = await wan3.eth.getAccounts();
    // const accounts = wan3.eth.accounts;

    const accounts = await mywan3.eth.getAccounts();

    if (accounts[0] == null) {
      alert("Connect to web3 Wallet");
      return;
    }
    nowTimestamp = 1571843003887; //Date.now();

    const message = {
      version: 3,
      senderAddress: accounts[0],
      matcherAddress: "0xB35d39BB41C69E4377A16C08EDA54999175c1cdD",
      baseAsset: "0x16D0770f8Dd8B3F3Ce75f39ce6A7626EDf7c2af4", // WETH
      quoteAsset: "0x092Ca292Ba7b104c551c89013F10e366203a4E5e", // WBTC
      matcherFeeAsset: "0x16D0770f8Dd8B3F3Ce75f39ce6A7626EDf7c2af4", // WETH
      amount: 350000000, //3.5 ETH * 10^8
      price: 2100000, //0.021 WBTC/WETH * 10^8
      matcherFee: 350000,
      nonce: nowTimestamp,
      expiration: nowTimestamp + 29 * 24 * 60 * 60 * 1000, // milliseconds
      side: "buy"
    };

    console.log([
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
      message.side
    ]);

    const msgParams = [
      { type: "uint8", name: "version", value: message.version },
      { type: "address", name: "senderAddress", value: message.senderAddress },
      {
        type: "address",
        name: "matcherAddress",
        value: message.matcherAddress
      },
      { type: "address", name: "baseAsset", value: message.baseAsset },
      { type: "address", name: "quoteAsset", value: message.quoteAsset },
      {
        type: "address",
        name: "matcherFeeAsset",
        value: message.matcherFeeAsset
      },
      { type: "uint64", name: "amount", value: message.amount },
      { type: "uint64", name: "price", value: message.price },
      { type: "uint64", name: "matcherFee", value: message.matcherFee },
      { type: "uint64", name: "nonce", value: message.nonce },
      { type: "uint64", name: "expiration", value: message.expiration },
      { type: "string", name: "side", value: message.side }
    ];

    // const from = wan3.utils.toChecksumAddress(wan3.eth.accounts[0]); v 1.0
    // const from = wan3.toChecksumAddress(wan3.eth.accounts[0]); // v 0.2
    const from = wan3.toChecksumAddress(accounts[0]); // v 0.2

    const params = [msgParams, from];
    const method = "eth_signTypedData";

    // window.web3.currentProvider.sendAsync(
    wan3.currentProvider.sendAsync(
      {
        method,
        params,
        from
      },
      function(err, result) {
        if (err) return console.dir(err);
        if (result.error) {
          alert(result.error.message);
        }
        let sign = result.result;
        response = "\nEthSignTyped:" + JSON.stringify(sign);
        console.log(response);

        res.style.display = "block";
        res.value = response;
      }
    );
  };

  // eth_signTypedData_v3
  signBtn3.onclick = async () => {
    const accounts = wan3.eth.accounts;
    // const accounts = await wan3.eth.getAccounts();

    if (accounts[0] == null) {
      alert("Connect to web3 Wallet");
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
      senderAddress: accounts[0],
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
        console.log(`Signature: \nr:${r}\ns:${s}\nv:${v}`);
        res.value = `\neth_signTypedData_v3: \n0x${signature}`;
      }
    );
  };
};
