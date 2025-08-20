import OpenAI from "openai";
import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config()
const baseApiUrl = "https://www.googleapis.com/youtube/v3";

const api_key = process.env.OPENAI_API_KEY;
const youtubeApiKey = process.env.YT_API_KEY;
const client = new OpenAI({ apiKey: api_key });

export async function buildCourse (topic) {
    let prompt = `You are an expert educator and curriculum designer. Create a complete course on the topic: "${topic}". 
            The course should include:
            1. A structured syllabus divided into modules and lessons.
            2. Learning objectives for each module.
            3. Detailed lesson content with explanations, examples, and key concepts.
            4. Practical exercises or mini-projects for each lesson.
            5. Quizzes or review questions at the end of each module.
            6. A final project or assessment to test understanding of the full course.

            Target audience: [specify, e.g., beginners, intermediate learners, university students].
            Format: [e.g., 5-6 modules, 3-5 lessons per module].
            Style: [e.g., clear, practical, hands-on, real-world examples].

            Output the result in a structured format with headings, subheadings, and detailed explanation like documentaion.`
    const response = await client.responses.create({
        model: "gpt-3.5-turbo",
        input: prompt
    });

    const courseText = response.output[0].content[0].text;
    const moduleTitles = courseText.match(/(?:^|\n)(?:#+\s*)?Module\s+\d+:\s+[^\n]+/g) || [];

    const videosByModule = {};
    for (let i = 0; i < moduleTitles.length; i++) {
        const title = moduleTitles[i];
        if (i === moduleTitles.length - 1) {
            videosByModule[title] = []; // No videos for last module
        } else {
            const query = title.replace(/Module\s+\d+:\s*/, "");
            videosByModule[title] = await getYtVideos(query);
        }
    }

    return { courseText, videosByModule };
}

export async function getYtVideos(topic) {
    try {
        const response = await axios.get(`${baseApiUrl}/search`, {
            params: {
                key: youtubeApiKey,
                type: "video",
                part: "snippet",
                q: topic,
                maxResults: 3
            }
        });

        return response.data.items.map(item => ({
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails.high.url,
            embedUrl: `https://www.youtube.com/embed/${item.id.videoId}`
        }));
    } catch (error) {
        console.error("YouTube API error:", error.response?.data || error.message);
        return [];
    }
}