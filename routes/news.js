import express from "express";
import * as cheerio from "cheerio";

const router = express.Router();
const BASE_URL = "https://uafs.edu";

async function fetchHTML(url) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Failed to fetch ${url}`);
	return res.text();
}

function extractArticleData(html) {
	const $ = cheerio.load(html);
	const container = $("div.col-12:has(span.pub-date)").first();
	const categories = container.find("span.category").text().split("|").map(s => s.trim()).filter(Boolean);
	const date = container.find("span.pub-date").text().trim();
	const tags = [];
	container.find("ul.categories li strong").each((_, el) => {
		const text = $(el).text().trim();
		if (text !== "Tags:") tags.push(text);
	});

	const paragraphs = [];
	container.find("p").each((_, el) => {
		const strong = $(el).find("strong").text().trim();
		if (strong.startsWith("About")) return false;
		const text = $(el).text().trim();
		if (text) paragraphs.push(text);
	});

	return { date, categories, tags, content: paragraphs.join("\n\n") };
}

router.get("/", async (req, res) => {
	try {
		const page = Number(req.query.page) || 1;
		const listURL = `${BASE_URL}/news/stories.php?categories=News&archives=&page=${page}`;
		const listHTML = await fetchHTML(listURL);
		const $ = cheerio.load(listHTML);
		const articles = [];

		$("div.row.card.plain").each((_, el) => {
			const title = $(el).find("h3 a").text().trim();
			const description = $(el).find("p.description").text().trim();
			const image = $(el).find("img").attr("src");
			const link = $(el).find("h3 a").attr("href");

			if (!title || !link) return;

			articles.push({
				title,
				description,
				image: image?.startsWith("http") ? image : `${BASE_URL}${image}`,
				link: link.startsWith("http") ? link : `${BASE_URL}${link}`
			});
		});

		const enrichedArticles = await Promise.all(
			articles.map(async article => {
				try {
					const articleHTML = await fetchHTML(article.link);
					const details = extractArticleData(articleHTML);
					return { ...article, ...details };
				} catch {
					return article;
				}
			})
		);

		res.json({
			page,
			count: enrichedArticles.length,
			news: enrichedArticles
		});

	} catch (err) {
		console.error("News scraping error:", err);
		res.status(500).json({ error: "Failed to fetch news" });
	}
});

export default router;