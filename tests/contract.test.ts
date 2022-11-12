import ArLocal from "arlocal";
import Arweave from "arweave";
import { addFunds, mineBlock } from "../utils/_helpers";
import * as fs from "fs";
import path from "path";
import {
  InteractionResult,
  LoggerFactory,
  PstContract,
  PstState,
  Warp,
  WarpFactory,
} from "warp-contracts";
import { JWKInterface } from "arweave/node/lib/wallet";
import { ArNSState } from "../src/contracts/types/types";

let warp: Warp;
warp = WarpFactory.forLocal(1820);

let WALLET_STARTING_TOKENS = 1_000_000_000_0;
let GATEWAY_STARTING_TOKENS = 1_000_000;
let DELEGATE_STARTING_TOKENS = 1_000;
let DELEGATE2_STARTING_TOKENS = 50_000;
let EXPECTED_BALANCE_AFTER_INVALID_TX = 9515750000;

describe("Testing the ArNS Registry Contract", () => {
  let contractSrc: string;
  let wallet: JWKInterface;
  let walletAddress: string;
  let wallet2: JWKInterface;
  let walletAddress2: string;
  let wallet3: JWKInterface;
  let walletAddress3: string;
  let wallet4: JWKInterface;
  let walletAddress4: string;
  let wallet5: JWKInterface;
  let walletAddress5: string;
  let gatewayWallet: JWKInterface;
  let gatewayWalletAddress: string;
  let gatewayWallet2: JWKInterface;
  let gatewayWalletAddress2: string;
  let delegateWallet: JWKInterface;
  let delegateWalletAddress: string;
  let delegateWallet2: JWKInterface;
  let delegateWalletAddress2: string;
  let slashedWallet: JWKInterface;
  let slashedWalletAddress: string;
  let initialState: ArNSState;
  let Warp: Warp;
  let arweave: Arweave;
  let pst: PstContract;
  const arlocal = new ArLocal(1820, false);
  jest.setTimeout(20000);
  beforeAll(async () => {
    // ~~ Set up ArLocal and instantiate Arweave ~~
    await arlocal.start();

    arweave = Arweave.init({
      host: "localhost",
      port: 1820,
      protocol: "http",
    });

    // ~~ Initialize 'LoggerFactory' ~~
    LoggerFactory.INST.logLevel("fatal");

    // ~~ Set up Warp ~~
    //Warp = warp.WarpNodeFactory.forTesting(arweave);
    //warp = WarpFactory.forLocal(arweave)
    //warp = WarpFactory.forLocal()

    // ~~ Generate wallet and add funds ~~
    wallet = await arweave.wallets.generate();
    walletAddress = await arweave.wallets.jwkToAddress(wallet);
    await addFunds(arweave, wallet);

    wallet2 = await arweave.wallets.generate();
    walletAddress2 = await arweave.wallets.jwkToAddress(wallet2);
    await addFunds(arweave, wallet2);

    wallet3 = await arweave.wallets.generate();
    walletAddress3 = await arweave.wallets.jwkToAddress(wallet3);
    await addFunds(arweave, wallet3);

    wallet4 = await arweave.wallets.generate();
    walletAddress4 = await arweave.wallets.jwkToAddress(wallet4);
    await addFunds(arweave, wallet4);

    wallet5 = await arweave.wallets.generate();
    walletAddress5 = await arweave.wallets.jwkToAddress(wallet5);
    await addFunds(arweave, wallet5);

    gatewayWallet = await arweave.wallets.generate();
    gatewayWalletAddress = await arweave.wallets.jwkToAddress(gatewayWallet);
    await addFunds(arweave, gatewayWallet);

    gatewayWallet2 = await arweave.wallets.generate();
    gatewayWalletAddress2 = await arweave.wallets.jwkToAddress(gatewayWallet2);
    await addFunds(arweave, gatewayWallet2);

    delegateWallet = await arweave.wallets.generate();
    delegateWalletAddress = await arweave.wallets.jwkToAddress(delegateWallet);
    await addFunds(arweave, delegateWallet);

    delegateWallet2 = await arweave.wallets.generate();
    delegateWalletAddress2 = await arweave.wallets.jwkToAddress(
      delegateWallet2
    );
    await addFunds(arweave, delegateWallet2);

    slashedWallet = await arweave.wallets.generate();
    slashedWalletAddress = await arweave.wallets.jwkToAddress(slashedWallet);
    await addFunds(arweave, slashedWallet);

    // ~~ Read contract source and initial state files ~~
    contractSrc = fs.readFileSync(
      path.join(__dirname, "../dist/contract.js"),
      "utf8"
    );
    const stateFromFile: ArNSState = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../dist/contracts/initial-state.json"),
        "utf8"
      )
    );

    // expired name date
    let expiredDate = new Date();
    expiredDate.setFullYear(expiredDate.getFullYear() - 1);

    // ~~ Update initial state ~~
    initialState = {
      ...stateFromFile,
      ...{
        owner: walletAddress,
      },
      records: {
        ["permaweb"]: {
          // We set an expired name here so we can test overwriting it
          tier: 1,
          contractTxId: "io9_QNUf4yBG0ErNKCmjGzZ-X9BJhmWOiVVQVyainlY",
          maxSubdomains: 100,
          minTtlSeconds: 3600, // tier 1 default for TTL
          endTimestamp: 100_000_000,
        },
        ["grace"]: {
          // We set a name in its grace period here
          tier: 3,
          contractTxId: "GRACENUf4yBG0ErNKCmjGzZ-X9BJhmWOiVVQVyainlY",
          maxSubdomains: 10000,
          minTtlSeconds: 900, // tier 3 default for ttl
          endTimestamp: Math.round(Date.now() / 1000),
        },
        ["expired"]: {
          // We set an expired name here so we test extending
          tier: 1,
          contractTxId: "EXPIREUf4yBG0ErNKCmjGzZ-X9BJhmWOiVVQVyainlY",
          maxSubdomains: 100,
          minTtlSeconds: 3600, // tier 3 default for ttl
          endTimestamp: Math.round(expiredDate.getTime() / 1000),
        },
      },
      foundation: {
        balance: 0,
        actionPeriod: 17,
        minSignatures: 2,
        addresses: [walletAddress, walletAddress2, walletAddress3],
        actions: [],
      },
      balances: {
        [walletAddress]: 0, // create tokens during mint
        [walletAddress2]: 1_000_000_000,
        [gatewayWalletAddress]: GATEWAY_STARTING_TOKENS,
        [gatewayWalletAddress2]: GATEWAY_STARTING_TOKENS * 2,
        [delegateWalletAddress]: DELEGATE_STARTING_TOKENS,
        [delegateWalletAddress2]: DELEGATE2_STARTING_TOKENS,
      },
      vaults: {
        [walletAddress]: [
          {
            balance: 500_000, // Positive integer
            end: 1_000, // At what block the lock ends.
            start: 0, // At what block the lock starts.
          },
        ],
        [walletAddress3]: [
          {
            balance: 1_000_000, // Positive integer
            end: 1_000, // At what block the lock ends.
            start: 0, // At what block the lock starts.
          },
        ],
        [delegateWalletAddress2]: [
          {
            balance: 300_000, // Positive integer
            end: 5_000, // At what block the lock ends.
            start: 0, // At what block the lock starts.
          },
        ],
      },
      gateways: {
        [gatewayWalletAddress2]: {
          operatorStake: 80_000,
          delegatedStake: 300_000,
          vaults: [
            {
              balance: 40_000, // Positive integer
              end: 0, // At what block the lock ends.
              start: 1, // At what block the lock starts.
            },
          ],
          delegates: {
            [delegateWalletAddress2]: [
              {
                balance: 300_000, // Positive integer
                end: 5_000, // At what block the lock ends.
                start: 0, // At what block the lock starts.
              },
            ],
          },
          settings: {
            label: "Arweave Community Gateway", // The friendly name used to label this gateway
            sslFingerprint: "BLAH BLAH BLAH SSL FINGERPRINT", // the SHA-256 Fingerprint used by SSL certificate used by this gateway eg. 5C 5D 05 16 C3 3C A3 34 51 78 1E 67 49 14 D4 66 31 A9 19 3C 63 8E F9 9E 54 84 1A F0 4C C2 1A 36
            ipAddress: "10.230.70.22", // the IP address this gateway can be reached at eg. 10.124.72.100
            url: "arweave.net", // the fully qualified domain name this gateway can be reached at. eg arweave.net
            port: 443, // The port used by this gateway eg. 443
            protocol: "https", // The protocol used by this gateway, either http or https
          },
        },
        [slashedWalletAddress]: {
          operatorStake: 6_000, // this includes the additional vault we add below
          delegatedStake: 866, // this includes the additional delegate we add below
          vaults: [
            {
              balance: 5_000, // Positive integer
              end: 0, // At what block the lock ends.
              start: 1, // At what block the lock starts.
            },
          ],
          delegates: {
            [delegateWalletAddress]: [
              {
                balance: 100, // Positive integer
                end: 0, // At what block the lock ends.
                start: 1, // At what block the lock starts.
              },
            ],
          },
          settings: {
            label: "Slashme", // The friendly name used to label this gateway
            sslFingerprint:
              "B7 BC 55 10 CC 1C 63 7B 5E 5F B7 85 81 6A 77 3D BB 39 4B 68 33 7B 1B 11 7C A5 AB 43 CC F7 78 CF", // the SHA-256 Fingerprint used by SSL certificate used by this gateway eg. 5C 5D 05 16 C3 3C A3 34 51 78 1E 67 49 14 D4 66 31 A9 19 3C 63 8E F9 9E 54 84 1A F0 4C C2 1A 36
            ipAddress: "75.10.113.66", // the IP address this gateway can be reached at eg. 10.124.72.100
            url: "slash-this-gateway.io", // the fully qualified domain name this gateway can be reached at. eg arweave.net
            port: 443, // The port used by this gateway eg. 443
            protocol: "https", // The protocol used by this gateway, either http or https
          },
        },
      },
    };

    initialState.gateways[slashedWalletAddress].delegates[
      delegateWalletAddress
    ].push({
      balance: 100, // Positive integer
      end: 0, // At what block the lock ends.
      start: 1, // At what block the lock starts.
    });

    initialState.gateways[slashedWalletAddress].delegates[
      delegateWalletAddress2
    ] = [
      {
        balance: 666, // Positive integer
        end: 0, // At what block the lock ends.
        start: 1, // At what block the lock starts.
      },
    ];

    initialState.gateways[slashedWalletAddress].vaults.push({
      balance: 1_000, // Positive integer
      end: 0, // At what block the lock ends.
      start: 1, // At what block the lock starts.
    });

    // ~~ Deploy contract ~~
    const deploy = await warp.createContract.deploy({
      wallet,
      initState: JSON.stringify(initialState),
      src: contractSrc,
    });

    // ~~ Connect to the pst contract ~~
    pst = warp.pst(deploy.contractTxId);
    pst.connect(wallet);

    // ~~ Mine block ~~
    await mineBlock(arweave);
  });

  afterAll(async () => {
    let totalBalance = 0;
    const currentState = await pst.currentState();
    const currentStateString = JSON.stringify(currentState, null, 5);
    const currentStateJSON = JSON.parse(currentStateString);
    console.log(JSON.stringify(currentStateJSON.balances, null, 5));
    console.log(JSON.stringify(currentStateJSON.gateways, null, 5));
    for (let address in currentStateJSON.balances) {
      if (currentStateJSON.balances.hasOwnProperty(address)) {
        totalBalance += parseFloat(currentStateJSON.balances[address]);
      }
    }
    // NEED TO UPDATE TO INCLUDE VAULTED TOKENS
    // ~~ Stop ArLocal ~~
    await arlocal.stop();
  });

  // PST TESTS
  it("should read pst state and balance data", async () => {
    expect(await pst.currentState()).toEqual(initialState);
    expect((await pst.currentState()).owner).toEqual(walletAddress);
  });

  it("should properly mint tokens", async () => {
    await pst.writeInteraction({
      function: "mint",
      qty: WALLET_STARTING_TOKENS,
    });
    await mineBlock(arweave);
    expect((await pst.currentState()).balances[walletAddress]).toEqual(
      0 + WALLET_STARTING_TOKENS
    );
  });

  it("should properly transfer and perform dry write with overwritten caller", async () => {
    const newWallet = await arweave.wallets.generate();
    const overwrittenCaller = await arweave.wallets.jwkToAddress(newWallet);
    await pst.transfer({
      target: overwrittenCaller.toString(),
      qty: 500000,
    });

    await mineBlock(arweave);
    const currentState = await pst.currentState();
    const currentStateString = JSON.stringify(currentState); // Had to do this because I cannot use my custom token interface
    const currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.balances[walletAddress]).toEqual(
      WALLET_STARTING_TOKENS - 500000
    );
    expect(currentStateJSON.balances[overwrittenCaller]).toEqual(0 + 500000);
    const result: InteractionResult<PstState, unknown> = await pst.dryWrite(
      {
        function: "transfer",
        target: "NdZ3YRwMB2AMwwFYjKn1g88Y9nRybTo0qhS1ORq_E7g",
        qty: 25000,
      },
      overwrittenCaller
    );

    expect(result.state.balances[overwrittenCaller]).toEqual(
      0 + 500000 - 25000
    );
    expect(
      result.state.balances["NdZ3YRwMB2AMwwFYjKn1g88Y9nRybTo0qhS1ORq_E7g"]
    ).toEqual(0 + 25000);
  });

  it("should not transfer tokens with incorrect ownership", async () => {
    const newWallet = await arweave.wallets.generate();
    const overwrittenCaller = await arweave.wallets.jwkToAddress(newWallet);
    pst.connect(newWallet);
    await pst.transfer({
      target: walletAddress.toString(),
      qty: 1000000000,
    });
    await mineBlock(arweave);
    const currentState = await pst.currentState();
    const currentStateString = JSON.stringify(currentState); // Had to do this because I cannot use my custom token interface
    const currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.balances[walletAddress]).toEqual(
      WALLET_STARTING_TOKENS - 500000
    );
    expect(currentStateJSON.balances[overwrittenCaller]).toEqual(undefined);
  });

  // ARNS TESTS
  it("should properly buy records", async () => {
    pst.connect(wallet2);
    const tier2Name = "microsoft"; // should cost 1000000 tokens
    await pst.writeInteraction({
      function: "buyRecord",
      name: tier2Name,
      contractTxId: "MSFTfeBVyaJ8s9n7GxIyJNNc62jEVCKD7lbL3fV8kzU",
      years: 6,
      tier: 2,
    });
    pst.connect(wallet);
    const nameToBuy = "permaWEB"; // this should be set to lower case, this name already exists but is expired
    const contractTxId = "lheofeBVyaJ8s9n7GxIyJNNc62jEVCKD7lbL3fV8kzU";
    const years = 3;
    const tier = 1;
    await pst.writeInteraction({
      function: "buyRecord",
      name: nameToBuy, // should cost 5000000 tokens
      contractTxId,
      years,
      tier,
    });
    const anotherNameToBuy = "vile";
    const anothercontractTxId = "BBBBfeBVyaJ8s9n7GxIyJNNc62jEVCKD7lbL3fV8kzU";
    await pst.writeInteraction({
      function: "buyRecord",
      name: anotherNameToBuy, // should cost 156250000 tokens
      contractTxId: anothercontractTxId,
      years,
      tier,
    });
    await mineBlock(arweave);
    const currentState = await pst.currentState();
    const currentStateString = JSON.stringify(currentState); // Had to do this because I cannot use my custom token interface
    const currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.records[tier2Name].maxSubdomains).toEqual(1000);
    expect(
      currentStateJSON.records[nameToBuy.toLowerCase()].contractTxId
    ).toEqual("lheofeBVyaJ8s9n7GxIyJNNc62jEVCKD7lbL3fV8kzU");
    expect(currentStateJSON.records[anotherNameToBuy].contractTxId).toEqual(
      "BBBBfeBVyaJ8s9n7GxIyJNNc62jEVCKD7lbL3fV8kzU"
    );
    expect((await pst.currentState()).balances[walletAddress]).toEqual(
      EXPECTED_BALANCE_AFTER_INVALID_TX
    );
  });

  it("should not buy malformed, too long, existing, or too expensive records", async () => {
    pst.connect(wallet2);
    const emptyNameToBuy = "";
    const contractTxId = "lheofeBVyaJ8s9n7GxIyJNNc62jEVCKD7lbL3fV8kzU";
    let years = 1;
    let tier = 1;
    await pst.writeInteraction({
      function: "buyRecord",
      name: emptyNameToBuy, // should cost 156250000 tokens
      contractTxId,
      years,
      tier,
    });
    await mineBlock(arweave);
    const malformedNameToBuy = "*&*##$%#";
    await pst.writeInteraction({
      function: "buyRecord",
      name: malformedNameToBuy, // should cost 156250000 tokens
      contractTxId,
      years,
      tier,
    });
    await mineBlock(arweave);
    const leadingDashNameToBuy = "-lead";
    await pst.writeInteraction({
      function: "buyRecord",
      name: leadingDashNameToBuy, // should not be purchased since it has a leading - which is invalid
      contractTxId,
      years,
      tier,
    });
    await mineBlock(arweave);
    const spaceNameToBuy = "name with spaces";
    await pst.writeInteraction({
      function: "buyRecord",
      name: spaceNameToBuy, // should not be purchased since it has spaces
      contractTxId,
      years,
      tier,
    });
    await mineBlock(arweave);
    const objectToBuy = { thisName: "testname" };
    await pst.writeInteraction({
      function: "buyRecord",
      name: objectToBuy, // should not be purchased since this is an object and not a string.
      contractTxId,
      years,
      tier,
    });
    await mineBlock(arweave);
    const veryLongNameToBuy =
      "this-is-a-looong-name-a-verrrryyyyy-loooooong-name-that-is-too-long";
    await pst.writeInteraction({
      function: "buyRecord",
      name: veryLongNameToBuy, // should cost 156250000 tokens
      contractTxId,
      years,
      tier,
    });
    await mineBlock(arweave);
    const existingNameToBuy = "permaweb"; // this name should already exist and in its lease
    await pst.writeInteraction({
      function: "buyRecord",
      name: existingNameToBuy, // should cost 156250000 tokens
      contractTxId,
      years,
      tier,
    });
    await mineBlock(arweave);
    const gracePeriodNameToBuy = "grace"; // this name should already exist and in its grace period
    await pst.writeInteraction({
      function: "buyRecord",
      name: gracePeriodNameToBuy, // should cost 156250000 tokens
      contractTxId,
      years,
      tier,
    });
    await mineBlock(arweave);
    const expensiveNameToBuy = "v";
    await pst.writeInteraction({
      function: "buyRecord",
      name: expensiveNameToBuy, // should cost 5000000 tokens
      contractTxId,
      years,
      tier,
    });
    await mineBlock(arweave);
    const disallowedNameToBuy = "test.subdomain.name";
    await pst.writeInteraction({
      function: "buyRecord",
      name: disallowedNameToBuy, // should cost 125000 tokens
      contractTxId,
      years,
      tier,
    });
    await mineBlock(arweave);
    const disallowedNameToBuy2 = "test_subdomain";
    await pst.writeInteraction({
      function: "buyRecord",
      name: disallowedNameToBuy2,
      contractTxId,
      years,
      tier,
    });
    await mineBlock(arweave);
    const invalidYearsName = "years";
    await pst.writeInteraction({
      function: "buyRecord",
      name: invalidYearsName,
      contractTxId,
      years: 0, // too many years
      tier,
    });
    await mineBlock(arweave);
    const invalidTierName = "tier";
    await pst.writeInteraction({
      function: "buyRecord",
      name: invalidTierName,
      contractTxId,
      years,
      tier: "Yep",
    });
    await mineBlock(arweave);
    expect((await pst.currentState()).balances[walletAddress]).toEqual(
      EXPECTED_BALANCE_AFTER_INVALID_TX
    );
  });

  it("should properly add new and update existing tiers", async () => {
    let tier = 4;
    let maxSubdomains = 50000;
    let minTtlSeconds = 300;
    pst.connect(wallet);
    await pst.writeInteraction({
      function: "setTier",
      tier,
      maxSubdomains,
      minTtlSeconds,
    });
    await mineBlock(arweave);
    let currentState = await pst.currentState();
    let currentStateString = JSON.stringify(currentState); // Had to do this because I cannot use my custom token interface
    let currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.tiers[tier].maxSubdomains).toEqual(maxSubdomains);
    expect(currentStateJSON.tiers[tier].minTtlSeconds).toEqual(minTtlSeconds);

    tier = 1;
    maxSubdomains = 100;
    minTtlSeconds = 7200; // double the existing TTL
    await pst.writeInteraction({
      function: "setTier",
      tier,
      maxSubdomains,
      minTtlSeconds,
    });
    await mineBlock(arweave);
    currentState = await pst.currentState();
    currentStateString = JSON.stringify(currentState); // Had to do this because I cannot use my custom token interface
    currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.tiers[tier].minTtlSeconds).toEqual(minTtlSeconds);
  });

  it("should not set tiers with incorrect ownership", async () => {
    const newWallet = await arweave.wallets.generate();
    await addFunds(arweave, newWallet);
    pst.connect(newWallet);
    const tier = 4;
    const maxSubdomains = 150000;
    await pst.writeInteraction({
      function: "setTier",
      tier,
      maxSubdomains,
    });
    await mineBlock(arweave);
    const currentState = await pst.currentState();
    const currentStateString = JSON.stringify(currentState); // Had to do this because I cannot use my custom token interface
    const currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.tiers[tier].maxSubdomains).toEqual(50000);
  });

  it("should extend record with enough balance", async () => {
    pst.connect(wallet2);
    await pst.writeInteraction({
      function: "extendRecord",
      name: "microsoft", // should cost 1000000 tokens
      years: 10, // should bring to a total of 16 years
    });
    await mineBlock(arweave);
    const currentState = await pst.currentState();
    const currentStateString = JSON.stringify(currentState); // Had to do this because I cannot use my custom token interface
    const currentStateJSON = JSON.parse(currentStateString);
    expect(
      currentStateJSON.records["microsoft"].endTimestamp
    ).toBeGreaterThanOrEqual(2162247010);
    expect(currentStateJSON.balances[walletAddress2]).toEqual(968000000);
  });

  it("should not extend record with not enough balance or invalid parameters", async () => {
    pst.connect(wallet2);
    await pst.writeInteraction({
      function: "extendRecord",
      name: "doesnt-exist", // This name doesnt exist so it shouldnt be created
      years: 5,
    });
    await pst.writeInteraction({
      function: "extendRecord",
      name: "expired", // is already expired, so it should not be extendable
      years: 1,
    });
    await mineBlock(arweave);
    await pst.writeInteraction({
      function: "extendRecord",
      name: "microsoft", // should cost 1000000 tokens
      years: 1000, // too many years
    });
    await mineBlock(arweave);
    const newWallet = await arweave.wallets.generate();
    pst.connect(newWallet);
    await pst.writeInteraction({
      function: "extendRecord",
      name: "vile", // should cost too many tokens to extend this existing name with this empty wallet
      years: 50,
    });
    await mineBlock(arweave);
    const currentState = await pst.currentState();
    const currentStateString = JSON.stringify(currentState); // Had to do this because I cannot use my custom token interface
    const currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.balances[walletAddress2]).toEqual(968000000);
    expect(currentStateJSON.records["vile"].endTimestamp).toBeLessThan(
      1765000000
    );
  });

  it("should change fees with correct ownership", async () => {
    pst.connect(wallet); // connect the original owning wallet
    const feesToChange = {
      "1": 5000000000,
      "2": 1406250000,
      "3": 468750000,
      "4": 156250000,
      "5": 62500000,
      "6": 25000000,
      "7": 10000000,
      "8": 5000000,
      "9": 1000000,
      "10": 500000,
      "11": 450000,
      "12": 400000,
      "13": 350000,
      "14": 300000,
      "15": 250000,
      "16": 200000,
      "17": 175000,
      "18": 150000,
      "19": 125000,
      "20": 5,
      "21": 5,
      "22": 5,
      "23": 5,
      "24": 5,
      "25": 5,
      "26": 5,
      "27": 5,
      "28": 5,
      "29": 5,
      "30": 5,
      "31": 5,
      "32": 5,
    };
    await pst.writeInteraction({
      function: "setFees",
      fees: feesToChange,
    });
    await mineBlock(arweave);
    const currentState = await pst.currentState();
    const currentStateString = JSON.stringify(currentState);
    const currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.fees).toEqual(feesToChange);
  });

  it("should not change malformed fees with correct ownership", async () => {
    pst.connect(wallet); // connect the original owning wallet
    const originalFees = {
      "1": 5000000000,
      "2": 1406250000,
      "3": 468750000,
      "4": 156250000,
      "5": 62500000,
      "6": 25000000,
      "7": 10000000,
      "8": 5000000,
      "9": 1000000,
      "10": 500000,
      "11": 450000,
      "12": 400000,
      "13": 350000,
      "14": 300000,
      "15": 250000,
      "16": 200000,
      "17": 175000,
      "18": 150000,
      "19": 125000,
      "20": 5,
      "21": 5,
      "22": 5,
      "23": 5,
      "24": 5,
      "25": 5,
      "26": 5,
      "27": 5,
      "28": 5,
      "29": 5,
      "30": 5,
      "31": 5,
      "32": 5,
    };

    let feesToChange = {
      // should not write if any fee is equal to 0
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 0,
      "6": 0,
      "7": 0,
      "8": 0,
      "9": 1000000,
      "10": 500000,
      "11": 450000,
      "12": 400000,
      "13": 350000,
      "14": 300000,
      "15": 250000,
      "16": 200000,
      "17": 175000,
      "18": 150000,
      "19": 125000,
      "20": 5,
      "21": 5,
      "22": 5,
      "23": 5,
      "24": 5,
      "25": 5,
      "26": 5,
      "27": 5,
      "28": 5,
      "29": 5,
      "30": 5,
      "31": 5,
      "32": 5,
    };
    await pst.writeInteraction({
      function: "setFees",
      fees: feesToChange,
    });
    await mineBlock(arweave);
    let currentState = await pst.currentState();
    let currentStateString = JSON.stringify(currentState);
    let currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.fees).toEqual(originalFees);

    let feesToChange2 = {
      // should not write if strings are the fees
      "1": "5000000000",
      "2": 1406250000,
      "3": 468750000,
      "4": 156250000,
      "5": 62500000,
      "6": 25000000,
      "7": 10000000,
      "8": 5000000,
      "9": 1000000,
      "10": 500000,
      "11": 450000,
      "12": 400000,
      "13": 350000,
      "14": 300000,
      "15": 250000,
      "16": 200000,
      "17": 175000,
      "18": 150000,
      "19": 125000,
      "20": 5,
    };
    await pst.writeInteraction({
      function: "setFees",
      fees: feesToChange2,
    });
    await mineBlock(arweave);
    currentState = await pst.currentState();
    currentStateString = JSON.stringify(currentState);
    currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.fees).toEqual(originalFees);

    let feesToChange3 = {
      // should not write with a string as the index
      whatever: 5000000000,
      "2": 1406250000,
      "3": 468750000,
      "4": 156250000,
      "5": 62500000,
      "6": 25000000,
      "7": 10000000,
      "8": 5000000,
      "9": 1000000,
      "10": 500000,
      "11": 450000,
      "12": 400000,
      "13": 350000,
      "14": 300000,
      "15": 250000,
      "16": 200000,
      "17": 175000,
      "18": 150000,
      "19": 125000,
      "20": 5,
    };
    await pst.writeInteraction({
      function: "setFees",
      fees: feesToChange3,
    });
    await mineBlock(arweave);
    currentState = await pst.currentState();
    currentStateString = JSON.stringify(currentState);
    currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.fees).toEqual(originalFees);

    let feesToChange4 = {
      // should not write if incomplete fees are added
      "1": 1,
      "2": 2,
      "3": 3,
      "4": 4,
      "5": 5,
    };
    await pst.writeInteraction({
      function: "setFees",
      fees: feesToChange4,
    });
    await mineBlock(arweave);
    currentState = await pst.currentState();
    currentStateString = JSON.stringify(currentState);
    currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.fees).toEqual(originalFees);

    let feesToChange5 = {
      // should not write if additional fees are added
      "1": 5000000000,
      "2": 1406250000,
      "3": 468750000,
      "4": 156250000,
      "5": 62500000,
      "6": 25000000,
      "7": 10000000,
      "8": 5000000,
      "9": 1000000,
      "10": 500000,
      "11": 450000,
      "12": 400000,
      "13": 350000,
      "14": 300000,
      "15": 250000,
      "16": 200000,
      "17": 175000,
      "18": 150000,
      "19": 125000,
      "20": 5,
      "21": 1000000000,
    };
    await pst.writeInteraction({
      function: "setFees",
      fees: feesToChange5,
    });
    await mineBlock(arweave);
    currentState = await pst.currentState();
    currentStateString = JSON.stringify(currentState);
    currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.fees).toEqual(originalFees);

    let feesToChange6 = {
      // should not write if decimals are used
      "1": 5000000000.666,
      "2": 1406250000,
      "3": 468750000,
      "4": 156250000,
      "5": 62500000,
      "6": 25000000,
      "7": 10000000,
      "8": 5000000,
      "9": 1000000,
      "10": 500000,
      "11": 450000,
      "12": 400000,
      "13": 350000,
      "14": 300000,
      "15": 250000,
      "16": 200000,
      "17": 175000,
      "18": 150000,
      "19": 125000,
      "20": 5.666,
    };
    await pst.writeInteraction({
      function: "setFees",
      fees: feesToChange6,
    });
    await mineBlock(arweave);
    currentState = await pst.currentState();
    currentStateString = JSON.stringify(currentState);
    currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.fees).toEqual(originalFees);
  });

  it("should not change fees with incorrect ownership", async () => {
    const originalFees = {
      "1": 5000000000,
      "2": 1406250000,
      "3": 468750000,
      "4": 156250000,
      "5": 62500000,
      "6": 25000000,
      "7": 10000000,
      "8": 5000000,
      "9": 1000000,
      "10": 500000,
      "11": 450000,
      "12": 400000,
      "13": 350000,
      "14": 300000,
      "15": 250000,
      "16": 200000,
      "17": 175000,
      "18": 150000,
      "19": 125000,
      "20": 5,
      "21": 5,
      "22": 5,
      "23": 5,
      "24": 5,
      "25": 5,
      "26": 5,
      "27": 5,
      "28": 5,
      "29": 5,
      "30": 5,
      "31": 5,
      "32": 5,
    };
    const newWallet = await arweave.wallets.generate();
    await addFunds(arweave, newWallet);
    pst.connect(newWallet);
    const feesToChange = {
      "1": 1,
      "2": 1,
      "3": 1,
      "4": 1,
      "5": 1,
      "6": 1,
      "7": 1,
      "8": 1,
      "9": 1,
      "10": 1,
      "11": 1,
      "12": 1,
      "13": 1,
      "14": 1,
      "15": 1,
      "16": 1,
      "17": 1,
      "18": 1,
      "19": 1,
      "20": 5,
      "21": 5,
      "22": 5,
      "23": 5,
      "24": 5,
      "25": 5,
      "26": 5,
      "27": 5,
      "28": 5,
      "29": 5,
      "30": 5,
      "31": 5,
      "32": 5,
    };
    await pst.writeInteraction({
      function: "setFees",
      fees: feesToChange,
    });
    await mineBlock(arweave);
    const currentState = await pst.currentState();
    const currentStateString = JSON.stringify(currentState);
    const currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.fees).toEqual(originalFees);
  });

  it("should add valid whitelisted ANT Smartweave Contract Source TX IDs with correct ownership", async () => {
    pst.connect(wallet); // connect the original owning wallet
    const sourceTxIdToAdd = "da51nhDwLZaLBA3lzpE7xl36Rms2NwUNZ7SKOTEWkbI";
    await pst.writeInteraction({
      function: "addANTSourceCodeTx",
      contractTxId: sourceTxIdToAdd,
    });

    const anotherSourceTxIdToAdd = "test"; // this should not get added because it is not a valid arweave transaction
    await pst.writeInteraction({
      function: "addANTSourceCodeTx",
      contractTxId: anotherSourceTxIdToAdd,
    });
    await mineBlock(arweave);
    const currentState = await pst.currentState();
    const currentStateString = JSON.stringify(currentState);
    const currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.approvedANTSourceCodeTxs).toContain(
      sourceTxIdToAdd
    );
    if (
      currentStateJSON.approvedANTSourceCodeTxs.indexOf(
        anotherSourceTxIdToAdd
      ) > -1
    ) {
      expect(false);
    } else {
      expect(true);
    }
  });

  it("should not add whitelisted ANT Smartweave Contract Source TX IDs with incorrect ownership", async () => {
    pst.connect(wallet4);
    const sourceTxIdToAdd = "BLAHhDwLZaLBA3lzpE7xl36Rms2NwUNZ7SKOTEWkbI";
    await pst.writeInteraction({
      function: "addANTSourceCodeTx",
      contractTxId: sourceTxIdToAdd,
    });
    await mineBlock(arweave);
    const currentState = await pst.currentState();
    const currentStateString = JSON.stringify(currentState);
    const currentStateJSON = JSON.parse(currentStateString);
    if (
      currentStateJSON.approvedANTSourceCodeTxs.indexOf(sourceTxIdToAdd) > -1
    ) {
      expect(false);
    } else {
      expect(true);
    }
  });

  it("should remove whitelisted ANT Smartweave Contract Source TX IDs with correct ownership", async () => {
    pst.connect(wallet);
    const sourceTxIdToRemove = "da51nhDwLZaLBA3lzpE7xl36Rms2NwUNZ7SKOTEWkbI";
    await pst.writeInteraction({
      function: "removeANTSourceCodeTx",
      contractTxId: sourceTxIdToRemove,
    });
    await mineBlock(arweave);
    const newState = await pst.currentState();
    const newStateString = JSON.stringify(newState);
    const newStateJSON = JSON.parse(newStateString);
    if (
      newStateJSON.approvedANTSourceCodeTxs.indexOf(sourceTxIdToRemove) > -1
    ) {
      expect(false);
    } else {
      expect(true);
    }
  });

  it("should not remove whitelisted ANT Smartweave Contract Source TX IDs with incorrect ownership", async () => {
    pst.connect(wallet5);
    const currentState = await pst.currentState();
    const currentStateString = JSON.stringify(currentState);
    const currentStateJSON = JSON.parse(currentStateString);
    const sourceTxIdToRemove = currentStateJSON.approvedANTSourceCodeTxs[0];
    await pst.writeInteraction({
      function: "removeANTSourceCodeTx",
      contractTxId: sourceTxIdToRemove,
    });
    await mineBlock(arweave);
    const newState = await pst.currentState();
    const newStateString = JSON.stringify(newState);
    const newStateJSON = JSON.parse(newStateString);
    expect(newStateJSON.approvedANTSourceCodeTxs).toEqual(
      currentStateJSON.approvedANTSourceCodeTxs
    );
  });

  it("should upgrade tier with correct balance, regardless of ownership", async () => {
    pst.connect(wallet2);
    const name = "permaweb";
    await pst.writeInteraction({
      function: "upgradeTier",
      name: "permaweb",
      tier: 2,
    });
    await mineBlock(arweave);
    const currentState = await pst.currentState();
    const currentStateString = JSON.stringify(currentState);
    const currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.records[name].tier).toEqual(2);
  });

  it("should not upgrade tier on expired name or without correct balance", async () => {
    const name = "permaweb";
    const newWallet = await arweave.wallets.generate();
    pst.connect(newWallet); // empty wallet
    await pst.writeInteraction({
      function: "upgradeTier",
      name: name,
      tier: 3,
    });
    const expiredName = "expired";
    pst.connect(wallet); // wallet with tokens
    await pst.writeInteraction({
      function: "upgradeTier",
      name: expiredName,
      tier: 2,
    });
    await mineBlock(arweave);
    const currentState = await pst.currentState();
    const currentStateString = JSON.stringify(currentState);
    const currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.records[name].tier).toEqual(2); // the tier should remain unchanged
    expect(currentStateJSON.records[expiredName].tier).toEqual(1); // the tier should remain unchanged
  });

  it("should not downgrade tier with correct balance, regardless of ownership", async () => {
    pst.connect(wallet2);
    const name = "permaweb";
    await pst.writeInteraction({
      function: "upgradeTier",
      name: "permaweb",
      tier: 1,
    });
    await mineBlock(arweave);
    const currentState = await pst.currentState();
    const currentStateString = JSON.stringify(currentState);
    const currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.records[name].tier).toEqual(2);
  });

  it("should not remove names with incorrect ownership", async () => {
    const nameToRemove = "vile";
    await pst.writeInteraction({
      function: "removeRecord",
      name: nameToRemove,
    });
    await mineBlock(arweave);
    const currentState = await pst.currentState();
    const currentStateString = JSON.stringify(currentState);
    const currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.records[nameToRemove]).toBeTruthy();
  });

  it("should remove names with correct ownership", async () => {
    pst.connect(wallet); // connect the original owning wallet
    const nameToRemove = "vile";
    await pst.writeInteraction({
      function: "removeRecord",
      name: nameToRemove,
    });
    await mineBlock(arweave);
    const currentState = await pst.currentState();
    const currentStateString = JSON.stringify(currentState);
    const currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.records[nameToRemove]).toEqual(undefined);
  });

  // EVOLUTION
  it("should properly evolve contract's source code", async () => {
    pst.connect(wallet);
    expect((await pst.currentBalance(walletAddress)).balance).toEqual(
      EXPECTED_BALANCE_AFTER_INVALID_TX
    );

    const newSource = fs.readFileSync(
      path.join(__dirname, "../src/tools/contract_evolve.js"),
      "utf8"
    );

    const newSrcTxId = await pst.save({ src: newSource }, warp.environment);
    if (newSrcTxId === null) {
      return 0;
    }
    await mineBlock(arweave);

    await pst.evolve(newSrcTxId);
    await mineBlock(arweave);

    // note: the evolved balance always returns -1
    expect((await pst.currentBalance(walletAddress)).balance).toEqual(-1);

    const updatedContractTxId = await pst.save(
      { src: contractSrc },
      warp.environment
    );
    if (updatedContractTxId === null) {
      return 0;
    }
    await mineBlock(arweave);
    await pst.evolve(updatedContractTxId);
    await mineBlock(arweave);

    // note: the balance should return correctly now
    expect((await pst.currentBalance(walletAddress)).balance).toEqual(
      EXPECTED_BALANCE_AFTER_INVALID_TX
    );
  });

  it("should not evolve contract's source code without correct ownership", async () => {
    const newWallet = await arweave.wallets.generate();
    await addFunds(arweave, newWallet);
    pst.connect(newWallet);
    expect((await pst.currentBalance(walletAddress)).balance).toEqual(
      EXPECTED_BALANCE_AFTER_INVALID_TX
    );

    const newSource = fs.readFileSync(
      path.join(__dirname, "../src/tools/contract_evolve.js"),
      "utf8"
    );
    const newSrcTxId = await pst.save({ src: newSource }, warp.environment);
    if (newSrcTxId === null) {
      return 0;
    }
    await mineBlock(arweave);

    await pst.evolve(newSrcTxId);
    await mineBlock(arweave);

    // note: the evolved balance always returns 1 because the contract did not change
    expect((await pst.currentBalance(walletAddress)).balance).toEqual(
      EXPECTED_BALANCE_AFTER_INVALID_TX
    );
  });

  // FOUNDATION
  it("should not initiate foundation actions with incorrect ownership", async () => {
    const newWallet = await arweave.wallets.generate();
    const overwrittenCaller = await arweave.wallets.jwkToAddress(newWallet);
    pst.connect(newWallet);
    await pst.writeInteraction({
      function: "initiateFoundationAction",
      type: "transfer",
      note: "Hacked",
      recipient: overwrittenCaller, // send the tokens to the hacker
      qty: 10000, // no lock length
    });
    await pst.writeInteraction({
      function: "initiateFoundationAction",
      type: "transfer",
      note: "Hacked",
      recipient: overwrittenCaller, // send the tokens to the hacker
      lockLength: 100,
      qty: 10000,
    });
    await pst.writeInteraction({
      function: "initiateFoundationAction",
      type: "setMinSignatures",
      note: "Hacked",
      value: 1,
    });
    await pst.writeInteraction({
      function: "initiateFoundationAction",
      type: "setActionPeriod",
      note: "Hacked",
      value: 1,
    });
    await pst.writeInteraction({
      function: "initiateFoundationAction",
      type: "addAddress",
      note: "Hacked",
      target: overwrittenCaller, // try to add the caller
    });
    await pst.writeInteraction({
      function: "initiateFoundationAction",
      type: "removeAddress",
      note: "Hacked",
      target: walletAddress, // try to remove an existing wallet
    });
    await mineBlock(arweave);
    const currentState = await pst.currentState();
    const currentStateString = JSON.stringify(currentState); // Had to do this because I cannot use my custom token interface
    const currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.foundation.actions).toEqual([]); // no actions should have been initiated
  });

  it("should initiate foundation token transfer (locked and unlocked) with correct ownership", async () => {
    const newWallet = await arweave.wallets.generate();
    const recipient = await arweave.wallets.jwkToAddress(newWallet);
    const lockLength = 50;
    pst.connect(wallet);
    await pst.writeInteraction({
      function: "initiateFoundationAction",
      type: "transfer",
      note: `Transferring unlocked to ${recipient}`,
      recipient,
      qty: 10000, // no lock length
    });
    await mineBlock(arweave);
    await pst.writeInteraction({
      function: "initiateFoundationAction",
      type: "transfer",
      note: `Transferring locked to ${recipient}`,
      recipient,
      qty: 50000,
      lockLength,
    });
    await mineBlock(arweave);
    await pst.writeInteraction({
      function: "initiateFoundationAction",
      type: "transfer",
      note: `Elapsed test of transferring unlocked to ${recipient}`,
      recipient,
      qty: 666,
    });
    await mineBlock(arweave);
    const currentState = await pst.currentState();
    const currentStateString = JSON.stringify(currentState);
    const currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.foundation.actions.length).toEqual(3); // three transfers should have been initialized
  });

  it("should not approve foundation token transfer with incorrect foundation wallet", async () => {
    const newWallet = await arweave.wallets.generate();
    const id = 0;
    pst.connect(newWallet);
    await pst.writeInteraction({
      function: "approveFoundationAction",
      id,
    });
    await mineBlock(arweave);
    const currentState = await pst.currentState();
    const currentStateString = JSON.stringify(currentState); // Had to do this because I cannot use my custom token interface
    const currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.foundation.actions[id].signed).toEqual([]); // there should not be any signatures on this vote
  });

  it("should approve foundation token transfers with correct foundation wallets", async () => {
    pst.connect(wallet);
    await pst.writeInteraction({
      function: "approveFoundationAction",
      id: 0,
    });
    await pst.writeInteraction({
      function: "approveFoundationAction",
      id: 1, // this is the locked transfer
    });
    await pst.writeInteraction({
      function: "approveFoundationAction",
      id: 2, // this transfer will elapse on purpose with a single vote
    });
    pst.connect(wallet2);
    await pst.writeInteraction({
      function: "approveFoundationAction",
      id: 0,
    });
    await pst.writeInteraction({
      function: "approveFoundationAction",
      id: 1, // this is the locked transfer
    });
    await mineBlock(arweave);
    const currentState = await pst.currentState();
    const currentStateString = JSON.stringify(currentState); // Had to do this because I cannot use my custom token interface
    const currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.foundation.actions[0].signed).toContain(
      walletAddress
    );
    expect(currentStateJSON.foundation.actions[0].signed).toContain(
      walletAddress2
    );
    expect(currentStateJSON.foundation.actions[1].signed).toContain(
      walletAddress
    );
    expect(currentStateJSON.foundation.actions[1].signed).toContain(
      walletAddress2
    );
    expect(
      currentStateJSON.balances[
        currentStateJSON.foundation.actions[0].recipient
      ]
    ).toEqual(currentStateJSON.foundation.actions[0].qty);
  });

  it("should not complete when foundation token transfer has elapsed", async () => {
    pst.connect(wallet2);
    await mineBlock(arweave);
    await mineBlock(arweave);
    await mineBlock(arweave);
    await mineBlock(arweave);
    await mineBlock(arweave);
    await mineBlock(arweave);
    await mineBlock(arweave);
    await mineBlock(arweave);
    await mineBlock(arweave);
    await mineBlock(arweave);
    await pst.writeInteraction({
      function: "approveFoundationAction",
      id: 2,
    });
    await mineBlock(arweave);
    const currentState = await pst.currentState();
    const currentStateString = JSON.stringify(currentState); // Had to do this because I cannot use my custom token interface
    const currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.foundation.actions[2].status).toEqual("failed");
  });

  it("should initiate other foundation actions (add/remove address, setactionPeriod, setMinSignatures) with correct ownership", async () => {
    pst.connect(wallet);
    await pst.writeInteraction({
      function: "initiateFoundationAction",
      type: "addAddress",
      note: `Adding new foundation address ${walletAddress4}`,
      target: walletAddress4,
    });
    await mineBlock(arweave);
    await pst.writeInteraction({
      function: "initiateFoundationAction",
      type: "removeAddress",
      note: `Removing foundation address ${walletAddress2}`,
      target: walletAddress2,
    });
    await mineBlock(arweave);
    await pst.writeInteraction({
      function: "initiateFoundationAction",
      type: "setActionPeriod",
      note: `Changing transfer period to 20`,
      value: 20,
    });
    await mineBlock(arweave);
    await pst.writeInteraction({
      function: "initiateFoundationAction",
      type: "setMinSignatures",
      note: `Lowering min signatures to 1`,
      value: 1,
    });
    await mineBlock(arweave);
    const currentState = await pst.currentState();
    const currentStateString = JSON.stringify(currentState);
    const currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.foundation.actions.length).toEqual(7); // 8 actions should be present
  });

  it("should approve foundation actions (add/remove address, setactionPeriod, setMinSignatures) with correct foundation wallets", async () => {
    pst.connect(wallet);
    await pst.writeInteraction({
      function: "approveFoundationAction",
      id: 3,
    });
    await pst.writeInteraction({
      function: "approveFoundationAction",
      id: 4, // this is the locked transfer
    });
    await pst.writeInteraction({
      function: "approveFoundationAction",
      id: 5, // this transfer will elapse on purpose with a single vote
    });
    await pst.writeInteraction({
      function: "approveFoundationAction",
      id: 6, // this will set minimum signatures
    });
    pst.connect(wallet3);
    await pst.writeInteraction({
      function: "approveFoundationAction",
      id: 3,
    });
    await pst.writeInteraction({
      function: "approveFoundationAction",
      id: 4, // this is the locked transfer
    });
    await pst.writeInteraction({
      function: "approveFoundationAction",
      id: 5, // this transfer will elapse on purpose with a single vote
    });
    await pst.writeInteraction({
      function: "approveFoundationAction",
      id: 6, // this transfer will elapse on purpose with a single vote
    });
    await mineBlock(arweave);
    const currentState = await pst.currentState();
    const currentStateString = JSON.stringify(currentState); // Had to do this because I cannot use my custom token interface
    const currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.foundation.actions[3].signed).toContain(
      walletAddress
    );
    expect(currentStateJSON.foundation.actions[3].signed).toContain(
      walletAddress3
    );
    expect(currentStateJSON.foundation.actions[4].signed).toContain(
      walletAddress
    );
    expect(currentStateJSON.foundation.actions[4].signed).toContain(
      walletAddress3
    );
    expect(currentStateJSON.foundation.actions[5].signed).toContain(
      walletAddress
    );
    expect(currentStateJSON.foundation.actions[5].signed).toContain(
      walletAddress3
    );
    expect(currentStateJSON.foundation.actions[6].signed).toContain(
      walletAddress
    );
    expect(currentStateJSON.foundation.actions[6].signed).toContain(
      walletAddress3
    );
    expect(currentStateJSON.foundation.minSignatures).toEqual(1);
  });

  // COMMUNITY LOCKING AND STAKING
  it("should lock tokens correct ownership, amounts and locktimes", async () => {
    pst.connect(wallet); // connect the original owning wallet
    await pst.writeInteraction({
      function: "lock",
      qty: 666,
      lockLength: 20,
    });
    await mineBlock(arweave);
    let currentState = await pst.currentState();
    let currentStateString = JSON.stringify(currentState, null, 2);
    let currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.vaults[walletAddress][1].balance).toEqual(666);

    await pst.writeInteraction({
      function: "lock",
      qty: 666,
      lockLength: 100000000, // invalid lock length
    });
    await mineBlock(arweave);
    currentState = await pst.currentState();
    currentStateString = JSON.stringify(currentState);
    currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.vaults[walletAddress].length).toEqual(2); // we should only have 2 vaults still

    await pst.writeInteraction({
      function: "lock",
      qty: 66600000000000000, // invalid token amount
      lockLength: 100,
    });
    await mineBlock(arweave);
    currentState = await pst.currentState();
    currentStateString = JSON.stringify(currentState, null, 2);
    currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.vaults[walletAddress].length).toEqual(2); // we should only have 2 vaults still
  });

  it("should not lock tokens with correct ownership but incorrect amounts and locktimes", async () => {
    pst.connect(wallet); // connect the original owning wallet
    await pst.writeInteraction({
      function: "lock",
      qty: 666,
      lockLength: 100000000, // invalid lock length
    });
    await mineBlock(arweave);
    let currentState = await pst.currentState();
    let currentStateString = JSON.stringify(currentState);
    let currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.vaults[walletAddress].length).toEqual(2); // we should only have 2 vaults still

    await pst.writeInteraction({
      function: "lock",
      qty: 66600000000000000, // invalid token amount
      lockLength: 100,
    });
    await mineBlock(arweave);
    currentState = await pst.currentState();
    currentStateString = JSON.stringify(currentState, null, 2);
    currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.vaults[walletAddress].length).toEqual(2); // we should only have 2 vaults still

    await pst.writeInteraction({
      function: "lock",
      qty: 666, // invalid token amount
      lockLength: 1,
    });
    await mineBlock(arweave);
    currentState = await pst.currentState();
    currentStateString = JSON.stringify(currentState, null, 2);
    currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.vaults[walletAddress].length).toEqual(2); // we should only have 2 vaults still
  });

  it("should not lock tokens with incorrect ownership", async () => {
    const newWallet = await arweave.wallets.generate();
    const newWalletAddress = await arweave.wallets.jwkToAddress(newWallet);
    pst.connect(newWallet); // connect the original owning wallet
    const qty = 666;
    const lockLength = 100;
    await pst.writeInteraction({
      function: "lock",
      qty,
      lockLength,
    });
    await mineBlock(arweave);
    const currentState = await pst.currentState();
    const currentStateString = JSON.stringify(currentState);
    const currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.vaults[newWalletAddress]).toEqual(undefined);
  });

  it("should not unlock tokens correct ownership if they are not unlockable", async () => {
    pst.connect(wallet); // connect the original owning wallet
    await pst.writeInteraction({
      function: "unlock",
    });
    await mineBlock(arweave);
    const currentState = await pst.currentState();
    const currentStateString = JSON.stringify(currentState);
    const currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.vaults[walletAddress].length).toEqual(2); // we should still have 2 vaults now
  });

  it("should unlock tokens correct ownership, amounts and locktimes", async () => {
    await mineBlock(arweave);
    await mineBlock(arweave);
    await mineBlock(arweave);
    await mineBlock(arweave);
    await mineBlock(arweave); // Mine 5 blocks to ensure latest vault can be unlocked
    pst.connect(wallet); // connect the original owning wallet
    await pst.writeInteraction({
      function: "unlock",
      id: 1,
    });
    await mineBlock(arweave);
    let currentState = await pst.currentState();
    let currentStateString = JSON.stringify(currentState);
    let currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.vaults[walletAddress].length).toEqual(1); // we should only have 1 vault now
  });

  it("should increase vault lock time length with correct ownership", async () => {
    pst.connect(wallet);
    await pst.writeInteraction({
      function: "lock",
      qty: 10000,
      lockLength: 100,
    });
    await mineBlock(arweave);
    await pst.writeInteraction({
      function: "increaseVaultLength",
      id: 1,
      lockLength: 555,
    });
    await mineBlock(arweave);
    let currentState = await pst.currentState();
    let currentStateString = JSON.stringify(currentState);
    let currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.vaults[walletAddress].length).toEqual(2); // we should only have 2 vaults now
    expect(currentStateJSON.vaults[walletAddress][1].end).toEqual(717); // the second vault should end at 590 blocks
  });

  it("should not increase vault lock time length with invalid length", async () => {
    const vaultEnds = 717;
    await pst.writeInteraction({
      function: "increaseVaultLength",
      id: 1,
      lockLength: 1, // too low
    });
    await mineBlock(arweave);
    let currentState = await pst.currentState();
    let currentStateString = JSON.stringify(currentState);
    let currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.vaults[walletAddress].length).toEqual(2); // we should still have 2 vaults now
    expect(currentStateJSON.vaults[walletAddress][1].end).toEqual(vaultEnds); // the second vault should end at 590 blocks

    await pst.writeInteraction({
      function: "increaseVaultLength",
      id: 1,
      lockLength: 100000000000, // too high
    });
    await mineBlock(arweave);
    currentState = await pst.currentState();
    currentStateString = JSON.stringify(currentState);
    currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.vaults[walletAddress].length).toEqual(2); // we should still have 2 vaults now
    expect(currentStateJSON.vaults[walletAddress][1].end).toEqual(vaultEnds); // the second vault should end at 590 blocks

    await pst.writeInteraction({
      function: "increaseVaultLength",
      id: 1,
      lockLength: "100", // strings are invalid
    });
    await mineBlock(arweave);
    currentState = await pst.currentState();
    currentStateString = JSON.stringify(currentState);
    currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.vaults[walletAddress].length).toEqual(2); // we should still have 2 vaults now
    expect(currentStateJSON.vaults[walletAddress][1].end).toEqual(vaultEnds); // the second vault should end at 590 blocks

    await pst.writeInteraction({
      function: "increaseVaultLength",
      id: "1", // strings are invalid
      lockLength: 100,
    });
    await mineBlock(arweave);
    currentState = await pst.currentState();
    currentStateString = JSON.stringify(currentState);
    currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.vaults[walletAddress].length).toEqual(2); // we should still have 2 vaults now
    expect(currentStateJSON.vaults[walletAddress][1].end).toEqual(vaultEnds); // the second vault should end at 590 blocks
  });

  it("should transfer tokens to a locked vault", async () => {
    let currentState = await pst.currentState();
    let currentStateString = JSON.stringify(currentState);
    let currentStateJSON = JSON.parse(currentStateString);
    let currentBalance = currentStateJSON.balances[walletAddress2];
    let target = walletAddress4;
    let qty = 500;
    let lockLength = 150;
    pst.connect(wallet2);
    await pst.writeInteraction({
      function: "transferLocked",
      target,
      qty,
      lockLength,
    });
    await mineBlock(arweave);
    currentState = await pst.currentState();
    currentStateString = JSON.stringify(currentState);
    currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.balances[walletAddress2]).toEqual(
      currentBalance - qty
    );
    expect(currentStateJSON.vaults[target]).toEqual([
      { balance: qty, end: 322, start: 172 },
    ]);
  });

  it("should not transfer tokens to a locked vault with incorrect balance or ownership", async () => {
    let target = walletAddress5; // empty wallet
    let qty = 100;
    let lockLength = 150;
    pst.connect(wallet4); // only owns a vaulted balance
    await pst.writeInteraction({
      function: "transferLocked",
      target,
      qty,
      lockLength,
    });
    await pst.writeInteraction({
      function: "transfer", // confirm locked tokens can not be transferred either
      target,
      qty,
    });
    await mineBlock(arweave);
    let currentState = await pst.currentState();
    let currentStateString = JSON.stringify(currentState);
    let currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.vaults[walletAddress4]).toEqual([
      { balance: 500, end: 322, start: 172 },
    ]); // this vault should not be changed from its original balance of 500
    expect(currentStateJSON.balances[walletAddress4]).toEqual(undefined); //  this wallet should still have an empty unlocked balance
    expect(currentStateJSON.vaults[walletAddress5]).toEqual(undefined); // no tokens should have been transfer locked

    target = walletAddress4;
    qty = 111;
    lockLength = 150;
    pst.connect(wallet5); // does not own any tokens
    await pst.writeInteraction({
      function: "transferLocked",
      target,
      qty,
      lockLength,
    });
    await mineBlock(arweave);
    currentState = await pst.currentState();
    currentStateString = JSON.stringify(currentState);
    currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.vaults[walletAddress4]).toEqual([
      { balance: 500, end: 322, start: 172 },
    ]);
    expect(currentStateJSON.balances[walletAddress5]).toEqual(undefined);

    qty = 1000000000000000; // Very large amount of tokens that the wallet does not own
    pst.connect(wallet2); // does not own any tokens
    await pst.writeInteraction({
      function: "transferLocked",
      target,
      qty,
      lockLength,
    });
    await mineBlock(arweave);
    currentState = await pst.currentState();
    currentStateString = JSON.stringify(currentState);
    currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.vaults[walletAddress4]).toEqual([
      { balance: 500, end: 322, start: 172 },
    ]);
  });

  // Network Join and Delegated Stake
  it("should join the network with correct parameters", async () => {
    let qty = 5000; // must meet the minimum
    let label = "Test Gateway"; // friendly label
    let sslFingerprint = "282D6F79C9533C534EBD28826CB3D706139761AB";
    let ipAddress = "192.168.1.40";
    let url = "test.ar.io";
    let port = 3000;
    let protocol = "http";

    pst.connect(gatewayWallet); // only owns a vaulted balance

    await pst.writeInteraction({
      function: "joinNetwork",
      qty,
      label,
      sslFingerprint,
      ipAddress,
      url,
      port,
      protocol,
    });

    await mineBlock(arweave);
    let currentState = await pst.currentState();
    let currentStateString = JSON.stringify(currentState);
    let currentStateJSON = JSON.parse(currentStateString);
    expect(
      currentStateJSON.gateways[gatewayWalletAddress].vaults[0].balance
    ).toEqual(5000);
    expect(currentStateJSON.balances[gatewayWalletAddress]).toEqual(
      GATEWAY_STARTING_TOKENS - 5000
    );
    expect(
      currentStateJSON.gateways[gatewayWalletAddress].operatorStake
    ).toEqual(qty);
  });

  it("should increase gateway stake with correct balance", async () => {
    let qty = 1000;
    pst.connect(gatewayWallet); // only owns a vaulted balance
    await pst.writeInteraction({
      function: "increaseOperatorStake",
      qty,
    });
    qty = 9999;
    await pst.writeInteraction({
      function: "increaseOperatorStake",
      qty,
    });
    await mineBlock(arweave);
    let currentState = await pst.currentState();
    let currentStateString = JSON.stringify(currentState);
    let currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.balances[gatewayWalletAddress]).toEqual(
      GATEWAY_STARTING_TOKENS - 5000 - 1000 - 9999
    );
    expect(
      currentStateJSON.gateways[gatewayWalletAddress].operatorStake
    ).toEqual(5000 + 1000 + 9999);
    expect(
      currentStateJSON.gateways[gatewayWalletAddress].vaults[1].balance
    ).toEqual(1000);
  });

  it("should decrease gateway stake with correct ownership", async () => {
    let id = 2;
    pst.connect(gatewayWallet); // owns 2 vaulted balances
    await pst.writeInteraction({
      function: "decreaseOperatorStake",
      id,
    });
    await mineBlock(arweave);
    await mineBlock(arweave);
    await mineBlock(arweave);
    await mineBlock(arweave);
    let currentState = await pst.currentState();
    let currentStateString = JSON.stringify(currentState);
    let currentStateJSON = JSON.parse(currentStateString);
    expect(
      currentStateJSON.gateways[gatewayWalletAddress].vaults[2].end
    ).toBeGreaterThan(0);
    await pst.writeInteraction({
      function: "decreaseOperatorStake",
      id,
    });
    await mineBlock(arweave);
    currentState = await pst.currentState();
    currentStateString = JSON.stringify(currentState);
    currentStateJSON = JSON.parse(currentStateString);
    expect(
      currentStateJSON.gateways[gatewayWalletAddress].operatorStake
    ).toEqual(5000 + 1000);
    expect(
      currentStateJSON.gateways[gatewayWalletAddress].vaults[2].balance
    ).toEqual(0);
  });

  it("should delegate stake with correct balance", async () => {
    let qty = 100; // must meet the minimum
    let target = gatewayWalletAddress;
    pst.connect(delegateWallet); // only owns a vaulted balance
    await pst.writeInteraction({
      function: "delegateStake",
      qty,
      target,
    });
    await pst.writeInteraction({
      function: "delegateStake",
      qty,
      target,
    });
    pst.connect(delegateWallet2); // only owns a vaulted balance
    qty = 1000;
    await pst.writeInteraction({
      function: "delegateStake",
      qty,
      target,
    });
    await mineBlock(arweave);
    qty = 5000;
    await pst.writeInteraction({
      function: "delegateStake",
      qty,
      target,
    });
    await mineBlock(arweave);
    qty = 25000;
    await pst.writeInteraction({
      function: "delegateStake",
      qty,
      target,
    });
    await mineBlock(arweave);
    let currentState = await pst.currentState();
    let currentStateString = JSON.stringify(currentState);
    let currentStateJSON = JSON.parse(currentStateString);
    expect(
      currentStateJSON.gateways[gatewayWalletAddress].delegates[
        delegateWalletAddress
      ][0].balance
    ).toEqual(100);
    expect(currentStateJSON.balances[delegateWalletAddress]).toEqual(
      DELEGATE_STARTING_TOKENS - 100 * 2
    );
    expect(
      currentStateJSON.gateways[gatewayWalletAddress].delegates[
        delegateWalletAddress2
      ].length
    ).toEqual(3);
    expect(
      currentStateJSON.gateways[gatewayWalletAddress].delegatedStake
    ).toEqual(100 + 100 + 1000 + 5000 + 25000);
  });

  it("should undelegate stake with correct ownership", async () => {
    let target = gatewayWalletAddress;
    let id = 1;
    pst.connect(delegateWallet);
    // remove a single stake
    await pst.writeInteraction({
      function: "undelegateStake",
      id,
      target,
    });
    pst.connect(delegateWallet2);
    // remove all stakes
    await pst.writeInteraction({
      function: "undelegateStake",
      target,
    });
    await mineBlock(arweave);
    await mineBlock(arweave);
    await mineBlock(arweave);
    await mineBlock(arweave);
    await mineBlock(arweave);
    let currentState = await pst.currentState();
    let currentStateString = JSON.stringify(currentState);
    let currentStateJSON = JSON.parse(currentStateString);
    expect(
      currentStateJSON.gateways[gatewayWalletAddress].delegates[
        delegateWalletAddress
      ][1].end
    ).toBeGreaterThan(0);
    expect(
      currentStateJSON.gateways[gatewayWalletAddress].delegates[
        delegateWalletAddress2
      ][0].end
    ).toBeGreaterThan(0);
    expect(
      currentStateJSON.gateways[gatewayWalletAddress].delegates[
        delegateWalletAddress2
      ][1].end
    ).toBeGreaterThan(0);
    expect(
      currentStateJSON.gateways[gatewayWalletAddress].delegates[
        delegateWalletAddress2
      ][2].end
    ).toBeGreaterThan(0);
    pst.connect(delegateWallet);
    // finish removing a single stake
    await pst.writeInteraction({
      function: "undelegateStake",
      id,
      target,
    });
    pst.connect(delegateWallet2);
    // finish removing all stakes
    await pst.writeInteraction({
      function: "undelegateStake",
      target,
    });
    await mineBlock(arweave);
    currentState = await pst.currentState();
    currentStateString = JSON.stringify(currentState);
    currentStateJSON = JSON.parse(currentStateString);
    expect(
      currentStateJSON.gateways[gatewayWalletAddress].delegates[
        delegateWalletAddress
      ][1].balance
    ).toEqual(0);
    expect(
      currentStateJSON.gateways[gatewayWalletAddress].delegates[
        delegateWalletAddress2
      ][0].balance
    ).toEqual(0);
    expect(
      currentStateJSON.gateways[gatewayWalletAddress].delegates[
        delegateWalletAddress2
      ][1].balance
    ).toEqual(0);
    expect(
      currentStateJSON.gateways[gatewayWalletAddress].delegates[
        delegateWalletAddress2
      ][2].balance
    ).toEqual(0);
    expect(currentStateJSON.balances[delegateWalletAddress]).toEqual(
      DELEGATE_STARTING_TOKENS - 100
    );
    expect(currentStateJSON.balances[delegateWalletAddress2]).toEqual(
      DELEGATE2_STARTING_TOKENS
    );
    expect(
      currentStateJSON.gateways[gatewayWalletAddress].delegatedStake
    ).toEqual(100);
  });

  it("should slash gateway and its delegates", async () => {
    let target = slashedWalletAddress;
    let penalty = 10;
    pst.connect(wallet); // only owns a vaulted balance
    await pst.writeInteraction({
      function: "proposeGatewaySlash",
      target,
      penalty,
    });
    await mineBlock(arweave);
    let currentState = await pst.currentState();
    let currentStateString = JSON.stringify(currentState);
    let currentStateJSON = JSON.parse(currentStateString);
    expect(
      currentStateJSON.gateways[slashedWalletAddress].delegatedStake
    ).toEqual(780);
    expect(
      currentStateJSON.gateways[slashedWalletAddress].operatorStake
    ).toEqual(5400);
    expect(
      currentStateJSON.gateways[slashedWalletAddress].vaults[0].balance
    ).toEqual(4500);
    expect(
      currentStateJSON.gateways[slashedWalletAddress].vaults[1].balance
    ).toEqual(900);
    expect(
      currentStateJSON.gateways[slashedWalletAddress].delegates[
        delegateWalletAddress
      ][0].balance
    ).toEqual(90);
    expect(
      currentStateJSON.gateways[slashedWalletAddress].delegates[
        delegateWalletAddress
      ][1].balance
    ).toEqual(90);
    expect(
      currentStateJSON.gateways[slashedWalletAddress].delegates[
        delegateWalletAddress2
      ][0].balance
    ).toEqual(600);
  });

  it("should slash gateway and its delegates and remove when stake is too low", async () => {
    let target = slashedWalletAddress;
    let penalty = 50;
    pst.connect(wallet); // contract owner
    await pst.writeInteraction({
      function: "proposeGatewaySlash",
      target,
      penalty,
    });
    await mineBlock(arweave);
    let currentState = await pst.currentState();
    let currentStateString = JSON.stringify(currentState);
    let currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.balances[slashedWalletAddress]).toEqual(2700);
    expect(currentStateJSON.balances[delegateWalletAddress]).toEqual(990);
    expect(currentStateJSON.balances[delegateWalletAddress2]).toEqual(50300);
  });

  it("should leave the network with correct ownership", async () => {
    pst.connect(gatewayWallet); // only owns a vaulted balance
    await pst.writeInteraction({
      function: "leaveNetwork",
    });
    await mineBlock(arweave);
    let currentState = await pst.currentState();
    let currentStateString = JSON.stringify(currentState);
    let currentStateJSON = JSON.parse(currentStateString);
    expect(
      currentStateJSON.gateways[gatewayWalletAddress].vaults[0].end
    ).toBeGreaterThan(0);
    // mine more blocks to force the gatewayLeaveLength
    await mineBlock(arweave);
    await mineBlock(arweave);
    await mineBlock(arweave);
    await pst.writeInteraction({
      function: "leaveNetwork",
    });
    await mineBlock(arweave);
    currentState = await pst.currentState();
    currentStateString = JSON.stringify(currentState);
    currentStateJSON = JSON.parse(currentStateString);
    expect(currentStateJSON.balances[gatewayWalletAddress]).toEqual(
      GATEWAY_STARTING_TOKENS
    );
    expect(currentStateJSON.balances[delegateWalletAddress]).toEqual(
      DELEGATE_STARTING_TOKENS + 90
    );
  });
});
