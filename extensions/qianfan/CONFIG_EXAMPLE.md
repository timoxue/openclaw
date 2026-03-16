# Qianfan Plugin Configuration Example

## Basic Setup

```json5
{
  env: {
    QIANFAN_API_KEY: "bce-v3/ALTAK-xxx/xxx",
  },
  agents: {
    defaults: {
      model: { primary: "qianfan/deepseek-v3.2-128k" },
    },
  },
}
```

## With Usage Monitoring

To enable usage monitoring, you need to provide your component code from Baidu Qianfan console:

```json5
{
  env: {
    QIANFAN_API_KEY: "bce-v3/ALTAK-xxx/xxx",
  },
  plugins: {
    entries: {
      qianfan: {
        config: {
          componentCode: "5e12955f-6b45-4f54-b2b6-84369f068a3d", // Get this from Baidu Qianfan console
        },
      },
    },
  },
  agents: {
    defaults: {
      model: { primary: "qianfan/deepseek-v3.2-128k" },
    },
  },
}
```

## How to Get Your Component Code

### What is a Component Code?

Component code is a UUID that identifies your application/component in Baidu Qianfan platform. It's used to query usage statistics and monitoring data.

**Format:** UUID (e.g., `5e12955f-6b45-4f54-b2b6-84369f068a3d`)

### Steps to Get Your Component Code:

1. **Login to Baidu Qianfan Console**
   - Visit: https://console.bce.baidu.com/qianfan/overview
   - Login with your Baidu account

2. **Find Your Component/Application**
   - Navigate to "应用接入" (Application Access) or "组件管理" (Component Management)
   - Select your application from the list

3. **Copy the Component Code**
   - Look for "组件 ID" (Component ID) or "应用 ID" (Application ID)
   - It will be in UUID format (8-4-4-4-12 hexadecimal digits)
   - Example: `5e12955f-6b45-4f54-b2b6-84369f068a3d`

4. **Add to OpenClaw Config**
   - Paste the UUID into your config as shown in the example above

### Important Notes:

- ⚠️ **Component code is optional** - If not provided, usage monitoring will show a helpful error message
- ✅ **Model calls work without it** - You can use Qianfan models without configuring component code
- 📊 **Only needed for monitoring** - Component code is only required if you want to view usage statistics via `openclaw models status`

## Usage Monitoring Features

Once configured, you can view:
- Total API calls (last 30 days)
- Success/failure rates
- Average and peak QPS (queries per second)

Run `openclaw models status` to see your usage statistics.

## API Documentation

- [Qianfan Monitoring API](https://cloud.baidu.com/doc/qianfan-api/s/Emmbtrjm3)
