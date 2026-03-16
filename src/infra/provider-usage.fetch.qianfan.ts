import { buildUsageHttpErrorSnapshot, fetchJson } from "./provider-usage.fetch.shared.js";
import { clampPercent, PROVIDER_LABELS } from "./provider-usage.shared.js";
import type { ProviderUsageSnapshot, UsageWindow } from "./provider-usage.types.js";

// Baidu Qianfan monitoring API response type
// Based on official documentation: https://cloud.baidu.com/doc/qianfan-api/s/Emmbtrjm3
type QianfanMonitorResponse = {
  code?: number;
  message?: string;
  result?: {
    requestId?: string;
    summary?: {
      totalCount?: number;
      successCount?: number;
      failureCount?: number;
      successRate?: number;
      avgTimecost?: number;
      avgQps?: number;
      maxQps?: number;
    };
    trend?: Array<{
      statTime?: number;
      totalCount?: number;
      successCount?: number;
      failureCount?: number;
      avgTimecost?: number;
      p50Timecost?: number;
      p90Timecost?: number;
      p99Timecost?: number;
      avgQps?: number;
      maxQps?: number;
    }>;
  };
};

export async function fetchQianfanUsage(
  apiKey: string,
  componentCode: string | undefined,
  timeoutMs: number,
  fetchFn: typeof fetch,
): Promise<ProviderUsageSnapshot> {
  // Check if component code is provided
  if (!componentCode || !componentCode.trim()) {
    return {
      provider: "qianfan",
      displayName: PROVIDER_LABELS.qianfan || "Qianfan",
      windows: [],
      error:
        "Qianfan usage tracking requires a component code. " +
        "Add it to your config: plugins.entries.qianfan.config.componentCode. " +
        "Get your component code from https://console.bce.baidu.com/qianfan/overview",
    };
  }

  // Calculate date range (last 30 days)
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const apiUrl =
    "https://qianfan.baidubce.com/v2/components?Action=DescribeComponentOverview";

  const res = await fetchJson(
    apiUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        code: componentCode.trim(),
        startTime: thirtyDaysAgo.toISOString().split("T")[0],
        endTime: today.toISOString().split("T")[0],
        timeStep: "day",
      }),
    },
    timeoutMs,
    fetchFn,
  );

  if (!res.ok) {
    return buildUsageHttpErrorSnapshot({
      provider: "qianfan",
      status: res.status,
    });
  }

  const data = (await res.json()) as QianfanMonitorResponse;

  // Handle API errors
  if (data.code !== 0) {
    const errorMessage = data.message || "API error";
    return {
      provider: "qianfan",
      displayName: PROVIDER_LABELS.qianfan || "Qianfan",
      windows: [],
      error: errorMessage,
    };
  }

  const windows: UsageWindow[] = [];

  // Parse monitoring summary
  if (data.result?.summary) {
    const { totalCount, successCount, failureCount, avgQps, maxQps } = data.result.summary;

    // Show failure rate if there are any calls
    if (typeof totalCount === "number" && totalCount > 0) {
      const failurePercent = failureCount
        ? clampPercent((failureCount / totalCount) * 100)
        : 0;

      windows.push({
        label: `API Calls (30d): ${totalCount.toLocaleString()}`,
        usedPercent: failurePercent,
      });
    }

    // Show QPS info if available
    if (typeof avgQps === "number" && typeof maxQps === "number") {
      windows.push({
        label: `QPS: avg ${avgQps.toFixed(2)}, max ${maxQps}`,
        usedPercent: 0, // QPS is informational, not a quota
      });
    }
  }

  return {
    provider: "qianfan",
    displayName: PROVIDER_LABELS.qianfan || "Qianfan",
    windows,
  };
}
