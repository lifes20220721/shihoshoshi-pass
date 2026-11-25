export const clockEndpoint = 'https://xs968799.xsrv.jp/pass-review/healthz';

// Diagnostics never change referral, reviewer or purchase entitlements.
export async function checkServerClock(plugin) {
  const result = await plugin.trustedTime();
  if (!Number.isSafeInteger(result?.trustedNow) || result.trustedNow <= 0 ||
      !Number.isFinite(new Date(result.trustedNow).getTime()) || result.endpoint !== clockEndpoint) {
    throw Error('サーバー時刻を確認できませんでした。通信状況をご確認ください。');
  }
  return {trustedNow: result.trustedNow, endpoint: clockEndpoint};
}
