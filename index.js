// This file is the corrected backend for your resume review application.
// It uses a PDF parsing library to extract text before sending it to Gemini.

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const pdf = require("pdf-parse"); // Import the PDF parsing library
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const app = express();
const PORT = 3000;

// Enable Cross-Origin Resource Sharing for the React Native frontend
app.use(cors());
app.use(express.json());
// Configure multer to handle file uploads, saving them to the 'uploads/' directory
const upload = multer({ dest: "uploads/" });

// Initialize the Gemini AI client with your API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// POST endpoint to handle resume uploads and review requests
app.post("/review", upload.single("resume"), async (req, res) => {
  // Check if a file was uploaded
  if (!req.file) {
    return res.status(400).json({ error: "No resume file uploaded." });
  }

  const filePath = req.file.path;

  try {
    // 1. Read the PDF file from the temporary uploads directory
    const pdfBuffer = fs.readFileSync(filePath);

    // 2. Use the 'pdf-parse' library to extract text from the PDF buffer
    const data = await pdf(pdfBuffer);
    const resumeText = data.text;

    if (!resumeText) {
        throw new Error("Could not extract text from the PDF file.");
    }
    
    // 3. Get the text-only Gemini model for analysis.
    // We are now using a different model to avoid the 404 error.
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-05-20" });

    // 4. Create the prompt with the extracted resume text
    const prompt = `Review this resume and provide constructive feedback to help improve it for software engineering roles.
    
    Here is the resume content:
    """
    ${resumeText}
    """
    `;

    // 5. Send the text-based prompt to the model
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const feedbackText = await response.text();

    // 6. Send the feedback back to the client
    res.json({ feedback: feedbackText });

  } catch (error) {
    console.error("❌ Review error:", error.message);
    res.status(500).json({ error: "Failed to process resume." });

  } finally {
    // 7. Clean up the uploaded file to prevent cluttering the server
    fs.unlink(filePath, (err) => {
      if (err) console.error("Error deleting file:", err);
    });
  }
});

app.post("/career/ask-chatbot", async (req, res) => {
  try {
    console.log("anuke", req.body)
    const {  query } = req.body;

    if ( !query) {
      return res.status(400).json({ error: "Missing resume or query." });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-preview-05-20",
    });

    const prompt = `
You are a professional career guidance chatbot.

Given the following user question, offer tailored guidance:



User Question:
"${query}"

Respond with:
1. Recommended Career Paths
2. Required Skills to Acquire
3. Month-by-Month Learning Roadmap (6 months)
4. Useful Online Resources (include links if possible)

Respond clearly and concisely. Add some friendly words, and feel like chatting with a career friend.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const answer = await response.text();

    res.status(200).json({ message: answer });
  } catch (error) {
    console.error("❌ Chatbot error:", error.message);
    res.status(500).json({ error: "Something went wrong with the chatbot." });
  }
});

app.post("/mock-interview", async (req, res) => {
  const { question, answer } = req.body;

  if (!question || !answer) {
    return res.status(400).json({ error: "Question and answer are required" });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
You are an experienced interviewer. 
Analyze the following response to the interview question and provide detailed constructive feedback.

Question: "${question}"
Answer: "${answer}"

Your feedback should help the candidate improve.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.json({ feedback: text });
  } catch (error) {
    console.error("Error generating feedback:", error.message);
    res.status(500).json({ error: "Failed to get feedback from AI." });
  }
});

module.exports = router;

app.listen(PORT, () => {
  console.log(`✅ Gemini resume review backend running on port ${PORT}`);
});