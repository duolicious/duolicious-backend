type AnonymousAnswer = {
  question_id: number
  answer: boolean | null
  public: boolean
};

const anonymousAnswers: AnonymousAnswer[] = [];

const addAnonymousAnswer = (answer: AnonymousAnswer): void => {
  removeAnonymousAnswer(answer.question_id);
  anonymousAnswers.push(answer);
};

const removeAnonymousAnswer = (questionId: number): void => {
  const i = anonymousAnswers.findIndex(a => a.question_id === questionId);
  if (i !== -1) {
    anonymousAnswers.splice(i, 1);
  }
};

const clearAnonymousAnswers = (): void => {
  anonymousAnswers.length = 0;
};

export {
  AnonymousAnswer,
  anonymousAnswers,
  addAnonymousAnswer,
  removeAnonymousAnswer,
  clearAnonymousAnswers,
};
