// No locally writable "paid" flag. Access is derived from the store-backed SDK result.
export function hasAccess(info, entitlement, now = Date.now()) {
  const item = info?.entitlements?.active?.[entitlement];
  if (!item?.isActive || item.verification === 'FAILED') return false;
  // These apps sell subscriptions only, so an expiry is required.
  const expiry = Date.parse(item.expirationDate);
  return Number.isFinite(expiry) && expiry > now;
}
export function subscriptionPlans(offerings, identifier) {
  const offering = offerings?.all?.[identifier];
  return (offering?.availablePackages || []).filter(p =>
    ['MONTHLY', 'ANNUAL'].includes(p.packageType) && p.product?.priceString);
}
export class Billing {
  constructor({sdk, platform, config, onChange = () => {}}) {
    Object.assign(this, {sdk, platform, config, onChange});
    this.info = null; this.plans = []; this.ready = false; this.error = ''; this.busy = false;
  }
  get active() { return hasAccess(this.info, this.config.entitlement); }
  async init() {
    const key = this.config.revenueCat[this.platform];
    if (!['ios', 'android'].includes(this.platform) || !key) {
      this.error = '現在は無料体験をご利用いただけます。購読の販売準備ができると、ここに料金が表示されます。';
      this.onChange(); return;
    }
    try {
      await this.sdk.configure({apiKey: key, entitlementVerificationMode: 'INFORMATIONAL'});
      this.ready = true;
      await this.sdk.addCustomerInfoUpdateListener(info => { this.info = info; this.onChange(); });
      await this.refresh();
    } catch { this.error = '購入情報を確認できませんでした。通信状況を確認して再試行してください。'; this.onChange(); }
  }
  async refresh() {
    if (!this.ready) return;
    try {
      const {customerInfo} = await this.sdk.getCustomerInfo();
      this.info = customerInfo;
      this.plans = subscriptionPlans(await this.sdk.getOfferings(), this.config.offering);
      this.error = this.plans.length ? '' : '料金情報を取得できませんでした。しばらくしてから再試行してください。';
    } catch { this.error = '購入情報の更新に失敗しました。通信状況を確認してください。'; }
    this.onChange();
  }
  async purchase(identifier) {
    if (!this.ready || this.busy) return false;
    const plan = this.plans.find(p => p.identifier === identifier);
    if (!plan) throw Error('料金を読み込み直してください。');
    this.busy = true; this.onChange();
    try {
      const {customerInfo} = await this.sdk.purchasePackage({aPackage: plan});
      this.info = customerInfo;
      if (!this.active) throw Error('購入はまだ確認できていません。承認待ちの場合は、承認後に購入情報を更新してください。');
      return true;
    } catch (e) {
      if (e?.userCancelled || String(e?.code) === '1') return false;
      throw Error(e?.message || '購入を完了できませんでした。');
    } finally { this.busy = false; this.onChange(); }
  }
  async restore() {
    if (!this.ready || this.busy) return false;
    this.busy = true; this.onChange();
    try { const {customerInfo} = await this.sdk.restorePurchases(); this.info = customerInfo; return this.active; }
    finally { this.busy = false; this.onChange(); }
  }
}
