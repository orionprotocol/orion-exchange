const { ethers } = require("hardhat");
const BN = ethers.BigNumber;

async function decimalToBaseUnit(token, amount) {
    const decimals = Number(await token.decimals());
    return BN.from(amount).mul(BN.from(10).pow(decimals)).div(1e8);
}

async function baseUnitToDecimal(token, amount) {
    const decimals = Number(await token.decimals());
    return BN.from(amount).mul(1e8).div(BN.from(10).pow(decimals));
}

function ToBN(doubleVal, digits) {
    const multiplier = 1e9;
    let nom = BN.from(Math.round(doubleVal * multiplier)).mul(BN.from(10).pow(digits));
    return nom.div(BN.from(multiplier));
}

function ToORN(val) { return ToBN(val, 8);}
function ToWETH(val) { return ToBN(val, 18);}
function ToUSDT(val) { return ToBN(val, 6);}
//  Any exchange amount is 8-digits
function ToExchAny(val) { return ToBN(val, 8);}

module.exports = {
    decimalToBaseUnit,
    baseUnitToDecimal,
    ToBN,
    ToORN,
    ToExchAny,
    ToUSDT,
    ToWETH
};
