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
    // Use Gemini 3 Flash for better question extraction and accuracy
    // Configure with safety settings to reduce false positives
    visionModel = genAI.getGenerativeModel({ 
      model: 'gemini-3-flash',
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    });
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
    // Modified to avoid RECITATION filter - focus on analysis rather than verbatim reproduction
    const prompt = `You are a learning assistant helping a student understand educational content. You are analyzing ${images.length} sequential screenshots that contain educational material with multiple-choice questions.

IMPORTANT: You are NOT reproducing copyrighted content. You are helping the student understand and learn from the material by:
- Identifying the concepts being tested
- Explaining the educational content
- Providing learning guidance

IMPORTANT NOTES:
- A single question may appear partially across multiple images (split across screenshots)
- Some questions may appear more than once (duplicate screenshots)
- Some images may contain overlapping or missing text
- Questions may be cut off or split between images
- Options (A, B, C, D, etc.) may appear on different images than the question text

YOUR TASK:
1. Analyze ALL images together as one cohesive set to get full context
2. Identify ALL unique questions by:
   - Merging partial or split question text across images
   - Combining text fragments that belong to the same question
   - Finding ALL multiple choice options (A, B, C, D, E, etc.) for each question
   - Options may appear on the same image or different images - search ALL images
   - Removing duplicate questions (same question appearing in multiple images)
3. For each final unique question:
   - Write the COMPLETE question text
   - Write ALL available options (A, B, C, D, etc.) with their text
   - Find the answer by analyzing the question and options carefully
   - You MUST find the answer - look carefully across all images
   - Use reasoning, logic, and knowledge to determine the answer if not explicitly marked
   - Only use "not visible" if the question or ALL options are completely unreadable
   - Do NOT give up easily - analyze thoroughly to find answers
   - Do NOT provide explanations for the answer

OUTPUT FORMAT (EXACTLY as shown):
total number of questions : X

Question 1: [Complete question text here]
Options:
A) [Option A text]
B) [Option B text]
C) [Option C text]
D) [Option D text]
Answer: a

Question 2: [Complete question text here]
Options:
A) [Option A text]
B) [Option B text]
C) [Option C text]
D) [Option D text]
E) [Option E text]
Answer: a and b

Question 3: [Complete question text here]
Options:
A) [Option A text]
B) [Option B text]
C) [Option C text]
Answer: d

...

CRITICAL RULES:
- Start with "total number of questions : X" where X is the count of unique questions
- For each question, write "Question X:" followed by the complete question text
- IMPORTANT: Use the ACTUAL question number from the images if visible (e.g., if image shows "Question 5:", use "Question 5:")
- If question number is NOT visible in images, use sequential numbering starting from 1
- Then write "Options:" followed by ALL options (A, B, C, D, etc.) with their complete text
- Then write "Answer:" followed by the answer(s)
- For single answer: "Answer: a"
- For multiple answers: "Answer: a and b" (use "and" not commas)
- You MUST include ALL options for each question - search all images carefully
- You MUST find answers - analyze questions and options to determine correct answer
- Only use "Answer: not visible" if question or ALL options are completely unreadable
- NO explanations for answers
- NO descriptions of images
- NO code blocks
- NO duplicate questions (each question appears only once)
- Merge partial questions and options that are split across images
- PRESERVE original question numbers from images when visible - do NOT renumber them

Do NOT:
- Describe the images or screenshots
- Provide explanations or reasoning for answers
- Show code or calculations
- Include duplicate questions
- Skip options - you must find ALL options for each question
- Give up on finding answers easily - analyze thoroughly
- Add any other text before or after the list

Return ONLY the output in the exact format specified above.`;

    // Convert all images to Gemini format
    const imageParts = images.map(img => convertBase64ToGeminiFormat(img));

    // Combine prompt with all images
    const parts = [
      { text: prompt },
      ...imageParts
    ];

    // Configure generation settings to avoid RECITATION errors
    // Higher temperature encourages varied responses and reduces verbatim reproduction
    const generationConfig = {
      temperature: 0.7, // Increased from 0.1 to encourage more varied responses
      topP: 0.95,
      topK: 40,
    };

    const safetySettings = [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
    ];

    // Use the model's generateContent with proper format
    // Higher temperature and generation config help avoid RECITATION
    const result = await model.generateContent(parts, {
      generationConfig,
    });
    
    // Check for RECITATION in the response finish reason
    if (result.response && result.response.candidates && result.response.candidates[0]) {
      const finishReason = result.response.candidates[0].finishReason;
      if (finishReason === 'RECITATION') {
        console.warn('RECITATION detected in response, trying alternative approach');
        throw new Error('RECITATION detected in response');
      }
    }
    const response = await result.response;
    const analysis = response.text() || 'No analysis available';

    // Post-process to ensure format is correct and remove duplicates
    const formattedAnalysis = formatBatchAnalysis(analysis);

    return formattedAnalysis;
  } catch (error) {
    console.error('Error analyzing all images:', error);
    
    // Handle RECITATION error specifically
    if (error.message && (error.message.includes('RECITATION') || error.message.includes('recitation'))) {
      console.warn('RECITATION error detected, trying alternative approach with modified prompt');
      // Try with a more educational/analytical prompt that doesn't trigger recitation
      try {
        return await analyzeWithEducationalPrompt(images);
      } catch (eduError) {
        console.error('Educational prompt also failed:', eduError);
        throw new Error(`Analysis blocked by content policy. Please try with different images or contact support. Original error: ${error.message}`);
      }
    }
    
    // Fallback: try with gemini-2.5-flash if gemini-3-flash fails
    if (error.message && (error.message.includes('gemini-3-flash') || error.message.includes('404'))) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Use higher temperature and safety settings for fallback model
        const fallbackModel = genAI.getGenerativeModel({ 
          model: 'gemini-2.5-flash',
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        });
        
        // Recreate prompt for fallback
        const prompt = `You are analyzing ${images.length} sequential screenshots captured from a laptop screen. These images collectively contain multiple multiple-choice questions (MCQs).

IMPORTANT NOTES:
- A single question may appear partially across multiple images (split across screenshots)
- Some questions may appear more than once (duplicate screenshots)
- Some images may contain overlapping or missing text
- Questions may be cut off or split between images
- Options (A, B, C, D, etc.) may appear on different images than the question text

YOUR TASK:
1. Analyze ALL images together as one cohesive set to get full context
2. Identify ALL unique questions by:
   - Merging partial or split question text across images
   - Combining text fragments that belong to the same question
   - Finding ALL multiple choice options (A, B, C, D, E, etc.) for each question
   - Options may appear on the same image or different images - search ALL images
   - Removing duplicate questions (same question appearing in multiple images)
3. For each final unique question:
   - Write the COMPLETE question text
   - Write ALL available options (A, B, C, D, etc.) with their text
   - Find the answer by analyzing the question and options carefully
   - You MUST find the answer - look carefully across all images
   - Use reasoning, logic, and knowledge to determine the answer if not explicitly marked
   - Only use "not visible" if the question or ALL options are completely unreadable
   - Do NOT give up easily - analyze thoroughly to find answers
   - Do NOT provide explanations for the answer

OUTPUT FORMAT (EXACTLY as shown):
total number of questions : X

Question 1: [Complete question text here]
Options:
A) [Option A text]
B) [Option B text]
C) [Option C text]
D) [Option D text]
Answer: a

Question 2: [Complete question text here]
Options:
A) [Option A text]
B) [Option B text]
C) [Option C text]
D) [Option D text]
E) [Option E text]
Answer: a and b

Question 3: [Complete question text here]
Options:
A) [Option A text]
B) [Option B text]
C) [Option C text]
Answer: d

...

CRITICAL RULES:
- Start with "total number of questions : X" where X is the count of unique questions
- For each question, write "Question X:" followed by the complete question text
- IMPORTANT: Use the ACTUAL question number from the images if visible (e.g., if image shows "Question 5:", use "Question 5:")
- If question number is NOT visible in images, use sequential numbering starting from 1
- Then write "Options:" followed by ALL options (A, B, C, D, etc.) with their complete text
- Then write "Answer:" followed by the answer(s)
- For single answer: "Answer: a"
- For multiple answers: "Answer: a and b" (use "and" not commas)
- You MUST include ALL options for each question - search all images carefully
- You MUST find answers - analyze questions and options to determine correct answer
- Only use "Answer: not visible" if question or ALL options are completely unreadable
- NO explanations for answers
- NO descriptions of images
- NO code blocks
- NO duplicate questions (each question appears only once)
- Merge partial questions and options that are split across images
- PRESERVE original question numbers from images when visible - do NOT renumber them

Do NOT:
- Describe the images or screenshots
- Provide explanations or reasoning for answers
- Show code or calculations
- Include duplicate questions
- Skip options - you must find ALL options for each question
- Give up on finding answers easily - analyze thoroughly
- Add any other text before or after the list

Return ONLY the output in the exact format specified above.`;
        
        const imageParts = images.map(img => convertBase64ToGeminiFormat(img));
        const parts = [
          { text: prompt },
          ...imageParts
        ];
        // Use higher temperature for fallback to avoid RECITATION
        const result = await fallbackModel.generateContent(parts, {
          generationConfig: {
            temperature: 0.8,
            topP: 0.95,
            topK: 40,
          },
        });
        const response = await result.response;
        
        // Check for RECITATION in fallback response
        if (response.candidates && response.candidates[0] && response.candidates[0].finishReason === 'RECITATION') {
          throw new Error('RECITATION detected even with fallback model');
        }
        
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
  if (!analysis) return 'total number of questions : 0\n\nNo questions found.';

  const lines = analysis.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Find the total count line
  let totalCount = 0;
  const totalMatch = analysis.match(/total\s+number\s+of\s+questions\s*:\s*(\d+)/i);
  if (totalMatch) {
    totalCount = parseInt(totalMatch[1], 10);
  }

  // Extract questions in the new format: "Question X: ..." followed by "Options:" and "Answer: ..."
  const questions = [];
  let currentQuestion = null;
  let collectingOptions = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Match "Question X: ..." pattern
    const questionMatch = line.match(/^Question\s+(\d+):\s*(.+)$/i);
    if (questionMatch) {
      // Save previous question if exists
      if (currentQuestion) {
        questions.push(currentQuestion);
      }
      // Start new question
      // Store original number from image, and mark if it's from image or generated
      const questionNumber = parseInt(questionMatch[1], 10);
      currentQuestion = {
        originalNumber: questionNumber, // Original number from image/LLM response
        hasOriginalNumber: true, // Assume it's from image (we'll detect if it's sequential later)
        text: questionMatch[2].trim(),
        options: [],
        answer: null
      };
      collectingOptions = false;
    }
    // Match "Options:" pattern
    else if (currentQuestion && /^Options:?$/i.test(line)) {
      collectingOptions = true;
    }
    // Match option pattern: "A) ..." or "A. ..." or "A ..."
    else if (currentQuestion && collectingOptions && /^[A-Z]\)\s*(.+)$/i.test(line)) {
      const optionMatch = line.match(/^([A-Z])\)\s*(.+)$/i);
      if (optionMatch) {
        currentQuestion.options.push({
          letter: optionMatch[1].toUpperCase(),
          text: optionMatch[2].trim()
        });
      }
    }
    // Match "Answer: ..." pattern
    else if (currentQuestion && /^Answer:\s*(.+)$/i.test(line)) {
      const answerMatch = line.match(/^Answer:\s*(.+)$/i);
      if (answerMatch) {
        currentQuestion.answer = answerMatch[1].trim().toLowerCase();
        collectingOptions = false;
      }
    }
  }
  
  // Add last question if exists
  if (currentQuestion) {
    questions.push(currentQuestion);
  }

  // If no questions found in new format, return as-is
  if (questions.length === 0) {
    return analysis;
  }

  // Remove duplicates based on question text (case-insensitive)
  const uniqueQuestions = [];
  const seenQuestions = new Set();
  
  for (const q of questions) {
    const questionKey = q.text.toLowerCase().trim();
    if (!seenQuestions.has(questionKey)) {
      seenQuestions.add(questionKey);
      uniqueQuestions.push(q);
    }
  }

  // Sort by original question number
  uniqueQuestions.sort((a, b) => a.originalNumber - b.originalNumber);
  
  // Detect if numbers are sequential (1, 2, 3...) - if so, they're likely generated, not from images
  // If numbers are non-sequential (e.g., 5, 7, 10), they're likely original from images
  const numbers = uniqueQuestions.map(q => q.originalNumber);
  const isSequential = numbers.length > 0 && 
    numbers.every((num, idx) => idx === 0 || num === numbers[idx - 1] + 1) &&
    numbers[0] === 1; // Must start from 1 to be considered sequential
  
  // If sequential starting from 1, mark as generated (no original numbers)
  if (isSequential && numbers[0] === 1) {
    uniqueQuestions.forEach(q => {
      q.hasOriginalNumber = false;
    });
  }
  
  // Build summary with original numbers or R-prefixed generated numbers
  const summaryParts = uniqueQuestions.map((q) => {
    const answer = q.answer || 'not visible';
    if (q.hasOriginalNumber) {
      return `${q.originalNumber}(${answer})`;
    } else {
      // Find index for R-prefixed number
      const index = uniqueQuestions.indexOf(q);
      return `R${index + 1}(${answer})`;
    }
  });
  const summary = `Summary: ${summaryParts.join(', ')}`;
  
  // Build output
  const output = [
    `total number of questions : ${uniqueQuestions.length}`,
    '',
    summary,
    ''
  ];
  
  uniqueQuestions.forEach((q, index) => {
    // Use original number if available, otherwise use R-prefixed sequential number
    const questionLabel = q.hasOriginalNumber 
      ? `Question ${q.originalNumber}`
      : `Question R${index + 1}`;
    
    output.push(`${questionLabel}: ${q.text}`);
    if (q.options && q.options.length > 0) {
      output.push('Options:');
      q.options.forEach(opt => {
        output.push(`${opt.letter}) ${opt.text}`);
      });
    }
    output.push(`Answer: ${q.answer || 'not visible'}`);
    output.push(''); // Empty line between questions
  });

  return output.join('\n');
};

