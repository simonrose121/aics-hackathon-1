
const OpenAI = require('openai');
const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");
require('dotenv').config()

const fs = require('fs');

const data = fs.readFileSync('./combined_2013.json', 'utf8');
const jsonData = JSON.parse(data);


const openAIClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // This is the default and can be omitted
});

const awsBedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

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
            "type": "terms",
            "field_name": "tags",
            "values": ["Key Stage 2"]
          },
          {
            "type": "hierarchical_match",
            "field_name": "taxonomy",
            "value": "english.english.writing.vocabulary_grammar_and_punctuation"
          },
        ],
        "should": [
          {
            "type": "terms",
            "field_name": "year_group",
            "values": ["Year 5"]
          },
          {
            "type": "terms",
            "field_name": "year_group",
            "values": ["Year 6"]
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

async function chatCompletion(prompt) {
  return await openAIInvoke(prompt);
}

const openAIInvoke = async (prompt) => {
  const completion = await openAIClient.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'gpt-4o',
  });

  return completion.choices[0].message.content;
}

// Function to invoke the model
const invokeModel = async (prompt) => {
  const messages = [
    {
      "role": "user",
      "content": [{ "type": "text", "text": prompt }],
    }
  ]

  const modelId = "anthropic.claude-3-haiku-20240307-v1:0"; // Adjust based on available models

  // Structure the payload to fit the Messages API
  const input = {
    anthropic_version: "bedrock-2023-05-31",
    messages: messages,
    max_tokens: 1024,
  };

  const params = {
    modelId: modelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(input),
  };

  try {
    const command = new InvokeModelCommand(params);
    const response = await awsBedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    // console.log(responseBody);
    return responseBody.content[0].text;
  } catch (error) {
    console.error("Error invoking model:", error);
  }
};

async function main() {
  const sta = await fetchSTAStandards();
  const nc = await fetchNationalCurriculum();

  // console.log('STA Standards:', sta.results);
  // console.log('National Curriculum:', nc.results);

  const noCSPrompt = `Can you generate me an exam booklets worth of novel practice SATS questions for key stage 2 English Grammar punctuation and spelling?

    Structure it as an exam-style format, including multiple-choice, short-answer, and applied-writing questions.`

  const csPrompt = `
      Generate practice SATs exam questions for key stage 2 English grammar punctuation and spelling questions based on the following the Standards and Testing Agency guidance:
      ${JSON.stringify(sta.results)}

      Focusing specifically on the 'content' fields of the elements, and ensuring that the questions are designed to help students prepare for the SATs exams.

      To meet the following National Curriculum standards:
      ${JSON.stringify(nc.results)}

      Focusing on the 'content' fields of the elements, and taxonomies that are relevant to grammar, punctuation and spelling.

      Structure it as an exam-style format, including multiple-choice, short-answer, and applied-writing questions.
  `;

  const csWithExamplesPrompt = `
      Generate practice SATs exam questions for key stage 2 English grammar punctuation and spelling questions based on the following content:
      ${JSON.stringify(jsonData)}

      For the Standards and Testing Agency guidance:
      ${JSON.stringify(sta.results)}

      Focusing specifically on the 'content' fields of the elements, and ensuring that the questions are designed to help students prepare for the SATs exams.

      To meet the following National Curriculum standards:
      ${JSON.stringify(nc.results)}

      Focusing on the 'content' fields of the elements, and taxonomies that are relevant to grammar, punctuation and spelling.

      Structure it as an exam-style format, including multiple-choice, short-answer, and applied-writing questions.
    `

  console.log("-------NOT USING CONTENT STORE-------")
  const notContentStoreResponse = await chatCompletion(noCSPrompt)
  console.log(notContentStoreResponse);
  console.log("-------------------------------------")

  console.log("-------USING CONTENT STORE-------")
  const contentStoreResponse = await chatCompletion(csPrompt)
  console.log(contentStoreResponse);
  console.log("-------------------------------------")

  console.log("-------USING CONTENT STORE AND EXAMPLES-------")
  const contentWithExamplesStoreResponse = await chatCompletion(csWithExamplesPrompt)
  console.log(contentWithExamplesStoreResponse);
  console.log("-------------------------------------")

  const comparisonPromptUsingCS = `
      Evaluate and compare these sets of questions.

      Identify any gaps in coverage and provide suggestions for improvement based on the Standards and Testing Agency guidance:
      ${JSON.stringify(sta.results)}

      And these National Curriculum standards:
      ${JSON.stringify(nc.results)}

      Score them both out of 100 for:
      - Coverage of the National Curriculum for English grammar, punctuation and spelling for years 5 and 6, focusing on the 'content' field of the elements.
      - Aligned with the word, sentence, and text level objectives for grammar, punctuation, and spelling in the National Curriculum.
      - Does it make reference to the spelling appendix for the National Curriculum?
      - Specific elements of the Standards and Testing Agency guidance, focusing on the elements with 'content_domain_references' field of G1.* to G7.* and S*.

      Your justification should be concise, precise, and directly support your evaluation.

      And give a total average score.

      Present it in a table with 3 rows and 2 columns, with the first row being the Option A and the second row being Option B and the third row being Option C and the respective average scores in the second column. Do not include an average score row in this table.

      Option C
      ${notContentStoreResponse}

      Option B
      ${contentStoreResponse}

      Option A
      ${contentWithExamplesStoreResponse}
    `

  console.log("-------COMPARISON USING CS-------")
  console.log(await chatCompletion(comparisonPromptUsingCS));
  console.log("-------------------------------------")

  // const comparisonPromptNotUsingCS = `
  //   Evaluate and compare these two sets of questions for key stage 2 English grammar, punctuation and spelling practice SATs exams.

  //   Identify any gaps in coverage and provide suggestions for improvement based on the Standards and Testing Agency guidance.

  //   And the National Curriculum standards for Key Stage 2 English grammar, punctuation and spelling.

  //   Score them both out of 100 for:
  //   - Coverage of the National Curriculum for English grammar, punctuation and spelling for years 5 and 6.
  //   - Specific elements of the Standards and Testing Agency guidance.

  //   Your justification should be concise, precise, and directly support your evaluation.

  //   And give a total average score.

  //   Present it in a table with 2 rows and 2 columns, with the first row being the Option A and the second row being Option B and the respective average scores in the second column. Do not include an average score row in this table.

  //   Option A
  //   ${contentStoreResponse}

  //   Option B
  //   ${notContentStoreResponse}

  //   Now go back and evaluate your own reasoning and reevaluate the scores, presenting them in the same table format.
  // `

  // console.log("-------COMPARISON NOT USING CS-------")
  // console.log(await chatCompletion(comparisonPromptNotUsingCS));
  // console.log("-------------------------------------")
}

main();

