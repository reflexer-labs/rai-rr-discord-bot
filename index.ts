import Axios from "axios";
import webhook from "webhook-discord"

// Main
export const discordUpdate = async () => {
  const discordWebhook = process.env.DISCORD_WEBHOOK as string;
  const Hook = new webhook.Webhook(discordWebhook);
  // Fetch RAI stats from subgraph
  const stats = await getSubgraphData();

  // Spacing made to align the prices with Twitter font
  const msgContent = `🗿 Redemption Rate Update 🗿
8-hourly Rate: ${stats.eightHourlyRate}%
Daily Rate: ${stats.twentyFourHourlyRate}%
Annualized Rate: ${stats.annualizedRate}%

The Market Price is $${stats.marketPrice} and the Redemption Price is $${stats.redemptionPrice}
`;

// Construct message. See webhook-discord docs for more options
const msg = new webhook.MessageBuilder().setText(msgContent);
// Send msg
Hook.send(msg);
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
        annualizedRate
      }
      currentRedemptionRate {
        eightHourlyRate
      }
      currentRedemptionRate {
        twentyFourHourlyRate
      }
      currentCoinFsmUpdate {
        value
      }
      
    }
      collateralType(id: "ETH-A") {
        currentPrice {
          value
        }
      }
      uniswapPair(id: "0xebde9f61e34b7ac5aae5a4170e964ea85988008c") {
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
  const annualizedRate =
    (parseFloat(res.systemState.currentRedemptionRate.annualizedRate) - 1) *
    100;

  const eightHourlyRate = 
  (parseFloat(res.systemState.currentRedemptionRate.eightHourlyRate) - 1) *
    100;

  const twentyFourHourlyRate = 
  (parseFloat(res.systemState.currentRedemptionRate.twentyFourHourlyRate) - 1) *
    100;

  const uniswapPaiPrice = parseFloat(res.uniswapPair.token1Price);

  return {
    annualizedRate: annualizedRate.toFixed(2),
    eightHourlyRate: eightHourlyRate.toFixed(8),
    twentyFourHourlyRate: twentyFourHourlyRate.toFixed(8),
    marketPrice: (uniswapPaiPrice * ethPrice).toFixed(4),
    redemptionPrice: redemptionPrice.toFixed(4),
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