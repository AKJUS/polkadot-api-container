const { rejectInTime } = require("../utils/rejectInTime");
const { ApiPromise, WsProvider } = require("@polkadot/api");
const allOptions = require("@osn/provider-options");

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

  const options = allOptions[network] || {};
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

async function createApiForChain(chain, endpoints, logger = console) {
  for (const endpoint of endpoints) {
    if (!endpoint) {
      continue;
    }

    try {
      await createApiInLimitTime(chain, endpoint);
      console.log(`${ chain }: ${ endpoint } created!`);
    } catch (e) {
      logger.info(
        `Can not connected to ${ endpoint } in ${ nodeTimeoutSeconds } seconds, just disconnect it`
      );
    }
  }
}

function getApis(chain) {
  return (chainApis[chain] || []).map(({ api }) => api);
}

function logApiStatus(logger = console) {
  Object.entries(chainApis).map(([chain, apis]) => {
    logger.info(`chain: ${ chain }`);
    for (const { endpoint, api } of apis) {
      logger.info(`\t ${ endpoint } connected: ${ api.isConnected }`);
    }
  });
}

module.exports = {
  createApi,
  createApiInLimitTime,
  createApiForChain,
  getApis,
  logApiStatus,
}
