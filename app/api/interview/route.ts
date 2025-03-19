import { NextResponse } from "next/server";
import { createClient } from "redis";
import { BufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";
import { RedisChatMessageHistory } from "@langchain/community/stores/message/redis";
import { ChatPromptTemplate, HumanMessagePromptTemplate } from "@langchain/core/prompts";
import { ChatAnthropic } from "@langchain/anthropic";
import { candidateInfo, InterviewReqBody } from "@/types/interview";
import {
  startFollowUpQuestion,
  startNextQuestion,
  EndInterview,
  askForEvaluation,
} from "@/prompts/followUp";
import { aiRole, askingArt, userDefaultKickOff } from "@/prompts/precondition";
import {
  QUESTION_COUNT,
  ROUNDS_FOR_EACH_QUESTION,
} from "@/constants/interviewConfig";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const chat = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
});

const client = createClient({
  url: REDIS_URL,
});

const prompt = ChatPromptTemplate.fromMessages([
  HumanMessagePromptTemplate.fromTemplate(aiRole),
  HumanMessagePromptTemplate.fromTemplate(askingArt),
]);

const checkCanAskNextQuestion = (interviewStep: [number, number]) => {
  const [questionIndex] = interviewStep;
  return questionIndex <= QUESTION_COUNT - 1;
};

const checkCanAskNextRound = (interviewStep: [number, number]) => {
  const [, roundIndex] = interviewStep;
  return roundIndex <= ROUNDS_FOR_EACH_QUESTION - 1;
};

const checkIsLastQuestionLastRound = (interviewStep: [number, number]) => {
  const [questionIndex, roundIndex] = interviewStep;
  return (
    questionIndex === QUESTION_COUNT &&
    roundIndex === ROUNDS_FOR_EACH_QUESTION
  );
};

const getCandidateInfos = (options: candidateInfo) => {
  const { jobPost, companyProfile, resume } = options || {};
  return (
    `${aiRole} ${askingArt}
    ${userDefaultKickOff}` +
    (jobPost ? `Here is the job post document: <content>${jobPost}</content> ` : "") +
    (companyProfile ? `Here is the company profile: <content>${companyProfile}</content> ` : "") +
    (resume
      ? `Here is my resume in <content> tags: <content>${resume}</content>`
      : "")
  );
};

export async function POST(request: Request) {
  const req: InterviewReqBody = await request.json();

  try {
    const bufferMemory = new BufferMemory({
      inputKey: "humanInput",
      returnMessages: true,
      chatHistory: new RedisChatMessageHistory({
        sessionId:
          request.headers.get("Interview-Id") || new Date().toISOString(),
        sessionTTL: 300,
        client,
      }),
    });

    const chain = new ConversationChain({
      memory: bufferMemory,
      prompt: ChatPromptTemplate.fromPromptMessages([
        HumanMessagePromptTemplate.fromTemplate("{humanInput}"),
      ]),
      llm: chat,
    });

    let res: string = '';
    let end = false;
    if (req.status === "start") {
      res = (await chain.call({ humanInput: getCandidateInfos(req.options) }))
        ?.response;
    } else if (req.status === "interviewing") {
      let humanInput = `This is my answer: <answer>${req.human}</answer>. `;
      let askingTips = `(REMEMBER: <tip>${askingArt}</tip>)`;
      if (checkCanAskNextRound(req.interviewStep)) {
        humanInput += `${startFollowUpQuestion} ${askingTips}`;
      } else if (checkCanAskNextQuestion(req.interviewStep)) {
        humanInput += `${startNextQuestion} ${askingTips}`;
      } else if (checkIsLastQuestionLastRound(req.interviewStep)) {
        humanInput += `${EndInterview} ${askForEvaluation}`;
        end = true;
      }
      res = (await chain.call({ humanInput }))?.response;
    }
    return NextResponse.json({ error: "", text: res, end });
  } catch (error) {
    console.log(error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      text: "",
      end: false 
    }, { status: 500 });
  }
}
