import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from root directory
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

// Lazy initialization
let genAI = null;
let visionModel = null;

const getGeminiClient = () => {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    visionModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }
  return visionModel;
};

/**
 * Convert base64 data URL to format Gemini can use
 */
const convertBase64ToGeminiFormat = (base64DataUrl) => {
  const base64Data = base64DataUrl.split(',')[1];
  const mimeType = base64DataUrl.match(/data:image\/([^;]+);/)?.[1] || 'jpeg';
  
  return {
    inlineData: {
      data: base64Data,
      mimeType: `image/${mimeType}`
    }
  };
};

/**
 * Analyze multiple images and return concise Q&A format
 */
export const analyzeMultipleImages = async (images) => {
  try {
    const model = getGeminiClient();

    if (!images || images.length === 0) {
      throw new Error('No images provided');
    }

    // Prepare prompt for batch analysis
    const prompt = `You are analyzing ${images.length} images that contain questions/problems (like exam questions, quiz questions, coding challenges, etc.).

Your task:
1. Extract ALL unique questions/problems from ALL images
2. For each unique question, provide ONLY the answer(s)
3. Format your response EXACTLY as follows (one question per line):

Question 1 - Answer D
Question 2 - Answer A, E
Question 3 - Answer B
Question 4 - Answer C, D, F
...

IMPORTANT RULES:
- If the same question appears in multiple images, list it ONLY ONCE (remove duplicates)
- Use "Question X" format where X is the question number
- For single answer: "Question 1 - Answer D"
- For multiple answers: "Question 2 - Answer A, E" (comma-separated)
- NO explanations, NO descriptions, NO code blocks
- NO "Question/Problem:" or "Answer/Solution:" labels
- Just the format: "Question X - Answer Y"
- If a question has multiple correct answers, list them comma-separated
- Only include questions that have clear answers

Do NOT:
- Describe the images
- Provide explanations
- Show code
- Include duplicate questions
- Add any other text

Return ONLY the list of questions and answers in the specified format.`;

    // Convert all images to Gemini format
    const imageParts = images.map(img => convertBase64ToGeminiFormat(img));

    // Combine prompt with all images
    const parts = [
      { text: prompt },
      ...imageParts
    ];

    const result = await model.generateContent(parts);
    const response = await result.response;
    const analysis = response.text() || 'No analysis available';

    // Post-process to ensure format is correct and remove duplicates
    const formattedAnalysis = formatBatchAnalysis(analysis);

    return formattedAnalysis;
  } catch (error) {
    console.error('Error analyzing multiple images:', error);
    
    // Fallback: try with gemini-2.5-flash if gemini-3-flash fails
    if (error.message && (error.message.includes('gemini-3-flash') || error.message.includes('404'))) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const imageParts = images.map(img => convertBase64ToGeminiFormat(img));
        const parts = [
          { text: prompt },
          ...imageParts
        ];
        const result = await fallbackModel.generateContent(parts);
        const response = await result.response;
        const analysis = response.text() || 'No analysis available';
        return formatBatchAnalysis(analysis);
      } catch (fallbackError) {
        throw new Error(`Batch analysis failed: ${fallbackError.message}`);
      }
    }
    
    throw new Error(`Batch analysis failed: ${error.message}`);
  }
};

/**
 * Format and deduplicate the batch analysis response
 */
const formatBatchAnalysis = (analysis) => {
  if (!analysis) return 'No questions found.';

  // Extract lines that match "Question X - Answer Y" pattern
  const lines = analysis.split('\n').filter(line => {
    const trimmed = line.trim();
    return /^Question\s+\d+\s*-\s*Answer\s+[A-Za-z0-9,\s]+/i.test(trimmed);
  });

  if (lines.length === 0) {
    // Try to extract questions from the text if format is different
    return analysis;
  }

  // Remove duplicates based on question content (before the dash)
  const seenQuestions = new Set();
  const uniqueLines = [];

  for (const line of lines) {
    const match = line.match(/^Question\s+(\d+)\s*-\s*(.+)/i);
    if (match) {
      const questionNum = match[1];
      const answer = match[2].trim();
      
      // Use question number + answer as key to detect duplicates
      const key = `Q${questionNum}-${answer}`;
      
      if (!seenQuestions.has(key)) {
        seenQuestions.add(key);
        uniqueLines.push(`Question ${questionNum} - Answer ${answer}`);
      }
    }
  }

  // Renumber questions sequentially
  const renumbered = uniqueLines.map((line, index) => {
    const match = line.match(/^Question\s+\d+\s*-\s*(.+)/i);
    if (match) {
      return `Question ${index + 1} - ${match[1]}`;
    }
    return line;
  });

  return renumbered.length > 0 ? renumbered.join('\n') : analysis;
};

