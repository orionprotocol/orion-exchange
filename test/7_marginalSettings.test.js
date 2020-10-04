require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

const Exchange = artifacts.require("Exchange");
const LibValidator = artifacts.require("LibValidator");

let exchange, lib;

const newStakeRisk = 127, newPremium = 10, newPriceOverdue = 2*3600, newPositionOverdue = 25*3600;

contract("Exchange", ([owner, randomAddr1, randomAddr2]) => {
  describe("Exchange::instance", async () => {
    exchange = await Exchange.deployed();
    lib = await LibValidator.deployed();
  });

  describe("Exchange::MarginalSettings", () => {
    it("only owner can update settings", async () => {
      await exchange.updateMarginalSettings(
                     [randomAddr1, randomAddr2],
                     newStakeRisk, newPremium,
                     newPriceOverdue, newPositionOverdue,
                     {from: randomAddr1}
                     )
            .should.be.rejected;
    });
    it("owner can update settings", async () => {
      await exchange.updateMarginalSettings(
                     [randomAddr1, randomAddr2],
                     newStakeRisk, newPremium,
                     newPriceOverdue, newPositionOverdue,
                     {from: owner})
            .should.be.fulfilled;
    });
    it("correct settings after update", async () => {
      let stakeRisk = await exchange.stakeRisk();
      let liquidationPremium = await exchange.liquidationPremium();
      let priceOverdue = await exchange.priceOverdue();
      let positionOverdue = await exchange.positionOverdue();
      let collateralAssets = await exchange.getCollateralAssets();
      stakeRisk.toString().should.be.equal(String(newStakeRisk));
      liquidationPremium.toString().should.be.equal(String(newPremium));
      positionOverdue.toString().should.be.equal(String(newPositionOverdue));
      priceOverdue.toString().should.be.equal(String(newPriceOverdue));
      JSON.stringify(collateralAssets).should.be
        .equal(JSON.stringify([randomAddr1, randomAddr2]));
    });

  });

  describe("Exchange::AssetRisks", () => {
    it("only owner can update AssetRisks", async () => {
      await exchange.updateAssetRisks(
                     [randomAddr1, randomAddr2],
                     [130, 255],
                     {from: randomAddr1}
                     )
            .should.be.rejected;
    });
    it("owner can update AssetRisks", async () => {
      await exchange.updateAssetRisks(
                     [randomAddr1, randomAddr2],
                     [130, 255],
                     {from: owner}
                     )
            .should.be.fulfilled;
    });
    it("correct settings after update", async () => {
      const expectedRisks = {[randomAddr1]: 130, [randomAddr2]: 255};
      for(let i in expectedRisks) {
        let risk = await exchange.assetRisks(i);
        risk.toString().should.be.equal(String(expectedRisks[i]));
      }
    });
  });
});
