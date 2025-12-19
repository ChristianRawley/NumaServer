const chromium = require("chrome-aws-lambda"); // Vercel-compatible Puppeteer

const SITE_ID = "5ed1791f1ca48e085a7b9a4d";
const LOCATION_ID = "5f4936c257e0d8184670a220";

const PERIODS = {
	breakfast: "693d55d4b4e411d4d52f13d1",
	lunch: "693d55d4b4e411d4d52f13d3",
	dinner: "693d55d4b4e411d4d52f13d2",
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

		// Set headers to mimic a real browser
		await page.setExtraHTTPHeaders({
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
			Accept: "application/json, text/plain, */*",
			Origin: "https://dineoncampus.com",
			Referer: "https://dineoncampus.com/",
			"X-Requested-With": "XMLHttpRequest",
		});

		await page.goto(url, { waitUntil: "networkidle0" });

		// Grab the raw JSON from the response
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
		const date = "2025-12-12"; // or new Date().toISOString().split("T")[0];

		const statusData = await fetchJsonWithPuppeteer(
			`https://apiv4.dineoncampus.com/locations/status_by_site?siteId=${SITE_ID}`
		);

		const location = statusData?.locations?.find((loc) => loc.id === LOCATION_ID);

		const meals = Object.fromEntries(
			await Promise.all(
				Object.entries(PERIODS).map(async ([meal, periodId]) => {
					const menu = await fetchJsonWithPuppeteer(
						`https://apiv4.dineoncampus.com/locations/${LOCATION_ID}/menu?date=${date}&period=${periodId}`
					);
					return [meal, simplifyMenu(menu)];
				})
			)
		);

		res.status(200).json({
			date,
			location: {
				id: LOCATION_ID,
				name: location?.name || "The Lion's Den",
				isOpen: location?.isOpen ?? false,
			},
			meals,
		});
	} catch (err) {
		console.error("Dining API error:", err);
		res.status(500).json({ error: "Failed to fetch dining data" });
	}
};
