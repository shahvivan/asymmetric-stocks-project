type PriceCallback = (symbol: string, price: number, timestamp: number) => void;

class FinnhubWebSocket {
  private ws: WebSocket | null = null;
  private apiKey = "";
  private subscriptions = new Set<string>();
  private reconnectAttempt = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private onPriceUpdate: PriceCallback | null = null;
  private onConnectionChange: ((connected: boolean) => void) | null = null;
  private isIntentionalClose = false;

  connect(apiKey: string, onPrice: PriceCallback, onConnection: (connected: boolean) => void) {
    this.disconnect();
    this.apiKey = apiKey;
    this.onPriceUpdate = onPrice;
    this.onConnectionChange = onConnection;
    this.isIntentionalClose = false;
    this._connect();
  }

  private _connect() {
    if (!this.apiKey) return;

    try {
      this.ws = new WebSocket(`wss://ws.finnhub.io?token=${this.apiKey}`);

      this.ws.onopen = () => {
        const ws = this.ws; // capture reference to avoid race condition
        this.reconnectAttempt = 0;
        this.onConnectionChange?.(true);
        this.subscriptions.forEach((symbol) => {
          try {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "subscribe", symbol }));
            }
          } catch {
            // Ignore send errors — will retry on next reconnect
          }
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "trade" && data.data) {
            for (const trade of data.data) {
              this.onPriceUpdate?.(trade.s, trade.p, trade.t);
            }
          }
        } catch {
          // ignore parse errors
        }
      };

      this.ws.onclose = () => {
        this.onConnectionChange?.(false);
        if (!this.isIntentionalClose) {
          this._scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch {
      this._scheduleReconnect();
    }
  }

  private _scheduleReconnect() {
    if (this.reconnectAttempt >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), 30000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempt++;
      this._connect();
    }, delay);
  }

  subscribe(symbol: string) {
    this.subscriptions.add(symbol);
    try {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "subscribe", symbol }));
      }
      // If not open yet, onopen handler will send all subscriptions
    } catch {
      // Ignore send errors — onopen will retry
    }
  }

  unsubscribe(symbol: string) {
    this.subscriptions.delete(symbol);
    try {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "unsubscribe", symbol }));
      }
    } catch {
      // Ignore send errors
    }
  }

  disconnect() {
    this.isIntentionalClose = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.subscriptions.clear();
    this.onConnectionChange?.(false);
  }
}

export const finnhubWS = new FinnhubWebSocket();
