const { expect } = require("chai");
const { ethers } = require("hardhat");
const BN = ethers.BigNumber;

const walletProvider = new ethers.providers.JsonRpcProvider("https://data-seed-prebsc-1-s2.binance.org:8545", 56);
const wallet = new ethers.Wallet("0x88dfde5395dc736f20af157180dcbafd616417b09f6227e777adbd3c80cd958c", walletProvider);

(async function main() {
    //const libValidator = await (await ethers.getContractFactory("LibValidator")).attach("");

    const order = {
        "id": "0x46133df98bc814ede3bb56ffc9bcddd7e732d425a3054605637402139345687d",
        "senderAddress": "0xb970B26fa1a4eF54bC0B9B83649bC0B877DE57df",
        "matcherAddress": "0x2d23c313feac4810d9d014f840741363fccba675",
        "baseAsset": "0xe4ca1f75eca6214393fce1c1b316c237664eaa8e",
        "quoteAsset": "0x55d398326f99059ff775485246999027b3197955",
        "matcherFeeAsset": "0xe4ca1f75eca6214393fce1c1b316c237664eaa8e",
        "amount": 10000000000,
        "price": 1411670000,
        "matcherFee": 28213710,
        "nonce": 1620710548484,
        "expiration": 1623216148484,
        "buySide": 0,
        "isPersonalSign": false,
        "signature": "0x9ec69886604733a182b3bf47f6517c6fcdda989946fbce7c1360147c0605d4634c360671c159229b97ac2b44a8d22e26b4aef5fb610c7dd5c336e59f33f6f39c1b"
    };

    const ORDER_TYPE_HASH = ethers.utils.solidityKeccak256(
        ['string'],
        ["Order(address senderAddress,address matcherAddress,address baseAsset,address quoteAsset,address matcherFeeAsset,uint64 amount,uint64 price,uint64 matcherFee,uint64 nonce,uint64 expiration,uint8 buySide)"]
    );

    const hashOrder = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
        ['bytes32', 'address', 'address', 'address', 'address', 'address', 'uint64', 'uint64', 'uint64', 'uint64', 'uint64', 'uint8'],
        [
            ORDER_TYPE_HASH,
            order.senderAddress,
            order.matcherAddress,
            order.baseAsset,
            order.quoteAsset,
            order.matcherFeeAsset,
            order.amount,
            order.price,
            order.matcherFee,
            order.nonce,
            order.expiration,
            order.buySide ? '0x01' : '0x00'
        ]
    ));

    console.log(hashOrder);
})();
