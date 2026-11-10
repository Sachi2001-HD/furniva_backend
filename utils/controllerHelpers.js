export const pick = (obj, keys) => {
  const source = obj ?? {};
  return Object.fromEntries(
    keys.filter((k) => source[k] !== undefined).map((k) => [k, source[k]])
  );
};

export const handleError = (res, error) => {
  if (error.name === "ValidationError") {
    const message = Object.values(error.errors).map((e) => e.message).join(" ");
    return res.status(400).json({ message });
  }
  if (error.name === "CastError") {
    return res.status(400).json({ message: `Invalid value for ${error.path}.` });
  }
  console.error(error);
  res.status(500).json({ message: "Something went wrong. Please try again." });
};

export const notFound = (res, what = "Item") =>
  res.status(404).json({ message: `${what} not found.` });

export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// e.g. CON123456789
export const reference = (prefix) =>
  prefix + Date.now().toString().slice(-7) + Math.floor(Math.random() * 90 + 10);