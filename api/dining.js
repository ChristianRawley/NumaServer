export default async function handler(req, res) {
  try {
    const response = await fetch("https://dineoncampusapi.onrender.com/dining");
    if (!response.ok) return res.status(response.status).json({ error: "Failed to fetch dining data" });
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
}