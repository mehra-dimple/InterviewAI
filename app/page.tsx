"use client";

import Image from "next/image";
import { useRef, useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { v4 as uuidv4 } from "uuid";

import "@/styles/base.css";
import styles from "@/styles/Home.module.css";
import {
  InterviewReqBody,
  InterviewReqBodyEnd,
  InterviewReqBodyInterviewing,
  InterviewReqBodyStart,
  InterviewStatus,
  Message,
} from "@/types/interview";
import { SendIcon, RobotIcon, UserIcon } from "@/components/Icons";
import LoadingDots from "@/components/LoadingDots";
import VoiceInputBox from "@/components/VoiceInputBox";
import {
  PRECONDITION_CONFIG,
  QUESTION_COUNT,
  ROUNDS_FOR_EACH_QUESTION,
} from "@/constants/interviewConfig";
import { INTERVIEW_ID_KEY } from "@/constants/storage";

/**
 * todo:
 * preconditions required | optional
 */
export default function Home() {
  const [interviewStatus, setInterviewStatus] = useState<InterviewStatus>(
    InterviewStatus["start"]
  );
  const [interviewStep, setInterviewStep] = useState<[number, number]>([1, 0]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [messageList, setMessageList] = useState<Partial<Message>[]>([]);
  const [pdfContent, setPdfContent] = useState<File>();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const interviewIdRef = useRef<string>(
    globalThis.sessionStorage?.getItem(INTERVIEW_ID_KEY)!
  );
  const preConditionFormRef = useRef<HTMLFormElement>(null);
  const resumeContentRef = useRef<string>("");
  const messageListRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  const [selectedFileName, setSelectedFileName] = useState<string>("");

  const checkCanAskNextQuestion = useCallback(() => {
    const [questionIndex] = interviewStep;
    return questionIndex <= QUESTION_COUNT - 1;
  }, [interviewStep]);

  const checkCanAskNextRound = useCallback(() => {
    const [, roundIndex] = interviewStep;
    return roundIndex <= ROUNDS_FOR_EACH_QUESTION - 1;
  }, [interviewStep]);

  const updateInterviewStatus = useCallback(() => {
    if (checkCanAskNextRound()) {
      setInterviewStep(([questionIndex, roundIndex]) => [
        questionIndex,
        roundIndex + 1,
      ]);
    } else if (checkCanAskNextQuestion()) {
      setInterviewStep(([questionIndex]) => [questionIndex + 1, 0]);
    }
  }, [checkCanAskNextQuestion, checkCanAskNextRound]);

  const resetInterview = () => {
    setInterviewStatus(InterviewStatus["start"]);
    setInterviewStep([1, 0]);
    setError(null);
    setMessageList([]);
    setPdfContent(undefined);
  };

  const getCandidateInfos = () => {
    if (preConditionFormRef.current) {
      const formData = new FormData(preConditionFormRef.current);

      return {
        jobTitle: `${formData.get("jobTitle")}`,
        workingYear: +formData.get("workingYear")!,
        countryOrRegion: `${formData.get("countryOrRegion")}`,
        resume: resumeContentRef.current,
      };
    } else {
      return {};
    }
  };

  useEffect(() => {
    (async () => {
      if (pdfContent) {
        const formData = new FormData();
        formData.append("file", pdfContent);
        const response = await fetch("/api/pdf/extract", {
          method: "POST",
          body: formData,
        });

        const { text } = await response.json();
        resumeContentRef.current = text;
        console.log("response", text);
      }
    })();
  }, [pdfContent]);

  const addDataToStack = (
    message: Message["message"],
    type: Message["type"]
  ) => {
    setMessageList((state) => [
      ...state,
      {
        type: type as Message["type"],
        message: message,
      },
    ]);
  };

  const validateForm = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!preConditionFormRef.current) return;
    
    const formData = new FormData(preConditionFormRef.current);
    const jobPost = formData.get('jobPost')?.toString().trim();
    
    if (!jobPost) {
      setFormError("Please provide information about the role to start the interview.");
    } else {
      setFormError(null);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const formData = new FormData(preConditionFormRef.current!);
    const jobPost = formData.get('jobPost')?.toString().trim();
    
    if (!jobPost) {
      setFormError("Please provide information about the role to start the interview.");
      return;
    }
    
    handleSubmit();
  };

  /** Handle form submission */
  const handleSubmit = useCallback(
    async (query?: string) => {
      setError(null);

      const data:
        | InterviewReqBodyEnd
        | InterviewReqBodyStart
        | InterviewReqBodyInterviewing = {} as any;

      if (interviewStatus === InterviewStatus["interviewing"]) {
        if (!query) {
          alert("Please input a question");
          return;
        }

        (data as InterviewReqBodyInterviewing).status = interviewStatus;
        (data as InterviewReqBodyInterviewing).interviewStep = interviewStep;
        (data as InterviewReqBodyInterviewing).human = query.trim();

        addDataToStack(
          (data as InterviewReqBodyInterviewing).human,
          "userMessage"
        );
      } else if (interviewStatus === InterviewStatus["start"]) {
        (data as InterviewReqBodyStart).status = interviewStatus;
        (data as InterviewReqBodyInterviewing).interviewStep = interviewStep;
        (data as InterviewReqBodyStart).options = getCandidateInfos();
      } else {
        return;
      }

      setLoading(true);

      try {
        const body: InterviewReqBody = {
          ...data,
        };
        const response = await fetch("/api/interview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Interview-Id": interviewIdRef.current,
          },
          body: JSON.stringify(body),
        });

        const { error, text: answer, end } = await response.json();

        if (error) {
          setError(error);
        } else {
          end
            ? setInterviewStatus(InterviewStatus["end"])
            : setInterviewStatus(InterviewStatus["interviewing"]);
          addDataToStack(answer, "apiMessage");
          updateInterviewStatus();
        }

        setLoading(false);

        /** scroll to bottom */
        messageListRef.current?.scrollTo(
          0,
          messageListRef.current.scrollHeight
        );
      } catch (error) {
        setLoading(false);
        setError(
          "An error occurred while fetching the data. Please try again."
        );
      }
    },
    [updateInterviewStatus, interviewStatus, interviewStep]
  );

  useEffect(() => {
    textAreaRef.current?.focus();

    if (!globalThis.sessionStorage?.getItem(INTERVIEW_ID_KEY)) {
      interviewIdRef.current = uuidv4();
      globalThis.sessionStorage?.setItem(
        INTERVIEW_ID_KEY,
        interviewIdRef.current
      );
    }
  }, []);

  const handleEnter = (e: any) => {
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key == "Enter") {
      e.preventDefault();
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf') {
        setPdfContent(file);
        setSelectedFileName(file.name);
      } else {
        alert('Please upload a PDF file');
      }
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf') {
        setPdfContent(file);
        setSelectedFileName(file.name);
      } else {
        alert('Please upload a PDF file');
      }
    }
  };

  return (
    <main className={styles.main}>
      {interviewStatus !== InterviewStatus["start"] ? (
        <>
          {interviewStatus === InterviewStatus["end"] && (
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill} 
                style={{ 
                  width: `${(interviewStep[0] / QUESTION_COUNT) * 100}%`,
                  backgroundColor: '#4ade80'
                }}
              />
              <span className={styles.progressText}>
                Question {interviewStep[0]} of {QUESTION_COUNT} (Complete)
              </span>
            </div>
          )}
          <div className={`${styles.cloud} border-slate-300`}>
            <div className={styles.messagelist}>
              <div className={styles.messages} ref={messageListRef}>
                {messageList.map((message, index) => {
                  const isQuestion = message.type === "apiMessage";
                  const isAnswer = message.type === "userMessage";
                  const isLastMessage = index === messageList.length - 1;
                  const shouldShowInput = isQuestion && isLastMessage && interviewStatus === InterviewStatus["interviewing"];
                  
                  return (
                    <div key={`message-${index}`}>
                      {isQuestion && (
                        <div className={styles.apimessage}>
                          <div className="flex justify-center items-center shrink-0 w-10 h-10 mr-4">
                            <RobotIcon />
                          </div>
                          <div className={styles.markdownanswer}>
                            <ReactMarkdown linkTarget="_blank">
                              {message.message!}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}
                      
                      {isAnswer && (
                        <div className={loading && index === messageList.length - 1 ? styles.usermessagewaiting : styles.usermessage}>
                          <div className="flex justify-center items-center shrink-0 w-10 h-10 mr-4">
                            <UserIcon />
                          </div>
                          <div className={styles.markdownanswer}>
                            <ReactMarkdown linkTarget="_blank">
                              {message.message!}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}

                      {loading && isLastMessage && isAnswer && (
                        <div className={styles.apimessage}>
                          <div className="flex justify-center items-center shrink-0 w-10 h-10 mr-4">
                            <RobotIcon />
                          </div>
                          <div className={styles.markdownanswer}>
                            <div className="flex items-center">
                              <span className="mr-2">Thinking</span>
                              <LoadingDots color="#4B5563" style="small" />
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {shouldShowInput && (
                        <div className={styles.cloudform}>
                          <form onSubmit={(e) => e.preventDefault()}>
                            <VoiceInputBox 
                              isLoading={loading} 
                              onSend={handleSubmit} 
                            />
                          </form>
                        </div>
                      )}
                    </div>
                  );
                })}

                {interviewStatus === InterviewStatus["end"] && (
                  <div className={styles.cloudform}>
                    <button
                      disabled={loading}
                      onClick={resetInterview}
                      className={styles.preConditionConfirm}
                    >
                      End
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <form
          ref={preConditionFormRef}
          onSubmit={handleFormSubmit}
          className={styles.preCondition}
        >
          <h2>
            Provide the information below to help the assistant tailor questions specifically for you.
          </h2>
          {Object.keys(PRECONDITION_CONFIG).map((key) => {
            const config = PRECONDITION_CONFIG[key];
            return (
              <div className={styles.preConditionItem} key={key}>
                <label htmlFor={key}>
                  {config.name}
                  {!config.required && <span className="text-[#e2e8f0] ml-2">(Optional)</span>}
                </label>
                {config.type === "textarea" ? (
                  <textarea
                    name={key}
                    id={key}
                    placeholder={(config.placeholder as string) || ""}
                    className={`${styles.textarea} ${key === 'jobPost' && formError ? 'border-red-500' : ''}`}
                    rows={5}
                    onChange={validateForm}
                    required={config.required as boolean}
                  />
                ) : (
                  <input
                    name={key}
                    id={key}
                    type={config.type}
                    placeholder={(config.placeholder as string) || ""}
                    required={config.required as boolean}
                  />
                )}
              </div>
            );
          })}
          
          {formError && (
            <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
              {formError}
            </div>
          )}
          
          <div className={styles.preConditionItem}>
            <label htmlFor="resumeUpload">Resume (Optional)</label>
            <div
              className={`${styles.customFileInput} ${isDragging ? styles.dragActive : ''} ${selectedFileName ? styles.hasFile : ''}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                id="resumeUpload"
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <div className={styles.uploadContent} onClick={() => fileInputRef.current?.click()}>
                {selectedFileName ? (
                  <>
                    <p className="text-green-600 font-medium">{selectedFileName}</p>
                    <p className="text-sm text-gray-500 mt-1">Click to change file</p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-600 font-medium">Drag and drop your resume here or click to select</p>
                    <p className="text-sm text-gray-500 mt-1">Accepted format: PDF (.pdf)</p>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <button
            type="submit"
            className={styles.preConditionConfirm}
            disabled={loading}
          >
            Start Interview
          </button>
        </form>
      )}
      {error && (
        <div className="border border-red-400 rounded-md p-4">
          <p className="text-red-500">{error}</p>
        </div>
      )}
    </main>
  );
}
