const {order, libs} = require('@waves/waves-transactions');
const wc = require('@waves/ts-lib-crypto');
const { binary, json } = require('@waves/marshall');
const Web3 = require("web3");
const web3 = new Web3("http://localhost:8545");
const Long = require("long");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

let senderAddress = "0xf8a1775286dddb8a0d2d35598d00f46873b4f8f6";
let matcherAddress = "0xb35d39bb41c69e4377a16c08eda54999175c1cdd";
let baseAsset = ZERO_ADDRESS; //ETH or WAN (base currency)
let quotetAsset = "0x0284fd64d75d76948076C5f0918159D86bC0Af6D"; // ORN token
let matcherFeeAsset = ZERO_ADDRESS;
let amount = 150000000;
let price = 2000000;
let matcherFee = 150000;
let nonce = 123;
let side;

const t = Date.now();
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
    timestamp: t,
    expiration: t + 29 * 24 * 60 * 60 * 1000,
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
    return Buffer.concat([byte(1), wc.base58Decode(asset)]);
}




const orderBytes = Buffer.concat([
    byte(3),
    wc.base58Decode(senderPublicKey),
    wc.base58Decode(wparams.matcherPublicKey),
    assetBytes(wparams.amountAsset),
    assetBytes(wparams.priceAsset),
    byte(wparams.orderType === 'buy' ? 0 : 0),
    longToBytes(wparams.price),
    longToBytes(wparams.amount),
    longToBytes(wparams.timestamp),
    longToBytes(wparams.expiration),
    longToBytes(wparams.matcherFee),
    assetBytes(wparams.matcherFeeAssetId)
]);

const signedOrder = order(wparams, "seed");
console.log(signedOrder);
console.log("Signature is valid: " + wc.verifySignature(senderPublicKey, orderBytes, signedOrder.proofs[0]));
