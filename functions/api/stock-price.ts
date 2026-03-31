/**
 * Cloudflare Pages Function — proxy for Yahoo Finance API.
 * Avoids CORS issues when fetching US stock prices from the browser.
 *
 * GET /api/stock-price?symbol=AAPL
 * Returns: { price: "175.23" } or 404 { error: "..." }
 */
export async function onRequestGet(context: { request: Request }): Promise<Response> {
    const url = new URL(context.request.url);
    const symbol = url.searchParams.get('symbol');

    if (!symbol) {
        return Response.json({ error: 'Missing symbol parameter' }, { status: 400 });
    }

    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;

    try {
        const res = await fetch(yahooUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json',
            },
        });

        if (!res.ok) {
            return Response.json({ error: `Yahoo Finance returned ${res.status}` }, { status: 404 });
        }

        const data = await res.json() as { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> } };
        const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;

        if (price == null) {
            return Response.json({ error: 'Symbol not found' }, { status: 404 });
        }

        return Response.json({ price: String(price) });
    } catch {
        return Response.json({ error: 'Failed to fetch from Yahoo Finance' }, { status: 502 });
    }
}
