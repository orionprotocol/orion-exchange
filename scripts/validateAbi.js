module.exports = [
  {
    inputs: [
      {
        name: "_chainId",
        type: "uint256",
      },
    ],
    payable: false,
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    constant: true,
    inputs: [],
    name: "DOMAIN_NAME",
    outputs: [
      {
        name: "",
        type: "string",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "DOMAIN_SALT",
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
    inputs: [],
    name: "DOMAIN_SEPARATOR",
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
    inputs: [],
    name: "DOMAIN_VERSION",
    outputs: [
      {
        name: "",
        type: "string",
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
        ],
        name: "order",
        type: "tuple",
      },
      {
        name: "signature",
        type: "bytes",
      },
    ],
    name: "signerOfOrder",
    outputs: [
      {
        name: "",
        type: "address",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
];
