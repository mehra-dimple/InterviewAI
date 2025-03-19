/**
 * @Note
 * In a interview,
 * there would be ${QUESTION_COUNT} questions,
 * and each question has ${ROUNDS_FOR_EACH_QUESTION} rounds.
 */
export const QUESTION_COUNT = 1;
export const ROUNDS_FOR_EACH_QUESTION = 2;
export const PRECONDITION_CONFIG: {
  [key: string]: { name: string; type: string; [key: string]: unknown };
} = {
  jobPost: {
    name: "About the Role",
    type: "textarea",
    required: true,
    placeholder: "Paste the job post document here (title, description, requirements)...",
  },
  companyProfile: {
    name: "About the Company",
    type: "textarea",
    required: false,
    placeholder: "Paste the company profile here (mission, vision, core values)... (Optional)",
  },
};
