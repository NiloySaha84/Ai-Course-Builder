import express from "express";
import dotenv from "dotenv";
import { buildCourse } from "./service.mjs";
import { marked } from "marked";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;


const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, 
    message: {
        error: "Too many requests from this IP, please try again later."
    }
});


app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static("public"));


app.set('view engine', 'ejs');
app.set('views', './views');


marked.setOptions({
    breaks: true,
    gfm: true,
    sanitize: false,
    smartLists: true,
    smartypants: true
});


const validateTopic = (req, res, next) => {
    const { topic } = req.body;
    
    if (!topic || typeof topic !== 'string') {
        return res.status(400).render('index', {
            courseContent: "Please provide a valid topic.",
            videosByModule: {},
            error: "Topic is required."
        });
    }
    
    const trimmedTopic = topic.trim();
    
    if (trimmedTopic.length < 3) {
        return res.status(400).render('index', {
            courseContent: "Please provide a topic with at least 3 characters.",
            videosByModule: {},
            error: "Topic too short."
        });
    }
    
    if (trimmedTopic.length > 200) {
        return res.status(400).render('index', {
            courseContent: "Topic is too long. Please keep it under 200 characters.",
            videosByModule: {},
            error: "Topic too long."
        });
    }
    
    
    const inappropriatePattern = /(hack|crack|illegal|piracy|adult|explicit)/i;
    if (inappropriatePattern.test(trimmedTopic)) {
        return res.status(400).render('index', {
            courseContent: "Please provide an appropriate educational topic.",
            videosByModule: {},
            error: "Inappropriate topic."
        });
    }
    
    req.body.topic = trimmedTopic;
    next();
};


app.post("/submit", validateTopic, async (req, res) => {
    const topic = req.body.topic;
    
    try {
        
        console.log(`Generating course for topic: ${topic}`);
        
        const { courseText, videosByModule } = await buildCourse(topic);
        const htmlContent = marked.parse(courseText);
        
        res.render("index", { 
            courseContent: htmlContent, 
            videosByModule,
            topic: topic,
            success: "Course generated successfully!"
        });
    } catch (error) {
        console.error("Error in /submit:", error);
        
        res.status(500).render("index", {
            courseContent: "Sorry, we encountered an error generating your course. Please try again with a different topic or try again later.",
            videosByModule: {},
            topic: topic,
            error: "Failed to generate course. Please try again."
        });
    }
});

app.get("/", (req, res) => {
    res.render("index", {
        courseContent: "Enter a topic above to generate your AI-powered course!",
        videosByModule: {},
        topic: "",
        success: null,
        error: null
    });
});


app.get("/health", (req, res) => {
    res.json({ 
        status: "healthy", 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render("index", {
        courseContent: "Page not found. Please use the form above to generate a course.",
        videosByModule: {},
        topic: "",
        error: "Page not found."
    });
});


app.use((err, req, res, next) => {
    console.error("Global error handler:", err);
    res.status(500).render("index", {
        courseContent: "An unexpected error occurred. Please try again later.",
        videosByModule: {},
        topic: "",
        error: "Server error occurred."
    });
});


process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});

const server = app.listen(port, () => {
    console.log(`AI Course Builder running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`OpenAI API Key configured: ${!!process.env.OPENAI_API_KEY}`);
    console.log(`YouTube API Key configured: ${!!process.env.YT_API_KEY}`);
});

export default app;