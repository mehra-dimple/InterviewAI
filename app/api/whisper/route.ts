import { NextResponse } from "next/server";

const whisperApiEndpoint = "https://api.openai.com/v1/audio/transcriptions";
const apiKey = process.env.OPENAI_API_KEY;

export async function POST(request: Request) {
  try {
    console.log("Received Whisper API request");
    
    if (!apiKey) {
      console.error("OpenAI API key is not configured");
      throw new Error("OpenAI API key is not configured");
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const model = formData.get("model") as string;

    console.log("Request details:", {
      model,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type
    });

    if (!file) {
      console.error("No audio file provided in request");
      throw new Error("No audio file provided");
    }

    // Create a new FormData instance for OpenAI
    const openAIFormData = new FormData();
    openAIFormData.append("file", file);
    openAIFormData.append("model", model);
    openAIFormData.append("language", "en");

    console.log("Sending request to OpenAI Whisper API...");
    const res = await fetch(whisperApiEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: openAIFormData,
    });

    if (!res.ok) {
      const error = await res.json();
      console.error("OpenAI API error response:", error);
      throw new Error(error.error?.message || "Failed to transcribe audio");
    }

    const data = await res.json();
    console.log("Whisper transcription result:", {
      text: data.text,
      textLength: data.text?.length || 0
    });

    return NextResponse.json({ text: data.text });
  } catch (error) {
    console.error("Whisper API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to transcribe audio" },
      { status: 500 }
    );
  }
}
