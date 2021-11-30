const BN = web3.utils.BN;

const getRandomAmount = async token => {
    const totalSupply = Number(await token.cap());
    const decimals = Number(await token.decimals());
    const amount = Math.floor(Math.random() * (totalSupply / (10 ** decimals) - 1)) + 1;
    const basis = (new BN(10)).pow(new BN(decimals));

    return web3.utils.toBN(amount).mul(basis);
};

const convertToExchangeBasis = async (token, amount) => {
    const decimals = Number(await token.decimals());
    const basis = (new BN(10)).pow(new BN(decimals));
    const exchangeBasis = (new BN(10)).pow(new BN(8));

    return amount.div(basis).mul(exchangeBasis);
};

const convertToNormalBasis = async (token, amount) => {
    const decimals = Number(await token.decimals());
    const basis = (new BN(10)).pow(new BN(decimals));
    const exchangeBasis = (new BN(10)).pow(new BN(8));

    return amount.div(exchangeBasis).mul(basis);
}

module.exports = {
    getRandomAmount,
    convertToExchangeBasis,
    convertToNormalBasis
};
