import axios from "axios";
import * as cheerio from "cheerio";
import https from "https";

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
axios.defaults.httpsAgent = httpsAgent;

export default async function handler(req, res) {
  try {
    const { data } = await axios.get(
      "https://uafs.edu/academics/academic-guidance/registrar/calendar/index.php"
    );

    const $ = cheerio.load(data);
    const months = [];

    $(".col-12").find("h2").each((i, elem) => {
      const monthName = $(elem).text().trim();
      const monthEvents = [];

      const rows = $(elem).next("table").find("tbody tr");
      rows.each((j, row) => {
        const cells = $(row).find("td");
        if (
          cells.length === 2 &&
          !$(cells[0]).text().toLowerCase().includes("date")
        ) {
          const day = $(cells[0]).text().trim();
          const description = $(cells[1])
            .find("p")
            .map((_, p) => $(p).text().trim())
            .get()
            .join(" ");
          if (day && description) monthEvents.push({ day, description });
        }
      });

      months.push({ month: monthName, events: monthEvents });
    });

    res.status(200).json(months);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch calendar" });
  }
}
