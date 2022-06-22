const { rejectInTime } = require("../utils/rejectInTime");
const { chains } = require("../utils/chains");
const { ApiPromise, WsProvider } = require("@polkadot/api");
const {
  bifrostOptions,
  khalaOptions,
  karuraOptions,
  polkadexOptions,
  kintsugiOptions,
  crustOptions,
  centrifugeOptions,
} = require("@osn/provider-options");

const nodeTimeoutSeconds = 20;

/**
 *
 * @type {
 *   network: [
 *     {
 *       endpoint,
 *       api
 *     },
 *   ]
 * }
 */
const chainApis = {};

async function reConnect(network, endpoint, logger) {
  const nowApis = chainApis[network] || [];

  const index = nowApis.findIndex(({ endpoint: url }) => url === endpoint);
  if (index >= 0) {
    const [targetApi] = nowApis.splice(index, 1);
    if (targetApi && targetApi.api) {
      await targetApi.api.disconnect();
    }
  }

  console.log(`re-connect network: ${ network } with endpoint: ${ endpoint }`);
  await createApi(network, endpoint);
  logger.info(`Reconnect to ${ network } ${ endpoint }`);
}

async function createApi(network, endpoint, logger = console) {
  const provider = new WsProvider(endpoint, 100);

  let options = {};
  if ([chains.karura, chains.acala].includes(network)) {
    options = karuraOptions;
  } else if (chains.khala === network) {
    options = khalaOptions;
  } else if (chains.bifrost === network) {
    options = bifrostOptions;
  } else if (chains.polkadex === network) {
    options = polkadexOptions;
  } else if ([chains.kintsugi, chains.interlay].includes(network)) {
    options = kintsugiOptions;
  } else if (chains.crust === network) {
    options = crustOptions;
  } else if (chains.centrifuge === network) {
    options = centrifugeOptions;
  }

  let api;
  try {
    api = await ApiPromise.create({ provider, ...options });
  } catch (e) {
    logger.error(`Can not connect to ${ network } ${ endpoint }`);
    throw e;
  }

  api.on("error", (err) => {
    reConnect(network, endpoint, logger);
  });
  api.on("disconnected", () => {
    reConnect(network, endpoint, logger);
  });

  const nowApis = chainApis[network] || [];
  if (nowApis.findIndex((api) => api.endpoint === endpoint) >= 0) {
    logger.info(`${ network } ${ endpoint } existed, ignore`);
    return;
  }

  const nodeInfo = {
    endpoint,
    api: await api.isReady,
  };
  chainApis[network] = [...nowApis, nodeInfo];
}

async function createApiInLimitTime(network, endpoint, logger = console) {
  return Promise.race([
    createApi(network, endpoint, logger),
    rejectInTime(nodeTimeoutSeconds),
  ]);
}

function getApis(chain) {
  return (chainApis[chain] || []).map(({ api }) => api);
}

function logApiStatus(logger = console) {
  Object.entries(chainApis).map(([chain, apis]) => {
    logger.info(`chain: ${chain}`);
    for (const { endpoint, api } of apis) {
      logger.info(`\t ${endpoint} connected: ${api.isConnected}`);
    }
  });
}

module.exports = {
  createApi,
  createApiInLimitTime,
  getApis,
  logApiStatus,
}
