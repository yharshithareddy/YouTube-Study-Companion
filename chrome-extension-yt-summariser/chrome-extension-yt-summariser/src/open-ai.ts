const PROMPT_TEMPLATE = `Please summarize the following YouTube video titled: "{{title}}" transcript into 6 bullet points. Each bullet point should correspond to a distinct portion of the video (e.g., minute 0-3, minute 3-5, etc.) and highlight the main topic or focus of that segment. The format (in markdown) for each bullet point (-) should be the (in bold **) approximate timestamps - (in bold **) summary title : (regular font) key points covered in that section in a clear, factual and precise manner (and two line breaks between each section using &nbsp; followed by two spaces). Sections irrelevant to the main topic like sponsorships can be ignored. Use an emoji at the end of each bullet point summary.`

export async function getLLMSummary(title: string, transcript: string) {
    const prompt = PROMPT_TEMPLATE.replace("{{title}}", title);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "You are an assistant that summarizes YouTube transcripts." },
                { role: "user", content: `${prompt}\n\n${transcript}` }
            ],
            temperature: 0.7,
        }),
    });
    const data = await response.json();
    return data.choices[0].message.content;
}