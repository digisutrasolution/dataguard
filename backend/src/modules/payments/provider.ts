// Crypto payment provider. Pluggable like the detection providers:
//   • MockCryptoProvider     — generates an address + simulates confirmations
//     so the full recharge flow is demoable offline.
//   • NowPaymentsProvider    — real gateway (USDT/BTC/ETH/TRX) when
//     NOWPAYMENTS_API_KEY is set; confirmation arrives via the IPN webhook.
import { randomBytes } from 'node:crypto';

export type Coin = 'USDT' | 'BTC' | 'ETH' | 'TRX';
export const COINS: Coin[] = ['USDT', 'BTC', 'ETH', 'TRX'];

export const CREDIT_USD = 0.0025; // 1 credit = $0.0025
const PRICE_USD: Record<Coin, number> = { USDT: 1, TRX: 0.12, ETH: 3500, BTC: 65000 };
const REQUIRED_CONF: Record<Coin, number> = { USDT: 12, TRX: 20, ETH: 12, BTC: 2 };

export interface CreatePaymentInput { coin: Coin; credits: number; customerId: string }
export interface CreatePaymentResult {
  address: string;
  amountCoin: number;
  amountUsd: number;
  externalId: string | null;
  requiredConfirmations: number;
  expiresAt: string;
}
export interface CryptoProvider {
  readonly name: string;
  readonly simulated: boolean; // mock drives its own confirmations
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
}

function fakeAddress(coin: Coin): string {
  const hex = randomBytes(20).toString('hex');
  if (coin === 'BTC') return 'bc1q' + hex.slice(0, 38);
  if (coin === 'ETH') return '0x' + hex;
  return 'T' + randomBytes(24).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 33); // TRX/USDT-TRC20
}
const round = (n: number, d = 8) => Math.round(n * 10 ** d) / 10 ** d;

export class MockCryptoProvider implements CryptoProvider {
  readonly name = 'mock';
  readonly simulated = true;
  async createPayment({ coin, credits }: CreatePaymentInput): Promise<CreatePaymentResult> {
    const amountUsd = round(credits * CREDIT_USD, 2);
    return {
      address: fakeAddress(coin),
      amountCoin: round(amountUsd / PRICE_USD[coin], 8),
      amountUsd,
      externalId: null,
      requiredConfirmations: REQUIRED_CONF[coin],
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    };
  }
}

export class NowPaymentsProvider implements CryptoProvider {
  readonly name = 'nowpayments';
  readonly simulated = false;
  constructor(private apiKey: string) {}
  async createPayment({ coin, credits, customerId }: CreatePaymentInput): Promise<CreatePaymentResult> {
    const amountUsd = round(credits * CREDIT_USD, 2);
    const res = await fetch('https://api.nowpayments.io/v1/payment', {
      method: 'POST',
      headers: { 'x-api-key': this.apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        price_amount: amountUsd, price_currency: 'usd',
        pay_currency: coin.toLowerCase(), order_id: `${customerId}:${Date.now()}`,
        order_description: `${credits} DataGuard credits`,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`nowpayments_http_${res.status}`);
    const d: any = await res.json();
    return {
      address: d.pay_address,
      amountCoin: Number(d.pay_amount),
      amountUsd,
      externalId: String(d.payment_id),
      requiredConfirmations: REQUIRED_CONF[coin],
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    };
  }
}

export function getCryptoProvider(): CryptoProvider {
  const key = process.env.NOWPAYMENTS_API_KEY;
  return key ? new NowPaymentsProvider(key) : new MockCryptoProvider();
}
