const abi = [
  {
    constant: true,
    inputs: [
      {
        name: "",
        type: "bytes32",
      },
    ],
    name: "orderStatus",
    outputs: [
      {
        name: "",
        type: "uint8",
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
        name: "",
        type: "bytes32",
      },
      {
        name: "",
        type: "uint256",
      },
    ],
    name: "trades",
    outputs: [
      {
        name: "filledPrice",
        type: "uint256",
      },
      {
        name: "filledAmount",
        type: "uint256",
      },
      {
        name: "feePaid",
        type: "uint256",
      },
      {
        name: "timestamp",
        type: "uint256",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: false,
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "owner",
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
  {
    constant: true,
    inputs: [],
    name: "isOwner",
    outputs: [
      {
        name: "",
        type: "bool",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      {
        name: "newOwner",
        type: "address",
      },
    ],
    name: "transferOwnership",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    payable: false,
    stateMutability: "nonpayable",
    type: "fallback",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: "user",
        type: "address",
      },
      {
        indexed: true,
        name: "assetAddress",
        type: "address",
      },
      {
        indexed: false,
        name: "amount",
        type: "uint256",
      },
    ],
    name: "NewAssetDeposit",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: "user",
        type: "address",
      },
      {
        indexed: true,
        name: "assetAddress",
        type: "address",
      },
      {
        indexed: false,
        name: "amount",
        type: "uint256",
      },
    ],
    name: "NewAssetWithdrawl",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: "buyer",
        type: "address",
      },
      {
        indexed: true,
        name: "seller",
        type: "address",
      },
      {
        indexed: false,
        name: "baseAsset",
        type: "address",
      },
      {
        indexed: false,
        name: "quoteAsset",
        type: "address",
      },
      {
        indexed: false,
        name: "filledPrice",
        type: "uint256",
      },
      {
        indexed: false,
        name: "filledAmount",
        type: "uint256",
      },
      {
        indexed: false,
        name: "amountQuote",
        type: "uint256",
      },
    ],
    name: "NewTrade",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        name: "orderHash",
        type: "bytes32",
      },
      {
        indexed: true,
        name: "user",
        type: "address",
      },
      {
        indexed: false,
        name: "orderStatus",
        type: "uint8",
      },
    ],
    name: "OrderUpdate",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    constant: false,
    inputs: [
      {
        name: "assetAddress",
        type: "address",
      },
      {
        name: "amount",
        type: "uint256",
      },
    ],
    name: "depositAsset",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: false,
    inputs: [],
    name: "deposit",
    outputs: [],
    payable: true,
    stateMutability: "payable",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      {
        name: "assetAddress",
        type: "address",
      },
      {
        name: "amount",
        type: "uint256",
      },
    ],
    name: "withdraw",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: true,
    inputs: [
      {
        name: "assetAddress",
        type: "address",
      },
      {
        name: "user",
        type: "address",
      },
    ],
    name: "getBalance",
    outputs: [
      {
        name: "assetBalance",
        type: "uint256",
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
        name: "assetsAddresses",
        type: "address[]",
      },
      {
        name: "user",
        type: "address",
      },
    ],
    name: "getBalances",
    outputs: [
      {
        name: "",
        type: "uint256[]",
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
    name: "getOrderTrades",
    outputs: [
      {
        components: [
          {
            name: "filledPrice",
            type: "uint256",
          },
          {
            name: "filledAmount",
            type: "uint256",
          },
          {
            name: "feePaid",
            type: "uint256",
          },
          {
            name: "timestamp",
            type: "uint256",
          },
        ],
        name: "",
        type: "tuple[]",
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
    name: "getFilledAmounts",
    outputs: [
      {
        name: "totalFilled",
        type: "uint256",
      },
      {
        name: "totalFeesPaid",
        type: "uint256",
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
    name: "getOrderStatus",
    outputs: [
      {
        name: "status",
        type: "uint8",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: false,
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
        name: "buyOrder",
        type: "tuple",
      },
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
        name: "sellOrder",
        type: "tuple",
      },
      {
        name: "filledPrice",
        type: "uint256",
      },
      {
        name: "filledAmount",
        type: "uint256",
      },
    ],
    name: "fillOrders",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: true,
    inputs: [
      {
        name: "orderHash",
        type: "bytes32",
      },
    ],
    name: "isOrderCancelled",
    outputs: [
      {
        name: "",
        type: "bool",
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
    name: "validateOrder",
    outputs: [
      {
        name: "isValid",
        type: "bool",
      },
    ],
    payable: false,
    stateMutability: "pure",
    type: "function",
  },
  {
    constant: false,
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
    name: "cancelOrder",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
];
