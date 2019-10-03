const ApiInstance = require("iwan-sdk");

require("dotenv").config();

const orionTokenArtifact = require("../build/contracts/ORN.json");
const exchangeArtifact = require("../build/contracts/Exchange.json");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

(async function main() {
  //Subject to https://iwan.wanchain.org
  let options = {
    url: "apitest.wanchain.org",
    port: 8443,
    flag: "ws",
    version: "v3"
  };

  let apiTest = new ApiInstance(
    process.env.IWAN_API_KEY,
    process.env.IWAN_SECRET_KEY,
    options
  );

  let balance = await apiTest.getBalance(
    "WAN",
    "0xf8a1775286dddb8a0d2d35598d00f46873b4f8f6"
  );
  console.log("WAN Balance:", balance);

  let ornBalance = await apiTest.callScFunc(
    "WAN",
    orionTokenArtifact.networks[3].address,
    "totalSupply",
    [],
    orionTokenArtifact.abi
  );
  console.log("ORN Balance:", ornBalance);

  let wanBalance = await apiTest.callScFunc(
    "WAN",
    exchangeArtifact.networks[3].address,
    "getBalance",
    [ZERO_ADDRESS, "0xb35d39bb41c69e4377a16c08eda54999175c1cdd"],
    exchangeArtifact.abi
  );
  console.log("WAN Balance in Exchange:", wanBalance);

  apiTest.close();
})();
