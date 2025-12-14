import express from "express";
const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const response = await fetch("https://api.presence.io/uafs/v1/organizations")
        if (!response.ok) return res.status(response.status).json({ error: "Failed to fetch organizations" });
        const data = await response.json();
        const numaData = data.map(org => ({
            name: org.name,
            description: org.description,
            memberCount: org.memberCount,
            categories: org.categories,
            photoUrl: org.photoUri ? `https://uafs-cdn.presence.io/organization-photos/fd6ee129-a3c2-4503-a4ae-1049bdd52906/${org.photoUri}` : null
        }));
        res.json(numaData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});

export default router;