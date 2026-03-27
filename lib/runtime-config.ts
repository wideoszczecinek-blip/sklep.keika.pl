export const runtimeConfig = {
  crmApiBaseUrl:
    process.env.NEXT_PUBLIC_CRM_API_BASE_URL?.replace(/\/+$/, "") ?? "",
  env: process.env.NEXT_PUBLIC_SHOP_ENV ?? "local",
} as const;
