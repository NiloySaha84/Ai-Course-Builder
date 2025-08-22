import express from "express"
import dotenv from "dotenv"
import { buildCourse } from "./service.mjs"
import PDFDocument from 'pdfkit'
import fs from 'fs'
import { marked } from "marked";
dotenv.config();

const app = express();
const port = 3000;
const api_key = process.env.API_KEY;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.post("/submit", async (req, res) => {
    const topic = req.body["topic"];
    if (!topic) { return res.status(400).send("Topic is missing.") }
    const { courseText, videosByModule } = await buildCourse(topic);
    const htmlContent = marked.parse(courseText);
    res.render("index.ejs", { courseContent: htmlContent, videosByModule });
})

app.get("/", async (req, res) => {
    res.render("index.ejs", {courseContent: "Output will be here", videosByModule: [] })
})

app.listen(port, () => {
    console.log("Server running on port 3000");
})