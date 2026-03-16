import { emptyPluginConfigSchema, type OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { buildQianfanProvider } from "../../src/agents/models-config.providers.static.js";
import { fetchQianfanUsage } from "../../src/infra/provider-usage.fetch.js";

const PROVIDER_ID = "qianfan";

type QianfanPluginConfig = {
  componentCode?: string;
};

const qianfanPlugin = {
  id: PROVIDER_ID,
  name: "Qianfan Provider",
  description: "Bundled Qianfan provider plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.registerProvider({
      id: PROVIDER_ID,
      label: "Qianfan",
      docsPath: "/providers/qianfan",
      envVars: ["QIANFAN_API_KEY"],
      auth: [],
      catalog: {
        order: "simple",
        run: async (ctx) => {
          const apiKey = ctx.resolveProviderApiKey(PROVIDER_ID).apiKey;
          if (!apiKey) {
            return null;
          }
          const explicitProvider = ctx.config.models?.providers?.[PROVIDER_ID];
          const explicitBaseUrl =
            typeof explicitProvider?.baseUrl === "string" ? explicitProvider.baseUrl.trim() : "";
          return {
            provider: {
              ...buildQianfanProvider(),
              ...(explicitBaseUrl ? { baseUrl: explicitBaseUrl } : {}),
              apiKey,
            },
          };
        },
      },
      resolveUsageAuth: async (ctx) => {
        const apiKey = ctx.resolveApiKeyFromConfigAndStore({
          providerIds: [PROVIDER_ID],
          envDirect: [ctx.env.QIANFAN_API_KEY],
        });
        if (!apiKey) {
          return null;
        }

        // Get component code from plugin config
        const pluginConfig = ctx.config.plugins?.entries?.[PROVIDER_ID]?.config as
          | QianfanPluginConfig
          | undefined;
        const componentCode = pluginConfig?.componentCode;

        return {
          token: apiKey,
          metadata: componentCode ? { componentCode } : undefined,
        };
      },
      fetchUsageSnapshot: async (ctx) => {
        const componentCode = (ctx as { metadata?: { componentCode?: string } }).metadata
          ?.componentCode;
        return await fetchQianfanUsage(ctx.token, componentCode, ctx.timeoutMs, ctx.fetchFn);
      },
    });
  },
};

export default qianfanPlugin;
