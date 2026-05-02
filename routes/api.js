import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Default model to use (Gemini 1.5 Flash is fast and cheap, Pro is better for complex reasoning)
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Endpoint 1: Deep-Signal Analyzer
router.post('/analyze-resume', upload.single('resume'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No resume file uploaded' });
        }

        // 1. Extract Text from PDF
        const pdfData = await pdfParse(req.file.buffer);
        const resumeText = pdfData.text;

        // 2. Prepare the prompt for Gemini
        const systemPrompt = `You are an expert AI Deep-Signal Recruiter. Analyze the provided resume text.
        Your goal is to evaluate the candidate's 'Growth Trajectory' and 'Domain Depth' instead of just extracting keywords.
        You MUST return ONLY a JSON object with the following structure, with no markdown formatting or extra text:
        {
            "technical_maturity_score": <number between 1-10 based on project complexity and depth>,
            "trajectory": "<string describing trajectory, e.g., 'Rapid Ascent', 'Specialist', 'Pivot', etc.>",
            "potential_roles": ["<role1>", "<role2>", "<role3>"],
            "sanitized_profile": "<A summary of the resume stripping out ALL gender, age, and name markers to ensure bias-blind matching later>"
        }`;

        const result = await model.generateContent([systemPrompt, resumeText]);
        const responseText = result.response.text();

        // 3. Parse JSON response safely
        // Sometimes Gemini returns markdown code blocks (e.g. \`\`\`json ... \`\`\`)
        let parsedResult;
        try {
            const cleanText = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();
            const startIndex = cleanText.indexOf('{');
            const endIndex = cleanText.lastIndexOf('}');
            const jsonStr = (startIndex !== -1 && endIndex !== -1) ? cleanText.substring(startIndex, endIndex + 1) : cleanText;
            parsedResult = JSON.parse(jsonStr);
        } catch (e) {
            console.error("JSON parsing error:", e, "Response was:", responseText);
            return res.status(500).json({ error: 'Failed to parse AI response' });
        }

        res.json(parsedResult);
    } catch (error) {
        console.error("Error analyzing resume:", error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Endpoint 2: Bias-Free Matchmaker
router.post('/match-job', async (req, res) => {
    try {
        const { sanitized_profile, job_description } = req.body;

        if (!sanitized_profile || !job_description) {
            return res.status(400).json({ error: 'Missing profile or job description' });
        }

        const systemPrompt = `You are an expert AI Matchmaker. You will receive a bias-free 'sanitized_profile' and a 'job_description'.
        Perform a gap analysis and provide a matching score.
        You MUST return ONLY a JSON object with the following structure, with no markdown formatting or extra text:
        {
            "match_score": <number between 0-100 representing percentage match>,
            "career_bridge": [
                "<Actionable step 1 to close the gap, e.g., a specific project or certification>",
                "<Actionable step 2>",
                "<Actionable step 3>"
            ],
            "adaptive_interview_question": "<A single high-level architectural or domain-specific question based on a significant project or skill in the profile to test depth>"
        }`;

        const result = await model.generateContent([
            systemPrompt, 
            "PROFILE:\n" + sanitized_profile + "\n\nJOB DESCRIPTION:\n" + job_description
        ]);
        
        const responseText = result.response.text();

        let parsedResult;
        try {
            const cleanText = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();
            const startIndex = cleanText.indexOf('{');
            const endIndex = cleanText.lastIndexOf('}');
            const jsonStr = (startIndex !== -1 && endIndex !== -1) ? cleanText.substring(startIndex, endIndex + 1) : cleanText;
            parsedResult = JSON.parse(jsonStr);
        } catch (e) {
            console.error("JSON parsing error:", e, "Response was:", responseText);
            return res.status(500).json({ error: 'Failed to parse AI response' });
        }

        res.json(parsedResult);
    } catch (error) {
        console.error("Error matching job:", error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

export default router;
