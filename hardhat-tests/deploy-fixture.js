const ChainManipulation = require("../test/helpers/ChainManipulation")
const {decimalToBaseUnit} = require("./libUnit");

async function deployTokens() {
    const weth = await (await ethers.getContractFactory("WETH")).deploy();
    const orn = await (await ethers.getContractFactory("Orion")).deploy();
    const usdt = await (await ethers.getContractFactory("USDT")).deploy();
    const wxrp = await (await ethers.getContractFactory("WXRP")).deploy();
    const wbtc = await (await ethers.getContractFactory("WBTC")).deploy();

    return {weth, orn, usdt, wbtc, wxrp};
}

async function deployPool(weth) {
    const [owner] = await ethers.getSigners();
    const OrionPoolFactory = await ethers.getContractFactory("OrionPoolV2Factory");
    const factory = await OrionPoolFactory.deploy(owner.address);

    const orionPoolLibrary = await (await ethers.getContractFactory("OrionPoolV2Library")).deploy();

    const OrionPoolRouter = await ethers.getContractFactory("OrionPoolV2Router02Ext");
    const router = await OrionPoolRouter.deploy(factory.address, weth.address);

    const PoolFunctionality = await ethers.getContractFactory("PoolFunctionality");
    const poolFunctionality = await PoolFunctionality.deploy(factory.address, weth.address);

    return {factory, router, poolFunctionality};
}

async function deployExchange(matcher, orn, weth, usdt) {
    const {factory, router, poolFunctionality} = await deployPool(weth);
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

    await exchange['setBasicParams(address,address,address,address)'](orn.address, priceOracle.address,
        matcher.address, poolFunctionality.address);
    await exchange.updateMarginalSettings([orn.address, weth.address, usdt.address], 220, 12, 10000, 86400);
    await exchange.updateAssetRisks([orn.address, weth.address, usdt.address], [200, 200, 200]);

    console.log("ExchangeWithOrionPool address:", exchange.address);
    return {exchange, router, factory, priceOracle};
}

async function mintAndApprove(token, owner, receiver, amount, exchange) {
    await token.connect(owner).mint(receiver.address, amount);
    await token.connect(receiver).approve(exchange.address, amount);
}

async function mintAndDeposit(token, owner, receiver, amount, exchange) {
    await mintAndApprove(token, owner, receiver, amount, exchange);
    await exchange.connect(receiver).depositAsset(token.address, amount);
}

async function burnToken(token, user) {
    const balance = (await token.balanceOf(user.address)).toString();
    await token.connect(user).transfer('0xDc966DCB447004dF677c8A509dd24A070AE93Bf2', balance);
}

async function addLiquidityETH(router, owner, eth_reserve, token, token_reserve) {
    await mintAndApprove(token, owner, owner, token_reserve, router);

    await router.connect(owner).addLiquidityETH(token.address,
        token_reserve, token_reserve,
        eth_reserve,
        owner.address,
        2000000000,
        {value: eth_reserve}
    )
}

async function addLiquidity(router, owner, token0, token1, token0_reserve, token1_reserve) {

    await mintAndApprove(token0, owner, owner, token0_reserve, router);
    await mintAndApprove(token1, owner, owner, token1_reserve, router);

    await router.connect(owner).addLiquidity(
        token0.address,
        token1.address,
        token0_reserve,
        token1_reserve,
        token0_reserve,
        token1_reserve,
        owner.address,
        2000000000
    );
}

async function setCollateralAndPriceOracles(priceOracle, exchange, owner, oracle, orn, weth, usdt) {
    const newStakeRisk = 254;
    const newPremium = 10;
    const newPriceOverdue = Math.floor(24*3600);
    const newPositionOverdue = Math.floor(25*3600);

    await exchange.connect(owner).updateMarginalSettings(
        [orn.address, usdt.address],
        newStakeRisk, newPremium,
        newPriceOverdue, newPositionOverdue
    )

    let newTs = await ChainManipulation.getBlokchainTime();
    console.log(`timestamp: ${newTs}`)
    prices= {
        assetAddresses: [orn.address, usdt.address, weth.address],
        prices: [1e8, 1e8, 1e8],
        timestamp: newTs,
        signature: "0x00"
    };
    await priceOracle.connect(owner).changePriceProviderAuthorization([oracle.address], []);
    await priceOracle.connect(oracle).provideDataAddressAuthorization(prices);
    await exchange.connect(owner).updateAssetRisks([orn.address, usdt.address], [254, 254]);
}

async function printPosition(exchange, varObj) {
    const name = Object.keys(varObj)[0];
    const addr = varObj[name].address;
    let position = await exchange.calcPosition(addr)
    console.log(name, '(' + addr + ')', "position",
        [position[0].toString(), position[1].toString(), position[2].toString(), position[3].toString()]);
}

async function cleanupDeposit(exchange, user, token) {
    await exchange.connect(user).withdraw(token.address,
        await decimalToBaseUnit(token, await exchange.getBalance(token.address, user.address)));
}

module.exports = {
    deployTokens,
    deployPool,
    deployExchange,
    mintAndApprove,
    addLiquidity,
    addLiquidityETH,
    setCollateralAndPriceOracles,
    mintAndDeposit,
    printPosition,
    burnToken,
    cleanupDeposit
}
