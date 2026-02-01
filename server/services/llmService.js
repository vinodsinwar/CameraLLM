import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from root directory
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

// Lazy initialization of Gemini client
let genAI = null;
let model = null;
let visionModel = null;

const getGeminiClient = () => {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured. Please set GEMINI_API_KEY in your .env file.');
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Use Gemini 3 Flash for text chat (works great)
    // Use Gemini 2.5 Flash for vision/image analysis (more reliable for vision tasks)
    // Configure with safety settings to reduce false positives
    const safetySettings = [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ];
    model = genAI.getGenerativeModel({ model: 'gemini-3-flash', safetySettings });
    visionModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', safetySettings });
  }
  return { model, visionModel };
};

// Store last image context per session (in production, use Redis or database)
const imageContexts = new Map();

/**
 * Convert base64 data URL to format Gemini can use
 */
const convertBase64ToGeminiFormat = (base64DataUrl) => {
  // Remove data:image/...;base64, prefix
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
 * Analyze an image using Gemini Vision
 */
export const analyzeImage = async (imageData, customPrompt = null) => {
  try {
    const { visionModel } = getGeminiClient();

    const prompt = customPrompt || `Analyze this image and extract the QUESTION or PROBLEM from it, then provide the ANSWER or SOLUTION.

Format your response as follows:

**Question/Problem:**
[Extract and state the question or problem clearly]

**Answer/Solution:**
[Provide the complete answer or solution]

If the problem requires code:
- Write clean, well-commented code
- ALWAYS enclose code in Markdown code blocks (e.g., \`\`\`python ... \`\`\`)
- Use proper code formatting with syntax highlighting
- Include explanations of the approach
- Show test cases if applicable

If it's a math problem:
- Show step-by-step solution
- Include calculations and reasoning

If it's a general question:
- Provide a clear, direct answer
- Include relevant explanations

Do NOT:
- Describe that this is a screenshot
- Describe UI elements or interface
- Talk about the image itself
- Use phrases like "this image shows" or "in the screenshot"

Focus ONLY on extracting the question/problem and providing the solution/answer.`;

    // Convert base64 to Gemini format
    const imagePart = convertBase64ToGeminiFormat(imageData);

    const result = await visionModel.generateContent([prompt, imagePart]);
    const response = await result.response;
    const analysis = response.text() || 'No analysis available';

    return analysis;
  } catch (error) {
    // If gemini-3-flash fails, try fallback to gemini-2.5-flash
    if (error.message && (error.message.includes('gemini-3-flash') || error.message.includes('404'))) {
      console.warn('gemini-3-flash not available for vision, falling back to gemini-2.5-flash');
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = customPrompt || `Analyze this image and extract the QUESTION or PROBLEM from it, then provide the ANSWER or SOLUTION.

Format your response as follows:

**Question/Problem:**
[Extract and state the question or problem clearly]

**Answer/Solution:**
[Provide the complete answer or solution]

If the problem requires code:
- Write clean, well-commented code
- ALWAYS enclose code in Markdown code blocks (e.g., \`\`\`python ... \`\`\`)
- Use proper code formatting with syntax highlighting
- Include explanations of the approach
- Show test cases if applicable

If it's a math problem:
- Show step-by-step solution
- Include calculations and reasoning

If it's a general question:
- Provide a clear, direct answer
- Include relevant explanations

Do NOT:
- Describe that this is a screenshot
- Describe UI elements or interface
- Talk about the image itself
- Use phrases like "this image shows" or "in the screenshot"

Focus ONLY on extracting the question/problem and providing the solution/answer.`;

        const imagePart = convertBase64ToGeminiFormat(imageData);
        const result = await fallbackModel.generateContent([prompt, imagePart]);
        const response = await result.response;
        return response.text() || 'No analysis available';
      } catch (fallbackError) {
        console.error('Error with fallback model:', fallbackError);
        throw new Error(`Image analysis failed: ${fallbackError.message}`);
      }
    }
    console.error('Error analyzing image with Gemini:', error);
    throw new Error(`Image analysis failed: ${error.message}`);
  }
};

/**
 * Chat with context including previous image
 */
export const chatWithContext = async (message, imageData = null) => {
  try {
    const { model, visionModel } = getGeminiClient();
    const selectedModel = imageData ? visionModel : model;

    const parts = [];

    // If image context is provided, include it in the conversation
    if (imageData) {
      const imagePart = convertBase64ToGeminiFormat(imageData);
      parts.push({
        text: 'This is the image we are discussing. Please refer to it when answering questions.'
      });
      parts.push(imagePart);
    }

    // Add the current message
    parts.push({ text: message });

    const result = await selectedModel.generateContent(parts);
    const response = await result.response;
    const reply = response.text() || 'No response available';

    return reply;
  } catch (error) {
    // If gemini-3-flash fails, try fallback to gemini-2.5-flash
    if (error.message && error.message.includes('gemini-3-flash')) {
      console.warn('gemini-3-flash not available, falling back to gemini-2.5-flash');
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const parts = [];
        if (imageData) {
          const imagePart = convertBase64ToGeminiFormat(imageData);
          parts.push({
            text: 'This is the image we are discussing. Please refer to it when answering questions.'
          });
          parts.push(imagePart);
        }
        parts.push({ text: message });
        const result = await fallbackModel.generateContent(parts);
        const response = await result.response;
        return response.text() || 'No response available';
      } catch (fallbackError) {
        console.error('Error with fallback model:', fallbackError);
        throw new Error(`Chat processing failed: ${fallbackError.message}`);
      }
    }
    console.error('Error processing chat with Gemini:', error);
    throw new Error(`Chat processing failed: ${error.message}`);
  }
};

/**
 * Store image context for a session
 */
export const storeImageContext = (sessionId, imageData) => {
  imageContexts.set(sessionId, imageData);
};

/**
 * Get image context for a session
 */
export const getImageContext = (sessionId) => {
  return imageContexts.get(sessionId) || null;
};

/**
 * Clear image context for a session
 */
export const clearImageContext = (sessionId) => {
  imageContexts.delete(sessionId);
};
