const axios = require("axios");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");

/* =======================
   CONSTANTS
======================= */

const SITE_ID = "5ed1791f1ca48e085a7b9a4d";
const LOCATION_ID = "5f4936c257e0d8184670a220";

const PERIODS = {
  breakfast: "693d55d4b4e411d4d52f13d1",
  lunch: "693d55d4b4e411d4d52f13d3",
  dinner: "693d55d4b4e411d4d52f13d2",
};

/* =======================
   AXIOS + COOKIE JAR
======================= */

const jar = new CookieJar();

const client = wrapper(
  axios.create({
    jar,
    withCredentials: true,
    timeout: 15000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      Referer: "https://dineoncampus.com/",
      Origin: "https://dineoncampus.com",
      "X-Requested-With": "XMLHttpRequest",
    },
  })
);

/* =======================
   IN-MEMORY CACHE
======================= */

let cache = {
  timestamp: 0,
  data: null,
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/* =======================
   HELPERS
======================= */

async function fetchJson(url) {
  try {
    const res = await client.get(url);
    return res.data;
  } catch (err) {
    if (!err.__retried) {
      err.__retried = true;
      return fetchJson(url);
    }
    throw err;
  }
}

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

/* =======================
   API HANDLER
======================= */

module.exports = async function handler(req, res) {
  try {
    const now = Date.now();

    if (cache.data && now - cache.timestamp < CACHE_TTL) {
      return res.status(200).json(cache.data);
    }

    const date = "2025-12-12";

    const statusData = await fetchJson(
      `https://apiv4.dineoncampus.com/locations/status_by_site?siteId=${SITE_ID}`
    );

    const location = statusData?.locations?.find(
      (loc) => loc.id === LOCATION_ID
    );

    const meals = {};

    for (const [meal, periodId] of Object.entries(PERIODS)) {
      const menu = await fetchJson(
        `https://apiv4.dineoncampus.com/locations/${LOCATION_ID}/menu?date=${date}&period=${periodId}`
      );
      meals[meal] = simplifyMenu(menu);
    }

    const payload = {
      date,
      location: {
        id: LOCATION_ID,
        name: location?.name || "The Lion's Den",
        isOpen: location?.isOpen ?? false,
      },
      meals,
    };

    cache = {
      timestamp: now,
      data: payload,
    };

    res.status(200).json(payload);
  } catch (err) {
    console.error("Dining API error:", err?.response?.status || err);
    res.status(500).json({ error: "Failed to fetch dining data" });
  }
};
