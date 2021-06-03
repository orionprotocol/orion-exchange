async function deployTokens() {
    const weth = await (await ethers.getContractFactory("WETH")).deploy();
    const orn = await (await ethers.getContractFactory("Orion")).deploy();
    const usdt = await (await ethers.getContractFactory("USDT")).deploy();

    return {weth, orn, usdt};
}

async function deployPool(weth) {
    const [owner] = await ethers.getSigners();
    const OrionPoolFactory = await ethers.getContractFactory("OrionPoolV2Factory");
    const factory = await OrionPoolFactory.deploy(owner.address);

    const orionPoolLibrary = await (await ethers.getContractFactory("OrionPoolV2Library")).deploy();
    const OrionPoolRouter = await ethers.getContractFactory("OrionPoolV2Router02Ext");

    const router = await OrionPoolRouter.deploy(factory.address, weth.address);

    return {factory, router};
}

async function deployExchange(matcher, router, orn, weth, usdt) {
    const [owner] = await ethers.getSigners();
    const libValidator = await (await ethers.getContractFactory("LibValidator")).deploy();
    const libUnitConverter = await (await ethers.getContractFactory("LibUnitConverter")).deploy();
    const marginalFunctionality = await (await ethers.getContractFactory("MarginalFunctionality")).deploy();
    const priceOracle = await (await ethers.getContractFactory("PriceOracle")).deploy(owner.address, orn.address);

    const ExchangeWithOrionPool = await ethers.getContractFactory("ExchangeWithOrionPool", {
        libraries: {
            LibValidator: libValidator.address,
            LibUnitConverter: libUnitConverter.address,
            MarginalFunctionality: marginalFunctionality.address,
        }
    });

    const exchange = await ExchangeWithOrionPool.deploy();
    await exchange.initialize();

    await exchange['setBasicParams(address,address,address,address)'](orn.address, priceOracle.address, matcher.address, router.address);
    await exchange.updateMarginalSettings([orn.address, weth.address, usdt.address], 220, 12, 10000, 86400);
    await exchange.updateAssetRisks([orn.address, weth.address, usdt.address], [200, 200, 200]);

    return {exchange};
}

module.exports = {
    deployTokens,
    deployPool,
    deployExchange
}
