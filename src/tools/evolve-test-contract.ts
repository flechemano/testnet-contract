import { LoggerFactory, WarpFactory } from "warp-contracts";
import * as fs from "fs";
import path from "path";
import { JWKInterface } from "arweave/node/lib/wallet";
import { testKeyfile } from "../constants";

(async () => {
  // This is the testnet ArNS Registry Smartweave Contract TX ID
  const arnsRegistryContractTxId =
    "rNR8SmcQLefBHZ-d-oJ9jbqmQxHGB_9bjdNipmsio-s";

  // ~~ Initialize warp ~~
  LoggerFactory.INST.logLevel("error");
  const warp = WarpFactory.forTestnet();

  // Get the key file used for the distribution
  const wallet: JWKInterface = JSON.parse(
    await fs.readFileSync(testKeyfile).toString()
  );

  // Read the ArNS Registry Contract
  const pst = warp.pst(arnsRegistryContractTxId);
  pst.connect(wallet);

  // ~~ Read test contract source and initial state files ~~
  const newSource = fs.readFileSync(
    path.join(__dirname, "../../dist/contract.js"),
    "utf8"
  );
  const newSrcTxId = await pst.save({ src: newSource }, warp.environment);
  if (newSrcTxId === null) {
    return 0;
  }
  console.log(newSrcTxId);
  const evolvedTxId = await pst.evolve(newSrcTxId);

  console.log("Finished evolving the ArNS Smartweave Contract %s.", newSrcTxId);
  console.log(`New Contract Tx Id ${evolvedTxId.originalTxId}`);
})();
