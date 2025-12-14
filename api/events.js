export default async function handler(req, res) {
  try {
    const response = await fetch("https://api.presence.io/uafs/v1/events");
    if (!response.ok)
      return res.status(response.status).json({ error: "Failed to fetch events" });

    const data = await response.json();
    const numaData = data.map((event) => ({
      eventName: event.eventName,
      organizationName: event.organizationName,
      description: event.description,
      location: event.location,
      startDateTimeUtc: event.startDateTimeUtc,
      endDateTimeUtc: event.endDateTimeUtc,
      tags: event.tags,
      link: `https://uafs.presence.io/event/${event.uri}`,
      photoUrl: event.photoUri
        ? `https://uafs-cdn.presence.io/event-photos/fd6ee129-a3c2-4503-a4ae-1049bdd52906/${event.photoUri}`
        : null,
    }));

    res.status(200).json(numaData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
}
