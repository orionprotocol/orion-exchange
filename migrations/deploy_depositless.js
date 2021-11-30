require("@nomiclabs/hardhat-waffle");
const hre = require("hardhat");
const { ethers, upgrades } = hre;

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    console.log("Account balance:", (await deployer.getBalance()).toString());

    let ORN, WETH, oracleAddress, allowedMatcher, orionPoolFactory;
    let exchangeProxy, libValidator, libUnitConverter, marginalFunctionality, poolFunctionality;

    if (hre.network.name === 'eth') {
        ORN = "0x0258F474786DdFd37ABCE6df6BBb1Dd5dfC4434a";
        WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
        oracleAddress = "0xFFfc4703918E1785742EEAAe7d2EAf7D45E38857";
        allowedMatcher = "0x15E030E12cD2C949181BFf268cbEF26F524d7929";
        orionPoolFactory = '0x5FA0060FcfEa35B31F7A5f6025F0fF399b98Edf1';

        libValidator = "0x611c49e049667f67F35E1e271b89299ce00e513A";
        libUnitConverter = "0x1F9b696272130dE4C3b038376ae8aFBDd14580e6";
        marginalFunctionality = "0xB6Bf84cbE86d786a3a66fd1a1Fa77D1e521596EA";

    } else if (hre.network.name === 'ropsten') {
        ORN = "0xfc25454ac2db9f6ab36bc0b0b034b41061c00982";
        WETH = '0xc778417E063141139Fce010982780140Aa0cD5Ab';
        oracleAddress = "0xe6d3f2fbd4dd9899ce346c9f283a0a4b5f325db0";
        allowedMatcher = "0x1ff516e5ce789085cff86d37fc27747df852a80a";
        orionPoolFactory = '0x414d12709d99a5f79a1837d98c11c3507e98fa36';

        exchangeProxy = "0x5b14d57ee8961d1a96bcac827fe44786a1e9f6ea";

        libValidator = "0xfF4437662e8F4634eB806984C30Cf3Cc9e45d839";
        libUnitConverter = "0x21dA232a1D63A63468579Bb2c53263a38745C94f";
        marginalFunctionality = "0x112BA62D19A7b713eDA4a73eB1B9527e15FCA419";
        poolFunctionality = "0x46d7ed3929441253f5A5729ecA668C986388A0fb";
    }

    //const PoolFunctionality = await ethers.getContractFactory("PoolFunctionality");
    //const poolFunctionality = await PoolFunctionality.deploy(orionPoolFactory, WETH);

    const Exchange = await ethers.getContractFactory("ExchangeWithOrionPool", {
        libraries: {
            LibValidator: libValidator,
            LibUnitConverter: libUnitConverter,
            MarginalFunctionality: marginalFunctionality,
        }
    });

    const exchangeImpl = await Exchange.deploy({nonce: 8});
    //const upgradedExchnage = await upgrades.upgradeProxy(exchangeProxy, Exchange,
    //    {unsafeAllow: ["external-library-linking", "delegatecall"]});

    //const exchange = await Exchange.attach(exchangeProxy);

    /*await exchange.setBasicParams(
        ORN,
        oracleAddress,
        allowedMatcher,
        poolFunctionality
    );*/
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
