const WBTC = artifacts.require("WBTC");

// =================================================== //

// truffle exec scripts/mintWBTC.js <addressTo> <amount> --network gwan
// accounts 0 must be unlocked in gwan node

module.exports = async callback => {
  try {
    let token = await WBTC.deployed();
    let to = process.argv[4];
    let amount = process.argv[5];

    let decimals = await token.decimals();

    await token.mint(to, String(amount*10**decimals));
    console.log(token.address);

    balance = await token.balanceOf(to);

    console.log(
      `New Balance for account ${to} is ${balance / (10 ** decimals)
      } WBTC`
    );

    callback();
  } catch (e) {
    callback(e);
  }
};
