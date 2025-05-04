export interface DefaultQuestion {
  text: string;
  context?: string;
  order: number;
}

export const defaultInterviewQuestions: DefaultQuestion[] = [
  {
    text: "Can you describe the specific challenge you were facing that this support engagement was designed to help you with?",
    context: "We're trying to collect any additional context of the situation and better understand why this specific support was helpful at the time of the request.",
    order: 1
  },
  {
    text: "If you had to rate your experience with your advisor on a scale of 1 to 10, where 1 is poor and 10 is excellent, what would you rate the support from his advisor?",
    context: "We're looking for a quantitative way to measure your experience.",
    order: 2
  },
  {
    text: "Can you describe why that was your answer?",
    context: "We're trying to get a better qualitative awareness of the reasonings behind their ratings.",
    order: 3
  },
  {
    text: "Can you describe the impact that this support has had on you and your business?",
    context: "We're looking for both qualitative and quantitative observations around what specific things have transpired or have they benefited from due to this support.",
    order: 4
  }
]; 