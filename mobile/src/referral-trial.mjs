// Install attribution is a campaign hint and is not proof of a unique user.
const sources = {shihoshoshi:'gyoseishoshi_pass', gyoseishoshi:'shihoshoshi_pass'};

export function referralTrial({app, referrer, installedAt, now}) {
  if (!sources[app] || typeof referrer !== 'string' || referrer.length > 2048 ||
      !Number.isSafeInteger(installedAt) || !Number.isSafeInteger(now) ||
      installedAt <= 0 || installedAt > now) return null;
  const params = new URLSearchParams(referrer);
  if (params.getAll('utm_source').length !== 1 || params.getAll('utm_medium').length !== 1 ||
      params.get('utm_source') !== sources[app] || params.get('utm_medium') !== 'app') return null;
  const start = new Date(installedAt);
  if (!Number.isFinite(start.getTime())) return null;
  const year = start.getUTCFullYear(), month = start.getUTCMonth(), day = start.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
  const end = new Date(installedAt);
  end.setUTCDate(1);
  end.setUTCMonth(month + 1);
  end.setUTCDate(Math.min(day, lastDay));
  const expiresAt = end.getTime();
  return {installedAt, expiresAt, active: now < expiresAt};
}

export class ReferralAccess {
  constructor({app, plugin, now = () => Date.now(), onChange = () => {}}) {
    Object.assign(this, {app,plugin,now,onChange});
    this.details = null;
    this.lastSeen = 0;
  }
  get status() {
    const now = this.now();
    // A clock moving backwards during this session must not extend access.
    if (!Number.isSafeInteger(now) || now < this.lastSeen) return null;
    this.lastSeen = now;
    return this.details && referralTrial({app:this.app,...this.details,now});
  }
  get active() { return Boolean(this.status?.active); }
  async refresh() {
    try {
      const details = await this.plugin.read();
      this.details = {referrer:details.referrer,installedAt:details.installedAt};
    } catch { this.details = null; }
    this.onChange();
  }
}
