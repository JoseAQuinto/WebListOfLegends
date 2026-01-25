export default function handler(req, res) {
  const key = process.env.RIOT_API_KEY || "";
  res.status(200).json({
    hasKey: !!key,
    keyStartsWithRGAPI: key.startsWith("RGAPI-"),
    keyLength: key.length,
    first10: key.slice(0, 10),
    last6: key.slice(-6),
  });
}
