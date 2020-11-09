import Twit from "twit";
import fs from "fs";
import puppeteer from "puppeteer";
import Axios from "axios";

// Main
export const tweetUpdate = async () => {
  
  // Configure Twitter API
  const twit = new Twit({
    consumer_key: process.env.CONSUMER_KEY as string,
    consumer_secret: process.env.CONSUMER_SECRET as string,
    access_token: process.env.ACCESS_TOKEN as string,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET as string,
  });

  // Fetch image
  await raiStatsScreenshot();

  // Upload image to Twitter
  const mediaId = await uploadImage("screenshot.png", twit);

  // Fetch RAI stats from subgraph
  const stats = await getSubgraphData();

  // Assemble Tweet
  const tweetContent = `🗿 PRAI update 🗿

Market Price: $${stats.marketPrice}
Redemption Price: $${stats.redemptionPrice}
Annual Redemption Rate: ${stats.annualizedRate}%
`;

  // Post tweet
  const id = await tweet(tweetContent, twit, mediaId);
  console.log(`Posted Tweet id: ${id}`);
};

// == Twitter endpoint functions ==

// Post a Tweet
const tweet = async (message: string, twit: Twit, mediaId?: string) => {
  const data = await twitterApiPost(
    "statuses/update",
    {
      status: message,
      media_ids: mediaId ? [mediaId] : undefined,
    },
    twit
  );
  return data.id_str as string;
};

// Upload an image
const uploadImage = async (imagePath: string, twit: Twit) => {
  const b64content = fs.readFileSync(imagePath, { encoding: "base64" });
  const uploadResult = await twitterApiPost(
    "media/upload",
    { media_data: b64content },
    twit
  );
  return uploadResult.media_id_string as string;
};

// Generic Twitter API request
const twitterApiPost = async (path: string, params: Twit.Params, twit: Twit) =>
  new Promise<any>((resolve, reject) => {
    twit.post(path, params, (err, data, response) => {
      if (err) {
        reject(err);
      } else {
        console.log(`Twitter API post ${path} success: ${response.statusCode}`);
        resolve(data);
      }
    });
  });

// == Screenshot ==

const raiStatsScreenshot = async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 600, height: 800 });
  await page.goto("https://stats.reflexer.finance/", {
    waitUntil: "networkidle0",
  });
  await page.screenshot({
    path: "./screenshot.png",
    clip: { x: 0, y: 175, width: 600, height: 340 },
  });
  await browser.close();
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

  // Parse and process data
  const ethPrice = parseFloat(res.collateralType.currentPrice.value);
  const redemptionPrice = parseFloat(
    res.systemState.currentRedemptionPrice.value
  );
  const annualizedRate =
    (parseFloat(res.systemState.currentRedemptionRate.annualizedRate) - 1) *
    100;
  const uniswapPaiPrice = parseFloat(res.uniswapPair.token1Price);

  return {
    marketPrice: (uniswapPaiPrice * ethPrice).toFixed(4),
    redemptionPrice: redemptionPrice.toFixed(4),
    annualizedRate: annualizedRate.toFixed(2),
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
