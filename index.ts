import Axios from "axios";
import webhook from "webhook-discord";

// Main
export const discordUpdate = async () => {
  const discordWebhook = process.env.DISCORD_WEBHOOK as string;
  const Hook = new webhook.Webhook(discordWebhook);
  // Fetch RAI stats from subgraph
  const stats = await getSubgraphData();

  // Spacing made to align the prices with Twitter font
  const msgContent = `🗿 RAI stats update 🗿
24-Hourly RAI Redemption Rate: ${stats.twentyFourHourlyRate}%
Redemption Price is $${stats.redemptionPrice}
Market price: $${stats.marketPrice}
Oracle price: $${stats.oraclePrice}
`;

  // Construct message. See webhook-discord docs for more options
  const msg = new webhook.MessageBuilder()
    .setText(msgContent)
    .setName("Rai-stats-bot");
  // Send msg
  await Hook.send(msg);

  console.log(`Posted Discord msg: ${msgContent}`);
};

// == Subgraph ==

const getSubgraphData = async () => {
  const res = await subgraphQuery(
    "https://subgraph.reflexer.finance/subgraphs/name/reflexer-labs/rai",
    `
  {
    systemState(id: "current") {
      currentRedemptionPrice {
        value
      }
      currentRedemptionRate {
        twentyFourHourlyRate
      }
      currentCoinMedianizerUpdate {
        value
      }
      
    }
      collateralType(id: "ETH-A") {
        currentPrice {
          value
        }
      }
      uniswapPair(id: "0x8ae720a71622e824f576b4a8c03031066548a3b1") {
        token1Price
      }
    }`
  );

  // Get ether price from CoinGecko
  const ethPrice = parseFloat(
    (
      await Axios.get(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
      )
    ).data.ethereum.usd
  );

  // Parse and process data
  const redemptionPrice = parseFloat(
    res.systemState.currentRedemptionPrice.value
  );

  const twentyFourHourlyRate =
    (parseFloat(res.systemState.currentRedemptionRate.twentyFourHourlyRate) -
      1) *
    100;

  const uniswapPaiPrice = parseFloat(res.uniswapPair.token1Price);

  const oraclePrice = parseFloat(
    res.systemState.currentCoinMedianizerUpdate.value
  );

  return {
    twentyFourHourlyRate: twentyFourHourlyRate.toFixed(8),
    marketPrice: (uniswapPaiPrice * ethPrice).toFixed(4),
    redemptionPrice: redemptionPrice.toFixed(4),
    oraclePrice: oraclePrice.toFixed(4),
  };
};

const subgraphQuery = async (host: string, query: string) => {
  const resp = await Axios.post(host, {
    query,
  });

  if (!resp.data || !resp.data.data) {
    throw "No data";
  }

  return resp.data.data;
};
