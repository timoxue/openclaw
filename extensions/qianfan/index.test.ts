import { describe, expect, it } from "vitest";
import { registerSingleProviderPlugin } from "../../src/test-utils/plugin-registration.js";
import qianfanPlugin from "./index.js";

const registerProvider = () => registerSingleProviderPlugin(qianfanPlugin);

describe("qianfan plugin", () => {
  it("registers qianfan provider", () => {
    const provider = registerProvider();
    expect(provider.id).toBe("qianfan");
    expect(provider.label).toBe("Qianfan");
  });

  it("declares QIANFAN_API_KEY as required env var", () => {
    const provider = registerProvider();
    expect(provider.envVars).toEqual(["QIANFAN_API_KEY"]);
  });

  it("points to correct docs path", () => {
    const provider = registerProvider();
    expect(provider.docsPath).toBe("/providers/qianfan");
  });

  it("returns null catalog when API key is missing", async () => {
    const provider = registerProvider();
    const result = await provider.catalog?.run?.({
      resolveProviderApiKey: () => ({ apiKey: null }),
      config: {} as never,
    } as never);

    expect(result).toBeNull();
  });

  it("builds provider config when API key is present", async () => {
    const provider = registerProvider();
    const result = await provider.catalog?.run?.({
      resolveProviderApiKey: () => ({ apiKey: "test-api-key" }),
      config: {} as never,
    } as never);

    expect(result).toBeDefined();
    expect(result?.provider).toBeDefined();
    expect(result?.provider.apiKey).toBe("test-api-key");
    expect(result?.provider.api).toBe("openai-completions");
  });

  it("includes default models in catalog", async () => {
    const provider = registerProvider();
    const result = await provider.catalog?.run?.({
      resolveProviderApiKey: () => ({ apiKey: "test-api-key" }),
      config: {} as never,
    } as never);

    expect(result?.provider.models).toBeDefined();
    expect(result?.provider.models?.length).toBeGreaterThan(0);

    // Check for DEEPSEEK V3.2 model
    const deepseekModel = result?.provider.models?.find(
      (m: { id: string }) => m.id === "deepseek-v3.2-128k"
    );
    expect(deepseekModel).toBeDefined();
    expect(deepseekModel?.name).toBe("DEEPSEEK V3.2");
    expect(deepseekModel?.reasoning).toBe(true);
  });

  it("includes ERNIE-5.0-Thinking model in catalog", async () => {
    const provider = registerProvider();
    const result = await provider.catalog?.run?.({
      resolveProviderApiKey: () => ({ apiKey: "test-api-key" }),
      config: {} as never,
    } as never);

    const ernieModel = result?.provider.models?.find(
      (m: { id: string }) => m.id === "ernie-5.0-thinking-preview"
    );
    expect(ernieModel).toBeDefined();
    expect(ernieModel?.name).toBe("ERNIE-5.0-Thinking-Preview");
    expect(ernieModel?.reasoning).toBe(true);
    expect(ernieModel?.input).toContain("text");
    expect(ernieModel?.input).toContain("image");
  });

  it("respects explicit baseUrl from config", async () => {
    const provider = registerProvider();
    const customBaseUrl = "https://custom.qianfan.example.com/v1";

    const result = await provider.catalog?.run?.({
      resolveProviderApiKey: () => ({ apiKey: "test-api-key" }),
      config: {
        models: {
          providers: {
            qianfan: {
              baseUrl: customBaseUrl,
            },
          },
        },
      } as never,
    } as never);

    expect(result?.provider.baseUrl).toBe(customBaseUrl);
  });

  it("resolves usage auth with API key", async () => {
    const provider = registerProvider();
    const result = await provider.resolveUsageAuth?.({
      config: {} as never,
      env: {
        QIANFAN_API_KEY: "test-qianfan-key",
      } as NodeJS.ProcessEnv,
      provider: "qianfan",
      resolveApiKeyFromConfigAndStore: () => "test-qianfan-key",
      resolveOAuthToken: async () => null,
    });

    expect(result).toEqual({
      token: "test-qianfan-key",
    });
  });

  it("returns null usage auth when API key is missing", async () => {
    const provider = registerProvider();
    const result = await provider.resolveUsageAuth?.({
      config: {} as never,
      env: {} as NodeJS.ProcessEnv,
      provider: "qianfan",
      resolveApiKeyFromConfigAndStore: () => null,
      resolveOAuthToken: async () => null,
    });

    expect(result).toBeNull();
  });
});
