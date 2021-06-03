const eth_signTypedData = (userAddress, signatureData) => {
  return new Promise(function (resolve, reject) {
    // fix per https://github.com/ethereum/web3.js/issues/1119
    // truffle uses an outdated version of web3
    web3.providers.HttpProvider.prototype.sendAsync =
      web3.providers.HttpProvider.prototype.send;
    web3.currentProvider.sendAsync(
      {
        method: "eth_signTypedData",
        params: [userAddress, signatureData],
        from: userAddress,
      },
      function (err, result) {
        if (err) {
          reject(err);
        } else if (result.error) {
          reject(result.error);
        } else {
          resolve(result.result);
        }
      }
    );
  });
};

const eth_signTypedData_v4 = (userAddress, signatureData) => {
  return new Promise(function (resolve, reject) {
    web3.currentProvider.send(
        {
          method: "eth_signTypedData_v4",
          params: [userAddress, signatureData],
          from: userAddress,
        },
        function (err, result) {
          if (err) {
            reject(err);
          } else if (result.error) {
            reject(result.error);
          } else {
            resolve(result.result);
          }
        }
    );
  });
};

module.exports = {
  eth_signTypedData,
  eth_signTypedData_v4
};
