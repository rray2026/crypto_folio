/**
 * Cloudflare Pages Function — proxy for Sina Finance real-time stock quotes.
 * Avoids CORS issues when fetching CN stock prices from the browser.
 *
 * GET /api/cn-stock-price?symbol=600036&exchange=SSE
 * Returns: { price: "12.34" } or 404 { error: "..." }
 */
export async function onRequestGet(context: { request: Request }): Promise<Response> {
    const url = new URL(context.request.url);
    const symbol = url.searchParams.get('symbol');
    const exchange = url.searchParams.get('exchange');

    if (!symbol) {
        return Response.json({ error: 'Missing symbol parameter' }, { status: 400 });
    }

    // Sina uses sh prefix for SSE (Shanghai), sz for SZSE (Shenzhen)
    const prefix = exchange === 'SZSE' ? 'sz' : 'sh';
    const sinaUrl = `https://hq.sinajs.cn/list=${prefix}${symbol}`;

    try {
        const res = await fetch(sinaUrl, {
            headers: {
                'Referer': 'https://finance.sina.com.cn',
                'User-Agent': 'Mozilla/5.0',
            },
        });

        if (!res.ok) {
            return Response.json({ error: `Sina Finance returned ${res.status}` }, { status: 404 });
        }

        const text = await res.text();
        // Response format: var hq_str_sh600036="招商银行,37.80,...";
        // Fields: name, open, prev_close, current, high, low, ...
        // Field index 3 (0-based) is the current price
        const match = text.match(/"([^"]*)"/);
        if (!match || !match[1]) {
            return Response.json({ error: 'Symbol not found' }, { status: 404 });
        }

        const fields = match[1].split(',');
        const price = fields[3]; // current price

        if (!price || price === '0.000') {
            return Response.json({ error: 'Symbol not found or market closed' }, { status: 404 });
        }

        return Response.json({ price });
    } catch {
        return Response.json({ error: 'Failed to fetch from Sina Finance' }, { status: 502 });
    }
}
