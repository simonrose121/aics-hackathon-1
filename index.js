
const OpenAI = require('openai');
require('dotenv').config()

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // This is the default and can be omitted
});

const headers = {
  "Content-Type": "application/json",
  "Ocp-Apim-Subscription-Key": process.env.API_KEY
}

const fetchSTAStandards = async () => {
  try {
    const response = await fetch("https://pp-api.education.gov.uk/dev/aiecs-public-api/elements/search", {
      method: "POST",
      headers,
      body: JSON.stringify({
        "type": "bool",
        "must": [
          {
            "type": "hierarchical_match",
            "field_name": "taxonomy",
            "value": "english.grammar_punctuation_and_spelling.*",
          },
          {
            "type": "terms",
            "field_name": "tags",
            "values": ["Key Stage 2"]
          }
        ],
        "pagination": {
          "limit": 100,
          "offset": 0
        }
      })
    });
    return response.json();

    // console.log(data);
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

const fetchNationalCurriculum = async () => {
  try {
    const response = await fetch("https://pp-api.education.gov.uk/dev/aiecs-public-api/elements/search", {
      method: "POST",
      headers,
      body: JSON.stringify({
        "type": "bool",
        "must": [
          {
            "type": "hierarchical_match",
            "field_name": "taxonomy",
            "value": "*{1}.english.*"
          },
          {
            "type": "terms",
            "field_name": "tags",
            "values": ["Key Stage 2"]
          },
        ],
        "pagination": {
          "limit": 100,
          "offset": 0
        }
      })
    });
    return response.json();

    // console.log(data);
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

async function main() {
  const sta = await fetchSTAStandards();
  const nc = await fetchNationalCurriculum();

  const prompt = `
    Generate practice SATs exam questions for key stage 2 English grammar punctuation and spelling questions based on the following content:
    ${JSON.stringify(sta)}

    Focusing specifically on the 'content' fields of the elements, and ensuring that the questions are designed to help students prepare for the SATs exams.

    To meet the following National Curriculum standards:
    ${JSON.stringify(nc)}

    Focusing on the 'content' fields of the elements, and taxonomies that are relevant to grammar, punctuation and spelling.

    Structure it as an exam-style format, including multiple-choice, short-answer, and applied-writing questions.
  `

  const noCSPrompt = `Can you generate me an exam booklets worth of novel practice SATS questions for key stage 2 English Grammar punctuation and spelling that cover the requirements of the Key Stage 2 curriculum English framework and the teacher assessment frameworks from the Standards and Testing Agency?

  Structure it as an exam-style format, including multiple-choice, short-answer, and applied-writing questions.`

  // structure of outputs

  const chatCompletion = await client.chat.completions.create({
    messages: [{ role: 'user', content: noCSPrompt }],
    model: 'gpt-4o',
  });

  console.log("-------NOT USING CONTENT STORE-------")
  console.log(chatCompletion.choices[0].message.content);
  console.log("-------------------------------------")

  const chatCompletion2 = await client.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'gpt-4o',
  });

  console.log("-------USING CONTENT STORE-------")
  console.log(chatCompletion2.choices[0].message.content);
  console.log("-------------------------------------")

  const comparisonPrompt = `
    Compare the two responses based on the Standards and Testing Agency guidance:
    ${JSON.stringify(sta)}

    Identify any gaps in coverage and provide suggestions for improvement.

    Score them both out of 100 for coverage, accuracy, and relevance.

    Not using content store:
    ${chatCompletion.choices[0].message.content}
    
    Using content store:
    ${chatCompletion2.choices[0].message.content}
  `

  const chatCompletion3 = await client.chat.completions.create({
    messages: [{ role: 'user', content: comparisonPrompt }],
    model: 'gpt-4o',
  });

  console.log(chatCompletion3.choices[0].message.content);
}

main();

