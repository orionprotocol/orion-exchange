module.exports = [
  {
    constant: true,
    inputs: [
      {
        components: [
          {
            name: "senderAddress",
            type: "address",
          },
          {
            name: "matcherAddress",
            type: "address",
          },
          {
            name: "baseAsset",
            type: "address",
          },
          {
            name: "quoteAsset",
            type: "address",
          },
          {
            name: "matcherFeeAsset",
            type: "address",
          },
          {
            name: "amount",
            type: "uint64",
          },
          {
            name: "price",
            type: "uint64",
          },
          {
            name: "matcherFee",
            type: "uint64",
          },
          {
            name: "nonce",
            type: "uint64",
          },
          {
            name: "expiration",
            type: "uint64",
          },
          {
            name: "side",
            type: "string",
          },
          {
            name: "signature",
            type: "bytes",
          },
        ],
        name: "_order",
        type: "tuple",
      },
    ],
    name: "getTypeValueHash",
    outputs: [
      {
        name: "",
        type: "bytes32",
      },
    ],
    payable: false,
    stateMutability: "pure",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "TYPE_HASH",
    outputs: [
      {
        name: "",
        type: "bytes32",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [
      {
        components: [
          {
            name: "senderAddress",
            type: "address",
          },
          {
            name: "matcherAddress",
            type: "address",
          },
          {
            name: "baseAsset",
            type: "address",
          },
          {
            name: "quoteAsset",
            type: "address",
          },
          {
            name: "matcherFeeAsset",
            type: "address",
          },
          {
            name: "amount",
            type: "uint64",
          },
          {
            name: "price",
            type: "uint64",
          },
          {
            name: "matcherFee",
            type: "uint64",
          },
          {
            name: "nonce",
            type: "uint64",
          },
          {
            name: "expiration",
            type: "uint64",
          },
          {
            name: "side",
            type: "string",
          },
          {
            name: "signature",
            type: "bytes",
          },
        ],
        name: "order",
        type: "tuple",
      },
    ],
    name: "validateV1",
    outputs: [
      {
        name: "",
        type: "bool",
      },
    ],
    payable: false,
    stateMutability: "pure",
    type: "function",
  },
];
