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
 * Add timeout wrapper for API calls
 */
const withTimeout = (promise, timeoutMs = 120000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};

/**
 * Analyze multiple images and return Q&A format with full questions
 * Analyzes all images together for proper context
 * @param {Function} progressCallback - Optional callback for progress updates
 */
export const analyzeMultipleImages = async (images, progressCallback = null) => {
  try {
    const model = getGeminiClient();

    if (!images || images.length === 0) {
      throw new Error('No images provided');
    }

    console.log(`[BATCH_ANALYZE] Processing ${images.length} images all together`);

    // Emit initial progress
    if (progressCallback) {
      progressCallback({
        stage: 'initializing',
        message: `Preparing to analyze ${images.length} images...`,
        totalImages: images.length,
        processedImages: 0
      });
    }

    // Emit analyzing progress
    if (progressCallback) {
      progressCallback({
        stage: 'analyzing',
        message: `Analyzing all ${images.length} images together...`,
        totalImages: images.length,
        processedImages: images.length
      });
    }

    // Analyze all images together in one go
    const analysis = await withTimeout(
      analyzeAllImagesTogether(images),
      300000 // 5 minute timeout for all images
    );

    // Emit final progress
    if (progressCallback) {
      progressCallback({
        stage: 'finalizing',
        message: 'Processing results...',
        totalImages: images.length,
        processedImages: images.length
      });
    }

    return analysis;
  } catch (error) {
    console.error('Error analyzing multiple images:', error);
    throw new Error(`Batch analysis failed: ${error.message}`);
  }
};

/**
 * Analyze all images together in one go
 */
