const {order, libs} = require('@waves/waves-transactions');
const wc = require('@waves/ts-lib-crypto');
const { binary, json } = require('@waves/marshall');
const Web3 = require("web3");
const web3 = new Web3("http://localhost:8545");
const Long = require("long");
const ethers = require('ethers');

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

let senderAddress = "0xf8a1775286dddb8a0d2d35598d00f46873b4f8f6";
let matcherAddress = "0xb35d39bb41c69e4377a16c08eda54999175c1cdd";
let baseAsset = "0x46397994A7e1E926eA0DE95557A4806d38F10B0d"; // WETH
let quotetAsset = "0x89A3e1494Bc3Db81dAdC893DEd7476d33D47dCBD"; // WBTC
let matcherFeeAsset = baseAsset;
let amount = 150000000;
let price = 2000000;
let matcherFee = 150000;

const timestamp = Date.now();
const expiration = timestamp + 29 * 24 * 60 * 60 * 1000;
const senderPublicKey = "HzSnoJKTVwezUBmo2gh9HYq52F1maKBsvv1ZWrZAHyHV";

const wparams = {
    amount: amount, //1.5 waves
    price: price, //for 0.02 BTC
    amountAsset: "474jTeYx2r2Va35794tCScAXWJG9hU2HcgxzMowaZUnu", // ETH
    priceAsset: "8LQW8f7P5d5PZM7GtZEBgaqRPGSzS3DfPuiXrURJ4AJS", // BTC
    matcherPublicKey: "7kPFrHDiGw1rCm7LPszuECwWYL3dMf6iMifLRDJQZMzy",
    matcherFeeAssetId: "474jTeYx2r2Va35794tCScAXWJG9hU2HcgxzMowaZUnu",
    matcherFee: 300000,
    version: 3,
    orderType: 'buy',
    timestamp: timestamp,
    expiration: timestamp + 29 * 24 * 60 * 60 * 1000,
};

const word = {
    orderType: wparams.orderType,
    version: 3,
    assetPair: {
        amountAsset: wparams.amountAsset,
        priceAsset: wparams.priceAsset,
    },
    price: wparams.price,
    amount: wparams.amount,
    timestamp: wparams.timestamp,
    expiration: wparams.expiration,
    matcherFee: 300000,
    matcherFeeAssetId: wparams.amountAsset,
    matcherPublicKey: wparams.matcherPublicKey,
    senderPublicKey: senderPublicKey
};

function hexToBase58(hex) {
    const b = web3.utils.hexToBytes(hex);
    return wc.base58Encode(web3.utils.hexToBytes(hex));

}

function longToBytes(long) {
    return Uint8Array.from(Long.fromNumber(long).toBytesBE());
}

function byte(num) {
    return Uint8Array.from([num])
}

function assetBytes(asset) {
    return ethers.utils.concat([byte(1), ethers.utils.arrayify(asset)]);
}

function assetBytesWaves(asset) {
    return Buffer.concat([byte(1), wc.base58Decode(asset)]);
}



const orderBytes = Buffer.concat([
    byte(3),
    wc.base58Decode(senderPublicKey),
    wc.base58Decode(wparams.matcherPublicKey),
    assetBytesWaves(wparams.amountAsset),
    assetBytesWaves(wparams.priceAsset),
    byte(wparams.orderType === 'buy' ? 0 : 0),
    longToBytes(wparams.price),
    longToBytes(wparams.amount),
    longToBytes(wparams.timestamp),
    longToBytes(wparams.expiration),
    longToBytes(wparams.matcherFee),
    assetBytesWaves(wparams.matcherFeeAssetId)
]);

const signedOrder = order(wparams, "seed");
console.log(signedOrder);
console.log("Signature is valid: " + wc.verifySignature(senderPublicKey, orderBytes, signedOrder.proofs[0]));

let privateKey = "0x3141592653589793238462643383279502884197169399375105820974944592";
console.log(assetBytes(privateKey));

let wallet = new ethers.Wallet(privateKey);

const nowTimestamp = Date.now();
const orionOrder = {
    senderAddress: "0xf8a1775286dddb8a0d2d35598d00f46873b4f8f6",
    matcherAddress: "0xb35d39bb41c69e4377a16c08eda54999175c1cdd",
    baseAsset: "0x46397994A7e1E926eA0DE95557A4806d38F10B0d", // WETH
    quoteAsset: "0x89A3e1494Bc3Db81dAdC893DEd7476d33D47dCBD", // WBTC
    side: "buy",
    amount: 150000000,
    price: 2000000,
    matcherFee: 150000,
    matcherFeeAsset: "0x46397994A7e1E926eA0DE95557A4806d38F10B0d", // WETH
    nonce: nowTimestamp,
    expirationTimestamp: nowTimestamp + 29 * 24 * 60 * 60 * 1000,
};

function getOrderMessage(order) {
    return Buffer.concat([
        byte(3),
        ethers.utils.arrayify(order.senderAddress),
        ethers.utils.arrayify(order.matcherAddress),
        assetBytes(order.baseAsset),
        assetBytes(order.quoteAsset),
        byte(order.side === 'buy' ? 0 : 1),
        longToBytes(order.price),
        longToBytes(order.amount),
        longToBytes(order.nonce),
        longToBytes(order.expiration),
        longToBytes(order.matcherFee),
        assetBytes(order.matcherFeeAsset)
    ]);
}

const bytes = getOrderMessage(orionOrder);

const sig = wallet.signMessage(bytes).then( s => {
    console.log(s);
});
