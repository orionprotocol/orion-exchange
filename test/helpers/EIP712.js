const domain = [
                 { name: "name", type: "string" },
                 { name: "version", type: "string" },
                 { name: "chainId", type: "uint256" },
                 { name: "salt", type: "bytes32" },
               ];
const domainData = {
          name: "Orion Exchange",
          version: "1",
          chainId: 666,
          salt: "0xf2d857f4a3edcb9b78b4d503bfe733db1e3f6cdc2b7971ee739626c97e86a557",
};
const orderTypes =  [
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
            { name: "buySide", type: "uint8" },
];

const pricesType =  [
            { name: "assetAddresses", type: "address[]" },
            { name: "prices", type: "uint64[]" },
            { name: "timestamp", type: "uint64" },
];

module.exports = Object({
    domain: domain,
    domainData: domainData,
    orderTypes: orderTypes,
    pricesType: pricesType
});


