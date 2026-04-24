require("dotenv").config();
const { SocketModeClient } = require("@slack/socket-mode");
const { WebClient } = require("@slack/web-api");
const { HttpsProxyAgent } = require("https-proxy-agent");
const appToken = process.env.SLACK_APP_TOKEN;
const botToken = process.env.SLACK_BOT_TOKEN;
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

if (!appToken) {
  console.error("Missing SLACK_APP_TOKEN");
  process.exit(1);
}

if (!botToken) {
  console.error("Missing SLACK_BOT_TOKEN");
  process.exit(1);
}

const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

if (agent) console.log(`使用 proxy: ${proxyUrl}`);

const socketClient = new SocketModeClient({
  appToken,
  clientOptions: { agent },
});

const webClient = new WebClient(botToken, { agent });

socketClient.on("message", async ({ event, ack }) => {
  await ack();

  if (event.bot_id) return;

  console.log(`收到訊息 [${event.channel}] ${event.user}: ${event.text}`);

  try {
    await webClient.chat.postMessage({
      channel: event.channel,
      text: `你說了：${event.text}`,
      thread_ts: event.ts,
    });
  } catch (err) {
    console.error("回覆訊息失敗:", err.message);
  }
});

socketClient.on("connecting", () => console.log("Socket Mode 連線中..."));
socketClient.on("connected", () => console.log("Socket Mode 已連線 ✓"));
socketClient.on("disconnecting", () => console.log("Socket Mode 中斷連線中..."));
socketClient.on("disconnected", () => console.log("Socket Mode 已中斷連線"));
socketClient.on("reconnecting", () => console.log("Socket Mode 重新連線中..."));

(async () => {
  await socketClient.start();
})();