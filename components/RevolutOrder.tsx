"use client";

import { EnrichedStock } from "@/lib/types";
import { formatPrice } from "@/lib/utils";
import Modal from "./Modal";

interface RevolutOrderProps {
  stock: EnrichedStock | null;
  onClose: () => void;
}

export default function RevolutOrder({ stock, onClose }: RevolutOrderProps) {
  if (!stock || !stock.tradeSetup) return null;

  const setup = stock.tradeSetup;
  const shares = Math.floor(setup.kellySize / stock.price);
  const totalCost = shares * stock.price;

  const orderText = [
    `REVOLUT ORDER: ${stock.ticker}`,
    `Action: BUY`,
    `Shares: ${shares}`,
    `Entry: ${formatPrice(setup.entryZone[0])} – ${formatPrice(setup.entryZone[1])}`,
    `Stop Loss: ${formatPrice(setup.stopLoss)}`,
    `Take Profit: ${formatPrice(setup.target)}`,
    `Total Cost: ~${formatPrice(totalCost)}`,
    `Risk:Reward: 1:${setup.riskReward.toFixed(1)}`,
    `Hold: ${setup.holdWindow[0]}–${setup.holdWindow[1]} days`,
  ].join("\n");

  const handleCopy = () => {
    navigator.clipboard.writeText(orderText);
  };

  return (
    <Modal open={true} onClose={onClose} title={`Revolut Order — ${stock.ticker}`}>
      <div className="space-y-4">
        <div className="bg-surface-2 border border-border rounded-lg p-4 font-mono text-sm whitespace-pre-line text-white">
          {orderText}
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-surface border border-border rounded p-2">
            <div className="text-muted">Score</div>
            <div className="text-lg font-bold text-profit">{stock.asymmetryScore}</div>
          </div>
          <div className="bg-surface border border-border rounded p-2">
            <div className="text-muted">Kelly %</div>
            <div className="text-lg font-bold text-buy">{setup.kellyPercent}%</div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 px-4 py-2 bg-buy/10 text-buy border border-buy/20 rounded-lg hover:bg-buy/20 transition-colors text-sm font-bold"
          >
            Copy Order
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/5 text-muted border border-border rounded-lg hover:bg-white/10 transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
