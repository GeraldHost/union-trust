const { ethers } = require("ethers");
const ABI = require("./abis/userManager.json");
const fs = require("fs");
const { JsonRpcProvider } = require("@ethersproject/providers");

const network = process.env.NETWORK;

if (!network) {
  console.log("No NETWORK provided");
  process.exit();
}

const configs = {
  ethereum: {
    blockRange: 10000,
    startBlock: 13816718,
    infuraKey: "05bc032e727c40d79202e3373090ed55",
    rpcUrl: "https://mainnet.infura.io/v3/",
    address: "0x49c910Ba694789B58F53BFF80633f90B8631c195",
  },
};

if (!Object.keys(configs).includes(network)) {
  console.log("NETWORK not valid");
  process.exit();
}

const config = configs[network];

const blockRange = config.blockRange;
const startBlock = config.startBlock;
const infuraKey = config.infuraKey;
const rpcUrl = config.rpcUrl + infuraKey;
const address = config.address;

const provider = new JsonRpcProvider(rpcUrl);

const userContract = new ethers.Contract(address, ABI, provider);

async function getRegisterLogs() {
  const endBlock = await provider.getBlockNumber();
  console.log(`Current block: ${endBlock}`);
  const filter = userContract.filters.LogUpdateTrust();

  let results = [];
  let block = startBlock;
  while (block + blockRange < endBlock) {
    try {
      const logs = await provider.getLogs({
        fromBlock: block,
        toBlock: block + blockRange,
        ...filter,
      });

      const parsed = logs.map((log) => {
        const logData = userContract.interface.parseLog(log);
        return {
          borrower: logData.args.borrower,
          staker: logData.args.staker,
          amount: logData.args.trustAmount.toString(),
        };
      });

      results = [...results, ...parsed];
      const maybeNextBlock = block + blockRange;
      block =
        maybeNextBlock + blockRange > endBlock
          ? endBlock - blockRange
          : maybeNextBlock;

      console.log(`[*] at block ${block}`);
      console.log(`[*] parsed ${parsed.length} logs, total: ${results.length}`);
    } catch (error) {
      console.log(error.message);
      console.log("[-] error trying again in 5 second");
      await new Promise((res) => setTimeout(res, 5000));
    }
  }

  const content = JSON.stringify(results);
  fs.writeFileSync(
    "./data/" + network + "-update-trust-snapshot.json",
    content
  );
}

getRegisterLogs();
