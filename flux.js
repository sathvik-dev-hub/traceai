
require("dotenv").config();

async function generateSketch(description) {
  if (!process.env.BFL_API_KEY) {
    throw new Error("BFL_API_KEY is missing from backend/.env");
  }

  const prompt = `
Create a fictional, AI-generated forensic-style pencil portrait
based only on this description: ${description}.
Plain white background, grayscale graphite drawing,
front-facing head and shoulders, neutral expression,
no text, no labels. This is an illustrative investigative lead,
not a verified identity.
`;

  const response = await fetch("https://api.bfl.ai/v1/flux-pro-1.1", {
    method: "POST",
    headers: {
      "x-key": process.env.BFL_API_KEY,
      "Content-Type": "application/json",
      "accept": "application/json"
    },
    body: JSON.stringify({
      prompt,
      width: 1024,
      height: 1024
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || data.message || "FLUX request failed");
  }

  if (!data.polling_url) {
    throw new Error("FLUX did not return a polling URL");
  }

  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 2000));

    const resultResponse = await fetch(data.polling_url, {
      headers: {
        "x-key": process.env.BFL_API_KEY,
        "accept": "application/json"
      }
    });

    const result = await resultResponse.json();

    if (!resultResponse.ok) {
      throw new Error("FLUX status check failed");
    }

    if (result.status === "Ready") {
      return result.result.sample;
    }

    if (["Error", "Failed", "Request Moderated", "Content Moderated"]
      .includes(result.status)) {
      throw new Error("FLUX generation failed: " + result.status);
    }
  }

  throw new Error("FLUX generation timed out; try again later");
}

module.exports = { generateSketch };
