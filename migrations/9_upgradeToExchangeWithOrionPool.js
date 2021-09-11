const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');

const ExchangeWithOrionPool = artifacts.require("ExchangeWithOrionPool");
const MarginalFunctionality = artifacts.require("MarginalFunctionality");
const LibUnitConverter = artifacts.require("LibUnitConverter");
const LibValidator = artifacts.require("LibValidator");

module.exports = async (deployer, network, accounts) => {
    if (network === "ropsten") {

        const exchange_proxy_address = "0x5b14d57ee8961d1a96bcac827fe44786a1e9f6ea";
        const orion_address = '0xfc25454ac2db9f6ab36bc0b0b034b41061c00982';
        const price_oracle_address = '0xe6d3f2fbd4dd9899ce346c9f283a0a4b5f325db0';
        const allowed_matcher_address = '0x1ff516e5ce789085cff86d37fc27747df852a80a';
        const orion_pool_router_address = '0x78eDA969EED2CB17298FFB99bD58F36819a0Cf2c';

        //  Deploy new validator lib
        //  await deployer.deploy(LibValidator);

        //  await deployer.link(MarginalFunctionality, ExchangeWithOrionPool);
        //  await ExchangeWithOrionPool.link('LibValidator', "0xfF4437662e8F4634eB806984C30Cf3Cc9e45d839"); // UNCORRECT
        await ExchangeWithOrionPool.link('LibValidator', "0x3c7fa69c50C798517C5322Aa1c08E8FD80Bb4226"); // Correct
        await ExchangeWithOrionPool.link('LibUnitConverter', "0x21dA232a1D63A63468579Bb2c53263a38745C94f");
        await ExchangeWithOrionPool.link('MarginalFunctionality', "0x112BA62D19A7b713eDA4a73eB1B9527e15FCA419");

        let exchangeInstance = await upgradeProxy(
            exchange_proxy_address,
            ExchangeWithOrionPool,
            {unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true}
        );

//        let exchangeInstance = await
/*
        let exchangeInstance = await ExchangeWithOrionPool.at('0x5b14d57ee8961d1a96bcac827fe44786a1e9f6ea');
        //  Set all params
        await exchangeInstance.setBasicParams(
            orion_address,
            price_oracle_address,
            allowed_matcher_address,
            orion_pool_router_address
        );
        //
 */
    }

    if (network === "bsc_testnet") {

        //  Example: npx truffle migrate --f 09 --to 09 --network bsc_testnet --compile-none
        const exchange_proxy_address = "0x927c99eaf573914c340220f25642a5523516d220";
        const orion_address = '0xf223eca06261145b3287a0fefd8cfad371c7eb34';
        const price_oracle_address = '0x42db4a1afab9ae1565ee24c3db6e888c5ac53ed3';
        const allowed_matcher_address = '0xfbcad2c3a90fbd94c335fbdf8e22573456da7f68';
        const orion_pool_router_address = '0x7bFCbbA2B7b3c26D55019527217Ba1c74d41Ad7c';

        //  await deployer.deploy(LibValidator);
        let libValidator = await LibValidator.deployed();


        //  await deployer.deploy(MarginalFunctionality);
        let marginalFunctionality = await MarginalFunctionality.deployed();

        //  await deployer.deploy(LibUnitConverter);
        let libUnitConverter = await LibUnitConverter.deployed();


        await deployer.link(MarginalFunctionality, ExchangeWithOrionPool);
        await deployer.link(LibValidator, ExchangeWithOrionPool);
        await deployer.link(LibUnitConverter, ExchangeWithOrionPool);

        let exchangeInstance = await upgradeProxy(
            exchange_proxy_address,
            ExchangeWithOrionPool,
            {unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true}
        );

        /*
        //  After everything
        //      Warning: type the correct address there!
        let exchangeInstance = await ExchangeWithOrionPool.at('0x927c99eaf573914c340220f25642a5523516d220');
        //  Set all params

        await exchangeInstance.setBasicParams(
            orion_address,
            price_oracle_address,
            allowed_matcher_address,
            orion_pool_router_address
        );

         */
    }

    if (network === "bsc") {

        //  Example: npx truffle migrate --f 9 --to 9 --network bsc --compile-none
        const exchange_proxy_address = "0xe9d1D2a27458378Dd6C6F0b2c390807AEd2217Ca";
        const oracleAddress = "0x468006964cee0e4aaf5837a5ab39874ac7fd9e0e";
        const allowedMatcher = "0x2d23c313feac4810D9D014f840741363FccBA675";

        const ORN = "0xe4ca1f75eca6214393fce1c1b316c237664eaa8e";
        const orion_pool_router_address = '0x45A664993f6c3e978A1257c6EF7bBB512af9F098';

        await deployer.deploy(LibValidator);
        let libValidator = await LibValidator.deployed();


        await deployer.deploy(MarginalFunctionality);
        let marginalFunctionality = await MarginalFunctionality.deployed();

        await deployer.deploy(LibUnitConverter);
        let libUnitConverter = await LibUnitConverter.deployed();


        await deployer.link(MarginalFunctionality, ExchangeWithOrionPool);
        await deployer.link(LibValidator, ExchangeWithOrionPool);
        await deployer.link(LibUnitConverter, ExchangeWithOrionPool);

        let exchangeInstance = await upgradeProxy(
            exchange_proxy_address,
            ExchangeWithOrionPool,
            {unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true}
        );


        //  After everything
        //      Warning: type the correct address there!
        //let exchangeInstance = await ExchangeWithOrionPool.at('0x927c99eaf573914c340220f25642a5523516d220');
        //  Set all params

        await exchangeInstance.setBasicParams(
            ORN,
            oracleAddress,
            allowedMatcher,
            orion_pool_router_address
        );


    }

    if (network === "mainnet") {

        //  Example: npx truffle migrate --f 9 --to 9 --network mainnet
        const exchange_proxy_address = "0xb5599f568D3f3e6113B286d010d2BCa40A7745AA";
        const oracleAddress = "0xFFfc4703918E1785742EEAAe7d2EAf7D45E38857";
        const allowedMatcher = "0x15E030E12cD2C949181BFf268cbEF26F524d7929";

        const ORN = "0x0258F474786DdFd37ABCE6df6BBb1Dd5dfC4434a";
        const orion_pool_router_address = '0x5526856CD51aD5Be9867249f957fd539Bc3c0988';

        await deployer.deploy(LibValidator);
        let libValidator = await LibValidator.deployed();


        await deployer.deploy(MarginalFunctionality);
        let marginalFunctionality = await MarginalFunctionality.deployed();

        await deployer.deploy(LibUnitConverter);
        let libUnitConverter = await LibUnitConverter.deployed();


        await deployer.link(MarginalFunctionality, ExchangeWithOrionPool);
        await deployer.link(LibValidator, ExchangeWithOrionPool);
        await deployer.link(LibUnitConverter, ExchangeWithOrionPool);

        let exchangeInstance = await upgradeProxy(
            exchange_proxy_address,
            ExchangeWithOrionPool,
            {unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true}
        );


        //  After everything
        //      Warning: type the correct address there!
        //let exchangeInstance = await ExchangeWithOrionPool.at('0x927c99eaf573914c340220f25642a5523516d220');
        //  Set all params

        await exchangeInstance.setBasicParams(
            ORN,
            oracleAddress,
            allowedMatcher,
            orion_pool_router_address
        );


    }

    if (network === "bsc2") {

        //  Example: npx truffle migrate --f 9 --to 9 --network bsc2
        const oracleAddress = "0x468006964cee0e4aaf5837a5ab39874ac7fd9e0e`";
        const allowedMatcher = "0xea2529bf9b63606284589afa5206f2d33baa8628";

        const ORN = "0xe4ca1f75eca6214393fce1c1b316c237664eaa8e";
        const orion_pool_router_address = '0x45A664993f6c3e978A1257c6EF7bBB512af9F098';

        //await deployer.deploy(LibValidator);
        let libValidator = await LibValidator.deployed();


        //await deployer.deploy(MarginalFunctionality);
        let marginalFunctionality = await MarginalFunctionality.deployed();

        //await deployer.deploy(LibUnitConverter);
        let libUnitConverter = await LibUnitConverter.deployed();


        await deployer.link(MarginalFunctionality, ExchangeWithOrionPool);
        await deployer.link(LibValidator, ExchangeWithOrionPool);
        await deployer.link(LibUnitConverter, ExchangeWithOrionPool);

        // let exchangeInstance = await deployProxy(
        //     ExchangeWithOrionPool,
        //     {unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true}
        // );

        let exchangeInstance = await ExchangeWithOrionPool.deployed();

        //  After everything
        //      Warning: type the correct address there!
        //let exchangeInstance = await ExchangeWithOrionPool.at('0x927c99eaf573914c340220f25642a5523516d220');
        //  Set all params

        await exchangeInstance.setBasicParams(
            ORN,
            oracleAddress,
            allowedMatcher,
            orion_pool_router_address
        );


    }

    if (network === "mainnet_kucoin") {

        //  Example: npx truffle migrate --f 9 --to 9 --network mainnet_kucoin
        const oracleAddress = "0xFFfc4703918E1785742EEAAe7d2EAf7D45E38857";
        const allowedMatcher = "0xDc453DeDE77afEd3199493dc2a520A17aDeA6DB0";

        const ORN = "0x0258F474786DdFd37ABCE6df6BBb1Dd5dfC4434a";
        const orion_pool_router_address = '0x5526856CD51aD5Be9867249f957fd539Bc3c0988';

        await ExchangeWithOrionPool.link("MarginalFunctionality", "0xB6Bf84cbE86d786a3a66fd1a1Fa77D1e521596EA");
        await ExchangeWithOrionPool.link("LibValidator", "0x611c49e049667f67F35E1e271b89299ce00e513A");
        await ExchangeWithOrionPool.link("LibUnitConverter", "0x1F9b696272130dE4C3b038376ae8aFBDd14580e6");

        let exchangeInstance = await deployProxy(
                 ExchangeWithOrionPool,
                 {unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true}
             );

        //  After everything
        //      Warning: type the correct address there!
        //let exchangeInstance = await ExchangeWithOrionPool.at('0x927c99eaf573914c340220f25642a5523516d220');
        //  Set all params

        /*await exchangeInstance.setBasicParams(
            ORN,
            oracleAddress,
            allowedMatcher,
            orion_pool_router_address
        );*/


    }
};
