"use client";

import { useState } from "react";
import { useApp } from "../providers";
import { formatPrice } from "@/lib/utils";
import { PACK_INFO, UniversePack } from "@/lib/universe";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function SettingsPage() {
  const { settings, updateSettings, resetAllData, cashTransactions, addCashTransaction, removeCashTransaction, portfolioValue } = useApp();
  const [testingEmail, setTestingEmail] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositNote, setDepositNote] = useState("");

  const handleTestEmail = async () => {
    if (!settings.emailjsPublicKey || !settings.emailjsServiceId || !settings.emailjsTemplateId || !settings.emailAddress) {
      toast.error("Fill in all EmailJS fields first");
      return;
    }
    setTestingEmail(true);
    try {
      const { default: emailjs } = await import("@emailjs/browser");
      await emailjs.send(settings.emailjsServiceId, settings.emailjsTemplateId, {
        to_email: settings.emailAddress,
        subject: "AGT Test Email",
        message: "If you received this, EmailJS is configured correctly!",
      }, settings.emailjsPublicKey);
      toast.success("Test email sent!");
    } catch {
      toast.error("Email send failed — check your EmailJS config");
    }
    setTestingEmail(false);
  };

  const handleAddDeposit = () => {
    const amount = Number(depositAmount);
    if (!amount || amount === 0) { toast.error("Enter an amount"); return; }
    addCashTransaction(amount, depositNote || (amount > 0 ? "Deposit" : "Withdrawal"));
    setDepositAmount("");
    setDepositNote("");
    toast.success(amount > 0 ? "Deposit added" : "Withdrawal recorded");
  };

  const handleReset = () => {
    if (confirm("This will delete ALL your data (positions, trades, settings). Are you sure?")) {
      resetAllData();
      toast.success("All data reset");
    }
  };

  return (
    <div className="p-5 md:p-8 max-w-3xl md:mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      {/* Cash Management */}
      <Section title="Cash Management">
        <p className="text-xs text-muted leading-relaxed">
          Your portfolio starts at $0. Add deposits as you fund your trading account. Your portfolio value updates automatically as you log trades.
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm mt-1">
          <span className="text-muted">Total deposited:</span>
          <span className="font-mono font-bold text-white">{formatPrice(portfolioValue.totalDeposited)}</span>
          <span className="text-white/10 hidden md:inline">|</span>
          <span className="text-muted">Portfolio value:</span>
          <span className="font-mono font-bold text-profit">{formatPrice(portfolioValue.totalValue)}</span>
        </div>
        <div className="flex flex-col md:flex-row gap-2 mt-1">
          <Input
            type="number"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="Amount (e.g. 500)"
            step="0.01"
            containerClassName="w-full md:flex-1"
          />
          <Input
            type="text"
            value={depositNote}
            onChange={(e) => setDepositNote(e.target.value)}
            placeholder="Note (optional)"
            containerClassName="w-full md:flex-1"
          />
          <Button variant="secondary" size="md" onClick={handleAddDeposit}>
            Add
          </Button>
        </div>
        {cashTransactions.length > 0 && (
          <div className="space-y-0 max-h-32 overflow-y-auto mt-1">
            {cashTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between text-xs py-2 border-b border-white/[0.04]">
                <div>
                  <span className={tx.amount >= 0 ? "text-profit font-mono" : "text-sell font-mono"}>
                    {tx.amount >= 0 ? "+" : ""}{formatPrice(tx.amount)}
                  </span>
                  <span className="text-muted ml-2">{tx.note}</span>
                  <span className="text-muted ml-2">{tx.date}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeCashTransaction(tx.id)} className="text-muted hover:text-sell">
                  x
                </Button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Stock Universe */}
      <Section title="Stock Universe">
        <p className="text-xs text-muted leading-relaxed">
          Choose which stock packs to scan. More packs = longer load times. Max 500 tickers.
        </p>
        <div className="space-y-1 mt-1">
          {(Object.entries(PACK_INFO) as [UniversePack, typeof PACK_INFO[UniversePack]][]).map(([key, info]) => {
            const enabled = (settings.enabledUniverses || ["core"]).includes(key);
            const isCore = key === "core";
            return (
              <label key={key} className="flex items-center justify-between cursor-pointer py-2 border-b border-white/[0.04] last:border-0">
                <div>
                  <span className="text-sm text-white">{info.label}</span>
                  <span className="text-xs text-muted ml-2">({info.count} stocks)</span>
                  <p className="text-[10px] text-muted-2 mt-0.5">{info.description}</p>
                </div>
                <button
                  onClick={() => {
                    if (isCore) return;
                    const current = settings.enabledUniverses || ["core"];
                    const next = enabled
                      ? current.filter((p) => p !== key)
                      : [...current, key];
                    updateSettings({ enabledUniverses: next });
                    toast.success(enabled ? `${info.label} disabled` : `${info.label} enabled — refresh screener`);
                  }}
                  disabled={isCore}
                  className={`w-10 h-5 rounded-full transition-colors relative ${enabled ? "bg-buy" : "bg-white/10"} ${isCore ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? "left-5" : "left-0.5"}`} />
                </button>
              </label>
            );
          })}
        </div>
      </Section>

      {/* Trading */}
      <Section title="Trading">
        <Field label="Risk Tolerance">
          <div className="flex gap-2">
            {(["conservative", "moderate", "aggressive"] as const).map((level) => (
              <Button
                key={level}
                variant={settings.riskTolerance === level ? "primary" : "secondary"}
                size="sm"
                onClick={() => updateSettings({ riskTolerance: level })}
                className="capitalize"
              >
                {level}
              </Button>
            ))}
          </div>
        </Field>
        <Field label="Refresh Interval">
          <div className="flex gap-2">
            {(["1h", "4h", "daily"] as const).map((interval) => (
              <Button
                key={interval}
                variant={settings.refreshInterval === interval ? "primary" : "secondary"}
                size="sm"
                onClick={() => updateSettings({ refreshInterval: interval })}
              >
                {interval}
              </Button>
            ))}
          </div>
        </Field>
      </Section>

      {/* AI Configuration */}
      <Section title="AI Stock Analysis (Groq)">
        {!settings.groqApiKey ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-2 leading-relaxed">
              Get AI-powered stock analysis, trade plans, and market briefings. Powered by Llama 3.3 70B — completely free.
            </p>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4 space-y-2.5">
              <div className="text-xs font-bold text-buy mb-1">How to get your free Groq API key:</div>
              <Step number={1} text="Go to" link="https://console.groq.com" linkText="console.groq.com" />
              <Step number={2} text="Sign up with Google or email (free, no credit card)" />
              <Step number={3} text='Click "API Keys" in the left sidebar' />
              <Step number={4} text='Click "Create API Key" and give it any name' />
              <Step number={5} text="Copy the key (starts with gsk_) and paste it below" />
            </div>
            <Input
              label="Groq API Key"
              type="password"
              value={settings.groqApiKey}
              onChange={(e) => updateSettings({ groqApiKey: e.target.value })}
              placeholder="Paste your key here (gsk_...)"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-profit">
              <span className="w-2 h-2 bg-profit rounded-full" />
              <span className="font-bold">AI enabled</span> — ask questions about any stock in the AI chat panel
            </div>
            <Input
              label="Groq API Key"
              type="password"
              value={settings.groqApiKey}
              onChange={(e) => updateSettings({ groqApiKey: e.target.value })}
              placeholder="gsk_..."
            />
            <p className="text-[10px] text-muted">
              Manage your key at{" "}
              <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-buy hover:underline">
                console.groq.com/keys
              </a>
            </p>
          </div>
        )}
      </Section>

      {/* Market Data (Finnhub) */}
      <Section title="Real-Time News (Finnhub)">
        {!settings.finnhubApiKey ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-2 leading-relaxed">
              Get real-time market news, company headlines, and fundamentals. Free tier gives you 60 API calls per minute.
            </p>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4 space-y-2.5">
              <div className="text-xs font-bold text-buy mb-1">How to get your free Finnhub API key:</div>
              <Step number={1} text="Go to" link="https://finnhub.io/register" linkText="finnhub.io/register" />
              <Step number={2} text="Sign up with email (free, no credit card)" />
              <Step number={3} text="After signing up, your API key is shown on the dashboard" />
              <Step number={4} text="Copy the key and paste it below" />
            </div>
            <Input
              label="Finnhub API Key"
              type="password"
              value={settings.finnhubApiKey}
              onChange={(e) => updateSettings({ finnhubApiKey: e.target.value })}
              placeholder="Paste your key here"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-profit">
              <span className="w-2 h-2 bg-profit rounded-full animate-pulse" />
              <span className="font-bold">Real-time data enabled</span> — news and fundamentals are live
            </div>
            <Input
              label="Finnhub API Key"
              type="password"
              value={settings.finnhubApiKey}
              onChange={(e) => updateSettings({ finnhubApiKey: e.target.value })}
              placeholder="Your Finnhub API key"
            />
            <p className="text-[10px] text-muted">
              Manage your key at{" "}
              <a href="https://finnhub.io/dashboard" target="_blank" rel="noopener noreferrer" className="text-buy hover:underline">
                finnhub.io/dashboard
              </a>
            </p>
          </div>
        )}
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <div className="space-y-0">
          <Toggle label="Sound Alerts" checked={settings.soundEnabled} onChange={(v) => updateSettings({ soundEnabled: v })} />
          <Toggle label="Exit Now Alerts" checked={settings.notifyExitNow} onChange={(v) => updateSettings({ notifyExitNow: v })} />
          <Toggle label="Switch Alerts" checked={settings.notifySwitch} onChange={(v) => updateSettings({ notifySwitch: v })} />
          <Toggle label="Strong Buy Alerts" checked={settings.notifyStrongBuy} onChange={(v) => updateSettings({ notifyStrongBuy: v })} />
          <Toggle label="Stop Loss Warnings" checked={settings.notifyStopLossWarning} onChange={(v) => updateSettings({ notifyStopLossWarning: v })} />
          <Toggle label="Take Profit Alerts" checked={settings.notifyTakeProfit} onChange={(v) => updateSettings({ notifyTakeProfit: v })} />
        </div>
      </Section>

      {/* EmailJS */}
      <Section title="EmailJS Configuration">
        <p className="text-xs text-muted leading-relaxed">Free 200 emails/month. Get keys from emailjs.com</p>
        <div className="space-y-3 mt-1">
          <Input label="Email Address" type="email" value={settings.emailAddress} onChange={(e) => updateSettings({ emailAddress: e.target.value })} placeholder="your@email.com" />
          <Input label="Service ID" type="text" value={settings.emailjsServiceId} onChange={(e) => updateSettings({ emailjsServiceId: e.target.value })} placeholder="service_xxxxx" />
          <Input label="Template ID" type="text" value={settings.emailjsTemplateId} onChange={(e) => updateSettings({ emailjsTemplateId: e.target.value })} placeholder="template_xxxxx" />
          <Input label="Public Key" type="text" value={settings.emailjsPublicKey} onChange={(e) => updateSettings({ emailjsPublicKey: e.target.value })} placeholder="your_public_key" />
          <Button variant="secondary" size="md" onClick={handleTestEmail} loading={testingEmail}>
            {testingEmail ? "Sending..." : "Send Test Email"}
          </Button>
        </div>
      </Section>

      {/* Danger Zone */}
      <Section title="Danger Zone">
        <Button variant="danger" size="md" onClick={handleReset}>
          Reset All Data
        </Button>
      </Section>

      {/* Mobile bottom nav spacer */}
      <div className="h-20 md:hidden" />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 md:p-6 space-y-3">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div className="space-y-2"><label className="text-xs text-muted font-medium">{label}</label>{children}</div>);
}

function Step({ number, text, link, linkText }: { number: number; text: string; link?: string; linkText?: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-buy/20 text-buy text-[10px] font-bold flex items-center justify-center mt-0.5">
        {number}
      </span>
      <span className="text-xs text-muted-2 leading-relaxed">
        {text}
        {link && (
          <>
            {" "}
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-buy font-bold hover:underline break-all"
            >
              {linkText || link}
            </a>
          </>
        )}
      </span>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer py-2.5 border-b border-white/[0.04] last:border-0">
      <span className="text-sm text-muted-2">{label}</span>
      <button onClick={() => onChange(!checked)} className={`w-10 h-5 rounded-full transition-colors relative ${checked ? "bg-buy" : "bg-white/10"}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? "left-5" : "left-0.5"}`} />
      </button>
    </label>
  );
}
