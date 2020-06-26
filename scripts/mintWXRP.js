const WXRP = artifacts.require("WXRP");

// =================================================== //

// truffle exec scripts/mintWXRP.js <addressTo> <amount> --network gwan
// accounts 0 must be unlocked in gwan node

module.exports = async (callback) => {
  try {
    let token = await WXRP.deployed();
    let to = process.argv[4];
    let amount = process.argv[5];

    console.log(token.address);

    await token.mint(to, web3.utils.toWei(String(amount)));

    balance = await token.balanceOf(to);

    console.log(
      `New Balance for account ${to} is ${web3.utils.fromWei(
        balance.toString()
      )} WXRP`
    );

    callback();
  } catch (e) {
    callback(e);
  }
};
