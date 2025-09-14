import OpenAI from "openai";
import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config()

const baseApiUrl = "https://www.googleapis.com/youtube/v3";
const api_key = process.env.OPENAI_API_KEY;
const youtubeApiKey = process.env.YT_API_KEY;
const client = new OpenAI({ apiKey: api_key });

export async function buildCourse(topic) {
    try {
        let prompt = `You are an expert educator and curriculum designer. Create a comprehensive course on the topic: "${topic}". 

The course should include:
1. A structured syllabus divided into 4-5 modules with clear titles
2. Learning objectives for each module
3. Detailed lesson content with explanations, examples, and key concepts
4. Practical exercises or activities for each module
5. Review questions at the end of each module
6. A final project or assessment

Target audience: Intermediate learners who want practical knowledge
Format: 4-5 modules, each covering a major aspect of the topic
Style: Clear, practical, with real-world examples and actionable insights

Structure your response with clear module titles in this format: "Module X: [Title]" where X is the module number.

Provide comprehensive content that would take 2-3 hours to complete per module.`;

        const response = await client.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 4000,
            temperature: 0.7
        });

        const courseText = response.choices[0].message.content;
        
        // Extract module titles more reliably
        const moduleTitles = extractModuleTitles(courseText);
        
        const videosByModule = {};
        
        // Get videos for each module (limit to prevent API overuse)
        for (let i = 0; i < Math.min(moduleTitles.length, 5); i++) {
            const title = moduleTitles[i];
            const query = title.replace(/^Module\s+\d+:\s*/i, "").trim();
            
            if (query && query.length > 3) {
                videosByModule[title] = await getYtVideos(query, topic);
            } else {
                videosByModule[title] = [];
            }
        }

        return { courseText, videosByModule };
    } catch (error) {
        console.error("Error building course:", error);
        throw new Error("Failed to generate course. Please try again.");
    }
}

function extractModuleTitles(courseText) {
    // Try multiple patterns to match module titles
    const patterns = [
        /(?:^|\n)\s*Module\s+\d+:\s*[^\n\r]+/gi,
        /(?:^|\n)\s*\d+\.\s*Module\s*\d*:\s*[^\n\r]+/gi,
        /(?:^|\n)\s*#{1,3}\s*Module\s+\d+:\s*[^\n\r]+/gi
    ];
    
    let matches = [];
    
    for (const pattern of patterns) {
        matches = courseText.match(pattern);
        if (matches && matches.length > 0) {
            break;
        }
    }
    
    if (!matches || matches.length === 0) {
        // Fallback: create generic module titles
        return [
            `Module 1: Introduction to ${courseText.split('\n')[0] || 'the Topic'}`,
            `Module 2: Core Concepts`,
            `Module 3: Practical Applications`,
            `Module 4: Advanced Topics`
        ];
    }
    
    return matches.map(match => match.trim());
}

export async function getYtVideos(query, originalTopic, maxResults = 2) {
    if (!youtubeApiKey) {
        console.warn("YouTube API key not found. Skipping video search.");
        return [];
    }

    try {
        // Enhance search query with original topic for better relevance
        const searchQuery = `${query} ${originalTopic} tutorial`;
        
        const response = await axios.get(`${baseApiUrl}/search`, {
            params: {
                key: youtubeApiKey,
                type: "video",
                part: "snippet",
                q: searchQuery,
                maxResults: maxResults,
                order: "relevance",
                videoDuration: "medium", // 4-20 minutes
                videoDefinition: "high"
            },
            timeout: 10000 // 10 second timeout
        });

        if (!response.data.items || response.data.items.length === 0) {
            return [];
        }

        return response.data.items.map(item => ({
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default.url,
            embedUrl: `https://www.youtube.com/embed/${item.id.videoId}`,
            publishedAt: item.snippet.publishedAt
        }));
    } catch (error) {
        console.error("YouTube API error:", error.response?.data || error.message);
        return []; // Return empty array instead of throwing
    }
}