const chromium = require("chrome-aws-lambda"); // Vercel-compatible Puppeteer

const SITE_ID = "5ed1791f1ca48e085a7b9a4d";
const LOCATION_ID = "5f4936c257e0d8184670a220";

const PERIODS = {
	breakfast: "693d55d4b4e411d4d52f13d1",
	lunch: "693d55d4b4e411d4d52f13d3",
	dinner: "693d55d4b4e411d4d52f13d2",
};

// Simple in-memory cache (valid only while the serverless instance is warm)
let cache = {
	statusData: null,
	menus: {},
	lastFetch: null,
};

function simplifyMenu(menu) {
	if (!menu?.period?.categories) return [];
	return menu.period.categories.flatMap(({ items }) =>
		items.map(({ name, calories, ingredients, filters }) => ({
			name,
			calories,
			ingredients: ingredients || null,
			dietaryTags: filters?.filter((f) => f.icon).map((f) => f.name) || [],
		}))
	);
}

async function fetchJsonWithPuppeteer(url) {
	let browser = null;
	try {
		browser = await chromium.puppeteer.launch({
			args: chromium.args,
			defaultViewport: chromium.defaultViewport,
			executablePath: await chromium.executablePath,
			headless: chromium.headless,
		});

		const page = await browser.newPage();

		// Browser headers to bypass Cloudflare
		await page.setExtraHTTPHeaders({
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
			Accept: "application/json, text/plain, */*",
			Origin: "https://dineoncampus.com",
			Referer: "https://dineoncampus.com/",
			"X-Requested-With": "XMLHttpRequest",
		});

		await page.goto(url, { waitUntil: "networkidle2" });

		// Grab the raw JSON
		const content = await page.evaluate(() => document.querySelector("pre, body").innerText);

		return JSON.parse(content);
	} catch (err) {
		console.error("Puppeteer fetch failed:", err);
		throw err;
	} finally {
		if (browser) await browser.close();
	}
}

module.exports = async function handler(req, res) {
	try {
		const date = "2025-12-12"; // or new Date().toISOString().split("T")[0]

		// Use cache if data is less than 5 minutes old
		const now = Date.now();
		if (!cache.lastFetch || now - cache.lastFetch > 5 * 60 * 1000) {
			// Fetch status data
			cache.statusData = await fetchJsonWithPuppeteer(
				`https://apiv4.dineoncampus.com/locations/status_by_site?siteId=${SITE_ID}`
			);
			cache.lastFetch = now;

			// Fetch menus for all periods
			cache.menus = {};
			await Promise.all(
				Object.entries(PERIODS).map(async ([meal, periodId]) => {
					const menu = await fetchJsonWithPuppeteer(
						`https://apiv4.dineoncampus.com/locations/${LOCATION_ID}/menu?date=${date}&period=${periodId}`
					);
					cache.menus[meal] = simplifyMenu(menu);
				})
			);
		}

		const location = cache.statusData?.locations?.find((loc) => loc.id === LOCATION_ID);

		res.status(200).json({
			date,
			location: {
				id: LOCATION_ID,
				name: location?.name || "The Lion's Den",
				isOpen: location?.isOpen ?? false,
			},
			meals: cache.menus,
		});
	} catch (err) {
		console.error("Dining API error:", err);
		res.status(500).json({ error: "Failed to fetch dining data" });
	}
};