const analyzeAllImagesTogether = async (images) => {
  try {
    const model = getGeminiClient();

    // Prepare prompt for analyzing all images together
    const prompt = `You are analyzing ${images.length} sequential screenshots captured from a laptop screen. These images collectively contain multiple multiple-choice questions (MCQs).

IMPORTANT NOTES:
- A single question may appear partially across multiple images (split across screenshots)
- Some questions may appear more than once (duplicate screenshots)
- Some images may contain overlapping or missing text
- Questions may be cut off or split between images

YOUR TASK:
1. Analyze ALL images together as one cohesive set to get full context
2. Identify ALL unique questions by:
   - Merging partial or split question text across images
   - Combining text fragments that belong to the same question
   - Removing duplicate questions (same question appearing in multiple images)
3. For each final unique question:
   - Write the COMPLETE question text
   - Find the answer from the multiple choice options
   - Identify the correct answer(s) ONLY if visible or clearly inferable
   - If the answer is NOT visible or cannot be determined, state "Answer not visible"
   - Do NOT provide explanations for the answer

OUTPUT FORMAT (EXACTLY as shown):
total number of questions : X

Question 1: [Complete question text here]
Answer: a

Question 2: [Complete question text here]
Answer: a and b

Question 3: [Complete question text here]
Answer: d

Question 4: [Complete question text here]
Answer: not visible

Question 5: [Complete question text here]
Answer: c

...

CRITICAL RULES:
- Start with "total number of questions : X" where X is the count of unique questions
- For each question, write "Question X:" followed by the complete question text
- Then write "Answer:" followed by the answer(s)
- For single answer: "Answer: a"
- For multiple answers: "Answer: a and b" (use "and" not commas)
- If answer not visible: "Answer: not visible"
- NO explanations for answers
- NO descriptions of images
- NO code blocks
- NO duplicate questions (each question appears only once)
- Merge partial questions that are split across images
- Number questions sequentially starting from 1

Do NOT:
- Describe the images or screenshots
- Provide explanations or reasoning for answers
- Show code or calculations
- Include duplicate questions
- Add any other text before or after the list

Return ONLY the output in the exact format specified above.`;

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
    console.error('Error analyzing all images:', error);
    
    // Fallback: try with gemini-2.5-flash if gemini-3-flash fails
    if (error.message && (error.message.includes('gemini-3-flash') || error.message.includes('404'))) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        
        // Recreate prompt for fallback
        const prompt = `You are analyzing ${images.length} sequential screenshots captured from a laptop screen. These images collectively contain multiple multiple-choice questions (MCQs).

IMPORTANT NOTES:
- A single question may appear partially across multiple images (split across screenshots)
- Some questions may appear more than once (duplicate screenshots)
- Some images may contain overlapping or missing text
- Questions may be cut off or split between images

YOUR TASK:
1. Analyze ALL images together as one cohesive set to get full context
2. Identify ALL unique questions by:
   - Merging partial or split question text across images
   - Combining text fragments that belong to the same question
   - Removing duplicate questions (same question appearing in multiple images)
3. For each final unique question:
   - Write the COMPLETE question text
   - Find the answer from the multiple choice options
   - Identify the correct answer(s) ONLY if visible or clearly inferable
   - If the answer is NOT visible or cannot be determined, state "Answer not visible"
   - Do NOT provide explanations for the answer

OUTPUT FORMAT (EXACTLY as shown):
total number of questions : X

Question 1: [Complete question text here]
Answer: a

Question 2: [Complete question text here]
Answer: a and b

Question 3: [Complete question text here]
Answer: d

Question 4: [Complete question text here]
Answer: not visible

Question 5: [Complete question text here]
Answer: c

...

CRITICAL RULES:
- Start with "total number of questions : X" where X is the count of unique questions
- For each question, write "Question X:" followed by the complete question text
- Then write "Answer:" followed by the answer(s)
- For single answer: "Answer: a"
- For multiple answers: "Answer: a and b" (use "and" not commas)
- If answer not visible: "Answer: not visible"
- NO explanations for answers
- NO descriptions of images
- NO code blocks
- NO duplicate questions (each question appears only once)
- Merge partial questions that are split across images
- Number questions sequentially starting from 1

Do NOT:
- Describe the images or screenshots
- Provide explanations or reasoning for answers
- Show code or calculations
- Include duplicate questions
- Add any other text before or after the list

Return ONLY the output in the exact format specified above.`;
        
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
  if (!analysis) return 'total number of questions : 0';

  const lines = analysis.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Find the total count line
  let totalCount = 0;
  const totalMatch = analysis.match(/total\s+number\s+of\s+questions\s*:\s*(\d+)/i);
  if (totalMatch) {
    totalCount = parseInt(totalMatch[1], 10);
  }

  // Extract question lines (case-insensitive matching)
  const questionLines = lines.filter(line => {
    // Match: "question X - answer Y" or "question X - answer not visible"
    return /^question\s+\d+\s*-\s*answer\s+[a-z0-9\s]+(?:and\s+[a-z0-9\s]+)?(?:not\s+visible)?$/i.test(line);
  });

  if (questionLines.length === 0) {
    // If no properly formatted lines, return as-is but try to extract
    return analysis;
  }

  // Parse and deduplicate questions
  const questionMap = new Map(); // Use Map to preserve order and deduplicate

  for (const line of questionLines) {
    // Match: "question X - answer Y" or "question X - answer not visible"
    const match = line.match(/^question\s+(\d+)\s*-\s*answer\s+(.+)$/i);
    if (match) {
      const questionNum = parseInt(match[1], 10);
      const answer = match[2].trim().toLowerCase();
      
      // Use question number as key to detect duplicates (same question number = duplicate)
      // But we want to keep unique questions, so we'll use the answer text as part of the key
      // Actually, we should deduplicate based on question content, but since we only have numbers,
      // we'll assume the LLM already merged duplicates. We just need to ensure sequential numbering.
      
      // Store with lowercase format
      questionMap.set(questionNum, `question ${questionNum} - answer ${answer}`);
    }
  }

  // Convert to array and renumber sequentially
  const sortedQuestions = Array.from(questionMap.values())
    .sort((a, b) => {
      const numA = parseInt(a.match(/question\s+(\d+)/i)?.[1] || '0', 10);
      const numB = parseInt(b.match(/question\s+(\d+)/i)?.[1] || '0', 10);
      return numA - numB;
    })
    .map((line, index) => {
      const match = line.match(/question\s+\d+\s*-\s*answer\s+(.+)$/i);
      if (match) {
        return `question ${index + 1} - answer ${match[1]}`;
      }
      return line;
    });

  // Update total count to match actual questions found
  const finalCount = sortedQuestions.length;
  
  // Build final output
  const output = [
    `total number of questions : ${finalCount}`,
    ...sortedQuestions
  ];

  return output.join('\n');
};

