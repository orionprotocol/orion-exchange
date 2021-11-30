require("chai")
    .use(require("chai-shallow-deep-equal"))
    .use(require("chai-as-promised"))
    .should();

const ETHWrapper = artifacts.require("ETHWrap");
const Exchange = artifacts.require("ExchangeWithOrionPool");

const ONE_ETH = web3.utils.toBN(web3.utils.toWei('1'));
const { BN } = web3.utils;

let wrapper, exchange;

contract("Ethereum Wrapper", accounts => {
    describe("ETHWrap::functionality", () => {
        it("Setting the exchange address should work correctly", async () => {
            wrapper = await ETHWrapper.deployed();
            const address = await wrapper.getExchangeAddress();
            exchange = await Exchange.deployed();

            address.toLowerCase().should.be.equal(exchange.address.toLowerCase());
        });

        it('Wrapping should work correctly', async () => {
            const sender1 = accounts[2];

            await wrapper.wrap({ from: sender1, value: ONE_ETH }).should.be.fulfilled;
            const balance = await wrapper.getBalance(sender1);

            balance.toString().should.be.equal(ONE_ETH.toString());
        });

        it('Withdrawal should work correctly', async () => {
            const sender1 = accounts[2];
            const HALF_ETHER = ONE_ETH.div(new BN(2));

            await wrapper.withdraw(HALF_ETHER, { from: sender1 });
            const balance = await wrapper.getBalance(sender1);

            balance.toString().should.be.equal(HALF_ETHER.toString());

            await wrapper.withdraw(HALF_ETHER, { from: sender1 });
            const balance2 = await wrapper.getBalance(sender1);

            balance2.toString().should.be.equal('0');
        });

        it('Wrap and approve should work correctly', async () => {
            const sender3 = accounts[3];
            const AMOUNT = ONE_ETH.mul(new BN(5));

            await wrapper.wrapAndApprove(ONE_ETH, { from: sender3, value: AMOUNT });
            const balance = await wrapper.getBalance(sender3);
            const approval = await wrapper.allowance(sender3);

            balance.toString().should.be.equal(AMOUNT.toString());
            approval.toString().should.be.equal(ONE_ETH.toString());
        });
    });
});

