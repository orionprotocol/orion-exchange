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
};
