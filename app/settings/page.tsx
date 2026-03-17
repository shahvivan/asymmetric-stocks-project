"use client";

import { useState } from "react";
import { useApp } from "../providers";
import { formatPrice } from "@/lib/utils";
import toast from "react-hot-toast";

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
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      <h1 className="text-xl font-bold">Settings</h1>

      {/* Cash Management */}
      <Section title="Cash Management">
        <p className="text-xs text-muted mb-3">
          Your portfolio starts at $0. Add deposits as you fund your trading account. Your portfolio value updates automatically as you log trades.
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm mb-3">
          <span className="text-muted">Total deposited:</span>
          <span className="font-mono font-bold text-white">{formatPrice(portfolioValue.totalDeposited)}</span>
          <span className="text-muted hidden md:inline">|</span>
          <span className="text-muted">Portfolio value:</span>
          <span className="font-mono font-bold text-profit">{formatPrice(portfolioValue.totalValue)}</span>
        </div>
        <div className="flex flex-col md:flex-row gap-2 mb-3">
          <input
            type="number"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="Amount (e.g. 500)"
            step="0.01"
            className="input-field w-full md:flex-1"
          />
          <input
            type="text"
            value={depositNote}
            onChange={(e) => setDepositNote(e.target.value)}
            placeholder="Note (optional)"
            className="input-field w-full md:flex-1"
          />
          <button onClick={handleAddDeposit} className="px-4 py-2 bg-buy/10 text-buy border border-buy/20 rounded-lg text-sm hover:bg-buy/20 transition-colors">
            Add
          </button>
        </div>
        {cashTransactions.length > 0 && (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {cashTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between text-xs py-1 border-b border-border">
                <div>
                  <span className={tx.amount >= 0 ? "text-profit font-mono" : "text-sell font-mono"}>
                    {tx.amount >= 0 ? "+" : ""}{formatPrice(tx.amount)}
                  </span>
                  <span className="text-muted ml-2">{tx.note}</span>
                  <span className="text-muted ml-2">{tx.date}</span>
                </div>
                <button onClick={() => removeCashTransaction(tx.id)} className="text-muted hover:text-sell text-xs">x</button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Trading */}
      <Section title="Trading">
        <Field label="Risk Tolerance">
          <div className="flex gap-2">
            {(["conservative", "moderate", "aggressive"] as const).map((level) => (
              <button
                key={level}
                onClick={() => updateSettings({ riskTolerance: level })}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors capitalize ${
                  settings.riskTolerance === level
                    ? "bg-buy/10 text-buy border-buy/20"
                    : "bg-surface border-border text-muted hover:text-white"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Refresh Interval">
          <div className="flex gap-2">
            {(["1h", "4h", "daily"] as const).map((interval) => (
              <button
                key={interval}
                onClick={() => updateSettings({ refreshInterval: interval })}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  settings.refreshInterval === interval
                    ? "bg-buy/10 text-buy border-buy/20"
                    : "bg-surface border-border text-muted hover:text-white"
                }`}
              >
                {interval}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      {/* AI Configuration */}
      <Section title="AI Stock Analysis (Groq)">
        {!settings.groqApiKey ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-2">
              Get AI-powered stock analysis, trade plans, and market briefings. Powered by Llama 3.3 70B — completely free.
            </p>
            <div className="bg-surface-2 border border-border rounded-lg p-3 space-y-2.5">
              <div className="text-xs font-bold text-buy mb-1">How to get your free Groq API key:</div>
              <Step number={1} text="Go to" link="https://console.groq.com" linkText="console.groq.com" />
              <Step number={2} text="Sign up with Google or email (free, no credit card)" />
              <Step number={3} text='Click "API Keys" in the left sidebar' />
              <Step number={4} text='Click "Create API Key" and give it any name' />
              <Step number={5} text="Copy the key (starts with gsk_) and paste it below" />
            </div>
            <Field label="Groq API Key">
              <input
                type="password"
                value={settings.groqApiKey}
                onChange={(e) => updateSettings({ groqApiKey: e.target.value })}
                placeholder="Paste your key here (gsk_...)"
                className="input-field w-full"
              />
            </Field>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-profit">
              <span className="w-2 h-2 bg-profit rounded-full" />
              <span className="font-bold">AI enabled</span> — ask questions about any stock in the AI chat panel
            </div>
            <Field label="Groq API Key">
              <input
                type="password"
                value={settings.groqApiKey}
                onChange={(e) => updateSettings({ groqApiKey: e.target.value })}
                placeholder="gsk_..."
                className="input-field w-full"
              />
            </Field>
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
            <p className="text-xs text-muted-2">
              Get real-time market news, company headlines, and fundamentals. Free tier gives you 60 API calls per minute.
            </p>
            <div className="bg-surface-2 border border-border rounded-lg p-3 space-y-2.5">
              <div className="text-xs font-bold text-buy mb-1">How to get your free Finnhub API key:</div>
              <Step number={1} text="Go to" link="https://finnhub.io/register" linkText="finnhub.io/register" />
              <Step number={2} text="Sign up with email (free, no credit card)" />
              <Step number={3} text="After signing up, your API key is shown on the dashboard" />
              <Step number={4} text="Copy the key and paste it below" />
            </div>
            <Field label="Finnhub API Key">
              <input
                type="password"
                value={settings.finnhubApiKey}
                onChange={(e) => updateSettings({ finnhubApiKey: e.target.value })}
                placeholder="Paste your key here"
                className="input-field w-full"
              />
            </Field>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-profit">
              <span className="w-2 h-2 bg-profit rounded-full animate-pulse" />
              <span className="font-bold">Real-time data enabled</span> — news and fundamentals are live
            </div>
            <Field label="Finnhub API Key">
              <input
                type="password"
                value={settings.finnhubApiKey}
                onChange={(e) => updateSettings({ finnhubApiKey: e.target.value })}
                placeholder="Your Finnhub API key"
                className="input-field w-full"
              />
            </Field>
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
        <Toggle label="Sound Alerts" checked={settings.soundEnabled} onChange={(v) => updateSettings({ soundEnabled: v })} />
        <Toggle label="Exit Now Alerts" checked={settings.notifyExitNow} onChange={(v) => updateSettings({ notifyExitNow: v })} />
        <Toggle label="Switch Alerts" checked={settings.notifySwitch} onChange={(v) => updateSettings({ notifySwitch: v })} />
        <Toggle label="Strong Buy Alerts" checked={settings.notifyStrongBuy} onChange={(v) => updateSettings({ notifyStrongBuy: v })} />
        <Toggle label="Stop Loss Warnings" checked={settings.notifyStopLossWarning} onChange={(v) => updateSettings({ notifyStopLossWarning: v })} />
        <Toggle label="Take Profit Alerts" checked={settings.notifyTakeProfit} onChange={(v) => updateSettings({ notifyTakeProfit: v })} />
      </Section>

      {/* EmailJS */}
      <Section title="EmailJS Configuration">
        <p className="text-xs text-muted mb-3">Free 200 emails/month. Get keys from emailjs.com</p>
        <Field label="Email Address"><input type="email" value={settings.emailAddress} onChange={(e) => updateSettings({ emailAddress: e.target.value })} placeholder="your@email.com" className="input-field w-full" /></Field>
        <Field label="Service ID"><input type="text" value={settings.emailjsServiceId} onChange={(e) => updateSettings({ emailjsServiceId: e.target.value })} placeholder="service_xxxxx" className="input-field w-full" /></Field>
        <Field label="Template ID"><input type="text" value={settings.emailjsTemplateId} onChange={(e) => updateSettings({ emailjsTemplateId: e.target.value })} placeholder="template_xxxxx" className="input-field w-full" /></Field>
        <Field label="Public Key"><input type="text" value={settings.emailjsPublicKey} onChange={(e) => updateSettings({ emailjsPublicKey: e.target.value })} placeholder="your_public_key" className="input-field w-full" /></Field>
        <button onClick={handleTestEmail} disabled={testingEmail} className="px-4 py-2 bg-buy/10 text-buy border border-buy/20 rounded-lg text-sm hover:bg-buy/20 transition-colors disabled:opacity-50">
          {testingEmail ? "Sending..." : "Send Test Email"}
        </button>
      </Section>

      {/* Danger Zone */}
      <Section title="Danger Zone">
        <button onClick={handleReset} className="px-4 py-2 bg-sell/10 text-sell border border-sell/20 rounded-lg text-sm hover:bg-sell/20 transition-colors">
          Reset All Data
        </button>
      </Section>

      {/* Mobile bottom nav spacer */}
      <div className="h-20 md:hidden" />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (<div className="bg-surface border border-border rounded-lg p-4 space-y-3"><h2 className="text-sm font-bold text-white">{title}</h2>{children}</div>);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div className="space-y-1"><label className="text-xs text-muted">{label}</label>{children}</div>);
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
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-muted-2">{label}</span>
      <button onClick={() => onChange(!checked)} className={`w-10 h-5 rounded-full transition-colors relative ${checked ? "bg-buy" : "bg-white/10"}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? "left-5" : "left-0.5"}`} />
      </button>
    </label>
  );
}
